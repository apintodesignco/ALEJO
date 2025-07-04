"""
ALEJO - Advanced Learning Engine with Judgment Orchestration
Model Registry - Central registry for all ML models
"""

import os
import time
import logging
import threading
from typing import Dict, Any, Optional, List, Union, Type, Tuple

from alejo.ml.models.model_base import ModelBase
from alejo.ml.config.ml_config import MLConfig

logger = logging.getLogger("alejo.ml.registry")

class ModelRegistry:
    """
    Central registry for all ML models in ALEJO.
    
    This class manages model loading, unloading, and access across the application.
    It implements memory management, caching, and lazy loading to optimize resource usage.
    """
    
    # Memory management constants
    DEFAULT_MAX_MEMORY_MB = 4096  # 4GB default limit
    DEFAULT_IDLE_TIMEOUT_SEC = 300  # 5 minutes
    
    def __init__(self, ml_config: Optional[MLConfig] = None):
        """
        Initialize the model registry.
        
        Args:
            ml_config: ML configuration instance
        """
        self.ml_config = ml_config or MLConfig()
        self.models = {}  # model_id -> model instance
        self.model_classes = {}  # framework -> model class
        self._lock = threading.RLock()
        self._memory_monitor_thread = None
        self._running = False
        
        # Memory management settings
        self.max_memory_mb = self.DEFAULT_MAX_MEMORY_MB
        self.idle_timeout_sec = self.DEFAULT_IDLE_TIMEOUT_SEC
        
    def register_model_class(self, framework: str, model_class: Type[ModelBase]) -> None:
        """
        Register a model class for a specific framework.
        
        Args:
            framework: Framework identifier
            model_class: Model class (must inherit from ModelBase)
        """
        with self._lock:
            if not issubclass(model_class, ModelBase):
                raise TypeError(f"Model class must inherit from ModelBase")
                
            self.model_classes[framework] = model_class
            logger.info(f"Registered model class for framework: {framework}")
            
    def create_model(
        self, 
        model_id: str, 
        framework: str, 
        config: Dict[str, Any] = None
    ) -> Optional[ModelBase]:
        """
        Create a new model instance.
        
        Args:
            model_id: Unique identifier for the model
            framework: Framework identifier
            config: Model-specific configuration
            
        Returns:
            Model instance or None if creation failed
        """
        with self._lock:
            if model_id in self.models:
                logger.warning(f"Model {model_id} already exists")
                return self.models[model_id]
                
            if framework not in self.model_classes:
                logger.error(f"No model class registered for framework: {framework}")
                return None
                
            # Get framework-specific configuration
            framework_config = self.ml_config.get_framework_config(framework)
            
            # Merge with model-specific configuration
            merged_config = {**framework_config}
            if config:
                merged_config.update(config)
                
            # Create model instance
            try:
                model_class = self.model_classes[framework]
                cache_dir = framework_config.get("cache_dir")
                model = model_class(model_id, framework, merged_config, cache_dir)
                
                self.models[model_id] = model
                logger.info(f"Created model: {model_id} ({framework})")
                return model
            except Exception as e:
                logger.error(f"Failed to create model {model_id}: {str(e)}")
                return None
                
    def get_model(self, model_id: str, auto_load: bool = True) -> Optional[ModelBase]:
        """
        Get a model by its ID.
        
        Args:
            model_id: Model identifier
            auto_load: Whether to automatically load the model if not loaded
            
        Returns:
            Model instance or None if not found
        """
        with self._lock:
            model = self.models.get(model_id)
            
            if model:
                model.touch()  # Update last used timestamp
                
                # Auto-load if needed
                if auto_load and not model.is_loaded:
                    success = model.load()
                    if not success:
                        logger.error(f"Failed to auto-load model: {model_id}")
                        
            return model
            
    def unload_model(self, model_id: str) -> bool:
        """
        Unload a model from memory.
        
        Args:
            model_id: Model identifier
            
        Returns:
            True if unloading was successful, False otherwise
        """
        with self._lock:
            model = self.models.get(model_id)
            if not model:
                logger.warning(f"Model not found: {model_id}")
                return False
                
            if model.is_loaded:
                success = model.unload()
                if success:
                    logger.info(f"Unloaded model: {model_id}")
                else:
                    logger.error(f"Failed to unload model: {model_id}")
                return success
            return True
            
    def remove_model(self, model_id: str) -> bool:
        """
        Remove a model from the registry.
        
        Args:
            model_id: Model identifier
            
        Returns:
            True if removal was successful, False otherwise
        """
        with self._lock:
            if model_id not in self.models:
                logger.warning(f"Model not found: {model_id}")
                return False
                
            # Unload if loaded
            if self.models[model_id].is_loaded:
                self.models[model_id].unload()
                
            # Remove from registry
            del self.models[model_id]
            logger.info(f"Removed model: {model_id}")
            return True
            
    def get_loaded_models(self) -> List[ModelBase]:
        """
        Get all currently loaded models.
        
        Returns:
            List of loaded model instances
        """
        with self._lock:
            return [model for model in self.models.values() if model.is_loaded]
            
    def get_total_memory_usage_mb(self) -> float:
        """
        Get the total memory usage of all loaded models in MB.
        
        Returns:
            Total memory usage in MB
        """
        with self._lock:
            total_bytes = sum(model.get_memory_usage() for model in self.models.values() if model.is_loaded)
            return total_bytes / (1024 * 1024)
            
    def start_memory_monitor(self) -> None:
        """Start the memory monitoring thread"""
        with self._lock:
            if self._memory_monitor_thread and self._memory_monitor_thread.is_alive():
                return
                
            self._running = True
            self._memory_monitor_thread = threading.Thread(
                target=self._memory_monitor_loop,
                daemon=True
            )
            self._memory_monitor_thread.start()
            logger.info("Started model memory monitor")
            
    def stop_memory_monitor(self) -> None:
        """Stop the memory monitoring thread"""
        with self._lock:
            self._running = False
            if self._memory_monitor_thread:
                self._memory_monitor_thread.join(timeout=5)
                logger.info("Stopped model memory monitor")
                
    def _memory_monitor_loop(self) -> None:
        """Memory monitoring thread loop"""
        while self._running:
            try:
                self._check_memory_usage()
                self._unload_idle_models()
            except Exception as e:
                logger.error(f"Error in memory monitor: {str(e)}")
                
            # Sleep for a while
            time.sleep(30)
            
    def _check_memory_usage(self) -> None:
        """Check memory usage and unload models if needed"""
        with self._lock:
            total_memory_mb = self.get_total_memory_usage_mb()
            
            if total_memory_mb > self.max_memory_mb:
                logger.warning(f"Memory usage ({total_memory_mb:.2f} MB) exceeds limit ({self.max_memory_mb} MB)")
                
                # Sort models by last used time (oldest first)
                loaded_models = sorted(
                    self.get_loaded_models(),
                    key=lambda m: m.last_used
                )
                
                # Unload models until we're under the limit
                for model in loaded_models:
                    if self.get_total_memory_usage_mb() <= self.max_memory_mb:
                        break
                        
                    logger.info(f"Unloading model due to memory pressure: {model.model_id}")
                    model.unload()
                    
    def _unload_idle_models(self) -> None:
        """Unload models that have been idle for too long"""
        with self._lock:
            current_time = time.time()
            
            for model in self.get_loaded_models():
                idle_time = current_time - model.last_used
                
                if idle_time > self.idle_timeout_sec:
                    logger.info(f"Unloading idle model: {model.model_id} (idle for {idle_time:.1f}s)")
                    model.unload()
                    
    def set_memory_limit(self, max_memory_mb: int) -> None:
        """
        Set the maximum memory limit for loaded models.
        
        Args:
            max_memory_mb: Maximum memory in MB
        """
        with self._lock:
            self.max_memory_mb = max(128, max_memory_mb)  # Minimum 128MB
            logger.info(f"Set model memory limit to {self.max_memory_mb} MB")
            
    def set_idle_timeout(self, timeout_sec: int) -> None:
        """
        Set the idle timeout for automatic model unloading.
        
        Args:
            timeout_sec: Timeout in seconds
        """
        with self._lock:
            self.idle_timeout_sec = max(30, timeout_sec)  # Minimum 30 seconds
            logger.info(f"Set model idle timeout to {self.idle_timeout_sec} seconds")
