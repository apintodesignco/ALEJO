import asyncio
import pytest
from datetime import datetime, timedelta

from alejo.service_registry import ServiceRegistry

class DummyRegistry(ServiceRegistry):
    """A dummy ServiceRegistry subclass to simulate passage of time for auto-deregistration."""
    def __init__(self):
        # Do not pass an event_bus for testing purposes
        super().__init__(event_bus=None)

@pytest.mark.asyncio
async def test_auto_deregistration():
    """Test that a service is auto-deregistered if no health update occurs within the threshold."""
    registry = DummyRegistry()
    # Register a dummy service
    await registry.register_service('TestService')

    # Simulate that the service was registered some time ago
    async with registry._lock:
        registry.services['TestService'] = datetime.now() - timedelta(seconds=100)

    # Check services with an unhealthy threshold of 60 seconds
    await registry.check_services(unhealthy_threshold=60)

    # The service should have been deregistered
    async with registry._lock:
        assert 'TestService' not in registry.services

if __name__ == "__main__":
    pytest.main(["-xvs", __file__])
