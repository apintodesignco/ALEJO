"""
ALEJO Startup Module

This module handles the startup sequence for ALEJO, including:
1. Initializing core components
2. Starting required services
3. Managing resource usage
4. Setting up event bus and communication
"""

import os
import sys
import asyncio
import logging
import signal
import time
from typing import List, Dict, Any, Optional

from alejo.core.event_bus import Event, EventType
from .memory_event_bus import MemoryEventBus
from ..services.resource_service import ResourceService, get_resource_service
from ..emotional_intelligence.comfort_response import get_comfort_manager

logger = logging.getLogger(__name__)

class ALEJOStartup:
    """
    Manages the startup and shutdown sequence for ALEJO
    
    This class ensures that:
    1. Components are started in the correct order
    2. Resources are properly managed
    3. Cleanup happens on shutdown
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the startup manager
        
        Args:
            config_path: Path to configuration file (optional)
        """
        self.config_path = config_path
        self.event_bus = None
        self.resource_service = None
        self.comfort_manager = None
        self.running = False
        self.services = {}
        self.components = {}
        self._shutdown_event = None
        
    async def start(self):
        """Start ALEJO with resource management"""
        if self.running:
            logger.warning("ALEJO is already running")
            return
            
        logger.info("Starting ALEJO...")
        self.running = True
        self._shutdown_event = asyncio.Event()
        
        # Set up signal handlers for graceful shutdown
        self._setup_signal_handlers()
        
        try:
            # Initialize event bus (using in-memory implementation for stability)
            self.event_bus = MemoryEventBus()
            await self.event_bus.start()
            logger.info("Event bus started")
            
            # Start resource service first to manage resources
            self.resource_service = get_resource_service(self.event_bus)
            await self.resource_service.start()
            logger.info("Resource service started")
            
            # Initialize comfort response manager
            self.comfort_manager = get_comfort_manager(self.event_bus)
            logger.info("Comfort response manager initialized")
            
            # Register this process as critical
            self._register_critical_process()
            
            # Start other core services
            await self._start_core_services()
            
            # Publish startup complete event
            startup_event = Event.create(
                type=EventType.SYSTEM,
                payload={
                    "type": "startup_complete",
                    "timestamp": time.time()
                },
                source="ALEJOStartup"
            )
            await self.event_bus.publish(startup_event)
            
            logger.info("ALEJO startup complete")
            
            # Wait for shutdown signal
            await self._shutdown_event.wait()
            
        except Exception as e:
            logger.error(f"Error during ALEJO startup: {e}")
            self.running = False
            raise
            
    async def stop(self):
        """Stop ALEJO and clean up resources"""
        if not self.running:
            return
            
        logger.info("Stopping ALEJO...")
        self.running = False
        
        # Signal shutdown
        if self._shutdown_event:
            self._shutdown_event.set()
        
        # Stop services in reverse order
        for name, service in reversed(list(self.services.items())):
            try:
                logger.info(f"Stopping service: {name}")
                await service.stop()
            except Exception as e:
                logger.error(f"Error stopping service {name}: {e}")
                
        # Stop resource service
        if self.resource_service:
            await self.resource_service.stop()
            logger.info("Resource service stopped")
        
        # Log comfort manager shutdown
        if self.comfort_manager:
            logger.info("Comfort response manager stopped")
            
        # Stop event bus last
        if self.event_bus:
            await self.event_bus.stop()
            logger.info("Event bus stopped")
            
        logger.info("ALEJO shutdown complete")
        
    def _setup_signal_handlers(self):
        """Set up signal handlers for graceful shutdown"""
        import platform
        
        if platform.system() == 'Windows':
            # Windows doesn't support asyncio signal handlers
            # Use the standard signal module instead
            for sig in (signal.SIGINT, signal.SIGTERM):
                signal.signal(sig, lambda signum, frame: asyncio.create_task(self._handle_shutdown_signal()))
        else:
            # Unix-like systems can use asyncio signal handlers
            loop = asyncio.get_event_loop()
            for sig in (signal.SIGINT, signal.SIGTERM):
                loop.add_signal_handler(
                    sig, 
                    lambda: asyncio.create_task(self._handle_shutdown_signal())
                )
        
        logger.debug("Signal handlers set up")
        
    async def _handle_shutdown_signal(self):
        """Handle shutdown signal"""
        logger.info("Shutdown signal received")
        await self.stop()
        
    def _register_critical_process(self):
        """Register this process as critical with the resource manager"""
        import os
        pid = os.getpid()
        
        # Create an event to register this process
        if self.event_bus:
            asyncio.create_task(self.event_bus.publish(Event.create(
                type=EventType.SYSTEM,
                payload={
                    "type": "process_register",
                    "data": {
                        "pid": pid,
                        "is_critical": True
                    }
                },
                source="ALEJOStartup"
            )))
            
    async def _start_core_services(self):
        """Start core ALEJO services"""
        # This method would start other core services
        # For now, we're just focusing on resource management
        pass
        
    def get_resource_usage(self) -> Dict[str, Any]:
        """Get current resource usage"""
        if self.resource_service:
            return self.resource_service.get_resource_usage()
        return {}
        
    def get_process_info(self) -> Dict[str, Any]:
        """Get information about ALEJO processes"""
        if self.resource_service:
            return self.resource_service.get_process_info()
        return {"count": 0, "processes": []}
        
    async def cleanup_redundant_processes(self):
        """Clean up redundant ALEJO processes"""
        if self.resource_service and self.event_bus:
            await self.event_bus.publish(Event.create(
                type=EventType.SYSTEM,
                payload={
                    "type": "process_cleanup",
                    "data": {
                        "type": "redundant"
                    }
                },
                source="ALEJOStartup"
            ))

# Singleton instance
_alejo_startup = None

def get_alejo_startup(config_path: Optional[str] = None) -> ALEJOStartup:
    """Get the singleton ALEJO startup instance"""
    global _alejo_startup
    if _alejo_startup is None:
        _alejo_startup = ALEJOStartup(config_path)
    return _alejo_startup
