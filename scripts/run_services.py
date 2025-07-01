"""
Service Runner Script
Starts all ALEJO services for testing or development
"""

import asyncio
import subprocess
import sys
import os
from pathlib import Path
import signal
import time
import json
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)

class ServiceRunner:
    """Manages ALEJO service processes"""
    
    def __init__(self):
        self.root_dir = Path(__file__).parent.parent
        self.processes: Dict[str, subprocess.Popen] = {}
        self.config = self._load_config()
        
    def _load_config(self) -> Dict:
        """Load service configuration"""
        config_path = self.root_dir / 'tests' / 'integration' / 'test_config.json'
        try:
            with open(config_path) as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return {'services': {}}
            
    def start_services(self):
        """Start all ALEJO services"""
        logger.info("Starting ALEJO services...")
        
        # Start services in dependency order
        service_order = [
            'memory',
            'emotional',
            'brain',
            'voice',
            'vision',
            'training'
        ]
        
        for service in service_order:
            if service in self.config['services']:
                self._start_service(service)
                time.sleep(2)  # Give each service time to start
                
        logger.info("All services started")
        
    def _start_service(self, service: str):
        """Start a specific service"""
        try:
            service_config = self.config['services'][service]
            port = int(service_config['url'].split(':')[-1])
            
            cmd = [
                sys.executable,
                '-m',
                f'alejo.services.{service}_service',
                '--port',
                str(port)
            ]
            
            if service in self.config.get('mocks', {}):
                if self.config['mocks'][service].get('enabled'):
                    cmd.append('--mock')
                    
            process = subprocess.Popen(
                cmd,
                cwd=str(self.root_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            self.processes[service] = process
            logger.info(f"Started {service} service on port {port}")
            
        except Exception as e:
            logger.error(f"Failed to start {service} service: {e}")
            
    def stop_services(self):
        """Stop all running services"""
        logger.info("Stopping services...")
        
        for service, process in self.processes.items():
            try:
                if os.name == 'nt':  # Windows
                    process.terminate()
                else:  # Unix
                    process.send_signal(signal.SIGTERM)
                    
                process.wait(timeout=5)
                logger.info(f"Stopped {service} service")
                
            except Exception as e:
                logger.error(f"Error stopping {service} service: {e}")
                # Force kill if graceful shutdown fails
                process.kill()
                
        self.processes.clear()
        
    def check_health(self) -> Dict[str, bool]:
        """Check health of all services"""
        results = {}
        
        for service, process in self.processes.items():
            if process.poll() is None:  # Process is running
                results[service] = True
            else:
                results[service] = False
                logger.error(f"{service} service has stopped")
                
        return results

def main():
    """Main entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    runner = ServiceRunner()
    
    try:
        runner.start_services()
        
        # Keep running until interrupted
        while True:
            health = runner.check_health()
            if not all(health.values()):
                logger.error("Some services have failed")
                break
            time.sleep(10)
            
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        runner.stop_services()

if __name__ == '__main__':
    main()