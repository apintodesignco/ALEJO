"""
ALEJO LoRA Manager Module

This module provides functionality for managing and hot-swapping LoRA adapters
for language models, enabling dynamic model adaptation without full model reloading.
Part of the Darwin Gödel Machine self-evolution capabilities.
"""

import os
import json
import asyncio
import logging
import shutil
from typing import Dict, List, Any, Optional, Union
from pathlib import Path
import time

import torch
from torch import nn

from ..utils.exceptions import LoRAError
from ..utils.events import EventBus
from ..utils.benchmarking import PerformanceBenchmark

logger = logging.getLogger("alejo.llm_client.lora_manager")

class LoRAManager:
    """
    Manager for LoRA (Low-Rank Adaptation) adapters in ALEJO
    
    This class provides functionality for:
    - Loading and unloading LoRA adapters
    - Hot-swapping adapters during runtime
    - Managing adapter storage and versioning
    - Benchmarking adapter performance
    - Automatic adapter selection based on task
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        base_model_path: str,
        lora_dir: Optional[str] = None,
        config_path: Optional[str] = None
    ):
        """
        Initialize the LoRA Manager
        
        Args:
            event_bus: EventBus instance for event-driven communication
            base_model_path: Path to the base model
            lora_dir: Directory to store LoRA adapters
            config_path: Path to configuration file
        """
        self.event_bus = event_bus
        self.base_model_path = base_model_path
        self.lora_dir = lora_dir or os.path.join(os.path.dirname(base_model_path), "lora_adapters")
        
        # Ensure LoRA directory exists
        os.makedirs(self.lora_dir, exist_ok=True)
        
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize state
        self.active_adapter = None
        self.loaded_adapters = {}
        self.adapter_metadata = {}
        
        # Register event handlers
        self._register_event_handlers()
        
        logger.info(f"LoRA Manager initialized with base model: {base_model_path}")
    
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        config = {
            "auto_select_enabled": True,
            "adapter_memory_limit": 2048,  # MB
            "benchmark_new_adapters": True,
            "adapter_selection": {
                "creative_writing": "creative_writing_v1",
                "code_generation": "code_assistant_v2",
                "emotional_intelligence": "empathy_v1",
                "logical_reasoning": "reasoning_v3",
                "default": "general_purpose_v1"
            },
            "task_detection": {
                "keywords": {
                    "creative_writing": ["story", "creative", "narrative", "poem", "fiction"],
                    "code_generation": ["code", "function", "class", "programming", "algorithm"],
                    "emotional_intelligence": ["feel", "emotion", "empathy", "understand", "support"],
                    "logical_reasoning": ["logic", "reason", "analyze", "deduce", "solve"]
                }
            }
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    loaded_config = json.load(f)
                    # Update nested dictionaries properly
                    for key, value in loaded_config.items():
                        if isinstance(value, dict) and key in config and isinstance(config[key], dict):
                            config[key].update(value)
                        else:
                            config[key] = value
            except Exception as e:
                logger.error(f"Failed to load config from {config_path}: {e}")
        
        return config
    
    def _register_event_handlers(self):
        """Register event handlers for the LoRA Manager"""
        self.event_bus.on("brain.message_received", self._on_message_received)
        self.event_bus.on("brain.task_detected", self._on_task_detected)
        self.event_bus.on("lora.adapter_requested", self._on_adapter_requested)
    
    async def _on_message_received(self, data: Dict[str, Any]):
        """Handle incoming messages to detect task type"""
        if not self.config["auto_select_enabled"]:
            return
            
        message = data.get("message", "")
        task_type = self._detect_task_type(message)
        
        if task_type:
            await self.event_bus.emit("brain.task_detected", {
                "task_type": task_type,
                "message_id": data.get("message_id")
            })
    
    async def _on_task_detected(self, data: Dict[str, Any]):
        """Handle task detection events"""
        task_type = data.get("task_type")
        if not task_type:
            return
            
        # Get the appropriate adapter for this task
        adapter_name = self.config["adapter_selection"].get(
            task_type, 
            self.config["adapter_selection"]["default"]
        )
        
        # Request adapter swap if needed
        if self.active_adapter != adapter_name:
            await self.event_bus.emit("lora.adapter_requested", {
                "adapter_name": adapter_name,
                "task_type": task_type
            })
    
    async def _on_adapter_requested(self, data: Dict[str, Any]):
        """Handle adapter request events"""
        adapter_name = data.get("adapter_name")
        if not adapter_name:
            return
            
        try:
            # Hot-swap to the requested adapter
            await self.hot_swap_adapter(adapter_name)
            
            # Emit event that adapter was loaded
            await self.event_bus.emit("lora.adapter_loaded", {
                "adapter_name": adapter_name,
                "task_type": data.get("task_type")
            })
        except Exception as e:
            logger.error(f"Failed to load adapter {adapter_name}: {e}")
            await self.event_bus.emit("lora.adapter_error", {
                "adapter_name": adapter_name,
                "error": str(e)
            })
    
    def _detect_task_type(self, message: str) -> Optional[str]:
        """Detect the task type from a message"""
        message = message.lower()
        
        # Check for keywords in the message
        max_matches = 0
        detected_task = None
        
        for task, keywords in self.config["task_detection"]["keywords"].items():
            matches = sum(1 for keyword in keywords if keyword.lower() in message)
            if matches > max_matches:
                max_matches = matches
                detected_task = task
        
        # Only return a task if we have a minimum number of matches
        return detected_task if max_matches >= 1 else None
    
    async def list_available_adapters(self) -> List[Dict[str, Any]]:
        """
        List all available LoRA adapters
        
        Returns:
            List of adapter metadata dictionaries
        """
        adapters = []
        
        # Scan the LoRA directory for adapter folders
        for item in os.listdir(self.lora_dir):
            adapter_path = os.path.join(self.lora_dir, item)
            if os.path.isdir(adapter_path):
                # Check for metadata file
                metadata_path = os.path.join(adapter_path, "metadata.json")
                if os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, 'r') as f:
                            metadata = json.load(f)
                            metadata["name"] = item
                            metadata["path"] = adapter_path
                            adapters.append(metadata)
                    except Exception as e:
                        logger.error(f"Failed to load metadata for adapter {item}: {e}")
                else:
                    # Create basic metadata if none exists
                    adapters.append({
                        "name": item,
                        "path": adapter_path,
                        "created_at": time.ctime(os.path.getctime(adapter_path)),
                        "description": "No metadata available"
                    })
        
        return adapters
    
    async def hot_swap_adapter(self, adapter_name: str) -> bool:
        """
        Hot-swap to a different LoRA adapter
        
        Args:
            adapter_name: Name of the adapter to swap to
            
        Returns:
            True if successful, False otherwise
        """
        if self.active_adapter == adapter_name:
            logger.info(f"Adapter {adapter_name} is already active")
            return True
            
        try:
            # Check if adapter exists
            adapter_path = os.path.join(self.lora_dir, adapter_name)
            if not os.path.exists(adapter_path):
                raise LoRAError(f"Adapter {adapter_name} not found at {adapter_path}")
                
            # Start benchmarking
            benchmark = PerformanceBenchmark()
            with benchmark.track():
                # Unload current adapter if any
                if self.active_adapter:
                    await self._unload_adapter(self.active_adapter)
                
                # Load new adapter
                await self._load_adapter(adapter_name)
                
                # Update active adapter
                self.active_adapter = adapter_name
            
            # Log benchmark results
            results = benchmark.get_results()
            logger.info(f"Hot-swapped to adapter {adapter_name} in {results['execution_time']:.2f}s")
            
            # Emit benchmark event
            await self.event_bus.emit("lora.benchmark", {
                "adapter_name": adapter_name,
                "operation": "hot_swap",
                "results": results
            })
            
            return True
        except Exception as e:
            logger.error(f"Failed to hot-swap to adapter {adapter_name}: {e}")
            raise LoRAError(f"Failed to hot-swap to adapter {adapter_name}: {e}")
    
    async def _load_adapter(self, adapter_name: str):
        """
        Load a LoRA adapter
        
        Args:
            adapter_name: Name of the adapter to load
        """
        adapter_path = os.path.join(self.lora_dir, adapter_name)
        
        # Load metadata
        metadata_path = os.path.join(adapter_path, "metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                self.adapter_metadata[adapter_name] = json.load(f)
        
        # In a real implementation, this would use the appropriate
        # library to load the LoRA weights into the model
        # For now, we'll simulate the loading process
        logger.info(f"Loading LoRA adapter: {adapter_name}")
        await asyncio.sleep(0.5)  # Simulate loading time
        
        # Mark as loaded
        self.loaded_adapters[adapter_name] = {
            "loaded_at": time.time(),
            "path": adapter_path
        }
        
        logger.info(f"LoRA adapter {adapter_name} loaded successfully")
    
    async def _unload_adapter(self, adapter_name: str):
        """
        Unload a LoRA adapter
        
        Args:
            adapter_name: Name of the adapter to unload
        """
        if adapter_name not in self.loaded_adapters:
            logger.warning(f"Adapter {adapter_name} is not loaded")
            return
            
        # In a real implementation, this would use the appropriate
        # library to unload the LoRA weights from the model
        # For now, we'll simulate the unloading process
        logger.info(f"Unloading LoRA adapter: {adapter_name}")
        await asyncio.sleep(0.2)  # Simulate unloading time
        
        # Remove from loaded adapters
        del self.loaded_adapters[adapter_name]
        
        logger.info(f"LoRA adapter {adapter_name} unloaded successfully")
    
    async def create_adapter(self, name: str, description: str, task_type: str) -> Dict[str, Any]:
        """
        Create a new empty LoRA adapter
        
        Args:
            name: Name for the new adapter
            description: Description of the adapter
            task_type: Type of task this adapter is optimized for
            
        Returns:
            Metadata for the created adapter
        """
        # Create adapter directory
        adapter_path = os.path.join(self.lora_dir, name)
        if os.path.exists(adapter_path):
            raise LoRAError(f"Adapter {name} already exists")
            
        os.makedirs(adapter_path)
        
        # Create metadata
        metadata = {
            "name": name,
            "description": description,
            "task_type": task_type,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "version": "1.0.0",
            "base_model": os.path.basename(self.base_model_path),
            "parameters": {}
        }
        
        # Save metadata
        metadata_path = os.path.join(adapter_path, "metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Created new LoRA adapter: {name}")
        return metadata
    
    async def delete_adapter(self, name: str) -> bool:
        """
        Delete a LoRA adapter
        
        Args:
            name: Name of the adapter to delete
            
        Returns:
            True if successful, False otherwise
        """
        adapter_path = os.path.join(self.lora_dir, name)
        if not os.path.exists(adapter_path):
            raise LoRAError(f"Adapter {name} not found")
            
        # Unload if loaded
        if name in self.loaded_adapters:
            await self._unload_adapter(name)
            
        # Delete directory
        try:
            shutil.rmtree(adapter_path)
            logger.info(f"Deleted LoRA adapter: {name}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete adapter {name}: {e}")
            raise LoRAError(f"Failed to delete adapter {name}: {e}")
    
    async def benchmark_adapter(self, name: str) -> Dict[str, Any]:
        """
        Benchmark a LoRA adapter's performance
        
        Args:
            name: Name of the adapter to benchmark
            
        Returns:
            Dictionary of benchmark results
        """
        adapter_path = os.path.join(self.lora_dir, name)
        if not os.path.exists(adapter_path):
            raise LoRAError(f"Adapter {name} not found")
            
        # Start benchmarking
        benchmark = PerformanceBenchmark()
        
        # Benchmark hot-swap time
        with benchmark.track("hot_swap_time"):
            await self.hot_swap_adapter(name)
        
        # Benchmark inference time (simulated)
        with benchmark.track("inference_time"):
            # Simulate inference with this adapter
            await asyncio.sleep(0.3)
        
        # Benchmark memory usage
        with benchmark.track("memory_usage"):
            # Simulate memory measurement
            memory_usage = 512 + hash(name) % 512  # Simulated memory usage
        
        # Get results
        results = benchmark.get_results()
        
        # Save benchmark results to adapter metadata
        metadata_path = os.path.join(adapter_path, "metadata.json")
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                
                # Update benchmark results
                if "benchmarks" not in metadata:
                    metadata["benchmarks"] = []
                    
                metadata["benchmarks"].append({
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "results": results
                })
                
                # Save updated metadata
                with open(metadata_path, 'w') as f:
                    json.dump(metadata, f, indent=2)
            except Exception as e:
                logger.error(f"Failed to update benchmark results for {name}: {e}")
        
        logger.info(f"Benchmarked LoRA adapter {name}: {results}")
        return results

# Singleton instance
_lora_manager_instance = None

def get_lora_manager(
    event_bus: Optional[EventBus] = None,
    base_model_path: Optional[str] = None,
    lora_dir: Optional[str] = None,
    config_path: Optional[str] = None
) -> LoRAManager:
    """
    Get or create the singleton LoRA Manager instance
    
    Args:
        event_bus: EventBus instance for event-driven communication
        base_model_path: Path to the base model
        lora_dir: Directory to store LoRA adapters
        config_path: Path to configuration file
        
    Returns:
        LoRAManager instance
    """
    global _lora_manager_instance
    
    if _lora_manager_instance is None:
        if event_bus is None or base_model_path is None:
            raise ValueError("event_bus and base_model_path are required for initial creation")
            
        _lora_manager_instance = LoRAManager(
            event_bus=event_bus,
            base_model_path=base_model_path,
            lora_dir=lora_dir,
            config_path=config_path
        )
    
    return _lora_manager_instance
