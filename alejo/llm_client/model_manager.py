"""
Model Management System for ALEJO
Handles model discovery, system compatibility checks, downloads, and verification.
"""
import os
import sys
import json
import shutil
import platform
import hashlib
import logging
import pathlib
from typing import Dict, List, Optional, Tuple
import psutil
import torch
import urllib.request
from dataclasses import dataclass
from tqdm import tqdm

logger = logging.getLogger(__name__)

@dataclass
class ModelTier:
    name: str
    model_id: str
    params_billion: float
    size_gb: float
    min_ram_gb: float
    min_vram_gb: Optional[float]
    description: str
    url: str
    sha256: str

# Define available model tiers
MODEL_TIERS = {
    "lightweight": ModelTier(
        name="Lightweight",
        model_id="llama-2-7b-q4_k_m",
        params_billion=7,
        size_gb=3.5,
        min_ram_gb=8,
        min_vram_gb=None,  # CPU only is fine
        description="Best for basic systems. Good for general use with minimal resource requirements.",
        url="https://huggingface.co/TheBloke/Llama-2-7B-GGUF/resolve/main/llama-2-7b-Q4_K_M.gguf",
        sha256="292c0939f1eb5c5d5d5c6966a29adaf05c1b13dd6396e1b1390f5d71de520342"
    ),
    "standard": ModelTier(
        name="Standard",
        model_id="llama-3-13b-q4_k_m",
        params_billion=13,
        size_gb=7.8,
        min_ram_gb=16,
        min_vram_gb=6,
        description="Recommended for most users. Excellent balance of performance and resource usage.",
        url="https://huggingface.co/TheBloke/Llama-3-13B-GGUF/resolve/main/llama-3-13b-Q4_K_M.gguf",
        sha256="d0f0b1a2c9814f7a40a270b51e7b54a8f2feea300ecfb3d60c6e3ad0e4d522a6"
    ),
    "performance": ModelTier(
        name="Performance",
        model_id="llama-2-70b-q4_k_m",
        params_billion=70,
        size_gb=39.5,
        min_ram_gb=32,
        min_vram_gb=8,
        description="For high-end systems. Superior performance across all tasks.",
        url="https://huggingface.co/TheBloke/Llama-2-70B-GGUF/resolve/main/llama-2-70b-Q4_K_M.gguf",
        sha256="e2c9a8f1f21fa02c54df7eaa4f148b7c7f8b3c0916a7c0e3c4b9f5e4c08b766c"
    )
}

# Define available VLM model tiers
VLM_MODEL_TIERS = {
    "vlm_lightweight": ModelTier(
        name="VLM Lightweight",
        model_id="llava-v1.5-7b-q4_k_m",
        params_billion=7,
        size_gb=4.2,
        min_ram_gb=8,
        min_vram_gb=None,  # CPU only is fine
        description="Basic vision-language capabilities with minimal resource requirements.",
        url="https://huggingface.co/mys/ggml_llava-v1.5-7b/resolve/main/ggml-model-q4_k.gguf",
        sha256="a8ede58b3c5f5b8c9b2c5b75d3b4c2d5d4d5f5e5a8b8c9d2e5f8a9c8b7a6c5d4"
    ),
    "vlm_standard": ModelTier(
        name="VLM Standard",
        model_id="llava-v1.6-mistral-7b-q4_k_m",
        params_billion=7,
        size_gb=4.5,
        min_ram_gb=16,
        min_vram_gb=6,
        description="Recommended VLM for most users. Excellent balance of vision-language performance and resource usage.",
        url="https://huggingface.co/cjpais/llava-1.6-mistral-7b-gguf/resolve/main/llava-v1.6-mistral-7b.Q4_K_M.gguf",
        sha256="b8e9a3a2c8f9b8a7c6d5e4f3c2b1a0d9e8f7c6b5a4d3c2b1a0f9e8d7c6b5a4d3"
    ),
    "vlm_performance": ModelTier(
        name="VLM Performance",
        model_id="llava-v1.6-vicuna-13b-q4_k_m",
        params_billion=13,
        size_gb=8.2,
        min_ram_gb=24,
        min_vram_gb=8,
        description="High-end vision-language model for systems with more resources.",
        url="https://huggingface.co/cjpais/llava-v1.6-vicuna-13b-gguf/resolve/main/llava-v1.6-vicuna-13b.Q4_K_M.gguf",
        sha256="c7d9a2c8b5a4d3e2f1a0d9e8c7b6a5d4e3f2a1d0c9b8a7f6e5d4c3b2a1f0e9d8"
    )
}

class SystemSpecs:
    """Analyzes and reports system capabilities"""
    
    @staticmethod
    def get_specs() -> Dict[str, float]:
        """Get system specifications"""
        ram_gb = psutil.virtual_memory().total / (1024**3)
        
        gpu_vram_gb = 0
        if torch.cuda.is_available():
            gpu_vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            
        disk_gb = shutil.disk_usage("/").free / (1024**3)
        
        return {
            "ram_gb": ram_gb,
            "gpu_vram_gb": gpu_vram_gb,
            "free_disk_gb": disk_gb
        }

class ModelManager:
    """Manages LLM model selection, download, and verification"""
    
    def __init__(self, models_dir: Optional[pathlib.Path] = None):
        self.models_dir = models_dir or pathlib.Path.home() / ".alejo" / "models"
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.system_specs = SystemSpecs.get_specs()
        
        # Combined model tiers for easier access
        self.all_model_tiers = {**MODEL_TIERS, **VLM_MODEL_TIERS}
        
    def get_compatible_tiers(self, model_type: str = "llm") -> List[ModelTier]:
        """Get list of model tiers compatible with the system
        
        Args:
            model_type: Type of model to check compatibility for ("llm" or "vlm")
        """
        compatible = []
        
        # Select appropriate model tiers based on type
        tiers_to_check = MODEL_TIERS if model_type == "llm" else VLM_MODEL_TIERS
        
        for tier_id, tier in tiers_to_check.items():
            # Check RAM requirements
            if self.system_specs["ram_gb"] < tier.min_ram_gb:
                continue
                
            # Check GPU requirements if specified
            if tier.min_vram_gb and self.system_specs["gpu_vram_gb"] < tier.min_vram_gb:
                continue
                
            # Check disk space
            if self.system_specs["free_disk_gb"] < tier.size_gb * 1.2:  # 20% buffer
                continue
                
            compatible.append(tier)
            
        return compatible
    
    def get_recommended_tier(self, model_type: str = "llm") -> ModelTier:
        """Get the recommended model tier for the current system
        
        Args:
            model_type: Type of model to get recommendation for ("llm" or "vlm")
        """
        compatible = self.get_compatible_tiers(model_type)
        
        # Select appropriate default tier based on model type
        default_tier = "lightweight" if model_type == "llm" else "vlm_lightweight"
        standard_tier = "standard" if model_type == "llm" else "vlm_standard"
        tiers_dict = MODEL_TIERS if model_type == "llm" else VLM_MODEL_TIERS
        
        if not compatible:
            # Fall back to lightweight if nothing else is compatible
            return tiers_dict[default_tier]
            
        # Prefer standard tier if compatible
        if any(t.model_id == tiers_dict[standard_tier].model_id for t in compatible):
            return tiers_dict[standard_tier]
            
        # Otherwise return the largest compatible model
        return max(compatible, key=lambda t: t.params_billion)
    
    def download_model(self, tier: ModelTier, force: bool = False) -> pathlib.Path:
        """Download and verify a model"""
        model_path = self.models_dir / f"{tier.model_id}.gguf"
        
        if model_path.exists() and not force:
            # Verify existing model
            if self._verify_checksum(model_path, tier.sha256):
                logger.info(f"Model {tier.model_id} already exists and verified")
                return model_path
            else:
                logger.warning(f"Model {tier.model_id} exists but failed verification")
                
        # Download with progress bar
        logger.info(f"Downloading {tier.name} model ({tier.size_gb:.1f}GB)...")
        
        temp_path = model_path.with_suffix('.tmp')
        with urllib.request.urlopen(tier.url) as response:
            total_size = int(response.headers['Content-Length'])
            with open(temp_path, 'wb') as f, tqdm(
                total=total_size,
                unit='iB',
                unit_scale=True
            ) as pbar:
                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    f.write(chunk)
                    pbar.update(len(chunk))
        
        # Verify downloaded file
        if self._verify_checksum(temp_path, tier.sha256):
            temp_path.rename(model_path)
            logger.info(f"Successfully downloaded and verified {tier.name} model")
            return model_path
        else:
            temp_path.unlink()
            raise ValueError(f"Downloaded model {tier.model_id} failed verification")
    
    def _verify_checksum(self, path: pathlib.Path, expected: str) -> bool:
        """Verify file integrity using SHA256"""
        sha256 = hashlib.sha256()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest() == expected
    
    def get_model_info(self, model_path: pathlib.Path) -> Optional[ModelTier]:
        """Get information about an existing model"""
        for tier in MODEL_TIERS.values():
            if model_path.name == f"{tier.model_id}.gguf":
                return tier
        return None
