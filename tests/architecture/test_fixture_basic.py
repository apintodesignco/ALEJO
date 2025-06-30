"""Basic test to verify fixture functionality in architecture tests"""

import pytest
import pytest_asyncio
import logging

logger = logging.getLogger(__name__)

# Set up basic logging to ensure we see any output
logging.basicConfig(level=logging.INFO)

@pytest.mark.asyncio
async def test_event_bus_fixture(event_bus):
    """Test that event_bus fixture initializes correctly"""
    logger.info("Starting event_bus fixture test")
    assert event_bus is not None
    assert event_bus.redis_url == "redis://localhost:6379/0"
    logger.info("Event bus initialized successfully")

@pytest.mark.asyncio
async def test_service_mesh_fixture(service_mesh, event_bus):
    """Test that service_mesh fixture initializes correctly"""
    logger.info("Starting service_mesh fixture test")
    assert service_mesh is not None
    assert service_mesh.event_bus == event_bus
    logger.info("Service mesh initialized successfully")

@pytest.mark.asyncio
async def test_working_memory_fixture(working_memory, event_bus):
    """Test that working_memory fixture initializes correctly"""
    logger.info("Starting working_memory fixture test")
    assert working_memory is not None
    assert working_memory.event_bus == event_bus
    assert working_memory.config.get('test_mode') is True
    logger.info("Working memory initialized successfully")

@pytest.mark.asyncio
async def test_memory_service_fixture(memory_service, event_bus, working_memory):
    """Test that memory_service fixture initializes correctly"""
    logger.info("Starting memory_service fixture test")
    assert memory_service is not None
    assert memory_service.event_bus == event_bus
    assert memory_service.working_memory == working_memory
    logger.info("Memory service initialized successfully")
