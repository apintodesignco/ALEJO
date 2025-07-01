#!/usr/bin/env python
"""
Generate Improvement Proposals Script for ALEJO CI/CD Pipeline

This script generates improvement proposals based on processed collective insights
and creates GitHub pull requests for automated improvements. It is designed to be run
as part of the CI/CD pipeline in GitHub Actions.
"""

import os
import sys
import json
import logging
import asyncio
import argparse
from datetime import datetime
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
logger = logging.getLogger("alejo.scripts.generate_improvements")

async def generate_improvements(config_path=None, input_file=None, output_dir=None):
    """
    Generate improvement proposals based on processed insights
    
    Args:
        config_path: Path to configuration file
        input_file: Path to processed insights JSON file
        output_dir: Directory to output generated improvement proposals
    """
    try:
        # Initialize configuration
        config_manager = ConfigManager(config_path)
        
        # Initialize data manager
        data_manager = CollectiveDataManager(config_manager)
        
        # Initialize improvement engine
        improvement_engine = ImprovementEngine(config_manager, data_manager)
        
        # Load processed insights from input file if specified
        if input_file and os.path.exists(input_file):
            with open(input_file, "r") as f:
                insights = json.load(f)
            logger.info(f"Loaded {len(insights)} processed insights from {input_file}")
            
            # Store insights in data manager for processing
            await data_manager.store_insights(insights, processed=True)
        
        # Generate improvements
        logger.info("Generating improvement proposals")
        improvements = await improvement_engine.generate_improvements()
        
        if not improvements:
            logger.info("No improvement proposals generated")
            return []
            
        logger.info(f"Generated {len(improvements)} improvement proposals")
        
        # Save improvement proposals to output directory if specified
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            output_file = os.path.join(output_dir, "improvement_proposals.json")
            with open(output_file, "w") as f:
                json.dump(improvements, f, indent=2)
            logger.info(f"Saved {len(improvements)} improvement proposals to {output_file}")
        
        return improvements
        
    except Exception as e:
        logger.error(f"Error generating improvements: {e}")
        raise

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Generate improvement proposals for ALEJO")
    parser.add_argument("--config", help="Path to configuration file")
    parser.add_argument("--input-file", help="Path to processed insights JSON file")
    parser.add_argument("--output-dir", help="Directory to output improvement proposals")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    asyncio.run(generate_improvements(args.config, args.input_file, args.output_dir))