#!/usr/bin/env python3
"""
Script to stop any running ALEJO processes that might be consuming resources
"""
import os
import sys
import psutil
import logging
import time
import signal

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def find_alejo_processes():
    """Find all ALEJO-related processes"""
    alejo_processes = []
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            # Check if process name or command line contains 'alejo'
            if proc.info['cmdline']:
                cmdline = ' '.join(proc.info['cmdline']).lower()
                if 'alejo' in cmdline or 'gaze' in cmdline or 'test_event_bus' in cmdline:
                    # Skip this script itself
                    if 'stop_processes.py' in cmdline:
                        continue
                    alejo_processes.append(proc)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    return alejo_processes

def stop_processes(processes, force=False):
    """Stop the given processes"""
    for proc in processes:
        try:
            logger.info(f"Stopping process {proc.pid}: {' '.join(proc.info['cmdline'])}")
            
            if force:
                proc.kill()
            else:
                proc.terminate()
                
            logger.info(f"Process {proc.pid} terminated")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            logger.warning(f"Could not terminate process {proc.pid}")

def main():
    """Main function"""
    logger.info("Looking for ALEJO processes...")
    
    # Find ALEJO processes
    alejo_processes = find_alejo_processes()
    
    if not alejo_processes:
        logger.info("No ALEJO processes found")
        return
    
    logger.info(f"Found {len(alejo_processes)} ALEJO processes:")
    for proc in alejo_processes:
        logger.info(f"  PID {proc.pid}: {' '.join(proc.info['cmdline'])}")
    
    # Stop processes gracefully
    logger.info("Stopping processes gracefully...")
    stop_processes(alejo_processes)
    
    # Wait a bit for processes to terminate
    time.sleep(2)
    
    # Check if any processes are still running
    remaining_processes = [p for p in alejo_processes if p.is_running()]
    if remaining_processes:
        logger.warning(f"{len(remaining_processes)} processes still running, forcing termination...")
        stop_processes(remaining_processes, force=True)
    
    logger.info("All ALEJO processes stopped")

if __name__ == "__main__":
    main()