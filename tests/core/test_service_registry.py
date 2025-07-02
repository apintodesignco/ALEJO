"""
Tests for service registry
"""

import asyncio
import secrets  # More secure for cryptographic purposes
import time
from unittest.mock import AsyncMock, Mock

import pytest
from alejo.core.service_registry import ServiceInstance, ServiceRegistry


@pytest.fixture
async def registry():
    """Create a test registry with shorter timeouts"""
    registry = ServiceRegistry(heartbeat_timeout=1.0)
    await registry.start()
    yield registry
    await registry.stop()


@pytest.mark.asyncio
async def test_service_registration(registry):
    """Test basic service registration"""
    service_name = "test_service"
    instance_url = "http://localhost:8000"

    # Register service
    await registry.register(service_name, instance_url)

    # Get service instance
    instance = await registry.get_service(service_name)
    assert instance is not None
    assert instance.name == service_name
    assert instance.url == instance_url
    assert instance.status == "healthy"


@pytest.mark.asyncio
async def test_service_deregistration(registry):
    """Test service deregistration"""
    service_name = "test_service"
    instance_url = "http://localhost:8000"

    # Register and then deregister
    await registry.register(service_name, instance_url)
    await registry.deregister(service_name, instance_url)

    # Service should not be found
    instance = await registry.get_service(service_name)
    assert instance is None


@pytest.mark.asyncio
async def test_heartbeat_timeout(registry):
    """Test service becomes unhealthy after missing heartbeats"""
    service_name = "test_service"
    instance_url = "http://localhost:8000"

    await registry.register(service_name, instance_url)

    # Wait for heartbeat timeout
    await asyncio.sleep(1.5)

    # Service should be marked unhealthy
    instances = await registry.get_all_instances(service_name)
    assert len(instances) == 1
    assert instances[0].status == "unhealthy"

    # Healthy service getter should return None
    assert await registry.get_service(service_name) is None


@pytest.mark.asyncio
async def test_service_recovery(registry):
    """Test service recovery after heartbeat resumes"""
    service_name = "test_service"
    instance_url = "http://localhost:8000"

    await registry.register(service_name, instance_url)

    # Wait for timeout
    await asyncio.sleep(1.5)
    assert await registry.get_service(service_name) is None

    # Send heartbeat
    await registry.heartbeat(service_name, instance_url)

    # Service should be healthy again
    instance = await registry.get_service(service_name)
    assert instance is not None
    assert instance.status == "healthy"


@pytest.mark.asyncio
async def test_load_balancing(registry):
    """Test round-robin load balancing"""
    service_name = "test_service"
    urls = ["http://localhost:8001", "http://localhost:8002", "http://localhost:8003"]

    # Register multiple instances
    for url in urls:
        await registry.register(service_name, url)

    # Get services multiple times
    seen_urls = set()
    for _ in range(len(urls)):
        instance = await registry.get_service(service_name)
        seen_urls.add(instance.url)

    # Should have seen all URLs
    assert seen_urls == set(urls)


@pytest.mark.asyncio
async def test_service_metadata(registry):
    """Test service metadata storage and retrieval"""
    service_name = "test_service"
    instance_url = "http://localhost:8000"
    metadata = {"version": "1.0.0", "capabilities": ["feature1", "feature2"]}

    # Register with metadata
    await registry.register(service_name, instance_url, metadata)

    # Check metadata
    instance = await registry.get_service(service_name)
    assert instance.metadata == metadata


@pytest.mark.asyncio
async def test_service_updates_subscription(registry):
    """Test service update notifications"""
    service_name = "test_service"
    instance_url = "http://localhost:8000"

    # Create mock callback
    events = []

    async def callback(event_type, instance):
        events.append((event_type, instance))

    # Subscribe to updates
    registry.subscribe(service_name, callback)

    # Trigger events
    await registry.register(service_name, instance_url)
    await registry.deregister(service_name, instance_url)

    # Check received events
    assert len(events) == 2
    assert events[0][0] == "register"
    assert events[1][0] == "deregister"


@pytest.mark.asyncio
async def test_cleanup_task(registry):
    """Test cleanup task marks services unhealthy"""
    service_name = "test_service"
    instance_url = "http://localhost:8000"

    await registry.register(service_name, instance_url)

    # Wait for cleanup
    await asyncio.sleep(1.5)

    # Verify service is marked unhealthy
    instances = await registry.get_all_instances(service_name)
    assert instances[0].status == "unhealthy"


@pytest.mark.asyncio
async def test_registry_shutdown(registry):
    """Test registry shutdown"""
    service_name = "test_service"
    instance_url = "http://localhost:8000"

    await registry.register(service_name, instance_url)
    await registry.stop()

    # Cleanup task should be cancelled
    assert registry._cleanup_task.cancelled()
