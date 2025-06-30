"""
Plugin Loader for ALEJO
Dynamically discovers and loads plugins from the plugins directory
with support for versioning, dependency management, and metadata validation
"""
import os
import sys
import importlib
import inspect
import logging
import json
import re
import importlib.metadata
from dataclasses import dataclass, field
from typing import Dict, Any, Callable, List, Optional, Set, Tuple, Union
from pathlib import Path
from packaging import version

logger = logging.getLogger(__name__)

@dataclass
class PluginMetadata:
    """Metadata for a plugin"""
    name: str
    version: str = "0.1.0"
    description: str = ""
    author: str = ""
    dependencies: Dict[str, str] = field(default_factory=dict)
    requires_alejo_version: str = "0.1.0"
    tags: List[str] = field(default_factory=list)
    enabled: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "dependencies": self.dependencies,
            "requires_alejo_version": self.requires_alejo_version,
            "tags": self.tags,
            "enabled": self.enabled
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PluginMetadata':
        """Create from dictionary"""
        return cls(
            name=data.get("name", ""),
            version=data.get("version", "0.1.0"),
            description=data.get("description", ""),
            author=data.get("author", ""),
            dependencies=data.get("dependencies", {}),
            requires_alejo_version=data.get("requires_alejo_version", "0.1.0"),
            tags=data.get("tags", []),
            enabled=data.get("enabled", True)
        )
        
    def is_compatible_with_alejo(self, alejo_version: str) -> bool:
        """Check if plugin is compatible with ALEJO version"""
        try:
            return version.parse(alejo_version) >= version.parse(self.requires_alejo_version)
        except Exception as e:
            logger.warning(f"Failed to parse version: {e}")
            return True  # Default to compatible if version parsing fails

class PluginLoader:
    """
    Dynamic plugin loader that discovers and loads plugins from specified directories.
    Supports both module-level plugins and class-based plugins with versioning,
    dependency management, and metadata validation.
    """
    
    def __init__(self, plugin_dirs: Optional[List[str]] = None, alejo_version: str = "0.1.0"):
        """
        Initialize the plugin loader.
        
        Args:
            plugin_dirs: List of directories to search for plugins. If None, defaults to 'plugins' directory.
            alejo_version: Current ALEJO version for compatibility checking
        """
        self.plugin_dirs = plugin_dirs or [os.path.join(os.path.dirname(__file__), 'plugins')]
        self.discovered_plugins: Dict[str, Any] = {}
        self.plugin_metadata: Dict[str, PluginMetadata] = {}
        self.alejo_version = alejo_version
        self.dependency_graph: Dict[str, Set[str]] = {}  # plugin -> dependencies
        self.reverse_dependency_graph: Dict[str, Set[str]] = {}  # plugin -> dependents
        
        # Create metadata directory if it doesn't exist
        self.metadata_dir = os.path.join(os.path.dirname(__file__), 'plugins', '.metadata')
        os.makedirs(self.metadata_dir, exist_ok=True)
        
    def discover_plugins(self) -> Dict[str, Any]:
        """
        Discover all available plugins in the plugin directories.
        
        Returns:
            Dictionary mapping plugin names to plugin objects/functions
        """
        # Clear existing data
        self.discovered_plugins = {}
        self.plugin_metadata = {}
        self.dependency_graph = {}
        self.reverse_dependency_graph = {}
        
        # Discover plugins in all directories
        for plugin_dir in self.plugin_dirs:
            if not os.path.exists(plugin_dir):
                os.makedirs(plugin_dir, exist_ok=True)
                logger.info(f"Created plugin directory: {plugin_dir}")
                continue
                
            self._discover_in_directory(plugin_dir)
        
        # Build dependency graph
        self._build_dependency_graphs()
        
        # Sort plugins by dependencies
        sorted_plugins = self._sort_plugins_by_dependencies()
        
        # Reorder discovered plugins based on dependency order
        ordered_plugins = {}
        for name in sorted_plugins:
            if name in self.discovered_plugins:
                ordered_plugins[name] = self.discovered_plugins[name]
        
        self.discovered_plugins = ordered_plugins
        return self.discovered_plugins
    
    def _discover_in_directory(self, directory: str) -> None:
        """
        Discover plugins in a specific directory.
        
        Args:
            directory: Directory to search for plugins
        """
        # Add directory to path if not already there
        if directory not in sys.path:
            sys.path.insert(0, directory)
            
        for item in os.listdir(directory):
            if item.startswith('__'):
                continue
                
            path = os.path.join(directory, item)
            
            # Handle Python files
            if item.endswith('.py'):
                module_name = item[:-3]  # Remove .py extension
                self._load_plugin_module(module_name)
                
            # Handle directories that might be packages
            elif os.path.isdir(path) and os.path.exists(os.path.join(path, '__init__.py')):
                self._load_plugin_module(item)
    
    def _load_plugin_module(self, module_name: str) -> None:
        """
        Load a plugin module and extract its plugins.
        
        Args:
            module_name: Name of the module to load
        """
        try:
            module = importlib.import_module(module_name)
            
            # Extract metadata
            plugin_name = getattr(module, 'PLUGIN_NAME', module_name)
            plugin_version = getattr(module, 'PLUGIN_VERSION', '0.1.0')
            plugin_description = getattr(module, 'PLUGIN_DESCRIPTION', '')
            plugin_author = getattr(module, 'PLUGIN_AUTHOR', '')
            plugin_dependencies = getattr(module, 'PLUGIN_DEPENDENCIES', {})
            plugin_requires_alejo = getattr(module, 'PLUGIN_REQUIRES_ALEJO', '0.1.0')
            plugin_tags = getattr(module, 'PLUGIN_TAGS', [])
            
            # Create metadata object
            metadata = PluginMetadata(
                name=plugin_name,
                version=plugin_version,
                description=plugin_description,
                author=plugin_author,
                dependencies=plugin_dependencies,
                requires_alejo_version=plugin_requires_alejo,
                tags=plugin_tags
            )
            
            # Check compatibility with ALEJO version
            if not metadata.is_compatible_with_alejo(self.alejo_version):
                logger.warning(f"Plugin {plugin_name} v{plugin_version} requires ALEJO v{plugin_requires_alejo} but current version is {self.alejo_version}. Skipping.")
                return
                
            # Save metadata
            self.plugin_metadata[plugin_name] = metadata
            self._save_plugin_metadata(plugin_name, metadata)
            
            # Check if module has a register function
            if hasattr(module, 'register'):
                self.discovered_plugins[plugin_name] = module.register
                logger.info(f"Discovered plugin with register function: {plugin_name} v{plugin_version}")
                return
                
            # Look for plugin classes
            for name, obj in inspect.getmembers(module):
                # Skip if it's not a class or is imported from elsewhere
                if not inspect.isclass(obj) or obj.__module__ != module.__name__:
                    continue
                    
                # Check if class has required plugin methods
                if hasattr(obj, 'execute') or hasattr(obj, 'process'):
                    self.discovered_plugins[plugin_name] = obj()
                    logger.info(f"Discovered plugin class: {plugin_name} v{plugin_version}")
                    break
                    
        except Exception as e:
            logger.error(f"Error loading plugin module {module_name}: {str(e)}", exc_info=True)
            
    def _build_dependency_graphs(self) -> None:
        """Build dependency graphs for all plugins"""
        # Initialize graphs
        for name in self.plugin_metadata:
            if name not in self.dependency_graph:
                self.dependency_graph[name] = set()
            if name not in self.reverse_dependency_graph:
                self.reverse_dependency_graph[name] = set()
                
        # Fill in dependencies
        for name, metadata in self.plugin_metadata.items():
            for dep_name, dep_version in metadata.dependencies.items():
                if dep_name in self.plugin_metadata:
                    # Add dependency relationship
                    self.dependency_graph[name].add(dep_name)
                    
                    # Add reverse dependency relationship
                    if dep_name not in self.reverse_dependency_graph:
                        self.reverse_dependency_graph[dep_name] = set()
                    self.reverse_dependency_graph[dep_name].add(name)
                    
                    # Check version compatibility
                    if not self._is_version_compatible(
                        self.plugin_metadata[dep_name].version, 
                        dep_version
                    ):
                        logger.warning(
                            f"Plugin {name} requires {dep_name} version {dep_version} but found version {self.plugin_metadata[dep_name].version}"
                        )
                else:
                    logger.warning(f"Plugin {name} depends on {dep_name} which was not found")
                    
    def _is_version_compatible(self, actual_version: str, required_version: str) -> bool:
        """Check if actual version satisfies required version constraint"""
        try:
            # Handle different version requirement formats
            if required_version.startswith('>='):
                req_version = required_version[2:]
                return version.parse(actual_version) >= version.parse(req_version)
            elif required_version.startswith('>'):
                req_version = required_version[1:]
                return version.parse(actual_version) > version.parse(req_version)
            elif required_version.startswith('<='):
                req_version = required_version[2:]
                return version.parse(actual_version) <= version.parse(req_version)
            elif required_version.startswith('<'):
                req_version = required_version[1:]
                return version.parse(actual_version) < version.parse(req_version)
            elif required_version.startswith('=='):
                req_version = required_version[2:]
                return version.parse(actual_version) == version.parse(req_version)
            elif required_version.startswith('!='):
                req_version = required_version[2:]
                return version.parse(actual_version) != version.parse(req_version)
            else:
                # Default to exact match
                return version.parse(actual_version) == version.parse(required_version)
        except Exception as e:
            logger.warning(f"Failed to compare versions {actual_version} and {required_version}: {e}")
            return True  # Default to compatible if version parsing fails
            
    def _sort_plugins_by_dependencies(self) -> List[str]:
        """
        Sort plugins based on dependencies using topological sort.
        Plugins with no dependencies come first.
        """
        result = []
        visited = set()
        temp_visited = set()
        
        def visit(plugin_name: str) -> None:
            if plugin_name in temp_visited:
                logger.warning(f"Circular dependency detected involving {plugin_name}")
                return
            if plugin_name in visited:
                return
                
            temp_visited.add(plugin_name)
            
            # Visit all dependencies first
            for dep in self.dependency_graph.get(plugin_name, set()):
                visit(dep)
                
            temp_visited.remove(plugin_name)
            visited.add(plugin_name)
            result.append(plugin_name)
            
        # Visit all plugins
        for plugin_name in self.plugin_metadata:
            if plugin_name not in visited:
                visit(plugin_name)
                
        return result
        
    def _save_plugin_metadata(self, plugin_name: str, metadata: PluginMetadata) -> None:
        """Save plugin metadata to disk"""
        try:
            metadata_path = os.path.join(self.metadata_dir, f"{plugin_name}.json")
            with open(metadata_path, 'w') as f:
                json.dump(metadata.to_dict(), f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save metadata for plugin {plugin_name}: {e}")
            
    def _load_plugin_metadata(self, plugin_name: str) -> Optional[PluginMetadata]:
        """Load plugin metadata from disk"""
        try:
            metadata_path = os.path.join(self.metadata_dir, f"{plugin_name}.json")
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    data = json.load(f)
                    return PluginMetadata.from_dict(data)
        except Exception as e:
            logger.warning(f"Failed to load metadata for plugin {plugin_name}: {e}")
        return None
        
    def get_plugin_metadata(self, plugin_name: str) -> Optional[PluginMetadata]:
        """Get metadata for a specific plugin"""
        if plugin_name in self.plugin_metadata:
            return self.plugin_metadata[plugin_name]
        return self._load_plugin_metadata(plugin_name)
        
    def get_all_plugin_metadata(self) -> Dict[str, PluginMetadata]:
        """Get metadata for all plugins"""
        return self.plugin_metadata
        
    def get_plugins_by_tag(self, tag: str) -> List[str]:
        """Get all plugins with a specific tag"""
        return [name for name, metadata in self.plugin_metadata.items() 
                if tag in metadata.tags]
                
    def get_plugin_dependents(self, plugin_name: str) -> Set[str]:
        """Get all plugins that depend on the specified plugin"""
        return self.reverse_dependency_graph.get(plugin_name, set())
        
    def register_with_registry(self, registry) -> int:
        """
        Register all discovered plugins with the provided registry.
        
        Args:
            registry: The plugin registry to register plugins with
            
        Returns:
            Number of plugins registered
        """
        if not self.discovered_plugins:
            self.discover_plugins()
            
        count = 0
        for name, plugin in self.discovered_plugins.items():
            try:
                # Skip disabled plugins
                if name in self.plugin_metadata and not self.plugin_metadata[name].enabled:
                    logger.info(f"Skipping disabled plugin: {name}")
                    continue
                    
                # Register the plugin
                plugin_instance = plugin() if callable(plugin) else plugin
                registry.register_plugin(name, plugin_instance)
                count += 1
                
                # Log metadata
                if name in self.plugin_metadata:
                    metadata = self.plugin_metadata[name]
                    logger.info(f"Registered plugin: {name} v{metadata.version} - {metadata.description}")
                else:
                    logger.info(f"Registered plugin: {name}")
                    
            except Exception as e:
                logger.error(f"Failed to register plugin {name}: {str(e)}", exc_info=True)
                
        return count
