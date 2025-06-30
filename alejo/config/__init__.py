"""
ALEJO Configuration Module
Manages configuration for all ALEJO components
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class ConfigManager:
    """Manages ALEJO configuration"""
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize configuration manager
        
        Args:
            config_path: Optional path to config file
        """
        self.config_path = config_path or os.getenv(
            "ALEJO_CONFIG",
            str(Path.home() / ".alejo" / "config.json")
        )
        self._config = self._load_config()
        
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file"""
        default_config = {
            "llm": {
                "provider": "local",  # Default to local Llama.cpp
                "model_name": "llama-3-13b-q4_k_m",
                "model_tier": "standard",
                "max_tokens": 2048,
                "temperature": 0.7,
                "top_p": 1.0,
                "retry_attempts": 3,
                "timeout": 30.0,
                "n_ctx": 4096,
                "gpu_layers": 35  # Will be auto-adjusted based on hardware
            },
            "vision": {
                "provider": "local",  # Use local model for vision by default
                "model_name": "llava-v1.6-mistral-7b-q4_k_m",
                "max_tokens": 300,
                "temperature": 0.7,
                "retry_attempts": 3,
                "timeout": 30.0,
                "gaze_tracking_enabled": True
            },
            "database": {
                "path": "alejo_data.db"
            },
            "api": {
                "rate_limit": 60,  # Requests per minute
                "batch_size": 10
            }
        }
        
        try:
            # Ensure config directory exists
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            
            # Load existing config if it exists
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    config = json.load(f)
                # Update with any missing default values
                self._update_nested_dict(default_config, config)
                return config
            else:
                # Create new config file with defaults
                with open(self.config_path, 'w') as f:
                    json.dump(default_config, f, indent=4)
                return default_config
                
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return default_config
            
    def _update_nested_dict(self, d1: Dict, d2: Dict) -> None:
        """Update d1 with values from d2, preserving nested structure"""
        for k, v in d1.items():
            if k not in d2:
                d2[k] = v
            elif isinstance(v, dict) and isinstance(d2[k], dict):
                self._update_nested_dict(v, d2[k])
                
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value"""
        try:
            keys = key.split('.')
            value = self._config
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
            
    def set(self, key: str, value: Any) -> None:
        """Set configuration value"""
        keys = key.split('.')
        config = self._config
        for k in keys[:-1]:
            config = config.setdefault(k, {})
        config[keys[-1]] = value
        self._save_config()
        
    def _save_config(self) -> None:
        """Save configuration to file"""
        try:
            with open(self.config_path, 'w') as f:
                json.dump(self._config, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to save config: {e}")
            
    @property
    def llm_config(self) -> Dict[str, Any]:
        """Get LLM configuration"""
        return self.get('llm', {})
        
    @property
    def vision_config(self) -> Dict[str, Any]:
        """Get vision configuration"""
        return self.get('vision', {})
        
    @property
    def database_config(self) -> Dict[str, Any]:
        """Get database configuration"""
        return self.get('database', {})
        
    @property
    def api_config(self) -> Dict[str, Any]:
        """Get API configuration"""
        return self.get('api', {})
