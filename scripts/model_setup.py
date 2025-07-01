#!/usr/bin/env python3
"""
ALEJO Model Setup Script
Helps users select and download the appropriate LLM model for their system.
"""
import os
import sys
import logging
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from alejo.llm_client.model_manager import ModelManager, MODEL_TIERS
def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

def main():
    setup_logging()
    logger = logging.getLogger(__name__)
    
    print("\n=== ALEJO Model Setup ===\n")
    
    # Initialize model manager
    model_manager = ModelManager()
    system_specs = model_manager.system_specs
    
    # Show system capabilities
    print("System Capabilities:")
    print(f"RAM: {system_specs['ram_gb']:.1f} GB")
    print(f"GPU VRAM: {system_specs['gpu_vram_gb']:.1f} GB")
    print(f"Free Disk Space: {system_specs['free_disk_gb']:.1f} GB")
    print()
    
    # Get compatible tiers
    compatible_tiers = model_manager.get_compatible_tiers()
    recommended_tier = model_manager.recommend_tier()
    
    print("Available Model Tiers:")
    for tier in MODEL_TIERS.values():
        status = ""
        if tier in compatible_tiers:
            status = "✓ Compatible"
            if tier == recommended_tier:
                status += " (Recommended)"
        else:
            status = "✗ Not Compatible"
            
        print(f"\n{tier.name}:")
        print(f"  - {tier.description}")
        print(f"  - {tier.params_billion}B parameters, {tier.size_gb:.1f}GB download")
        print(f"  - Requires: {tier.min_ram_gb}GB RAM", end="")
        if tier.min_vram_gb:
            print(f", {tier.min_vram_gb}GB VRAM")
        else:
            print(" (CPU-only)")
        print(f"  - Status: {status}")
    
    print("\nRecommended model tier for your system:", recommended_tier.name)
    
    # Ask user which tier to download
    while True:
        choice = input("\nWhich model tier would you like to use? [lightweight/standard/performance] ").lower()
        if choice in MODEL_TIERS:
            selected_tier = MODEL_TIERS[choice]
            if selected_tier not in compatible_tiers:
                print(f"\nWarning: The {selected_tier.name} model may not perform well on your system.")
                confirm = input("Are you sure you want to continue? [y/N] ").lower()
                if confirm != 'y':
                    continue
            break
        print("Invalid choice. Please select from:", ", ".join(MODEL_TIERS.keys()))
    
    # Download the selected model
    print(f"\nDownloading {selected_tier.name} model...")
    try:
        model_path = model_manager.download_model(selected_tier)
        print(f"\nSuccess! Model downloaded to: {model_path}")
        print("\nYou can now start ALEJO with this model.")
    except Exception as e:
        print(f"\nError downloading model: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()