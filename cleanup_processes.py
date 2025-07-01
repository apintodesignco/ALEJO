#!/usr/bin/env python3
"""
Script to clean up redundant ALEJO processes and reduce system load
"""
import os
import sys
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from alejo.core.process_manager import ProcessManager

def main():
    """Main function to clean up ALEJO processes"""
    logger.info("Starting ALEJO process cleanup...")
    
    # Create process manager
    process_manager = ProcessManager()
    
    # Find all ALEJO processes
    alejo_processes = process_manager.find_alejo_processes()
    logger.info(f"Found {len(alejo_processes)} ALEJO-related processes")
    
    # Print process info
    for proc in alejo_processes:
        try:
            cmdline = ' '.join(proc.info['cmdline'])
            logger.info(f"PID {proc.pid}: {cmdline}")
        except Exception:
            pass
    
    # Terminate redundant processes
    redundant_count = process_manager.terminate_redundant_processes()
    logger.info(f"Terminated {redundant_count} redundant processes")
    
    # Terminate test processes
    test_count = process_manager.terminate_all_test_processes()
    logger.info(f"Terminated {test_count} test processes")
    
    # Terminate resource-intensive processes (with higher thresholds to only catch extreme cases)
    intensive_count = process_manager.terminate_resource_intensive_processes(
        cpu_threshold=70.0, memory_threshold=50.0)
    logger.info(f"Terminated {intensive_count} resource-intensive processes")
    
    # Final check
    remaining = process_manager.find_alejo_processes()
    logger.info(f"Remaining ALEJO processes: {len(remaining)}")
    for proc in remaining:
        try:
            cmdline = ' '.join(proc.info['cmdline'])
            logger.info(f"PID {proc.pid}: {cmdline}")
        except Exception:
            pass
    
    logger.info("ALEJO process cleanup completed")

if __name__ == "__main__":
    main()