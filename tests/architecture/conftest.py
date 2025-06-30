"""Configuration for architecture-level tests"""

import pytest
import pytest_asyncio
from alejo.core.event_bus import EventBus
from alejo.core.service_mesh import ServiceMesh
from alejo.cognitive.memory.working_memory import WorkingMemory
from alejo.services.memory_service import MemoryService

@pytest_asyncio.fixture
async def event_bus():
    """Create a test event bus instance"""
    bus = EventBus("redis://localhost:6379/0")
    await bus.start()
    yield bus
    await bus.stop()

@pytest_asyncio.fixture
async def service_mesh(event_bus):
    """Create a test service mesh instance"""
    mesh = ServiceMesh(event_bus)
    await mesh.start()
    yield mesh
    await mesh.stop()

@pytest_asyncio.fixture
async def working_memory(event_bus):
    """Create a test working memory instance"""
    memory = WorkingMemory(event_bus, config={'test_mode': True})
    await memory.initialize()
    yield memory
    await memory.cleanup()

@pytest_asyncio.fixture
async def memory_service(event_bus, working_memory):
    """Create a test memory service instance"""
    service = MemoryService(event_bus, working_memory)
    await service.initialize()
    yield service
    await service.cleanup()
