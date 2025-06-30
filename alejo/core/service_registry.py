"""
Service registry for dynamic service discovery
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class ServiceInstance:
    """Information about a service instance"""
    name: str
    url: str
    status: str = "healthy"
    last_heartbeat: float = 0.0
    metadata: Dict = None
    
    def __post_init__(self):
        self.metadata = self.metadata or {}
        self.last_heartbeat = time.time()

class ServiceRegistry:
    """
    Registry for service discovery and health monitoring
    
    Features:
    - Service registration and deregistration
    - Health check monitoring
    - Service discovery with load balancing
    - Metadata storage for service capabilities
    """
    
    def __init__(self, heartbeat_timeout: float = 30.0):
        self.services: Dict[str, Dict[str, ServiceInstance]] = {}
        self.heartbeat_timeout = heartbeat_timeout
        self._cleanup_task: Optional[asyncio.Task] = None
        self._subscribers: Dict[str, Set[callable]] = {}
        
    async def start(self):
        """Start the registry service"""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Service registry started")
        
    async def stop(self):
        """Stop the registry service"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        logger.info("Service registry stopped")
        
    async def register(self, service_name: str, instance_url: str, metadata: Dict = None) -> str:
        """Register a new service instance"""
        if service_name not in self.services:
            self.services[service_name] = {}
            
        instance = ServiceInstance(
            name=service_name,
            url=instance_url,
            metadata=metadata
        )
        
        self.services[service_name][instance_url] = instance
        logger.info(f"Registered service {service_name} at {instance_url}")
        
        # Notify subscribers
        await self._notify_subscribers(service_name, "register", instance)
        return instance_url
        
    async def deregister(self, service_name: str, instance_url: str):
        """Remove a service instance"""
        if service_name in self.services and instance_url in self.services[service_name]:
            instance = self.services[service_name].pop(instance_url)
            if not self.services[service_name]:
                del self.services[service_name]
            
            # Notify subscribers
            await self._notify_subscribers(service_name, "deregister", instance)
            logger.info(f"Deregistered service {service_name} at {instance_url}")
            
    async def heartbeat(self, service_name: str, instance_url: str):
        """Update service instance heartbeat"""
        if (service_name in self.services and 
            instance_url in self.services[service_name]):
            instance = self.services[service_name][instance_url]
            instance.last_heartbeat = time.time()
            instance.status = "healthy"
            
    async def get_service(self, service_name: str) -> Optional[ServiceInstance]:
        """Get a service instance using round-robin load balancing"""
        if service_name not in self.services:
            return None
            
        # Filter healthy instances
        healthy_instances = [
            instance for instance in self.services[service_name].values()
            if instance.status == "healthy" and 
            (time.time() - instance.last_heartbeat) <= self.heartbeat_timeout
        ]
        
        if not healthy_instances:
            return None
            
        # Simple round-robin selection
        return healthy_instances[int(time.time()) % len(healthy_instances)]
        
    async def get_all_instances(self, service_name: str) -> List[ServiceInstance]:
        """Get all instances of a service"""
        if service_name not in self.services:
            return []
            
        return list(self.services[service_name].values())
        
    def subscribe(self, service_name: str, callback: callable):
        """Subscribe to service updates"""
        if service_name not in self._subscribers:
            self._subscribers[service_name] = set()
        self._subscribers[service_name].add(callback)
        
    def unsubscribe(self, service_name: str, callback: callable):
        """Unsubscribe from service updates"""
        if service_name in self._subscribers:
            self._subscribers[service_name].discard(callback)
            if not self._subscribers[service_name]:
                del self._subscribers[service_name]
                
    async def _notify_subscribers(self, service_name: str, event_type: str, instance: ServiceInstance):
        """Notify subscribers of service changes"""
        if service_name in self._subscribers:
            for callback in self._subscribers[service_name]:
                try:
                    await callback(event_type, instance)
                except Exception as e:
                    logger.error(f"Error in subscriber callback: {e}")
                    
    async def _cleanup_loop(self):
        """Periodically clean up unhealthy services"""
        while True:
            try:
                current_time = time.time()
                for service_name in list(self.services.keys()):
                    for instance_url in list(self.services[service_name].keys()):
                        instance = self.services[service_name][instance_url]
                        if (current_time - instance.last_heartbeat) > self.heartbeat_timeout:
                            instance.status = "unhealthy"
                            logger.warning(
                                f"Service {service_name} at {instance_url} "
                                f"missed heartbeat (last: {datetime.fromtimestamp(instance.last_heartbeat)})"
                            )
                            
                            # Notify subscribers of status change
                            await self._notify_subscribers(service_name, "status_change", instance)
                            
                await asyncio.sleep(5)  # Check every 5 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(5)  # Continue checking even if there's an error
