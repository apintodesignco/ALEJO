"""
ALEJO - Advanced Learning Engine with Judgment Orchestration
TensorFlow Model - TensorFlow-specific model implementation
"""

import os
import logging
import tempfile
from typing import Dict, Any, Optional, List, Union, Tuple

import numpy as np

from alejo.ml.models.model_base import ModelBase

logger = logging.getLogger("alejo.ml.tensorflow")

class TensorFlowModel(ModelBase):
    """
    TensorFlow model implementation for ALEJO.
    
    This class handles TensorFlow-specific model loading, inference, and memory management.
    It supports both SavedModel and Keras model formats, as well as TensorFlow Lite.
    """
    
    def __init__(
        self, 
        model_id: str, 
        framework: str = "tensorflow",
        config: Dict[str, Any] = None,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize a TensorFlow model.
        
        Args:
            model_id: Unique identifier for the model
            framework: Framework identifier (should be "tensorflow")
            config: Model-specific configuration
            cache_dir: Directory for model caching
        """
        super().__init__(model_id, framework, config, cache_dir)
        
        # Lazy import TensorFlow to avoid loading it unnecessarily
        self.tf = None
        self.model_format = config.get("model_format", "saved_model")  # saved_model, keras, tflite
        self.model_path = config.get("model_path")
        self.memory_usage_bytes = 0
        
        # TensorFlow-specific metadata
        self.metadata.update({
            "model_format": self.model_format,
            "input_shapes": None,
            "output_shapes": None,
            "dtype": None,
        })
        
    def _import_tensorflow(self) -> bool:
        """
        Import TensorFlow and configure it according to settings.
        
        Returns:
            True if import was successful, False otherwise
        """
        if self.tf is not None:
            return True
            
        try:
            # Configure TensorFlow before importing
            os.environ["TF_CPP_MIN_LOG_LEVEL"] = str(self.config.get("log_level", 3))
            
            if not self.config.get("allow_gpu", True):
                os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
            elif "visible_devices" in self.config:
                os.environ["CUDA_VISIBLE_DEVICES"] = self.config["visible_devices"]
                
            # Import TensorFlow
            import tensorflow as tf
            self.tf = tf
            
            # Configure TensorFlow
            if self.config.get("allow_xla", True):
                tf.config.optimizer.set_jit(True)
                
            # Configure memory growth to avoid allocating all GPU memory
            if self.config.get("memory_growth", True):
                gpus = tf.config.experimental.list_physical_devices('GPU')
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)
                    
            # Set precision
            precision = self.config.get("precision", "mixed_float16")
            if precision == "mixed_float16" and len(gpus) > 0:
                tf.keras.mixed_precision.set_global_policy('mixed_float16')
                
            logger.info(f"TensorFlow {tf.__version__} imported successfully")
            return True
        except ImportError as e:
            logger.error(f"Failed to import TensorFlow: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error configuring TensorFlow: {str(e)}")
            return False
            
    def load(self) -> bool:
        """
        Load the TensorFlow model into memory.
        
        Returns:
            True if loading was successful, False otherwise
        """
        if self.is_loaded:
            return True
            
        if not self._import_tensorflow():
            return False
            
        try:
            # Determine model path
            model_path = self.model_path
            if not model_path:
                cache_path = self.get_cache_path()
                if cache_path and os.path.exists(cache_path):
                    model_path = cache_path
                else:
                    logger.error(f"No model path specified for {self.model_id}")
                    return False
                    
            # Load model based on format
            if self.model_format == "saved_model":
                self.model = self.tf.saved_model.load(model_path)
                
                # Get model signatures
                if hasattr(self.model, "signatures"):
                    sig_keys = list(self.model.signatures.keys())
                    self.metadata["signatures"] = sig_keys
                    
                    # Get input/output shapes from first signature
                    if sig_keys:
                        sig = self.model.signatures[sig_keys[0]]
                        self.metadata["input_shapes"] = {k: v.shape.as_list() for k, v in sig.inputs.items()}
                        self.metadata["output_shapes"] = {k: v.shape.as_list() for k, v in sig.outputs.items()}
                        
            elif self.model_format == "keras":
                self.model = self.tf.keras.models.load_model(model_path)
                
                # Get input/output shapes
                if hasattr(self.model, "input_shape"):
                    self.metadata["input_shapes"] = {"input": self.model.input_shape}
                    self.metadata["output_shapes"] = {"output": self.model.output_shape}
                    
            elif self.model_format == "tflite":
                self.model = self.tf.lite.Interpreter(model_path=model_path)
                self.model.allocate_tensors()
                
                # Get input/output details
                input_details = self.model.get_input_details()
                output_details = self.model.get_output_details()
                
                self.metadata["input_shapes"] = {str(i): d["shape"] for i, d in enumerate(input_details)}
                self.metadata["output_shapes"] = {str(i): d["shape"] for i, d in enumerate(output_details)}
                self.metadata["input_details"] = input_details
                self.metadata["output_details"] = output_details
            else:
                logger.error(f"Unsupported model format: {self.model_format}")
                return False
                
            # Estimate memory usage
            self._estimate_memory_usage()
            
            self.is_loaded = True
            self.touch()
            logger.info(f"Loaded TensorFlow model: {self.model_id} ({self.model_format})")
            return True
        except Exception as e:
            logger.error(f"Failed to load TensorFlow model {self.model_id}: {str(e)}")
            self.model = None
            return False
            
    def unload(self) -> bool:
        """
        Unload the TensorFlow model from memory.
        
        Returns:
            True if unloading was successful, False otherwise
        """
        if not self.is_loaded:
            return True
            
        try:
            # Clear model
            self.model = None
            
            # Force garbage collection
            import gc
            gc.collect()
            
            # Clear TensorFlow session if using Keras
            if self.tf and hasattr(self.tf.keras.backend, "clear_session"):
                self.tf.keras.backend.clear_session()
                
            self.is_loaded = False
            self.memory_usage_bytes = 0
            logger.info(f"Unloaded TensorFlow model: {self.model_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to unload TensorFlow model {self.model_id}: {str(e)}")
            return False
            
    def predict(self, inputs: Any) -> Any:
        """
        Run inference on the TensorFlow model.
        
        Args:
            inputs: Input data for the model (numpy array, tensor, or dict of arrays/tensors)
            
        Returns:
            Model predictions
        """
        if not self.is_loaded:
            if not self.load():
                raise RuntimeError(f"Failed to load model {self.model_id}")
                
        self.touch()
        
        try:
            # Handle different model formats
            if self.model_format == "saved_model":
                # Handle different input types
                if isinstance(inputs, dict):
                    # Convert numpy arrays to tensors if needed
                    tensor_inputs = {}
                    for k, v in inputs.items():
                        if isinstance(v, np.ndarray):
                            tensor_inputs[k] = self.tf.convert_to_tensor(v)
                        else:
                            tensor_inputs[k] = v
                    
                    # Use the first signature by default if not specified
                    if "signature" in self.config:
                        signature = self.config["signature"]
                        if hasattr(self.model, "signatures") and signature in self.model.signatures:
                            return self.model.signatures[signature](**tensor_inputs)
                    
                    # Try calling the model directly
                    return self.model(**tensor_inputs)
                else:
                    # Convert to tensor if needed
                    if isinstance(inputs, np.ndarray):
                        inputs = self.tf.convert_to_tensor(inputs)
                    
                    # Call the model
                    return self.model(inputs)
                    
            elif self.model_format == "keras":
                return self.model.predict(inputs)
                
            elif self.model_format == "tflite":
                # Get input details
                input_details = self.metadata.get("input_details") or self.model.get_input_details()
                output_details = self.metadata.get("output_details") or self.model.get_output_details()
                
                # Set input tensor
                if isinstance(inputs, dict):
                    for i, (key, value) in enumerate(inputs.items()):
                        if i < len(input_details):
                            self.model.set_tensor(input_details[i]['index'], value)
                else:
                    self.model.set_tensor(input_details[0]['index'], inputs)
                    
                # Run inference
                self.model.invoke()
                
                # Get output
                if len(output_details) == 1:
                    return self.model.get_tensor(output_details[0]['index'])
                else:
                    return {str(i): self.model.get_tensor(detail['index']) 
                            for i, detail in enumerate(output_details)}
        except Exception as e:
            logger.error(f"Error during TensorFlow inference: {str(e)}")
            raise
            
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
                
            # Different estimation methods based on model format
            if self.model_format == "keras":
                # For Keras models, we can get the number of parameters
                trainable_count = sum(
                    self.tf.keras.backend.count_params(w) 
                    for w in self.model.trainable_weights
                )
                non_trainable_count = sum(
                    self.tf.keras.backend.count_params(w) 
                    for w in self.model.non_trainable_weights
                )
                
                # Rough estimate: 4 bytes per parameter (float32)
                self.memory_usage_bytes = (trainable_count + non_trainable_count) * 4
                
            elif self.model_format == "tflite":
                # For TFLite, we can get the model size from the file
                if self.model_path and os.path.exists(self.model_path):
                    self.memory_usage_bytes = os.path.getsize(self.model_path)
                    
            else:
                # For SavedModel, estimate based on file size
                if self.model_path and os.path.exists(self.model_path):
                    if os.path.isdir(self.model_path):
                        # Sum up sizes of all files in the directory
                        total_size = 0
                        for dirpath, _, filenames in os.walk(self.model_path):
                            for f in filenames:
                                fp = os.path.join(dirpath, f)
                                total_size += os.path.getsize(fp)
                        self.memory_usage_bytes = total_size
                    else:
                        self.memory_usage_bytes = os.path.getsize(self.model_path)
                        
            # Add overhead (50%)
            self.memory_usage_bytes = int(self.memory_usage_bytes * 1.5)
            
            logger.debug(f"Estimated memory usage for {self.model_id}: {self.memory_usage_bytes / (1024*1024):.2f} MB")
        except Exception as e:
            logger.warning(f"Failed to estimate memory usage: {str(e)}")
            # Default to 100MB if estimation fails
            self.memory_usage_bytes = 100 * 1024 * 1024
