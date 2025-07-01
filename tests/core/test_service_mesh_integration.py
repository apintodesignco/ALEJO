"""Integration tests for ServiceMesh and EventBus interaction"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
import aiohttp
import json

from alejo.core.event_bus import EventBus, Event, EventType
from alejo.core.service_mesh import ServiceMesh, ServiceHealth, CircuitBreaker
import secrets  # More secure for cryptographic purposes

@pytest.fixture
async def event_bus():
    """Create a test event bus instance"""
    bus = EventBus("redis://localhost:6379/0")
    await bus.start()
    yield bus
    await bus.stop()

@pytest.fixture
async def service_mesh(event_bus):
    """Create a test service mesh instance"""
    mesh = ServiceMesh(event_bus)
    await mesh.start()
    yield mesh
    await mesh.stop()

@pytest.mark.asyncio
async def test_service_registration_events(service_mesh, event_bus):
    """Test service registration events are properly propagated"""
    # Track registration events
    received_events = []
    
    async def track_event(event):
        if event.data.get("action") in ["register", "deregister"]:
            received_events.append(event)
    
    event_bus.subscribe(EventType.SYSTEM, track_event)
    
    # Register a service
    service_mesh.register_service("test_service", "http://test:8000")
    
    # Wait for event propagation
    await asyncio.sleep(0.1)
    
    # Verify registration event was sent
    assert len(received_events) == 1
    event = received_events[0]
    assert event.data["action"] == "register"
    assert event.data["service_name"] == "test_service"
    assert event.data["endpoint"] == "http://test:8000"

@pytest.mark.asyncio
async def test_health_status_events(service_mesh, event_bus):
    """Test health status events are properly emitted"""
    # Track health events
    health_events = []
    
    async def track_health(event):
        if event.data.get("action") == "health_update":
            health_events.append(event)
    
    event_bus.subscribe(EventType.SYSTEM, track_health)
    
    # Register and check health of a service
    endpoint = "http://test:8000"
    service_mesh.register_service("test_service", endpoint)
    
    # Mock successful health check
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json = AsyncMock(return_value={"status": "healthy"})
    
    with patch("aiohttp.ClientSession.get", return_value=mock_response):
        await service_mesh._check_service_health(endpoint)
    
    # Wait for event propagation
    await asyncio.sleep(0.1)
    
    # Verify health event was emitted
    assert len(health_events) == 1
    event = health_events[0]
    assert event.data["action"] == "health_update"
    assert event.data["endpoint"] == endpoint
    assert event.data["health"]["is_healthy"] is True
    assert "success_rate" in event.data["health"]
    assert "avg_latency_ms" in event.data["health"]

@pytest.mark.asyncio
async def test_service_dependency_events(service_mesh, event_bus):
    """Test service dependency events are properly handled"""
    # Register services with dependencies
    services = {
        "api": ["http://api:8000"],
        "auth": ["http://auth:8000"],
        "db": ["http://db:8000"]
    }
    
    dependency_events = []
    
    async def track_dependencies(event):
        if event.data.get("action") == "dependency_update":
            dependency_events.append(event)
    
    event_bus.subscribe(EventType.SYSTEM, track_dependencies)
    
    # Register services and mock their health checks
    mock_responses = {}
    for service, endpoints in services.items():
        for endpoint in endpoints:
            service_mesh.register_service(service, endpoint)
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.headers = {"content-type": "application/json"}
            
            # Set up mock dependencies
            dependencies = []
            if service == "api":
                dependencies = ["auth", "db"]
            elif service == "auth":
                dependencies = ["db"]
                
            mock_response.json = AsyncMock(return_value={
                "dependencies": dependencies
            })
            mock_responses[endpoint] = mock_response
    
    # Mock health checks to update dependencies
    async def mock_get(url, **kwargs):
        return mock_responses[url.split("/health")[0]]
    
    with patch("aiohttp.ClientSession.get", side_effect=mock_get):
        # Perform health checks
        for service, endpoints in services.items():
            for endpoint in endpoints:
                await service_mesh._check_service_health(endpoint)
    
    # Wait for event propagation
    await asyncio.sleep(0.1)
    
    # Verify dependency graph was properly constructed
    assert service_mesh._service_dependencies["api"] == ["auth", "db"]
    assert service_mesh._service_dependencies["auth"] == ["db"]
    assert "db" not in service_mesh._service_dependencies or not service_mesh._service_dependencies["db"]

@pytest.mark.asyncio
async def test_circuit_breaker_events(service_mesh, event_bus):
    """Test circuit breaker state change events"""
    circuit_events = []
    
    async def track_circuit_events(event):
        if event.data.get("action") == "circuit_state_change":
            circuit_events.append(event)
    
    event_bus.subscribe(EventType.SYSTEM, track_circuit_events)
    
    # Register a service
    endpoint = "http://test:8000"
    service_mesh.register_service("test_service", endpoint)
    circuit_breaker = service_mesh.circuit_breakers[endpoint]
    
    # Mock failing requests to trigger circuit breaker
    async def failing_request():
        raise aiohttp.ClientError("Test error")
    
    # Trigger failures to open circuit
    for _ in range(circuit_breaker.failure_threshold):
        with pytest.raises(aiohttp.ClientError):
            await circuit_breaker.call(failing_request)
    
    # Wait for event propagation
    await asyncio.sleep(0.1)
    
    # Verify circuit state change events
    assert len(circuit_events) > 0
    last_event = circuit_events[-1]
    assert last_event.data["action"] == "circuit_state_change"
    assert last_event.data["endpoint"] == endpoint
    assert last_event.data["state"] == "OPEN"
    assert "failure_count" in last_event.data

@pytest.mark.asyncio
async def test_service_mesh_shutdown(service_mesh, event_bus):
    """Test graceful shutdown with event propagation"""
    shutdown_events = []
    
    async def track_shutdown(event):
        if event.data.get("action") == "service_shutdown":
            shutdown_events.append(event)
    
    event_bus.subscribe(EventType.SYSTEM, track_shutdown)
    
    # Register some services
    service_mesh.register_service("service1", "http://service1:8000")
    service_mesh.register_service("service2", "http://service2:8000")
    
    # Initiate shutdown
    await service_mesh.stop()
    
    # Wait for event propagation
    await asyncio.sleep(0.1)
    
    # Verify shutdown events were sent for each service
    assert len(shutdown_events) >= 2  # At least one per service
    for event in shutdown_events:
        assert event.data["action"] == "service_shutdown"
        assert "service_name" in event.data
        assert "endpoint" in event.data