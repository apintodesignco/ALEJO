"""
Resource Management Service for ALEJO

This service monitors and manages system resources for ALEJO,
ensuring optimal performance and preventing system overload.
"""

import os
import sys
import logging
import asyncio
import time
from typing import Dict, Any, Optional
import json

from alejo.core.event_bus import Event, EventType
from alejo.core.resource_manager import ResourceManager, ResourceType, get_resource_manager
from alejo.core.process_manager import ProcessManager, get_process_manager

logger = logging.getLogger(__name__)

class ResourceService:
    """
    Service that monitors and manages system resources for ALEJO
    
    This service:
    1. Monitors CPU, memory, disk, and network usage
    2. Publishes resource usage events to the event bus
    3. Manages processes to prevent redundancy and resource overuse
    4. Provides an API for components to request and release resources
    """
    
    def __init__(self, event_bus=None):
        """
        Initialize the resource service
        
        Args:
            event_bus: The event bus to use for communication
        """
        self.event_bus = event_bus
        self.resource_manager = get_resource_manager()
        self.process_manager = get_process_manager()
        self.running = False
        self.monitoring_task = None
        self.cleanup_task = None
        
    async def start(self):
        """Start the resource service"""
        if self.running:
            return
            
        logger.info("Starting ResourceService...")
        self.running = True
        
        # Start resource monitoring
        self.resource_manager.start_monitoring()
        
        # Start process monitoring
        self.process_manager.start_monitoring()
        
        # Start periodic tasks
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        # Subscribe to resource request events
        if self.event_bus:
            self.event_bus.subscribe(EventType.SYSTEM, self._handle_system_event)
            
        logger.info("ResourceService started")
        
    async def stop(self):
        """Stop the resource service"""
        if not self.running:
            return
            
        logger.info("Stopping ResourceService...")
        self.running = False
        
        # Stop resource monitoring
        self.resource_manager.stop_monitoring()
        
        # Stop process monitoring
        self.process_manager.stop_monitoring()
        
        # Cancel tasks
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
            self.monitoring_task = None
            
        if self.cleanup_task:
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass
            self.cleanup_task = None
            
        # Unsubscribe from events
        if self.event_bus:
            self.event_bus.unsubscribe(EventType.SYSTEM, self._handle_system_event)
            
        logger.info("ResourceService stopped")
        
    async def _monitoring_loop(self):
        """Periodically publish resource usage events"""
        while self.running:
            try:
                # Get system info
                system_info = self.resource_manager.get_system_info()
                
                # Publish resource usage event
                if self.event_bus:
                    event = Event.create(
                        type=EventType.SYSTEM,
                        payload={
                            "type": "resource_usage",
                            "data": system_info
                        },
                        source="ResourceService"
                    )
                    await self.event_bus.publish(event)
                    
                # Log resource usage
                cpu_percent = system_info.get("cpu", {}).get("percent", 0)
                memory_percent = system_info.get("memory", {}).get("percent", 0)
                disk_percent = system_info.get("disk", {}).get("percent", 0)
                
                logger.debug(f"Resource usage - CPU: {cpu_percent}%, Memory: {memory_percent}%, Disk: {disk_percent}%")
                
                # Check for critical resource usage
                if cpu_percent > 90 or memory_percent > 85:
                    logger.warning(f"Critical resource usage - CPU: {cpu_percent}%, Memory: {memory_percent}%")
                    
                    # Terminate resource-intensive processes if critical
                    intensive_count = self.process_manager.terminate_resource_intensive_processes(
                        cpu_threshold=70.0, memory_threshold=50.0)
                        
                    if intensive_count > 0:
                        logger.info(f"Terminated {intensive_count} resource-intensive processes")
                    
                # Wait for next check
                await asyncio.sleep(10)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(10)
                
    async def _cleanup_loop(self):
        """Periodically clean up redundant processes"""
        while self.running:
            try:
                # Wait a bit before first cleanup
                await asyncio.sleep(60)
                
                # Terminate redundant processes
                redundant_count = self.process_manager.terminate_redundant_processes()
                if redundant_count > 0:
                    logger.info(f"Terminated {redundant_count} redundant processes")
                    
                # Wait for next cleanup
                await asyncio.sleep(300)  # 5 minutes
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(60)
                
    async def _handle_system_event(self, event):
        """
        Handle system events
        
        Args:
            event: The event to handle
        """
        try:
            if event.payload.get("type") == "resource_request":
                await self._handle_resource_request(event)
            elif event.payload.get("type") == "process_register":
                await self._handle_process_register(event)
            elif event.payload.get("type") == "process_cleanup":
                await self._handle_process_cleanup(event)
        except Exception as e:
            logger.error(f"Error handling system event: {e}")
            
    async def _handle_resource_request(self, event):
        """
        Handle resource request events
        
        Args:
            event: The resource request event
        """
        data = event.payload.get("data", {})
        component = data.get("component", "unknown")
        resource_type_str = data.get("resource_type")
        action = data.get("action", "allocate")
        
        try:
            resource_type = ResourceType(resource_type_str)
        except (ValueError, TypeError):
            logger.error(f"Invalid resource type: {resource_type_str}")
            return
            
        if action == "allocate":
            success = self.resource_manager.allocate_resource(component, resource_type)
            logger.info(f"Resource allocation for {component}: {resource_type.value} - {'Success' if success else 'Failed'}")
        elif action == "release":
            success = self.resource_manager.release_resource(component, resource_type)
            logger.info(f"Resource release for {component}: {resource_type.value} - {'Success' if success else 'Failed'}")
            
    async def _handle_process_register(self, event):
        """
        Handle process registration events
        
        Args:
            event: The process registration event
        """
        data = event.payload.get("data", {})
        pid = data.get("pid")
        is_critical = data.get("is_critical", False)
        
        if pid:
            if is_critical:
                self.process_manager.register_critical_process(pid)
                logger.info(f"Registered critical process: {pid}")
            else:
                self.process_manager.unregister_critical_process(pid)
                logger.info(f"Unregistered critical process: {pid}")
                
    async def _handle_process_cleanup(self, event):
        """
        Handle process cleanup events
        
        Args:
            event: The process cleanup event
        """
        data = event.payload.get("data", {})
        cleanup_type = data.get("type", "redundant")
        
        if cleanup_type == "redundant":
            count = self.process_manager.terminate_redundant_processes()
            logger.info(f"Terminated {count} redundant processes")
        elif cleanup_type == "intensive":
            count = self.process_manager.terminate_resource_intensive_processes()
            logger.info(f"Terminated {count} resource-intensive processes")
        elif cleanup_type == "tests":
            count = self.process_manager.terminate_all_test_processes()
            logger.info(f"Terminated {count} test processes")
        elif cleanup_type == "all":
            # Find all ALEJO processes except critical ones
            processes = self.process_manager.find_alejo_processes()
            count = self.process_manager.terminate_processes(processes)
            logger.info(f"Terminated {count} ALEJO processes")
            
    def get_resource_usage(self) -> Dict[str, Any]:
        """
        Get current resource usage
        
        Returns:
            Dictionary with resource usage information
        """
        return self.resource_manager.get_system_info()
        
    def get_process_info(self) -> Dict[str, Any]:
        """
        Get information about ALEJO processes
        
        Returns:
            Dictionary with process information
        """
        processes = self.process_manager.get_process_info()
        return {
            "count": len(processes),
            "processes": processes
        }

# Singleton instance
_resource_service = None

def get_resource_service(event_bus=None) -> ResourceService:
    """Get the singleton resource service instance"""
    global _resource_service
    if _resource_service is None:
        _resource_service = ResourceService(event_bus)
    return _resource_service
