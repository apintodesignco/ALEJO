"""
ALEJO - Advanced Learning Engine with Judgment Orchestration
PyTorch Model - PyTorch-specific model implementation
"""

import os
import logging
import tempfile
from typing import Dict, Any, Optional, List, Union, Tuple

import numpy as np

from alejo.ml.models.model_base import ModelBase

logger = logging.getLogger("alejo.ml.pytorch")

class PyTorchModel(ModelBase):
    """
    PyTorch model implementation for ALEJO.
    
    This class handles PyTorch-specific model loading, inference, and memory management.
    It supports both standard PyTorch models and TorchScript models.
    """
    
    def __init__(
        self, 
        model_id: str, 
        framework: str = "pytorch",
        config: Dict[str, Any] = None,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize a PyTorch model.
        
        Args:
            model_id: Unique identifier for the model
            framework: Framework identifier (should be "pytorch")
            config: Model-specific configuration
            cache_dir: Directory for model caching
        """
        super().__init__(model_id, framework, config, cache_dir)
        
        # Lazy import PyTorch to avoid loading it unnecessarily
        self.torch = None
        self.model_format = config.get("model_format", "standard")  # standard, torchscript
        self.model_path = config.get("model_path")
        self.model_class = config.get("model_class")
        self.model_args = config.get("model_args", {})
        self.memory_usage_bytes = 0
        
        # PyTorch-specific metadata
        self.metadata.update({
            "model_format": self.model_format,
            "input_shapes": None,
            "output_shapes": None,
            "device": None,
        })
        
    def _import_pytorch(self) -> bool:
        """
        Import PyTorch and configure it according to settings.
        
        Returns:
            True if import was successful, False otherwise
        """
        if self.torch is not None:
            return True
            
        try:
            # Import PyTorch
            import torch
            self.torch = torch
            
            # Configure PyTorch
            device = self.config.get("device", "auto")
            if device == "auto":
                device = "cuda" if torch.cuda.is_available() else "cpu"
                if device == "cpu" and hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    device = "mps"  # Use Apple Metal if available
                    
            self.metadata["device"] = device
            
            # Set number of threads for CPU
            if device == "cpu" and "num_threads" in self.config:
                torch.set_num_threads(self.config["num_threads"])
                
            # Set benchmark mode
            if self.config.get("benchmark_mode", False):
                torch.backends.cudnn.benchmark = True
                
            # Set deterministic mode
            if self.config.get("deterministic", False):
                torch.backends.cudnn.deterministic = True
                torch.backends.cudnn.benchmark = False
                
            logger.info(f"PyTorch {torch.__version__} imported successfully (device: {device})")
            return True
        except ImportError as e:
            logger.error(f"Failed to import PyTorch: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error configuring PyTorch: {str(e)}")
            return False
            
    def load(self) -> bool:
        """
        Load the PyTorch model into memory.
        
        Returns:
            True if loading was successful, False otherwise
        """
        if self.is_loaded:
            return True
            
        if not self._import_pytorch():
            return False
            
        try:
            # Get device
            device = self.metadata["device"]
            
            # Determine model path
            model_path = self.model_path
            if not model_path and self.model_format != "hub":
                cache_path = self.get_cache_path()
                if cache_path and os.path.exists(cache_path):
                    model_path = cache_path
                elif not self.model_class:
                    logger.error(f"No model path or class specified for {self.model_id}")
                    return False
                    
            # Load model based on format
            if self.model_format == "torchscript":
                if not model_path:
                    logger.error(f"Model path required for TorchScript models")
                    return False
                    
                self.model = self.torch.jit.load(model_path, map_location=device)
                self.model.eval()
                
            elif self.model_format == "hub":
                # Load from PyTorch Hub
                hub_repo = self.config.get("hub_repo")
                hub_model = self.config.get("hub_model")
                
                if not hub_repo or not hub_model:
                    logger.error(f"Hub repo and model name required for PyTorch Hub models")
                    return False
                    
                self.model = self.torch.hub.load(
                    hub_repo, 
                    hub_model, 
                    **self.model_args
                )
                self.model.to(device)
                self.model.eval()
                
            elif self.model_format == "standard":
                # Either load from path or instantiate from class
                if model_path:
                    # Load state dict
                    state_dict = self.torch.load(model_path, map_location=device)
                    
                    # Instantiate model if class is provided
                    if self.model_class:
                        # Import the model class dynamically
                        module_path, class_name = self.model_class.rsplit(".", 1)
                        module = __import__(module_path, fromlist=[class_name])
                        model_cls = getattr(module, class_name)
                        
                        # Create model instance
                        self.model = model_cls(**self.model_args)
                        
                        # Load state dict
                        if isinstance(state_dict, dict) and "state_dict" in state_dict:
                            self.model.load_state_dict(state_dict["state_dict"])
                        else:
                            self.model.load_state_dict(state_dict)
                    else:
                        # Assume state_dict is the model itself
                        self.model = state_dict
                        
                    self.model.to(device)
                    self.model.eval()
                elif self.model_class:
                    # Import the model class dynamically
                    module_path, class_name = self.model_class.rsplit(".", 1)
                    module = __import__(module_path, fromlist=[class_name])
                    model_cls = getattr(module, class_name)
                    
                    # Create model instance
                    self.model = model_cls(**self.model_args)
                    self.model.to(device)
                    self.model.eval()
                else:
                    logger.error(f"Either model path or class must be specified")
                    return False
            else:
                logger.error(f"Unsupported model format: {self.model_format}")
                return False
                
            # Try to get input/output shapes if possible
            if hasattr(self.model, "input_shape"):
                self.metadata["input_shapes"] = self.model.input_shape
                
            if hasattr(self.model, "output_shape"):
                self.metadata["output_shapes"] = self.model.output_shape
                
            # Estimate memory usage
            self._estimate_memory_usage()
            
            self.is_loaded = True
            self.touch()
            logger.info(f"Loaded PyTorch model: {self.model_id} ({self.model_format})")
            return True
        except Exception as e:
            logger.error(f"Failed to load PyTorch model {self.model_id}: {str(e)}")
            self.model = None
            return False
            
    def unload(self) -> bool:
        """
        Unload the PyTorch model from memory.
        
        Returns:
            True if unloading was successful, False otherwise
        """
        if not self.is_loaded:
            return True
            
        try:
            # Move model to CPU first to free GPU memory
            if self.torch and self.model is not None:
                if hasattr(self.model, "to"):
                    self.model.to("cpu")
                    
            # Clear model
            self.model = None
            
            # Force garbage collection
            import gc
            gc.collect()
            
            # Clear CUDA cache if available
            if self.torch and hasattr(self.torch.cuda, "empty_cache"):
                self.torch.cuda.empty_cache()
                
            self.is_loaded = False
            self.memory_usage_bytes = 0
            logger.info(f"Unloaded PyTorch model: {self.model_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to unload PyTorch model {self.model_id}: {str(e)}")
            return False
            
    def predict(self, inputs: Any) -> Any:
        """
        Run inference on the PyTorch model.
        
        Args:
            inputs: Input data for the model (numpy array, tensor, or dict of arrays/tensors)
            
        Returns:
            Model predictions (as numpy arrays)
        """
        if not self.is_loaded:
            if not self.load():
                raise RuntimeError(f"Failed to load model {self.model_id}")
                
        self.touch()
        
        try:
            # Get device
            device = self.metadata["device"]
            
            # Convert inputs to PyTorch tensors if needed
            with self.torch.no_grad():
                if isinstance(inputs, dict):
                    # Convert dict of arrays to dict of tensors
                    tensor_inputs = {}
                    for k, v in inputs.items():
                        if isinstance(v, np.ndarray):
                            tensor_inputs[k] = self.torch.tensor(v).to(device)
                        elif isinstance(v, self.torch.Tensor):
                            tensor_inputs[k] = v.to(device)
                        else:
                            tensor_inputs[k] = v
                            
                    # Run inference
                    outputs = self.model(**tensor_inputs)
                elif isinstance(inputs, list):
                    # Convert list of arrays to list of tensors
                    tensor_inputs = []
                    for v in inputs:
                        if isinstance(v, np.ndarray):
                            tensor_inputs.append(self.torch.tensor(v).to(device))
                        elif isinstance(v, self.torch.Tensor):
                            tensor_inputs.append(v.to(device))
                        else:
                            tensor_inputs.append(v)
                            
                    # Run inference
                    outputs = self.model(*tensor_inputs)
                else:
                    # Convert single array to tensor
                    if isinstance(inputs, np.ndarray):
                        inputs = self.torch.tensor(inputs).to(device)
                    elif isinstance(inputs, self.torch.Tensor):
                        inputs = inputs.to(device)
                        
                    # Run inference
                    outputs = self.model(inputs)
                    
            # Convert outputs to numpy arrays
            if isinstance(outputs, tuple) or isinstance(outputs, list):
                return [self._tensor_to_numpy(o) for o in outputs]
            elif isinstance(outputs, dict):
                return {k: self._tensor_to_numpy(v) for k, v in outputs.items()}
            else:
                return self._tensor_to_numpy(outputs)
        except Exception as e:
            logger.error(f"Error during PyTorch inference: {str(e)}")
            raise
            
    def _tensor_to_numpy(self, tensor: Any) -> np.ndarray:
        """
        Convert a PyTorch tensor to a numpy array.
        
        Args:
            tensor: PyTorch tensor
            
        Returns:
            Numpy array
        """
        if tensor is None:
            return None
            
        if isinstance(tensor, self.torch.Tensor):
            return tensor.detach().cpu().numpy()
        return tensor
        
    def get_memory_usage(self) -> int:
        """
        Get the estimated memory usage of the model in bytes.
        
        Returns:
            Estimated memory usage in bytes
        """
        return self.memory_usage_bytes
        
    def _estimate_memory_usage(self) -> None:
        """Estimate the memory usage of the loaded model"""
        try:
            if not self.is_loaded or self.model is None:
                self.memory_usage_bytes = 0
                return
                
            # Count parameters
            total_params = 0
            total_size = 0
            
            for param in self.model.parameters():
                if param.requires_grad:
                    num_params = param.numel()
                    total_params += num_params
                    
                    # Calculate size in bytes
                    if param.dtype == self.torch.float32:
                        bytes_per_param = 4
                    elif param.dtype == self.torch.float16:
                        bytes_per_param = 2
                    elif param.dtype == self.torch.int8:
                        bytes_per_param = 1
                    else:
                        bytes_per_param = 4  # Default to float32
                        
                    total_size += num_params * bytes_per_param
                    
            # Add overhead for model structure (50%)
            self.memory_usage_bytes = int(total_size * 1.5)
            
            # Add extra for CUDA if using GPU
            if self.metadata["device"].startswith("cuda"):
                self.memory_usage_bytes = int(self.memory_usage_bytes * 2)  # Double for GPU overhead
                
            logger.debug(f"Estimated memory usage for {self.model_id}: {self.memory_usage_bytes / (1024*1024):.2f} MB")
        except Exception as e:
            logger.warning(f"Failed to estimate memory usage: {str(e)}")
            # Default to 100MB if estimation fails
            self.memory_usage_bytes = 100 * 1024 * 1024
