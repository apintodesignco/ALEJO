"""
Automatic Model Management for ALEJO

Handles automatic model selection, download, cleanup, and updates based on system capabilities.
This ensures ALEJO works out-of-the-box with minimal user intervention.
"""
import os
import logging
import asyncio
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import datetime
import json

from .model_manager import ModelManager, ModelTier, MODEL_TIERS, VLM_MODEL_TIERS

logger = logging.getLogger(__name__)

# Constants
MODEL_METADATA_FILE = "model_metadata.json"
MAX_OLD_MODELS = 1  # Keep at most this many old models
CLEANUP_THRESHOLD_DAYS = 30  # Clean models older than this

class AutoModelManager:
    """
    Manages automatic model selection, download, and cleanup based on system specs.
    Provides a seamless experience for users who may not be technical.
    """
    
    def __init__(self, models_dir: Optional[Path] = None):
        """
        Initialize the automatic model manager.
        
        Args:
            models_dir: Optional custom path to models directory
        """
        self.model_manager = ModelManager(models_dir)
        self.models_dir = self.model_manager.models_dir
        self.metadata_path = self.models_dir / MODEL_METADATA_FILE
        
        # Load or create metadata
        self.metadata = self._load_metadata()
    
    def _load_metadata(self) -> Dict:
        """Load model metadata or create if it doesn't exist"""
        if self.metadata_path.exists():
            try:
                with open(self.metadata_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load model metadata: {e}")
        
        # Create default metadata
        metadata = {
            "models": {},
            "last_check": None,
            "last_cleanup": None
        }
        self._save_metadata(metadata)
        return metadata
    
    def _save_metadata(self, metadata: Optional[Dict] = None) -> None:
        """Save model metadata"""
        if metadata is None:
            metadata = self.metadata
            
        try:
            with open(self.metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save model metadata: {e}")
    
    def _update_model_metadata(self, model_id: str, tier_id: str) -> None:
        """Update metadata for a specific model"""
        self.metadata["models"][model_id] = {
            "tier_id": tier_id,
            "installed_date": datetime.datetime.now().isoformat(),
            "last_used": datetime.datetime.now().isoformat()
        }
        self._save_metadata()
    
    def _mark_model_used(self, model_id: str) -> None:
        """Mark a model as recently used"""
        if model_id in self.metadata["models"]:
            self.metadata["models"][model_id]["last_used"] = datetime.datetime.now().isoformat()
            self._save_metadata()
    
    async def ensure_best_model(self, model_type: str = "llm", force_check: bool = False) -> Path:
        """
        Ensures the best model for the current system is downloaded and available.
        Downloads if missing, and triggers cleanup of old models.
        
        Args:
            model_type: Type of model ("llm" or "vlm")
            force_check: Force checking even if recently checked
            
        Returns:
            Path to the best model
        """
        # Determine best model tier for the system
        tier = self.model_manager.get_recommended_tier(model_type)
        model_id = tier.model_id
        
        logger.info(f"Best {model_type.upper()} model for this system: {tier.name} ({model_id})")
        
        model_path = self.models_dir / f"{model_id}.gguf"
        
        # Check if model needs to be downloaded
        if not model_path.exists():
            logger.info(f"Model {model_id} not found, downloading...")
            model_path = await self._download_model_async(tier)
            self._update_model_metadata(model_id, tier.name)
        else:
            logger.info(f"Model {model_id} already exists")
            self._mark_model_used(model_id)
        
        # Run cleanup in background
        asyncio.create_task(self.cleanup_old_models())
        
        return model_path
    
    async def _download_model_async(self, tier: ModelTier) -> Path:
        """Download a model asynchronously"""
        # Create a thread to run the synchronous download
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self.model_manager.download_model(tier))
    
    async def cleanup_old_models(self) -> None:
        """
        Clean up old or unused models to save disk space.
        Keeps only the most recently used models up to MAX_OLD_MODELS.
        """
        # Update last cleanup timestamp
        self.metadata["last_cleanup"] = datetime.datetime.now().isoformat()
        self._save_metadata()
        
        # Get all model files
        model_files = list(self.models_dir.glob("*.gguf"))
        if len(model_files) <= MAX_OLD_MODELS + 1:  # +1 for current model
            return
            
        # Sort models by last usage
        sorted_models = []
        for model_file in model_files:
            model_id = model_file.stem
            if model_id in self.metadata["models"]:
                last_used = self.metadata["models"][model_id].get(
                    "last_used", datetime.datetime.min.isoformat()
                )
                sorted_models.append((model_file, last_used))
            else:
                # If no metadata, assume oldest
                sorted_models.append((model_file, datetime.datetime.min.isoformat()))
        
        # Sort by last used date (oldest first)
        sorted_models.sort(key=lambda x: x[1])
        
        # Delete oldest models beyond our limit
        models_to_delete = sorted_models[:-MAX_OLD_MODELS-1]
        for model_file, _ in models_to_delete:
            model_id = model_file.stem
            try:
                model_file.unlink()
                logger.info(f"Cleaned up old model: {model_id}")
                
                # Remove from metadata
                if model_id in self.metadata["models"]:
                    del self.metadata["models"][model_id]
                    self._save_metadata()
            except Exception as e:
                logger.warning(f"Failed to clean up model {model_id}: {e}")

    async def check_for_updates(self, current_model_id: str) -> Tuple[bool, Optional[Path]]:
        """
        Check if there's a newer version of the model available.
        
        Args:
            current_model_id: Current model ID
            
        Returns:
            Tuple of (update_available, new_model_path)
        """
        # This would typically check a remote API for newer models
        # For now, we'll just return False (no updates)
        return False, None
