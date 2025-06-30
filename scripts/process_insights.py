#!/usr/bin/env python
"""
Process Collective Insights Script for ALEJO CI/CD Pipeline

This script processes anonymized collective insights stored in the GitHub repository
and prepares them for improvement proposal generation. It is designed to be run
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
from alejo.collective.data_manager import CollectiveDataManager
from alejo.utils.exceptions import DataManagerError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("alejo.scripts.process_insights")

async def process_insights(config_path=None, output_dir=None):
    """
    Process collective insights from GitHub repository
    
    Args:
        config_path: Path to configuration file
        output_dir: Directory to output processed insights
    """
    try:
        # Initialize configuration
        config_manager = ConfigManager(config_path)
        
        # Initialize data manager
        data_manager = CollectiveDataManager(config_manager)
        
        # Get unprocessed insights
        logger.info("Retrieving unprocessed insights from GitHub repository")
        insights = await data_manager.get_unprocessed_insights()
        
        if not insights:
            logger.info("No unprocessed insights found")
            return
            
        logger.info(f"Found {len(insights)} unprocessed insights")
        
        # Process insights (anonymization is already done when storing to GitHub)
        # Here we can do additional processing like aggregation, categorization, etc.
        processed_insights = []
        for insight in insights:
            # Add processing timestamp
            insight["processed_at"] = datetime.now().isoformat()
            processed_insights.append(insight)
            
        # Save processed insights to output directory if specified
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            output_file = os.path.join(output_dir, "processed_insights.json")
            with open(output_file, "w") as f:
                json.dump(processed_insights, f, indent=2)
            logger.info(f"Saved {len(processed_insights)} processed insights to {output_file}")
            
        # Mark insights as processed in the data manager
        await data_manager.mark_insights_processed(insights)
        logger.info(f"Marked {len(insights)} insights as processed")
        
        return processed_insights
        
    except Exception as e:
        logger.error(f"Error processing insights: {e}")
        raise

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Process collective insights for ALEJO")
    parser.add_argument("--config", help="Path to configuration file")
    parser.add_argument("--output-dir", help="Directory to output processed insights")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    asyncio.run(process_insights(args.config, args.output_dir))
