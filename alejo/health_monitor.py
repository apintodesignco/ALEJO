import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class HealthMonitor:
    """
    Monitors the health of registered service components and auto-deregisters those that are unhealthy.
    """
    def __init__(self, event_bus=None, check_interval=30):
        """
        Initialize HealthMonitor

        Args:
            event_bus: An optional EventBus instance to notify of deregistration events
            check_interval: Interval in seconds between health checks
        """
        self.event_bus = event_bus
        self.check_interval = check_interval
        self.running = False
        # A dictionary to track services by name and their last healthy timestamp
        self.services = {}  # {service_name: datetime}

    def register_service(self, service_name):
        """Register a new service with current timestamp"""
        self.services[service_name] = datetime.now()
        logger.info(f"Registered service: {service_name}")

    def update_service_health(self, service_name):
        """Update the health timestamp for a service"""
        if service_name in self.services:
            self.services[service_name] = datetime.now()
            logger.debug(f"Updated health for service: {service_name}")

    async def monitor(self):
        """Periodically check the health of all registered services and deregister unhealthy ones"""
        self.running = True
        while self.running:
            now = datetime.now()
            to_deregister = []
            for service, last_health in self.services.items():
                # If no health update in twice the check interval, mark as unhealthy
                if (now - last_health).total_seconds() > self.check_interval * 2:
                    to_deregister.append(service)
            for service in to_deregister:
                del self.services[service]
                logger.warning(f"Auto-deregistering unhealthy service: {service}")
                # Optionally, notify EventBus or ServiceRegistry here
                if self.event_bus:
                    # Example: self.event_bus.deregister_service(service)
                    pass
            await asyncio.sleep(self.check_interval)

    def stop(self):
        """Stop the health monitoring process"""
        self.running = False
