"""
ALEJO Inter-Service Communication Module

This module provides utilities for communication between microservices in ALEJO,
enabling:
- HTTP-based communication for direct service-to-service interaction
- Error handling and retries for robust communication
"""

import logging
from typing import Dict, Any, Optional
import requests
from requests.exceptions import RequestException
import time
import asyncio

from ..utils.error_handling import handle_errors
from ..core.circuit_breaker import CircuitBreaker, CircuitBreakerError
from ..core.service_registry import ServiceRegistry

logger = logging.getLogger(__name__)

class ServiceCommunicator:
    """Handles communication between ALEJO microservices"""
    
    def __init__(self, service_endpoints: Dict[str, str], max_retries: int = 3, retry_delay: float = 1.0):
        """Initialize the communicator with service endpoints"""
        self.service_endpoints = service_endpoints
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        
        # Initialize service registry
        self.registry = ServiceRegistry()
        self._registry_started = False
        
        # Initialize circuit breakers for each service
        self.circuit_breakers = {}
        for service_name in service_endpoints:
            self.circuit_breakers[service_name] = CircuitBreaker(
                name=f"{service_name}_circuit",
                failure_threshold=5,  # Trip after 5 failures
                recovery_timeout=30.0,  # Wait 30s before attempting recovery
                half_open_timeout=10.0  # Test service health for 10s
            )
        
        logger.info("ServiceCommunicator initialized with endpoints: %s", service_endpoints)
        
    async def start(self):
        """Start the service communicator"""
        if not self._registry_started:
            await self.registry.start()
            
            # Register initial services
            for service_name, url in self.service_endpoints.items():
                await self.registry.register(service_name, url)
            
            self._registry_started = True
            logger.info("ServiceCommunicator started")
            
    async def stop(self):
        """Stop the service communicator"""
        if self._registry_started:
            await self.registry.stop()
            self._registry_started = False
            logger.info("ServiceCommunicator stopped")
            
    async def register_service(self, service_name: str, url: str, metadata: Dict = None):
        """Register a new service"""
        if not self._registry_started:
            await self.start()
            
        await self.registry.register(service_name, url, metadata)
        
        # Create circuit breaker if needed
        if service_name not in self.circuit_breakers:
            self.circuit_breakers[service_name] = CircuitBreaker(
                name=f"{service_name}_circuit",
                failure_threshold=5,
                recovery_timeout=30.0,
                half_open_timeout=10.0
            )
            
    async def deregister_service(self, service_name: str, url: str):
        """Deregister a service"""
        if self._registry_started:
            await self.registry.deregister(service_name, url)
    
    @handle_errors(component="service_communicator", category="http_request")
    async def send_request(self, service_name: str, endpoint: str, method: str = "POST", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send a request to a specified service endpoint with circuit breaker protection"""
        if not self._registry_started:
            await self.start()
            
        # Get service instance from registry
        instance = await self.registry.get_service(service_name)
        if not instance:
            raise ValueError(f"No healthy instances available for service: {service_name}")
        
        url = f"{instance.url}{endpoint}"
        logger.info(f"Sending {method} request to {url}")
        
        circuit = self.circuit_breakers[service_name]
        
        async def _make_request():
            for attempt in range(self.max_retries):
                try:
                    if method.upper() == "POST":
                        response = requests.post(url, json=data)
                    elif method.upper() == "GET":
                        response = requests.get(url, params=data)
                    else:
                        raise ValueError(f"Unsupported HTTP method: {method}")
                    
                    response.raise_for_status()
                    
                    # Update service heartbeat
                    await self.registry.heartbeat(service_name, instance.url)
                    
                    return response.json()
                except RequestException as e:
                    logger.warning(f"Request to {url} failed (attempt {attempt+1}/{self.max_retries}): {str(e)}")
                    if attempt == self.max_retries - 1:
                        # Mark service as unhealthy after max retries
                        instance.status = "unhealthy"
                        logger.error(f"Failed to communicate with {service_name} after {self.max_retries} attempts")
                        raise
                    await asyncio.sleep(self.retry_delay)
            
            raise Exception(f"Failed to communicate with {service_name} after {self.max_retries} attempts")
        
        try:
            return await circuit.call(_make_request)
        except CircuitBreakerError as e:
            logger.error(f"Circuit breaker prevented request to {service_name}: {e}")
            raise RequestException(f"Service {service_name} is unavailable: {e}") from e
    
    async def call_emotional_service_sentiment(self, text: str) -> Dict[str, float]:
        """Call Emotional Intelligence Service for sentiment analysis"""
        return await self.send_request("emotional_intelligence", "/sentiment", data={"text": text})
    
    async def call_emotional_service_response(self, text: str, relationship_context: Optional[Dict[str, Any]] = None) -> str:
        """Call Emotional Intelligence Service for empathetic response"""
        data = {"text": text}
        if relationship_context:
            data["relationship_context"] = relationship_context
        response = self.send_request("emotional_intelligence", "/response", data=data)
        return response.get("response", "")
    
    def call_emotional_service_ethical_evaluation(self, action: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Call Emotional Intelligence Service for ethical evaluation"""
        return self.send_request("emotional_intelligence", "/ethical-evaluation", data={"action": action, "context": context})
    
    def call_brain_service_process(self, user_input: str) -> str:
        """Call Brain Service to process user input"""
        response = self.send_request("brain", "/process", data={"user_input": user_input})
        return response.get("response", "")

# Default service endpoints for ALEJO microservices
DEFAULT_ENDPOINTS = {
    "brain": "http://localhost:8000",
    "emotional_intelligence": "http://localhost:8001"
}

# Global communicator instance for easy access
default_communicator = ServiceCommunicator(service_endpoints=DEFAULT_ENDPOINTS)
