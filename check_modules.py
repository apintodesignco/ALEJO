import sys
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_module(module_name):
    try:
        __import__(module_name)
        logger.info(f"Module {module_name} is available")
        return True
    except ImportError as e:
        logger.error(f"Failed to import {module_name}: {e}")
        return False

if __name__ == '__main__':
    logger.info("Checking Python environment and module availability...")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Python path: {sys.path}")
    logger.info(f"Current working directory: {os.getcwd()}")
    logger.info(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")

    modules_to_check = [
        'alejo',
        'alejo.brain',
        'alejo.brain.alejo_brain',
        'alejo.emotional_intelligence',
        'alejo.emotional_intelligence.memory',
        'alejo.emotional_intelligence.processor',
        'alejo.emotional_intelligence.ethics',
        'alejo.services',
        'alejo.services.communication',
        'alejo.utils',
        'alejo.utils.error_handling'
    ]

    for module in modules_to_check:
        check_module(module)
