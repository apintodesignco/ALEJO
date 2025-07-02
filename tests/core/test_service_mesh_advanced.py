"""Tests for enhanced ServiceMesh with advanced load balancing and health monitoring"""

import asyncio
import json
import secrets  # More secure for cryptographic purposes
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch

import aiohttp
import pytest
from alejo.core.event_bus import Event, EventBus, EventType
from alejo.core.service_mesh import CircuitBreaker, ServiceHealth, ServiceMesh


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
async def test_weighted_load_balancing(service_mesh):
    """Test weighted load balancing with health metrics"""
    # Register multiple endpoints for a service
    endpoints = ["http://service1:8001", "http://service1:8002", "http://service1:8003"]
    for endpoint in endpoints:
        service_mesh.register_service("test_service", endpoint)

    # Set up mock health data
    health_data = {
        endpoints[0]: ServiceHealth(
            is_healthy=True,
            last_check=datetime.now(),
            error_count=0,
            latency_ms=50,
            success_rate=0.98,
            avg_latency_ms=45,
        ),
        endpoints[1]: ServiceHealth(
            is_healthy=True,
            last_check=datetime.now(),
            error_count=2,
            latency_ms=100,
            success_rate=0.85,
            avg_latency_ms=95,
        ),
        endpoints[2]: ServiceHealth(
            is_healthy=True,
            last_check=datetime.now(),
            error_count=5,
            latency_ms=200,
            success_rate=0.75,
            avg_latency_ms=180,
        ),
    }

    service_mesh.health = health_data

    # Make multiple requests and track endpoint selection
    selections = {endpoint: 0 for endpoint in endpoints}
    total_requests = 1000

    for _ in range(total_requests):
        endpoint = await service_mesh.get_endpoint("test_service")
        selections[endpoint] += 1

    # Verify that healthier endpoints are selected more frequently
    assert (
        selections[endpoints[0]] > selections[endpoints[1]] > selections[endpoints[2]]
    )
    # Best performing endpoint should get at least 50% of requests
    assert selections[endpoints[0]] >= total_requests * 0.5


@pytest.mark.asyncio
async def test_health_check_metrics(service_mesh):
    """Test advanced health check metrics and updates"""
    endpoint = "http://testservice:8000"
    service_mesh.register_service("test_service", endpoint)

    # Mock successful health check response
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json = AsyncMock(
        return_value={
            "version": "1.2.3",
            "dependencies": ["db", "cache"],
            "metrics": {"cpu": 0.5, "memory": 0.7},
        }
    )

    with patch("aiohttp.ClientSession.get", return_value=mock_response):
        success = await service_mesh._check_service_health(endpoint)
        assert success

        # Verify health metrics were updated
        health = service_mesh.health[endpoint]
        assert health.is_healthy
        assert health.success_rate > 0.9  # Should be high after successful check
        assert health.consecutive_failures == 0
        assert isinstance(health.avg_latency_ms, float)

        # Verify service metadata was captured
        assert service_mesh._service_versions["test_service"][endpoint] == "1.2.3"
        assert service_mesh._service_dependencies["test_service"] == ["db", "cache"]


@pytest.mark.asyncio
async def test_circuit_breaker_adaptive_behavior(service_mesh):
    """Test circuit breaker's adaptive behavior under various conditions"""
    endpoint = "http://testservice:8000"
    service_mesh.register_service("test_service", endpoint)
    circuit_breaker = service_mesh.circuit_breakers[endpoint]

    # Mock a series of failed requests
    async def failing_request():
        raise aiohttp.ClientError("Test error")

    # Trigger multiple failures
    for _ in range(circuit_breaker.failure_threshold):
        with pytest.raises(aiohttp.ClientError):
            await circuit_breaker.call(failing_request)

    # Verify circuit is open
    assert circuit_breaker.state == "OPEN"
    assert circuit_breaker.failures >= circuit_breaker.failure_threshold

    # Wait for half-open timeout
    await asyncio.sleep(circuit_breaker.half_open_timeout)

    # Mock successful request
    async def successful_request():
        return {"status": "ok"}

    # Test recovery
    result = await circuit_breaker.call(successful_request)
    assert result == {"status": "ok"}
    assert circuit_breaker.state == "HALF-OPEN"

    # Verify successful requests in half-open state lead to closed state
    for _ in range(circuit_breaker.success_threshold):
        await circuit_breaker.call(successful_request)

    assert circuit_breaker.state == "CLOSED"
    assert circuit_breaker.failures == 0


@pytest.mark.asyncio
async def test_service_dependency_cascade(service_mesh):
    """Test handling of service dependency cascades"""
    # Register services with dependencies
    services = {
        "api": ["http://api:8000"],
        "auth": ["http://auth:8000"],
        "db": ["http://db:8000"],
    }

    for service, endpoints in services.items():
        for endpoint in endpoints:
            service_mesh.register_service(service, endpoint)

    # Set up dependencies
    service_mesh._service_dependencies.update(
        {"api": ["auth", "db"], "auth": ["db"], "db": []}
    )

    # Simulate DB service failure
    db_endpoint = services["db"][0]
    service_mesh.health[db_endpoint].is_healthy = False
    service_mesh.health[db_endpoint].error_count = 5

    # Verify dependent services are affected
    auth_endpoint = await service_mesh.get_endpoint("auth")
    assert auth_endpoint is None  # Auth should be unavailable due to DB dependency

    api_endpoint = await service_mesh.get_endpoint("api")
    assert (
        api_endpoint is None
    )  # API should be unavailable due to transitive dependency


@pytest.mark.asyncio
async def test_canary_deployment(service_mesh):
    """Test canary deployment with version-aware routing"""
    # Register multiple versions of a service
    endpoints = {
        "http://service:8001": "1.0.0",  # Stable version
        "http://service:8002": "1.1.0",  # Canary version
    }

    for endpoint, version in endpoints.items():
        service_mesh.register_service("test_service", endpoint)
        service_mesh._service_versions.setdefault("test_service", {})[
            endpoint
        ] = version
        service_mesh.health[endpoint] = ServiceHealth(
            is_healthy=True,
            last_check=datetime.now(),
            error_count=0,
            latency_ms=50,
            success_rate=1.0,
            avg_latency_ms=50,
        )

    # Track version distribution
    selections = {version: 0 for version in endpoints.values()}
    total_requests = 1000

    for _ in range(total_requests):
        endpoint = await service_mesh.get_endpoint("test_service")
        version = service_mesh._service_versions["test_service"][endpoint]
        selections[version] += 1

    # Verify canary gets limited traffic (10-20%)
    canary_ratio = selections["1.1.0"] / total_requests
    assert 0.1 <= canary_ratio <= 0.2
