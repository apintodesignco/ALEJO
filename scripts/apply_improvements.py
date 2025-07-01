#!/usr/bin/env python
"""
Apply Improvement Proposals Script for ALEJO CI/CD Pipeline

This script applies approved improvement proposals to the codebase.
It is designed to be run as part of the CI/CD pipeline in GitHub Actions
after improvements have been reviewed and approved.
"""

import os
import sys
import json
import logging
import asyncio
import argparse
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from alejo.core.config_manager import ConfigManager
from alejo.collective.improvement_engine import ImprovementEngine
from alejo.collective.data_manager import CollectiveDataManager
from alejo.utils.exceptions import ImprovementEngineError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("alejo.scripts.apply_improvements")

async def apply_improvements(config_path=None, input_file=None, dry_run=False):
    """
    Apply approved improvement proposals to the codebase
    
    Args:
        config_path: Path to configuration file
        input_file: Path to approved improvements JSON file
        dry_run: If True, only simulate applying improvements without making changes
    
    Returns:
        List of applied improvements
    """
    try:
        # Initialize configuration
        config_manager = ConfigManager(config_path)
        
        # Initialize data manager
        data_manager = CollectiveDataManager(config_manager)
        
        # Initialize improvement engine
        improvement_engine = ImprovementEngine(config_manager, data_manager)
        
        # Load approved improvements from input file if specified
        improvements = []
        if input_file and os.path.exists(input_file):
            with open(input_file, "r") as f:
                improvements = json.load(f)
            logger.info(f"Loaded {len(improvements)} approved improvements from {input_file}")
        else:
            # Get approved improvements from data manager
            improvements = await data_manager.get_approved_improvements()
            logger.info(f"Retrieved {len(improvements)} approved improvements from data manager")
        
        if not improvements:
            logger.info("No approved improvements to apply")
            return []
            
        # Apply improvements
        applied_improvements = []
        for improvement in improvements:
            improvement_id = improvement.get("id", "unknown")
            try:
                logger.info(f"Applying improvement {improvement_id}")
                
                if dry_run:
                    logger.info(f"Dry run: Would apply improvement {improvement_id}")
                    applied = True
                else:
                    # Apply the improvement
                    applied = await improvement_engine.apply_improvement(improvement)
                
                if applied:
                    logger.info(f"Successfully applied improvement {improvement_id}")
                    improvement["status"] = "applied"
                    improvement["applied_at"] = datetime.now().isoformat()
                    applied_improvements.append(improvement)
                else:
                    logger.warning(f"Failed to apply improvement {improvement_id}")
                    improvement["status"] = "failed"
            except Exception as e:
                logger.error(f"Error applying improvement {improvement_id}: {e}")
                improvement["status"] = "error"
                improvement["error"] = str(e)
        
        # Update improvements status in data manager
        if not dry_run and applied_improvements:
            await data_manager.update_improvements(applied_improvements)
            logger.info(f"Updated status for {len(applied_improvements)} improvements")
        
        return applied_improvements
        
    except Exception as e:
        logger.error(f"Error applying improvements: {e}")
        raise

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Apply approved improvements for ALEJO")
    parser.add_argument("--config", help="Path to configuration file")
    parser.add_argument("--input-file", help="Path to approved improvements JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Simulate applying improvements without making changes")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    asyncio.run(apply_improvements(args.config, args.input_file, args.dry_run))