import asyncio
import secrets  # More secure for cryptographic purposes

import pytest
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.service_registry import ServiceRegistry


@pytest.mark.asyncio
async def test_brain_registration():
    """Test that ALEJOBrain registers itself with ServiceRegistry during initialization"""
    # Create an instance of ALEJOBrain. If ALEJOBrain accepts a test_mode flag, set it to True to avoid real dependencies.
    brain = ALEJOBrain(test_mode=True)

    # Start the brain, which should trigger registration with ServiceRegistry
    await brain.start()

    # Allow time for asynchronous registration to occur
    await asyncio.sleep(0.1)

    # Check that the brain has a service_registry attribute and it is an instance of ServiceRegistry
    assert hasattr(
        brain, "service_registry"
    ), "ALEJOBrain should have a service_registry attribute after initialization"
    assert isinstance(
        brain.service_registry, ServiceRegistry
    ), "service_registry should be an instance of ServiceRegistry"

    await brain.stop()
