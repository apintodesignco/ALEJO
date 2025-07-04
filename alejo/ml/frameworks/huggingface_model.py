"""
ALEJO - Advanced Learning Engine with Judgment Orchestration
Hugging Face Model - Transformers-specific model implementation
"""

import os
import logging
import tempfile
from typing import Dict, Any, Optional, List, Union, Tuple

import numpy as np

from alejo.ml.models.model_base import ModelBase

logger = logging.getLogger("alejo.ml.huggingface")

class HuggingFaceModel(ModelBase):
    """
    Hugging Face Transformers model implementation for ALEJO.
    
    This class handles loading, inference, and memory management for models from
    the Hugging Face Hub and local Transformers models.
    """
    
    def __init__(
        self, 
        model_id: str, 
        framework: str = "huggingface",
        config: Dict[str, Any] = None,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize a Hugging Face model.
        
        Args:
            model_id: Unique identifier for the model
            framework: Framework identifier (should be "huggingface")
            config: Model-specific configuration
            cache_dir: Directory for model caching
        """
        super().__init__(model_id, framework, config, cache_dir)
        
        # Lazy import Transformers to avoid loading it unnecessarily
        self.transformers = None
        self.torch = None
        
        # Model configuration
        self.hf_model_id = config.get("hf_model_id")  # Hugging Face Hub model ID
        self.model_path = config.get("model_path")    # Local path to model
        self.model_type = config.get("model_type", "auto")  # auto, text-generation, etc.
        self.tokenizer_path = config.get("tokenizer_path")  # Optional separate tokenizer path
        self.use_auth_token = config.get("use_auth_token", False)  # For private models
        self.revision = config.get("revision", "main")  # Model revision/branch
        self.trust_remote_code = config.get("trust_remote_code", False)
        self.memory_usage_bytes = 0
        
        # Hugging Face specific metadata
        self.metadata.update({
            "hf_model_id": self.hf_model_id,
            "model_type": self.model_type,
            "device": None,
            "quantization": config.get("quantization", None),
        })
        
    def _import_dependencies(self) -> bool:
        """
        Import Hugging Face Transformers and PyTorch.
        
        Returns:
            True if import was successful, False otherwise
        """
        if self.transformers is not None:
            return True
            
        try:
            # Import PyTorch first
            import torch
            self.torch = torch
            
            # Import Transformers
            import transformers
            self.transformers = transformers
            
            # Configure device
            device = self.config.get("device", "auto")
            if device == "auto":
                device = "cuda" if torch.cuda.is_available() else "cpu"
                if device == "cpu" and hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    device = "mps"  # Use Apple Metal if available
                    
            self.metadata["device"] = device
            
            # Configure Transformers
            if self.config.get("disable_telemetry", True):
                transformers.utils.logging.disable_progress_bar()
                transformers.utils.logging.set_verbosity_error()
                
            # Set up logging level
            log_level = self.config.get("log_level", "error")
            if log_level == "info":
                transformers.utils.logging.set_verbosity_info()
            elif log_level == "warning":
                transformers.utils.logging.set_verbosity_warning()
            elif log_level == "error":
                transformers.utils.logging.set_verbosity_error()
                
            logger.info(f"Hugging Face Transformers {transformers.__version__} imported successfully (device: {device})")
            return True
        except ImportError as e:
            logger.error(f"Failed to import dependencies: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error configuring dependencies: {str(e)}")
            return False
            
    def load(self) -> bool:
        """
        Load the Hugging Face model into memory.
        
        Returns:
            True if loading was successful, False otherwise
        """
        if self.is_loaded:
            return True
            
        if not self._import_dependencies():
            return False
            
        try:
            # Get device
            device = self.metadata["device"]
            
            # Determine model source
            model_source = self.model_path if self.model_path else self.hf_model_id
            if not model_source:
                logger.error(f"No model path or Hugging Face model ID specified for {self.model_id}")
                return False
                
            # Prepare cache directory
            cache_dir = self.get_cache_path()
            
            # Prepare quantization config if needed
            quantization_config = None
            if self.metadata["quantization"]:
                quant_type = self.metadata["quantization"]
                if quant_type == "int8":
                    quantization_config = self.transformers.BitsAndBytesConfig(
                        load_in_8bit=True,
                        llm_int8_threshold=6.0
                    )
                elif quant_type == "int4":
                    quantization_config = self.transformers.BitsAndBytesConfig(
                        load_in_4bit=True,
                        bnb_4bit_compute_dtype=self.torch.float16
                    )
                    
            # Load tokenizer
            tokenizer_source = self.tokenizer_path if self.tokenizer_path else model_source
            self.tokenizer = self.transformers.AutoTokenizer.from_pretrained(
                tokenizer_source,
                cache_dir=cache_dir,
                use_auth_token=self.use_auth_token,
                revision=self.revision,
                trust_remote_code=self.trust_remote_code
            )
            
            # Load model based on type
            if self.model_type == "auto":
                self.model = self.transformers.AutoModel.from_pretrained(
                    model_source,
                    cache_dir=cache_dir,
                    use_auth_token=self.use_auth_token,
                    revision=self.revision,
                    trust_remote_code=self.trust_remote_code,
                    quantization_config=quantization_config,
                    device_map=device if quantization_config else None
                )
                if not quantization_config:
                    self.model.to(device)
                    
            elif self.model_type == "text-generation":
                self.model = self.transformers.AutoModelForCausalLM.from_pretrained(
                    model_source,
                    cache_dir=cache_dir,
                    use_auth_token=self.use_auth_token,
                    revision=self.revision,
                    trust_remote_code=self.trust_remote_code,
                    quantization_config=quantization_config,
                    device_map=device if quantization_config else None
                )
                if not quantization_config:
                    self.model.to(device)
                    
            elif self.model_type == "text-classification":
                self.model = self.transformers.AutoModelForSequenceClassification.from_pretrained(
                    model_source,
                    cache_dir=cache_dir,
                    use_auth_token=self.use_auth_token,
                    revision=self.revision,
                    trust_remote_code=self.trust_remote_code,
                    quantization_config=quantization_config,
                    device_map=device if quantization_config else None
                )
                if not quantization_config:
                    self.model.to(device)
                    
            elif self.model_type == "token-classification":
                self.model = self.transformers.AutoModelForTokenClassification.from_pretrained(
                    model_source,
                    cache_dir=cache_dir,
                    use_auth_token=self.use_auth_token,
                    revision=self.revision,
                    trust_remote_code=self.trust_remote_code,
                    quantization_config=quantization_config,
                    device_map=device if quantization_config else None
                )
                if not quantization_config:
                    self.model.to(device)
                    
            elif self.model_type == "question-answering":
                self.model = self.transformers.AutoModelForQuestionAnswering.from_pretrained(
                    model_source,
                    cache_dir=cache_dir,
                    use_auth_token=self.use_auth_token,
                    revision=self.revision,
                    trust_remote_code=self.trust_remote_code,
                    quantization_config=quantization_config,
                    device_map=device if quantization_config else None
                )
                if not quantization_config:
                    self.model.to(device)
                    
            elif self.model_type == "text-to-text":
                self.model = self.transformers.AutoModelForSeq2SeqLM.from_pretrained(
                    model_source,
                    cache_dir=cache_dir,
                    use_auth_token=self.use_auth_token,
                    revision=self.revision,
                    trust_remote_code=self.trust_remote_code,
                    quantization_config=quantization_config,
                    device_map=device if quantization_config else None
                )
                if not quantization_config:
                    self.model.to(device)
                    
            elif self.model_type == "feature-extraction":
                self.model = self.transformers.AutoModel.from_pretrained(
                    model_source,
                    cache_dir=cache_dir,
                    use_auth_token=self.use_auth_token,
                    revision=self.revision,
                    trust_remote_code=self.trust_remote_code,
                    quantization_config=quantization_config,
                    device_map=device if quantization_config else None
                )
                if not quantization_config:
                    self.model.to(device)
                    
            elif self.model_type == "pipeline":
                # Create a pipeline
                task = self.config.get("pipeline_task", "text-generation")
                self.model = self.transformers.pipeline(
                    task,
                    model=model_source,
                    tokenizer=self.tokenizer,
                    device=0 if device == "cuda" else device,
                    use_auth_token=self.use_auth_token,
                    revision=self.revision,
                    trust_remote_code=self.trust_remote_code
                )
            else:
                logger.error(f"Unsupported model type: {self.model_type}")
                return False
                
            # Set model to evaluation mode
            if hasattr(self.model, "eval") and callable(self.model.eval):
                self.model.eval()
                
            # Estimate memory usage
            self._estimate_memory_usage()
            
            self.is_loaded = True
            self.touch()
            logger.info(f"Loaded Hugging Face model: {self.model_id} ({self.model_type})")
            return True
        except Exception as e:
            logger.error(f"Failed to load Hugging Face model {self.model_id}: {str(e)}")
            self.model = None
            self.tokenizer = None
            return False
            
    def unload(self) -> bool:
        """
        Unload the Hugging Face model from memory.
        
        Returns:
            True if unloading was successful, False otherwise
        """
        if not self.is_loaded:
            return True
            
        try:
            # Move model to CPU first to free GPU memory
            if self.torch and self.model is not None and hasattr(self.model, "to"):
                try:
                    self.model.to("cpu")
                except:
                    pass  # Ignore errors for pipeline models
                    
            # Clear model and tokenizer
            self.model = None
            self.tokenizer = None
            
            # Force garbage collection
            import gc
            gc.collect()
            
            # Clear CUDA cache if available
            if self.torch and hasattr(self.torch.cuda, "empty_cache"):
                self.torch.cuda.empty_cache()
                
            self.is_loaded = False
            self.memory_usage_bytes = 0
            logger.info(f"Unloaded Hugging Face model: {self.model_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to unload Hugging Face model {self.model_id}: {str(e)}")
            return False
            
    def predict(self, inputs: Any, **kwargs) -> Any:
        """
        Run inference on the Hugging Face model.
        
        Args:
            inputs: Input data for the model (text, tokens, etc.)
            **kwargs: Additional arguments for the model
            
        Returns:
            Model predictions
        """
        if not self.is_loaded:
            if not self.load():
                raise RuntimeError(f"Failed to load model {self.model_id}")
                
        self.touch()
        
        try:
            # Get device
            device = self.metadata["device"]
            
            # Process inputs based on model type
            if self.model_type == "pipeline":
                # Pipeline models handle tokenization internally
                return self.model(inputs, **kwargs)
            else:
                # Handle different input types
                if isinstance(inputs, str) or (isinstance(inputs, list) and all(isinstance(item, str) for item in inputs)):
                    # Text input, tokenize first
                    encoding = self.tokenizer(
                        inputs,
                        return_tensors="pt",
                        padding=True,
                        truncation=True,
                        **kwargs.get("tokenizer_kwargs", {})
                    )
                    
                    # Move to device
                    encoding = {k: v.to(device) for k, v in encoding.items()}
                    
                    # Run model with no_grad
                    with self.torch.no_grad():
                        outputs = self.model(**encoding, **kwargs.get("model_kwargs", {}))
                        
                    # Process outputs based on model type
                    if self.model_type == "text-generation":
                        # Generate text if requested
                        if kwargs.get("generate", False):
                            generation_kwargs = kwargs.get("generation_kwargs", {})
                            generated_ids = self.model.generate(
                                encoding["input_ids"],
                                attention_mask=encoding.get("attention_mask", None),
                                **generation_kwargs
                            )
                            return self.tokenizer.batch_decode(
                                generated_ids,
                                skip_special_tokens=True,
                                clean_up_tokenization_spaces=True
                            )
                    
                    # Convert outputs to numpy or python types
                    return self._convert_outputs_to_numpy(outputs)
                elif isinstance(inputs, dict):
                    # Assume pre-tokenized inputs
                    # Move to device
                    inputs = {k: v.to(device) if hasattr(v, "to") else v for k, v in inputs.items()}
                    
                    # Run model with no_grad
                    with self.torch.no_grad():
                        outputs = self.model(**inputs, **kwargs.get("model_kwargs", {}))
                        
                    # Convert outputs to numpy or python types
                    return self._convert_outputs_to_numpy(outputs)
                else:
                    raise ValueError(f"Unsupported input type: {type(inputs)}")
        except Exception as e:
            logger.error(f"Error during Hugging Face inference: {str(e)}")
            raise
            
    def _convert_outputs_to_numpy(self, outputs: Any) -> Any:
        """
        Convert Hugging Face model outputs to numpy arrays or Python types.
        
        Args:
            outputs: Model outputs
            
        Returns:
            Converted outputs
        """
        if outputs is None:
            return None
            
        # Handle different output types
        if hasattr(outputs, "to_tuple"):
            # Convert to tuple first
            outputs = outputs.to_tuple()
            
        if isinstance(outputs, tuple):
            # Convert each element in the tuple
            return tuple(self._convert_outputs_to_numpy(item) for item in outputs)
        elif isinstance(outputs, list):
            # Convert each element in the list
            return [self._convert_outputs_to_numpy(item) for item in outputs]
        elif isinstance(outputs, dict):
            # Convert each value in the dict
            return {k: self._convert_outputs_to_numpy(v) for k, v in outputs.items()}
        elif hasattr(outputs, "detach") and hasattr(outputs, "cpu") and hasattr(outputs, "numpy"):
            # PyTorch tensor
            return outputs.detach().cpu().numpy()
        else:
            # Return as is
            return outputs
            
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
                
            # For pipeline models
            if self.model_type == "pipeline":
                # Use a rough estimate based on model type
                if "gpt" in str(self.model).lower() or "llama" in str(self.model).lower():
                    self.memory_usage_bytes = 5 * 1024 * 1024 * 1024  # 5GB for large LLMs
                else:
                    self.memory_usage_bytes = 1 * 1024 * 1024 * 1024  # 1GB for smaller models
                return
                
            # For regular models, count parameters
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
            if self.metadata["device"] == "cuda":
                self.memory_usage_bytes = int(self.memory_usage_bytes * 2)  # Double for GPU overhead
                
            logger.debug(f"Estimated memory usage for {self.model_id}: {self.memory_usage_bytes / (1024*1024):.2f} MB")
        except Exception as e:
            logger.warning(f"Failed to estimate memory usage: {str(e)}")
            # Default to 1GB if estimation fails
            self.memory_usage_bytes = 1 * 1024 * 1024 * 1024
