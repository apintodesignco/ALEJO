"""
Tests for service communicator with service registry integration
"""

import asyncio
import secrets  # More secure for cryptographic purposes
from unittest.mock import AsyncMock, Mock, patch

import pytest
import requests
from alejo.core.circuit_breaker import CircuitBreakerError
from alejo.core.service_registry import ServiceInstance
from alejo.services.communication import ServiceCommunicator
from requests.exceptions import RequestException


@pytest.fixture
async def communicator():
    """Create a test communicator"""
    endpoints = {
        "test_service": "http://localhost:8000",
        "other_service": "http://localhost:8001",
    }
    comm = ServiceCommunicator(endpoints)
    await comm.start()
    yield comm
    await comm.stop()


@pytest.mark.asyncio
async def test_service_registration(communicator):
    """Test service registration through communicator"""
    # Register a new service
    service_name = "new_service"
    url = "http://localhost:8002"
    await communicator.register_service(service_name, url)

    # Verify service is registered in registry
    instance = await communicator.registry.get_service(service_name)
    assert instance is not None
    assert instance.url == url

    # Verify circuit breaker was created
    assert service_name in communicator.circuit_breakers


@pytest.mark.asyncio
async def test_service_deregistration(communicator):
    """Test service deregistration"""
    service_name = "test_service"
    url = "http://localhost:8000"

    # Deregister service
    await communicator.deregister_service(service_name, url)

    # Verify service is not available
    with pytest.raises(ValueError):
        await communicator.send_request(service_name, "/test")


@pytest.mark.asyncio
async def test_service_discovery(communicator):
    """Test service discovery during request"""
    service_name = "test_service"
    endpoint = "/test"

    # Mock successful response
    mock_response = Mock()
    mock_response.json.return_value = {"status": "ok"}
    mock_response.raise_for_status.return_value = None

    with patch("requests.post", return_value=mock_response):
        response = await communicator.send_request(service_name, endpoint)
        assert response == {"status": "ok"}


@pytest.mark.asyncio
async def test_service_heartbeat(communicator):
    """Test service heartbeat updates"""
    service_name = "test_service"
    url = "http://localhost:8000"
    endpoint = "/test"

    # Mock successful response
    mock_response = Mock()
    mock_response.json.return_value = {"status": "ok"}
    mock_response.raise_for_status.return_value = None

    with patch("requests.post", return_value=mock_response):
        # Send request
        await communicator.send_request(service_name, endpoint)

        # Get service instance
        instance = await communicator.registry.get_service(service_name)
        assert instance.status == "healthy"


@pytest.mark.asyncio
async def test_unhealthy_service_handling(communicator):
    """Test handling of unhealthy services"""
    service_name = "test_service"
    endpoint = "/test"

    # Make service unhealthy by waiting for heartbeat timeout
    await asyncio.sleep(2)

    # Attempt to send request
    with pytest.raises(ValueError, match="No healthy instances available"):
        await communicator.send_request(service_name, endpoint)


@pytest.mark.asyncio
async def test_circuit_breaker_integration(communicator):
    """Test circuit breaker integration"""
    service_name = "test_service"
    endpoint = "/test"

    # Mock failed response
    with patch("requests.post", side_effect=RequestException("Connection error")):
        # Send requests until circuit breaker opens
        for _ in range(6):  # More than failure_threshold
            with pytest.raises(RequestException):
                await communicator.send_request(service_name, endpoint)

        # Verify circuit is open
        circuit = communicator.circuit_breakers[service_name]
        assert circuit.state.value == "open"


@pytest.mark.asyncio
async def test_service_recovery(communicator):
    """Test service recovery after failure"""
    service_name = "test_service"
    endpoint = "/test"

    # Make service fail
    with patch("requests.post", side_effect=RequestException("Connection error")):
        with pytest.raises(RequestException):
            await communicator.send_request(service_name, endpoint)

    # Mock successful response
    mock_response = Mock()
    mock_response.json.return_value = {"status": "ok"}
    mock_response.raise_for_status.return_value = None

    # Wait for recovery timeout
    await asyncio.sleep(1)

    # Service should recover
    with patch("requests.post", return_value=mock_response):
        response = await communicator.send_request(service_name, endpoint)
        assert response == {"status": "ok"}


@pytest.mark.asyncio
async def test_load_balancing(communicator):
    """Test load balancing through service registry"""
    service_name = "balanced_service"
    urls = ["http://localhost:8001", "http://localhost:8002", "http://localhost:8003"]

    # Register multiple instances
    for url in urls:
        await communicator.register_service(service_name, url)

    # Mock successful response
    mock_response = Mock()
    mock_response.json.return_value = {"status": "ok"}
    mock_response.raise_for_status.return_value = None

    # Send multiple requests and track URLs
    seen_urls = set()
    with patch("requests.post", return_value=mock_response):
        for _ in range(len(urls)):
            await communicator.send_request(service_name, "/test")
            instance = await communicator.registry.get_service(service_name)
            seen_urls.add(instance.url)

    # Should have used all URLs
    assert seen_urls == set(urls)
