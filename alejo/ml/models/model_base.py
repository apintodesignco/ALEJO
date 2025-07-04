"""
ALEJO - Advanced Learning Engine with Judgment Orchestration
Model Base - Abstract base class for all ML models
"""

import os
import time
import logging
import hashlib
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Union, Tuple

logger = logging.getLogger("alejo.ml.models")

class ModelBase(ABC):
    """
    Abstract base class for all ML models in ALEJO.
    
    This class defines the common interface for all models regardless of framework
    (TensorFlow, PyTorch, Hugging Face, LLaMa) and provides shared functionality
    for model loading, caching, and inference.
    """
    
    def __init__(
        self, 
        model_id: str, 
        framework: str,
        config: Dict[str, Any] = None,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize a model instance.
        
        Args:
            model_id: Unique identifier for the model
            framework: Framework identifier (tensorflow, pytorch, huggingface, llama)
            config: Model-specific configuration
            cache_dir: Directory for model caching
        """
        self.model_id = model_id
        self.framework = framework
        self.config = config or {}
        self.cache_dir = cache_dir
        self.model = None
        self.is_loaded = False
        self.last_used = 0
        self.metadata = {}
        
    @abstractmethod
    def load(self) -> bool:
        """
        Load the model into memory.
        
        Returns:
            True if loading was successful, False otherwise
        """
        pass
        
    @abstractmethod
    def unload(self) -> bool:
        """
        Unload the model from memory.
        
        Returns:
            True if unloading was successful, False otherwise
        """
        pass
        
    @abstractmethod
    def predict(self, inputs: Any) -> Any:
        """
        Run inference on the model.
        
        Args:
            inputs: Input data for the model
            
        Returns:
            Model predictions
        """
        pass
        
    def touch(self) -> None:
        """Update the last used timestamp"""
        self.last_used = time.time()
        
    def get_memory_usage(self) -> int:
        """
        Get the estimated memory usage of the model in bytes.
        
        Returns:
            Estimated memory usage in bytes
        """
        return 0  # Override in subclasses
        
    def get_model_hash(self) -> str:
        """
        Get a unique hash for the model based on its ID and config.
        
        Returns:
            Unique hash string
        """
        config_str = str(sorted(self.config.items()))
        hash_input = f"{self.model_id}:{self.framework}:{config_str}"
        return hashlib.md5(hash_input.encode()).hexdigest()
        
    def get_cache_path(self) -> str:
        """
        Get the path for caching this model.
        
        Returns:
            Path to the model cache directory
        """
        if not self.cache_dir:
            return ""
            
        model_hash = self.get_model_hash()
        return os.path.join(self.cache_dir, self.framework, model_hash)
        
    def update_metadata(self, metadata: Dict[str, Any]) -> None:
        """
        Update model metadata.
        
        Args:
            metadata: Dictionary with metadata to update
        """
        self.metadata.update(metadata)
        
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert model information to a dictionary.
        
        Returns:
            Dictionary with model information
        """
        return {
            "model_id": self.model_id,
            "framework": self.framework,
            "is_loaded": self.is_loaded,
            "last_used": self.last_used,
            "memory_usage": self.get_memory_usage(),
            "metadata": self.metadata
        }
