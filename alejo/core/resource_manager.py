"""
Resource Manager for ALEJO

This module provides a resource manager that helps ALEJO efficiently manage
system resources by dynamically allocating and releasing resources as needed.
"""

import os
import logging
import psutil
import threading
import time
from typing import Dict, List, Set, Optional, Callable, Any
import asyncio
from enum import Enum
from dataclasses import dataclass

logger = logging.getLogger(__name__)

class ResourceType(Enum):
    """Types of resources that can be managed"""
    CPU = "cpu"
    MEMORY = "memory"
    GPU = "gpu"
    CAMERA = "camera"
    MICROPHONE = "microphone"
    NETWORK = "network"
    DISK = "disk"

@dataclass
class ResourceUsage:
    """Resource usage information"""
    type: ResourceType
    usage_percent: float
    allocated: bool = False
    component: str = "unknown"
    priority: int = 0
    
    @property
    def is_critical(self) -> bool:
        """Check if resource usage is critical"""
        thresholds = {
            ResourceType.CPU: 90.0,
            ResourceType.MEMORY: 85.0,
            ResourceType.GPU: 90.0,
            ResourceType.DISK: 90.0,
        }
        return self.type in thresholds and self.usage_percent > thresholds[self.type]

class ResourceManager:
    """
    Manages system resources for ALEJO components
    
    This class provides functionality to:
    1. Monitor system resource usage
    2. Allocate resources to components based on priority
    3. Release resources when they are no longer needed
    4. Throttle resource-intensive operations when system load is high
    """
    
    def __init__(self, monitoring_interval: float = 5.0):
        """
        Initialize the resource manager
        
        Args:
            monitoring_interval: Interval in seconds between resource usage checks
        """
        self.monitoring_interval = monitoring_interval
        self.allocated_resources: Dict[str, Set[ResourceType]] = {}
        self.component_priorities: Dict[str, int] = {}
        self.resource_callbacks: Dict[ResourceType, List[Callable]] = {}
        self.monitoring_thread: Optional[threading.Thread] = None
        self.running = False
        self._lock = threading.RLock()
        
    def start_monitoring(self):
        """Start monitoring system resources"""
        if self.running:
            return
            
        self.running = True
        self.monitoring_thread = threading.Thread(
            target=self._monitor_resources,
            daemon=True,
            name="ALEJO-ResourceMonitor"
        )
        self.monitoring_thread.start()
        logger.info("Resource monitoring started")
        
    def stop_monitoring(self):
        """Stop monitoring system resources"""
        self.running = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=2.0)
            self.monitoring_thread = None
        logger.info("Resource monitoring stopped")
        
    def _monitor_resources(self):
        """Monitor system resources in a background thread"""
        while self.running:
            try:
                # Get current resource usage
                cpu_usage = psutil.cpu_percent(interval=1.0)
                memory_usage = psutil.virtual_memory().percent
                disk_usage = psutil.disk_usage('/').percent
                
                # Check for GPU if available
                gpu_usage = 0.0
                try:
                    # This is a placeholder - in a real implementation, you would use
                    # a library like pynvml for NVIDIA GPUs or equivalent for AMD
                    pass
                except Exception:
                    pass
                    
                # Log resource usage
                logger.debug(f"Resource usage - CPU: {cpu_usage}%, Memory: {memory_usage}%, Disk: {disk_usage}%")
                
                # Check if any resource is critical
                resources = [
                    ResourceUsage(ResourceType.CPU, cpu_usage),
                    ResourceUsage(ResourceType.MEMORY, memory_usage),
                    ResourceUsage(ResourceType.DISK, disk_usage),
                ]
                
                if gpu_usage > 0:
                    resources.append(ResourceUsage(ResourceType.GPU, gpu_usage))
                    
                # Handle critical resources
                for resource in resources:
                    if resource.is_critical:
                        self._handle_critical_resource(resource)
                        
                # Sleep until next check
                time.sleep(self.monitoring_interval)
                
            except Exception as e:
                logger.error(f"Error in resource monitoring: {e}")
                time.sleep(self.monitoring_interval)
                
    def _handle_critical_resource(self, resource: ResourceUsage):
        """Handle a critical resource usage situation"""
        logger.warning(f"Critical {resource.type.value} usage: {resource.usage_percent}%")
        
        # Notify callbacks for this resource type
        if resource.type in self.resource_callbacks:
            for callback in self.resource_callbacks[resource.type]:
                try:
                    callback(resource)
                except Exception as e:
                    logger.error(f"Error in resource callback: {e}")
                    
        # If we have low-priority components using this resource, ask them to release it
        with self._lock:
            components_to_throttle = []
            for component, resources in self.allocated_resources.items():
                if resource.type in resources and self.component_priorities.get(component, 0) < 5:
                    components_to_throttle.append(component)
                    
            if components_to_throttle:
                logger.info(f"Requesting resource release from: {', '.join(components_to_throttle)}")
                
    def register_component(self, component_name: str, priority: int = 5):
        """
        Register a component with the resource manager
        
        Args:
            component_name: Name of the component
            priority: Priority level (0-10, higher is more important)
        """
        with self._lock:
            self.component_priorities[component_name] = max(0, min(10, priority))
            self.allocated_resources.setdefault(component_name, set())
        logger.debug(f"Registered component: {component_name} with priority {priority}")
        
    def unregister_component(self, component_name: str):
        """
        Unregister a component from the resource manager
        
        Args:
            component_name: Name of the component to unregister
        """
        with self._lock:
            if component_name in self.component_priorities:
                del self.component_priorities[component_name]
            if component_name in self.allocated_resources:
                del self.allocated_resources[component_name]
        logger.debug(f"Unregistered component: {component_name}")
        
    def allocate_resource(self, component_name: str, resource_type: ResourceType) -> bool:
        """
        Allocate a resource to a component
        
        Args:
            component_name: Name of the component requesting the resource
            resource_type: Type of resource to allocate
            
        Returns:
            bool: True if resource was allocated, False otherwise
        """
        with self._lock:
            if component_name not in self.component_priorities:
                self.register_component(component_name)
                
            # Check if the resource is already allocated to this component
            if resource_type in self.allocated_resources.get(component_name, set()):
                return True
                
            # Add the resource to the component's allocated resources
            self.allocated_resources.setdefault(component_name, set()).add(resource_type)
            
        logger.debug(f"Allocated {resource_type.value} to {component_name}")
        return True
        
    def release_resource(self, component_name: str, resource_type: ResourceType) -> bool:
        """
        Release a resource from a component
        
        Args:
            component_name: Name of the component releasing the resource
            resource_type: Type of resource to release
            
        Returns:
            bool: True if resource was released, False otherwise
        """
        with self._lock:
            if component_name not in self.allocated_resources:
                return False
                
            if resource_type not in self.allocated_resources[component_name]:
                return False
                
            self.allocated_resources[component_name].remove(resource_type)
            
        logger.debug(f"Released {resource_type.value} from {component_name}")
        return True
        
    def register_resource_callback(self, resource_type: ResourceType, callback: Callable[[ResourceUsage], None]):
        """
        Register a callback for resource events
        
        Args:
            resource_type: Type of resource to monitor
            callback: Function to call when resource usage changes
        """
        with self._lock:
            self.resource_callbacks.setdefault(resource_type, []).append(callback)
            
    def unregister_resource_callback(self, resource_type: ResourceType, callback: Callable[[ResourceUsage], None]):
        """
        Unregister a callback for resource events
        
        Args:
            resource_type: Type of resource being monitored
            callback: Function to remove from callbacks
        """
        with self._lock:
            if resource_type in self.resource_callbacks and callback in self.resource_callbacks[resource_type]:
                self.resource_callbacks[resource_type].remove(callback)
                
    def get_system_info(self) -> Dict[str, Any]:
        """
        Get current system information
        
        Returns:
            Dict containing system resource information
        """
        try:
            return {
                "cpu": {
                    "percent": psutil.cpu_percent(interval=0.1),
                    "count": psutil.cpu_count(),
                    "frequency": psutil.cpu_freq().current if psutil.cpu_freq() else 0,
                },
                "memory": {
                    "total": psutil.virtual_memory().total,
                    "available": psutil.virtual_memory().available,
                    "percent": psutil.virtual_memory().percent,
                },
                "disk": {
                    "total": psutil.disk_usage('/').total,
                    "free": psutil.disk_usage('/').free,
                    "percent": psutil.disk_usage('/').percent,
                },
                "network": {
                    "bytes_sent": psutil.net_io_counters().bytes_sent,
                    "bytes_recv": psutil.net_io_counters().bytes_recv,
                },
                "battery": {
                    "percent": psutil.sensors_battery().percent if psutil.sensors_battery() else 0,
                    "power_plugged": psutil.sensors_battery().power_plugged if psutil.sensors_battery() else False,
                },
                "temperature": {
                    "cpu": psutil.sensors_temperatures() if hasattr(psutil, 'sensors_temperatures') else {},
                },
                "process_count": len(psutil.pids()),
            }
        except Exception as e:
            logger.error(f"Error getting system info: {e}")
            return {}

# Singleton instance
_resource_manager = None

def get_resource_manager() -> ResourceManager:
    """Get the singleton resource manager instance"""
    global _resource_manager
    if _resource_manager is None:
        _resource_manager = ResourceManager()
    return _resource_manager
