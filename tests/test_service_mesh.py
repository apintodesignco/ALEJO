"""
Unit tests for the service mesh functionality
"""

import pytest
import asyncio
from unittest.mock import Mock, patch
from datetime import datetime, timedelta
import aiohttp
from alejo.core.service_mesh import ServiceMesh, ServiceHealth, CircuitBreaker
from alejo.core.event_bus import EventBus, Event, EventType

@pytest.fixture
def event_bus():
    """Create an event bus instance"""
    return EventBus()

@pytest.fixture
async def service_mesh(event_bus):
    """Create a service mesh instance with mocked session"""
    mesh = ServiceMesh(event_bus)
    
    # Create mock session
    mock_session = Mock()
    mock_session.get = Mock()
    mock_session.close = Mock()
    mesh.session = mock_session
    
    yield mesh
    
    # Cleanup
    await mesh.stop()

@pytest.mark.asyncio
async def test_service_registration(service_mesh):
    """Test service registration and endpoint tracking"""
    service_mesh.register_service("test-service", "http://localhost:8000")
    
    assert "test-service" in service_mesh.services
    assert "http://localhost:8000" in service_mesh.services["test-service"]
    assert service_mesh._service_counters["test-service"] == 0
    
    # Verify health record was created
    assert "http://localhost:8000" in service_mesh.health
    health = service_mesh.health["http://localhost:8000"]
    assert health.is_healthy
    assert health.error_count == 0
    
    # Verify circuit breaker was created
    assert "http://localhost:8000" in service_mesh.circuit_breakers

@pytest.mark.asyncio
async def test_service_deregistration(service_mesh):
    """Test service deregistration"""
    # Register service first
    service_mesh.register_service("test-service", "http://localhost:8000")
    
    # Deregister service
    success = service_mesh.deregister_service("test-service", "http://localhost:8000")
    assert success
    
    # Verify service was removed
    assert "test-service" not in service_mesh.services
    assert "http://localhost:8000" not in service_mesh.health
    assert "http://localhost:8000" not in service_mesh.circuit_breakers
    assert "test-service" not in service_mesh._service_counters
    
    # Try to deregister non-existent service
    success = service_mesh.deregister_service("nonexistent", "http://localhost:9999")
    assert not success

@pytest.mark.asyncio
async def test_load_balancing(service_mesh):
    """Test round-robin load balancing"""
    # Register multiple endpoints
    endpoints = [
        "http://localhost:8001",
        "http://localhost:8002",
        "http://localhost:8003"
    ]
    
    for endpoint in endpoints:
        service_mesh.register_service("test-service", endpoint)
        service_mesh.health[endpoint].is_healthy = True
    
    # Get endpoints multiple times and verify round-robin behavior
    selected = []
    for _ in range(6):  # Get twice through all endpoints
        endpoint = await service_mesh.get_endpoint("test-service")
        assert endpoint is not None
        selected.append(endpoint)
    
    # Verify each endpoint was used twice in order
    assert selected == endpoints * 2

@pytest.mark.asyncio
async def test_unhealthy_endpoint_handling(service_mesh):
    """Test handling of unhealthy endpoints"""
    # Register multiple endpoints
    healthy_endpoint = "http://localhost:8001"
    unhealthy_endpoint = "http://localhost:8002"
    
    service_mesh.register_service("test-service", healthy_endpoint)
    service_mesh.register_service("test-service", unhealthy_endpoint)
    
    # Mark one endpoint as unhealthy
    service_mesh.health[unhealthy_endpoint].is_healthy = False
    service_mesh.health[unhealthy_endpoint].error_count = 5
    
    # Get endpoint multiple times
    for _ in range(3):
        endpoint = await service_mesh.get_endpoint("test-service")
        assert endpoint == healthy_endpoint

@pytest.mark.asyncio
async def test_health_check(service_mesh):
    """Test health check functionality"""
    endpoint = "http://localhost:8000"
    service_mesh.register_service("test-service", endpoint)
    
    # Mock successful health check
    mock_response = Mock()
    mock_response.status = 200
    service_mesh.session.get.return_value.__aenter__.return_value = mock_response
    
    is_healthy = await service_mesh._check_service_health(endpoint)
    assert is_healthy
    assert service_mesh.health[endpoint].is_healthy
    assert service_mesh.health[endpoint].error_count == 0
    
    # Mock failed health check
    mock_response.status = 500
    is_healthy = await service_mesh._check_service_health(endpoint)
    assert not is_healthy
    assert not service_mesh.health[endpoint].is_healthy
    assert service_mesh.health[endpoint].error_count == 1

@pytest.mark.asyncio
async def test_auto_deregistration(service_mesh):
    """Test automatic deregistration of consistently unhealthy endpoints"""
    endpoint = "http://localhost:8000"
    service_mesh.register_service("test-service", endpoint)
    
    # Mock failed health checks
    mock_response = Mock()
    mock_response.status = 500
    service_mesh.session.get.return_value.__aenter__.return_value = mock_response
    
    # Simulate multiple failed health checks
    for _ in range(11):  # More than threshold (10)
        await service_mesh._check_service_health(endpoint)
    
    # Run health check loop once
    await service_mesh._check_all_services()
    
    # Verify endpoint was deregistered
    assert "test-service" not in service_mesh.services
    assert endpoint not in service_mesh.health
    assert endpoint not in service_mesh.circuit_breakers

@pytest.mark.asyncio
async def test_circuit_breaker(service_mesh):
    """Test circuit breaker functionality"""
    endpoint = "http://localhost:8000"
    service_mesh.register_service("test-service", endpoint)
    circuit_breaker = service_mesh.circuit_breakers[endpoint]
    
    # Mock failed requests
    async def failing_request():
        raise Exception("Service unavailable")
    
    # Trigger circuit breaker
    for _ in range(circuit_breaker.failure_threshold):
        with pytest.raises(Exception):
            await circuit_breaker.call(failing_request)
    
    assert circuit_breaker.state == "OPEN"
    
    # Verify circuit breaker prevents calls
    with pytest.raises(Exception, match="Circuit breaker is OPEN"):
        await circuit_breaker.call(failing_request)
    
    # Mock successful request
    async def successful_request():
        return "Success"
    
    # Wait for reset timeout
    circuit_breaker.last_failure_time = datetime.now() - timedelta(
        seconds=circuit_breaker.reset_timeout + 1
    )
    
    # Verify circuit breaker allows request and resets
    result = await circuit_breaker.call(successful_request)
    assert result == "Success"
    assert circuit_breaker.state == "CLOSED"
    assert circuit_breaker.failures == 0
