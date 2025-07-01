#!/usr/bin/env python3
"""
ALEJO Model Fetcher Utility

Downloads and verifies LLM and VLM models for ALEJO.

Usage:
    python model_fetcher.py [--model MODEL] [--list] [--force]

Options:
    --model MODEL   Model tier to download (default: standard)
                    Options: lightweight, standard, performance, vlm_standard
    --list          List available models and exit
    --force         Force re-download even if model exists
"""
import argparse
import asyncio
import os
import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add ALEJO directory to the path
script_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(script_dir.parent))

from alejo.llm_client.model_manager import ModelManager, MODEL_TIERS, VLM_MODEL_TIERS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("model_fetcher")

def list_models():
    """List available models with their details"""
    logger.info("Available LLM Models:")
    
    for tier_id, tier in MODEL_TIERS.items():
        logger.info(f" - {tier_id}: {tier.name} ({tier.params_billion}B, {tier.size_gb:.1f}GB)")
        logger.info(f"   Description: {tier.description}")
        logger.info("")
    
    logger.info("Available VLM (Vision) Models:")
    for tier_id, tier in VLM_MODEL_TIERS.items():
        logger.info(f" - {tier_id}: {tier.name} ({tier.params_billion}B, {tier.size_gb:.1f}GB)")
        logger.info(f"   Description: {tier.description}")
        logger.info("")

def download_model(model_tier: str, force: bool = False):
    """Download a model using the model manager"""
    model_manager = ModelManager()
    
    # Get all tiers (both LLM and VLM)
    all_tiers = {**MODEL_TIERS, **VLM_MODEL_TIERS}
    
    if model_tier not in all_tiers:
        logger.error(f"Unknown model tier: {model_tier}")
        logger.error(f"Available tiers: {', '.join(all_tiers.keys())}")
        return False
    
    tier = all_tiers[model_tier]
    
    # Check system compatibility
    is_compatible = True
    system_specs = model_manager.system_specs
    
    if system_specs["ram_gb"] < tier.min_ram_gb:
        logger.warning(f"Warning: Your system has {system_specs['ram_gb']:.1f}GB RAM, but {tier.name} "
              f"recommends at least {tier.min_ram_gb:.1f}GB")
        is_compatible = False
    
    if tier.min_vram_gb and system_specs["has_gpu"]:
        if system_specs["vram_gb"] < tier.min_vram_gb:
            logger.warning(f"Warning: Your GPU has {system_specs['vram_gb']:.1f}GB VRAM, but {tier.name} "
                  f"recommends at least {tier.min_vram_gb:.1f}GB for GPU acceleration")
    
    if not is_compatible:
        logger.warning("This model may not perform well on your system.")
        confirm = input("Continue anyway? [y/N]: ")
        if confirm.lower() not in ["y", "yes"]:
            logger.info("Download cancelled")
            return False
    
    try:
        # Download the model
        logger.info(f"Downloading {tier.name} model...")
        model_path = model_manager.download_model(tier, force=force)
        logger.info(f"Model successfully downloaded and verified to {model_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to download model: {str(e)}")
        return False

def check_models_dir():
    """Check if the models directory exists and create if needed"""
    default_path = Path.home() / ".alejo" / "models"
    
    if not default_path.exists():
        try:
            default_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created models directory at {default_path}")
        except Exception as e:
            logger.error(f"Failed to create models directory: {str(e)}")
            return False
    
    # Check if directory is writable
    try:
        test_file = default_path / ".write_test"
        with open(test_file, "w") as f:
            f.write("test")
        test_file.unlink()
    except Exception:
        logger.error(f"Models directory {default_path} is not writable")
        return False
    
    return True

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="ALEJO Model Fetcher Utility")
    parser.add_argument("--model", default="standard", 
                      help="Model tier to download (lightweight, standard, performance, vlm_standard)")
    parser.add_argument("--list", action="store_true",
                      help="List available models and exit")
    parser.add_argument("--force", action="store_true",
                      help="Force re-download even if model exists")
    
    args = parser.parse_args()
    
    if args.list:
        list_models()
        return 0
    
    if not check_models_dir():
        return 1
    
    success = download_model(args.model, args.force)
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())