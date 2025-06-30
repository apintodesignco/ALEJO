# ALEJO Plugin Development Guide

## Overview

This guide provides comprehensive instructions for developing plugins for the ALEJO system. Plugins extend ALEJO's functionality by adding new capabilities that can be dynamically loaded and integrated with the core system.

## Plugin Structure

An ALEJO plugin can be implemented in two ways:

1. **Module-level plugin**: A Python module with a `register` function
2. **Class-based plugin**: A Python class with `execute` or `process` methods

### Basic Plugin Structure

```python
"""
Example Plugin for ALEJO
Description of what the plugin does
"""
import logging

# Plugin metadata (required)
PLUGIN_NAME = "example_plugin"
PLUGIN_VERSION = "1.0.0"
PLUGIN_DESCRIPTION = "Description of what this plugin does"
PLUGIN_AUTHOR = "Your Name"
PLUGIN_DEPENDENCIES = {"other_plugin": ">=1.0.0"}
PLUGIN_REQUIRES_ALEJO = "0.1.0"
PLUGIN_TAGS = ["category1", "category2"]

logger = logging.getLogger(__name__)

# For module-level plugins
def register():
    """
    Register the plugin with ALEJO.
    Returns a callable that will be invoked when the plugin is used.
    """
    return process_data

def process_data(data):
    """
    Process the data and return the result.
    """
    # Plugin implementation
    return processed_data

# For class-based plugins
class ExamplePlugin:
    """
    Example plugin class
    """
    def __init__(self):
        """
        Initialize the plugin
        """
        pass
        
    def execute(self, *args, **kwargs):
        """
        Execute the plugin functionality
        """
        # Plugin implementation
        return result
```

## Plugin Metadata

All plugins must include the following metadata fields:

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `PLUGIN_NAME` | `str` | Unique identifier for the plugin | Yes |
| `PLUGIN_VERSION` | `str` | Version of the plugin using semantic versioning (e.g., "1.0.0") | Yes |
| `PLUGIN_DESCRIPTION` | `str` | Brief description of the plugin's functionality | Yes |
| `PLUGIN_AUTHOR` | `str` | Author or organization that created the plugin | Yes |
| `PLUGIN_DEPENDENCIES` | `Dict[str, str]` | Dictionary mapping plugin names to version requirements | No |
| `PLUGIN_REQUIRES_ALEJO` | `str` | Minimum ALEJO version required | No |
| `PLUGIN_TAGS` | `List[str]` | Categories or tags for the plugin | No |

### Version Requirements

Version requirements in `PLUGIN_DEPENDENCIES` support the following formats:

- `"1.0.0"`: Exact version match
- `">=1.0.0"`: Greater than or equal to version
- `">1.0.0"`: Greater than version
- `"<=1.0.0"`: Less than or equal to version
- `"<1.0.0"`: Less than version
- `"==1.0.0"`: Exact version match
- `"!=1.0.0"`: Not equal to version

## Plugin Loading Process

1. The `PluginLoader` discovers all plugins in the configured directories
2. Metadata is extracted and validated for each plugin
3. Version compatibility is checked against ALEJO and dependencies
4. Dependencies are resolved and plugins are loaded in the correct order
5. Plugins are registered with the plugin registry

## Best Practices

### Dependency Management

- Only declare dependencies that are actually required by your plugin
- Use the most permissive version constraints that work for your plugin
- Test your plugin with different versions of its dependencies

### Versioning

- Follow semantic versioning (MAJOR.MINOR.PATCH):
  - MAJOR: Breaking changes
  - MINOR: New features, backward compatible
  - PATCH: Bug fixes, backward compatible

### Error Handling

- Handle exceptions gracefully within your plugin
- Use the provided logger for error reporting
- Return meaningful error messages

### Performance

- Initialize expensive resources lazily
- Clean up resources when they're no longer needed
- Consider the impact of your plugin on the overall system performance

### Testing

- Write unit tests for your plugin
- Test with different versions of dependencies
- Test with different versions of ALEJO

## Example Plugins

### Sentiment Analyzer Plugin

```python
"""
Sentiment Analysis Plugin for ALEJO
Provides advanced sentiment analysis capabilities
"""
import logging
from typing import Dict, Any

# Plugin metadata
PLUGIN_NAME = "sentiment_analyzer"
PLUGIN_VERSION = "1.0.0"
PLUGIN_DESCRIPTION = "Advanced sentiment analysis for text processing"
PLUGIN_AUTHOR = "ALEJO Development Team"
PLUGIN_DEPENDENCIES = {}
PLUGIN_REQUIRES_ALEJO = "0.1.0"
PLUGIN_TAGS = ["nlp", "sentiment", "text_processing"]

logger = logging.getLogger(__name__)

class SentimentAnalyzer:
    def __init__(self):
        logger.info("Initializing sentiment analyzer")
        
    def process(self, text: str) -> Dict[str, Any]:
        """
        Analyze the sentiment of the provided text
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary with sentiment analysis results
        """
        # Implementation details
        return {
            "positive": 0.7,
            "negative": 0.2,
            "neutral": 0.1
        }
```

### Text Summarizer Plugin (with Dependencies)

```python
"""
Text Summarizer Plugin for ALEJO
Provides text summarization capabilities
"""
import logging
from typing import Dict, Any, List

# Plugin metadata
PLUGIN_NAME = "text_summarizer"
PLUGIN_VERSION = "1.0.0"
PLUGIN_DESCRIPTION = "Text summarization for content processing"
PLUGIN_AUTHOR = "ALEJO Development Team"
PLUGIN_DEPENDENCIES = {"sentiment_analyzer": ">=1.0.0"}
PLUGIN_REQUIRES_ALEJO = "0.1.0"
PLUGIN_TAGS = ["nlp", "summarization", "text_processing"]

logger = logging.getLogger(__name__)

def register():
    """Register the plugin with ALEJO"""
    return TextSummarizer()

class TextSummarizer:
    def __init__(self):
        logger.info("Initializing text summarizer")
        
    def process(self, text: str, max_length: int = 100) -> Dict[str, Any]:
        """
        Summarize the provided text
        
        Args:
            text: Text to summarize
            max_length: Maximum length of the summary
            
        Returns:
            Dictionary with summarization results
        """
        # Implementation details
        return {
            "summary": "Summarized text...",
            "original_length": len(text),
            "summary_length": len("Summarized text...")
        }
```

## Troubleshooting

### Common Issues

1. **Plugin not loading**
   - Check that the plugin is in the correct directory
   - Verify that the plugin has the required metadata
   - Check for syntax errors in the plugin code

2. **Dependency issues**
   - Ensure all dependencies are installed and available
   - Check version compatibility between plugins
   - Look for circular dependencies

3. **Version conflicts**
   - Update plugins to compatible versions
   - Consider using more permissive version constraints

### Debugging

- Enable debug logging to get more information about plugin loading
- Check the plugin metadata directory for saved metadata
- Use the `get_plugin_metadata` method to inspect plugin metadata

## API Reference

### PluginLoader

```python
class PluginLoader:
    def __init__(self, plugin_dirs: Optional[List[str]] = None, alejo_version: str = "0.1.0"):
        """
        Initialize the plugin loader.
        
        Args:
            plugin_dirs: List of directories to search for plugins
            alejo_version: Current ALEJO version for compatibility checking
        """
        
    def discover_plugins(self) -> Dict[str, Any]:
        """
        Discover all available plugins in the plugin directories.
        
        Returns:
            Dictionary mapping plugin names to plugin objects/functions
        """
        
    def register_with_registry(self, registry) -> int:
        """
        Register all discovered plugins with the provided registry.
        
        Args:
            registry: The plugin registry to register plugins with
            
        Returns:
            Number of plugins registered
        """
        
    def get_plugin_metadata(self, plugin_name: str) -> Optional[PluginMetadata]:
        """
        Get metadata for a specific plugin
        
        Args:
            plugin_name: Name of the plugin
            
        Returns:
            PluginMetadata object or None if not found
        """
        
    def get_all_plugin_metadata(self) -> Dict[str, PluginMetadata]:
        """
        Get metadata for all plugins
        
        Returns:
            Dictionary mapping plugin names to PluginMetadata objects
        """
        
    def get_plugins_by_tag(self, tag: str) -> List[str]:
        """
        Get all plugins with a specific tag
        
        Args:
            tag: Tag to search for
            
        Returns:
            List of plugin names
        """
        
    def get_plugin_dependents(self, plugin_name: str) -> Set[str]:
        """
        Get all plugins that depend on the specified plugin
        
        Args:
            plugin_name: Name of the plugin
            
        Returns:
            Set of plugin names that depend on the specified plugin
        """
```

### PluginMetadata

```python
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
```
