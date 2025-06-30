import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class ServiceRegistry:
    """
    Maintains a registry of services with their health statuses.
    Integrates with EventBus for service-related events and can be used in conjunction with HealthMonitor
    for auto-deregistration of unresponsive services.
    """

    def __init__(self, event_bus=None):
        self.event_bus = event_bus
        self.services = {}  # Map of service_name -> last healthy timestamp (datetime)
        self._lock = asyncio.Lock()

    async def register_service(self, service_name: str):
        """Register a new service with the current timestamp."""
        async with self._lock:
            self.services[service_name] = datetime.now()
            logger.info(f"Service registered: {service_name}")
            # Optionally, notify the event bus about registration
            if self.event_bus:
                # self.event_bus.emit_service_registered(service_name)
                pass

    async def update_service_health(self, service_name: str):
        """Update the health timestamp for a registered service."""
        async with self._lock:
            if service_name in self.services:
                self.services[service_name] = datetime.now()
                logger.debug(f"Service health updated: {service_name}")

    async def deregister_service(self, service_name: str):
        """Deregister a service, removing it from the registry."""
        async with self._lock:
            if service_name in self.services:
                del self.services[service_name]
                logger.warning(f"Service deregistered: {service_name}")
                # Optionally, notify the event bus about deregistration
                if self.event_bus:
                    # self.event_bus.emit_service_deregistered(service_name)
                    pass

    async def get_service_health(self, service_name: str):
        """Retrieve the last health update timestamp for a service."""
        async with self._lock:
            return self.services.get(service_name)

    async def check_services(self, unhealthy_threshold: float):
        """
        Check all registered services and deregister those that have not reported healthy within the unhealthy_threshold
        (in seconds).
        """
        now = datetime.now()
        to_deregister = []
        async with self._lock:
            for service, last_health in self.services.items():
                if (now - last_health).total_seconds() > unhealthy_threshold:
                    to_deregister.append(service)
        for service in to_deregister:
            await self.deregister_service(service)
