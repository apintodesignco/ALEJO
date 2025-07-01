#!/usr/bin/env python3
"""
ALEJO Deployment Script

This script streamlines the deployment of the ALEJO application for production use.
It performs necessary checks, builds Docker containers, and starts the application.
"""
import os
import sys
import subprocess
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Union, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('alejo_deployment.log')
    ]
)

logger = logging.getLogger(__name__)

class AlejoDeployer:
    """Manages the deployment of ALEJO application."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.absolute()
        self.env_file = self.project_root / '.env'
        self.docker_compose_file = self.project_root / 'docker-compose.yml'
    
    def check_prerequisites(self) -> bool:
        """Verify all prerequisites are met."""
        logger.info("Checking prerequisites...")
        
        # Check for Docker and Docker Compose
        try:
            subprocess.run(["docker", "--version"], check=True, capture_output=True)
            logger.info("✓ Docker is installed")
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.error("✗ Docker is not installed or not in PATH")
            return False
            
        try:
            subprocess.run(["docker-compose", "--version"], check=True, capture_output=True)
            logger.info("✓ Docker Compose is installed")
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.error("✗ Docker Compose is not installed or not in PATH")
            return False
        
        # Check for .env file
        if not self.env_file.exists():
            logger.warning("! .env file not found. Creating from .env.example")
            self._create_env_file()
        else:
            logger.info("✓ .env file exists")
            
        # Check docker-compose.yml
        if not self.docker_compose_file.exists():
            logger.error("✗ docker-compose.yml file not found")
            return False
        else:
            logger.info("✓ docker-compose.yml file exists")
            
        return True
    
    def _create_env_file(self) -> None:
        """Create .env file from .env.example."""
        example_env = self.project_root / '.env.example'
        if not example_env.exists():
            logger.error("! .env.example not found. Cannot create .env file.")
            return
            
        # Copy content from .env.example to .env
        with open(example_env, 'r') as src, open(self.env_file, 'w') as dest:
            dest.write(src.read())
        logger.info("✓ Created .env file from .env.example")
    
    def build_containers(self, pull: bool = False) -> bool:
        """Build all Docker containers."""
        logger.info("Building Docker containers...")
        
        try:
            cmd = ["docker-compose", "build"]
            if pull:
                cmd.append("--pull")
                
            subprocess.run(cmd, check=True, cwd=self.project_root)
            logger.info("✓ Successfully built all containers")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"✗ Failed to build containers: {str(e)}")
            return False
    
    def start_services(self, detach: bool = True) -> bool:
        """Start all services defined in docker-compose.yml."""
        logger.info("Starting ALEJO services...")
        
        try:
            cmd = ["docker-compose", "up"]
            if detach:
                cmd.append("-d")
                
            subprocess.run(cmd, check=True, cwd=self.project_root)
            logger.info("✓ Successfully started all services")
            
            # Display service URLs
            self._display_service_urls()
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"✗ Failed to start services: {str(e)}")
            return False
    
    def stop_services(self) -> bool:
        """Stop all running ALEJO services."""
        logger.info("Stopping ALEJO services...")
        
        try:
            subprocess.run(["docker-compose", "down"], check=True, cwd=self.project_root)
            logger.info("✓ Successfully stopped all services")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"✗ Failed to stop services: {str(e)}")
            return False
    
    def _display_service_urls(self) -> None:
        """Display URLs for accessing the services."""
        host = "localhost"
        
        logger.info("\n" + "=" * 50)
        logger.info("ALEJO SERVICES")
        logger.info("=" * 50)
        logger.info(f"Brain Service:      http://{host}:8000")
        logger.info(f"Emotional Service:  http://{host}:8001")
        logger.info(f"Memory Service:     http://{host}:8002")
        logger.info(f"Command Service:    http://{host}:8003")
        logger.info(f"WebSocket Gestures: ws://{host}:8765")
        logger.info(f"Redis:              redis://{host}:6379")
        logger.info("=" * 50)
        logger.info("Access the main UI at: http://localhost:8000/ui")
        logger.info("Gesture demo interface: http://localhost:8000/gestures")
        logger.info("=" * 50 + "\n")
    
    def check_service_status(self) -> None:
        """Check the status of all services."""
        logger.info("Checking service status...")
        
        try:
            subprocess.run(["docker-compose", "ps"], check=True, cwd=self.project_root)
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to check service status: {str(e)}")

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="ALEJO Deployment Tool")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Deploy command
    deploy_parser = subparsers.add_parser("deploy", help="Deploy ALEJO")
    deploy_parser.add_argument("--pull", action="store_true", help="Pull latest base images")
    deploy_parser.add_argument("--no-detach", action="store_true", help="Run in foreground")
    
    # Stop command
    subparsers.add_parser("stop", help="Stop ALEJO services")
    
    # Status command
    subparsers.add_parser("status", help="Check ALEJO service status")
    
    # Build command
    build_parser = subparsers.add_parser("build", help="Build ALEJO containers")
    build_parser.add_argument("--pull", action="store_true", help="Pull latest base images")
    
    return parser.parse_args()

def main():
    """Main entry point for the deployment script."""
    args = parse_arguments()
    deployer = AlejoDeployer()
    
    # Check prerequisites regardless of command
    if not deployer.check_prerequisites():
        logger.error("Prerequisites check failed. Please address the issues before continuing.")
        sys.exit(1)
    
    if args.command == "deploy":
        if deployer.build_containers(pull=args.pull):
            deployer.start_services(detach=not args.no_detach)
    elif args.command == "stop":
        deployer.stop_services()
    elif args.command == "status":
        deployer.check_service_status()
    elif args.command == "build":
        deployer.build_containers(pull=args.pull)
    else:
        # Default action is to deploy
        if deployer.build_containers():
            deployer.start_services()

if __name__ == "__main__":
    main()