"""
ALEJO - Advanced Learning Engine with Judgment Orchestration
ML Configuration - Central configuration for all ML frameworks
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List, Union
from pathlib import Path

logger = logging.getLogger("alejo.ml.config")

class MLConfig:
    """
    Central configuration manager for all ML frameworks used in ALEJO.
    Handles configuration for TensorFlow, PyTorch, Hugging Face, and LLaMa.
    
    This class ensures consistent configuration across all ML components
    and provides validation, default settings, and environment-specific configs.
    """
    
    # Default configuration paths
    DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "default_config.json")
    USER_CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".alejo", "ml_config.json")
    
    # Framework identifiers
    TENSORFLOW = "tensorflow"
    PYTORCH = "pytorch"
    HUGGINGFACE = "huggingface"
    LLAMA = "llama"
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the ML configuration manager.
        
        Args:
            config_path: Optional path to a custom configuration file
        """
        self.config_path = config_path
        self.config = {}
        self._load_config()
        
    def _load_config(self) -> None:
        """Load configuration from files and environment variables"""
        # Start with default configuration
        self._load_default_config()
        
        # Override with user configuration if it exists
        if os.path.exists(self.USER_CONFIG_PATH):
            self._load_from_file(self.USER_CONFIG_PATH)
            
        # Override with custom configuration if provided
        if self.config_path and os.path.exists(self.config_path):
            self._load_from_file(self.config_path)
            
        # Override with environment variables
        self._load_from_env()
        
        # Validate the configuration
        self._validate_config()
        
        logger.info(f"ML configuration loaded successfully with {len(self.config)} framework settings")
        
    def _load_default_config(self) -> None:
        """Load the default configuration"""
        # Create default config directory if it doesn't exist
        os.makedirs(os.path.dirname(self.DEFAULT_CONFIG_PATH), exist_ok=True)
        
        # Default configuration for each framework
        default_config = {
            self.TENSORFLOW: {
                "memory_growth": True,
                "visible_devices": "",  # Empty means use all
                "log_level": 3,  # 0=all, 1=INFO, 2=WARNING, 3=ERROR
                "allow_xla": True,
                "allow_gpu": True,
                "precision": "mixed_float16",
                "cache_dir": os.path.join(os.path.expanduser("~"), ".alejo", "cache", "tensorflow"),
            },
            self.PYTORCH: {
                "device": "auto",  # auto, cpu, cuda, mps
                "precision": "float32",
                "num_threads": 4,
                "benchmark_mode": False,
                "deterministic": False,
                "cache_dir": os.path.join(os.path.expanduser("~"), ".alejo", "cache", "pytorch"),
            },
            self.HUGGINGFACE: {
                "cache_dir": os.path.join(os.path.expanduser("~"), ".alejo", "cache", "huggingface"),
                "offline_mode": False,
                "use_auth_token": "",
                "revision": "main",
                "trust_remote_code": False,
                "max_memory": None,
            },
            self.LLAMA: {
                "model_path": os.path.join(os.path.expanduser("~"), ".alejo", "models", "llama"),
                "n_ctx": 2048,
                "n_batch": 512,
                "n_gpu_layers": -1,  # -1 means auto-detect
                "use_mlock": False,
                "use_mmap": True,
                "embedding": True,
                "verbose": False,
            }
        }
        
        # Save default config if it doesn't exist
        if not os.path.exists(self.DEFAULT_CONFIG_PATH):
            os.makedirs(os.path.dirname(self.DEFAULT_CONFIG_PATH), exist_ok=True)
            with open(self.DEFAULT_CONFIG_PATH, 'w') as f:
                json.dump(default_config, f, indent=2)
        
        self.config = default_config
        
    def _load_from_file(self, file_path: str) -> None:
        """
        Load configuration from a JSON file
        
        Args:
            file_path: Path to the configuration file
        """
        try:
            with open(file_path, 'r') as f:
                file_config = json.load(f)
                
            # Update configuration with file values
            for framework, settings in file_config.items():
                if framework in self.config:
                    self.config[framework].update(settings)
                else:
                    self.config[framework] = settings
                    
            logger.debug(f"Loaded configuration from {file_path}")
        except Exception as e:
            logger.error(f"Failed to load configuration from {file_path}: {str(e)}")
            
    def _load_from_env(self) -> None:
        """Load configuration from environment variables"""
        # Environment variable format: ALEJO_ML_{FRAMEWORK}_{SETTING}
        # Example: ALEJO_ML_TENSORFLOW_ALLOW_GPU=false
        
        prefix = "ALEJO_ML_"
        for key, value in os.environ.items():
            if key.startswith(prefix):
                parts = key[len(prefix):].lower().split('_', 1)
                if len(parts) == 2:
                    framework, setting = parts
                    
                    # Convert value to appropriate type
                    if value.lower() in ('true', 'yes', '1'):
                        typed_value = True
                    elif value.lower() in ('false', 'no', '0'):
                        typed_value = False
                    elif value.isdigit():
                        typed_value = int(value)
                    elif value.replace('.', '', 1).isdigit() and value.count('.') <= 1:
                        typed_value = float(value)
                    else:
                        typed_value = value
                        
                    # Update configuration
                    if framework in self.config:
                        self.config[framework][setting] = typed_value
                        logger.debug(f"Updated {framework}.{setting} from environment: {typed_value}")
                        
    def _validate_config(self) -> None:
        """Validate the configuration and set missing values to defaults"""
        # Ensure all required frameworks are present
        required_frameworks = [self.TENSORFLOW, self.PYTORCH, self.HUGGINGFACE, self.LLAMA]
        for framework in required_frameworks:
            if framework not in self.config:
                logger.warning(f"Missing configuration for {framework}, using defaults")
                self._load_default_config()
                break
                
        # Create cache directories
        for framework in self.config:
            if "cache_dir" in self.config[framework]:
                os.makedirs(self.config[framework]["cache_dir"], exist_ok=True)
                
        # Create model directories
        if "model_path" in self.config.get(self.LLAMA, {}):
            os.makedirs(self.config[self.LLAMA]["model_path"], exist_ok=True)
            
    def get_framework_config(self, framework: str) -> Dict[str, Any]:
        """
        Get configuration for a specific framework
        
        Args:
            framework: Framework identifier (tensorflow, pytorch, huggingface, llama)
            
        Returns:
            Dictionary with framework configuration
        """
        return self.config.get(framework, {})
        
    def set_framework_config(self, framework: str, settings: Dict[str, Any]) -> None:
        """
        Update configuration for a specific framework
        
        Args:
            framework: Framework identifier
            settings: Dictionary with settings to update
        """
        if framework in self.config:
            self.config[framework].update(settings)
        else:
            self.config[framework] = settings
            
        logger.debug(f"Updated configuration for {framework}")
        
    def save_user_config(self) -> None:
        """Save current configuration to user config file"""
        try:
            os.makedirs(os.path.dirname(self.USER_CONFIG_PATH), exist_ok=True)
            with open(self.USER_CONFIG_PATH, 'w') as f:
                json.dump(self.config, f, indent=2)
                
            logger.info(f"Saved user configuration to {self.USER_CONFIG_PATH}")
        except Exception as e:
            logger.error(f"Failed to save user configuration: {str(e)}")
            
    def get_tensorflow_config(self) -> Dict[str, Any]:
        """Get TensorFlow specific configuration"""
        return self.get_framework_config(self.TENSORFLOW)
        
    def get_pytorch_config(self) -> Dict[str, Any]:
        """Get PyTorch specific configuration"""
        return self.get_framework_config(self.PYTORCH)
        
    def get_huggingface_config(self) -> Dict[str, Any]:
        """Get Hugging Face specific configuration"""
        return self.get_framework_config(self.HUGGINGFACE)
        
    def get_llama_config(self) -> Dict[str, Any]:
        """Get LLaMa specific configuration"""
        return self.get_framework_config(self.LLAMA)
