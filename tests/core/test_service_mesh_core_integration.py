"""Integration tests for ServiceMesh with ALEJO core services"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
import aiohttp
import json

from alejo.core.event_bus import EventBus, Event, EventType
from alejo.core.service_mesh import ServiceMesh, ServiceHealth, CircuitBreaker
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.emotional_intelligence.processor import EmotionalProcessor
from alejo.cognitive.learning_orchestrator import LearningOrchestrator
from alejo.vision.vision_processor import VisionProcessor

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

@pytest.fixture
async def alejo_brain(event_bus):
    """Create a test ALEJO brain instance"""
    brain = ALEJOBrain()
    await brain.start()
    yield brain
    await brain.stop()

@pytest.mark.asyncio
async def test_emotional_processor_integration(service_mesh, event_bus):
    """Test ServiceMesh integration with EmotionalProcessor"""
    # Register EmotionalProcessor service
    processor_endpoint = "http://emotional:8000"
    service_mesh.register_service("emotional_processor", processor_endpoint)
    
    # Mock emotional processor responses
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json = AsyncMock(return_value={
        "emotion": "happy",
        "confidence": 0.85,
        "context_aware": True
    })
    
    with patch("aiohttp.ClientSession.get", return_value=mock_response):
        # Verify health check
        is_healthy = await service_mesh._check_service_health(processor_endpoint)
        assert is_healthy
        
        # Verify service discovery
        endpoint = await service_mesh.get_endpoint("emotional_processor")
        assert endpoint == processor_endpoint
        
        # Verify metrics are tracked
        health = service_mesh.health[processor_endpoint]
        assert health.is_healthy
        assert health.success_rate > 0.9
        assert isinstance(health.avg_latency_ms, float)

@pytest.mark.asyncio
async def test_learning_orchestrator_integration(service_mesh, event_bus):
    """Test ServiceMesh integration with LearningOrchestrator"""
    # Register LearningOrchestrator service
    orchestrator_endpoint = "http://learning:8000"
    service_mesh.register_service("learning_orchestrator", orchestrator_endpoint)
    
    # Set up mock learning data
    learning_data = {
        "model_version": "1.2.3",
        "training_status": "ready",
        "active_learning": True,
        "dependencies": ["emotional_processor", "vision_processor"]
    }
    
    # Mock orchestrator responses
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json = AsyncMock(return_value=learning_data)
    
    with patch("aiohttp.ClientSession.get", return_value=mock_response):
        # Verify health check and dependency tracking
        is_healthy = await service_mesh._check_service_health(orchestrator_endpoint)
        assert is_healthy
        
        # Verify dependencies were recorded
        assert "learning_orchestrator" in service_mesh._service_dependencies
        assert service_mesh._service_dependencies["learning_orchestrator"] == learning_data["dependencies"]
        
        # Verify version tracking
        assert "learning_orchestrator" in service_mesh._service_versions
        assert service_mesh._service_versions["learning_orchestrator"][orchestrator_endpoint] == learning_data["model_version"]

@pytest.mark.asyncio
async def test_vision_processor_integration(service_mesh, event_bus):
    """Test ServiceMesh integration with VisionProcessor"""
    # Register VisionProcessor service
    vision_endpoint = "http://vision:8000"
    service_mesh.register_service("vision_processor", vision_endpoint)
    
    # Mock vision processor health data
    health_data = {
        "status": "operational",
        "gpu_available": True,
        "models_loaded": ["object_detection", "scene_analysis"],
        "processing_queue": 0
    }
    
    # Mock processor responses
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json = AsyncMock(return_value=health_data)
    
    with patch("aiohttp.ClientSession.get", return_value=mock_response):
        # Verify health check
        is_healthy = await service_mesh._check_service_health(vision_endpoint)
        assert is_healthy
        
        # Verify service is discoverable
        endpoint = await service_mesh.get_endpoint("vision_processor")
        assert endpoint == vision_endpoint
        
        # Verify health metrics
        health = service_mesh.health[vision_endpoint]
        assert health.is_healthy
        assert health.error_count == 0

@pytest.mark.asyncio
async def test_alejo_brain_service_coordination(service_mesh, event_bus, alejo_brain):
    """Test coordination between ALEJOBrain and core services through ServiceMesh"""
    # Register core services
    services = {
        "emotional_processor": "http://emotional:8000",
        "learning_orchestrator": "http://learning:8000",
        "vision_processor": "http://vision:8000"
    }
    
    for service_name, endpoint in services.items():
        service_mesh.register_service(service_name, endpoint)
    
    # Mock service responses
    mock_responses = {
        "emotional_processor": {
            "emotion": "curious",
            "confidence": 0.9
        },
        "learning_orchestrator": {
            "learning_active": True,
            "feedback_processed": True
        },
        "vision_processor": {
            "scene_analyzed": True,
            "objects_detected": ["person", "laptop"]
        }
    }
    
    async def mock_get(url, **kwargs):
        response = AsyncMock()
        response.status = 200
        response.headers = {"content-type": "application/json"}
        
        # Extract service name from URL
        service_name = next(
            (name for name, ep in services.items() if ep in url),
            None
        )
        
        if service_name:
            response.json = AsyncMock(return_value=mock_responses[service_name])
        else:
            response.json = AsyncMock(return_value={"status": "ok"})
            
        return response
    
    # Track service coordination events
    coordination_events = []
    
    async def track_coordination(event):
        if event.type == EventType.SYSTEM and event.data.get("action") == "service_coordination":
            coordination_events.append(event)
    
    event_bus.subscribe(EventType.SYSTEM, track_coordination)
    
    with patch("aiohttp.ClientSession.get", side_effect=mock_get):
        # Verify all services are healthy
        for endpoint in services.values():
            is_healthy = await service_mesh._check_service_health(endpoint)
            assert is_healthy
        
        # Verify service dependencies
        for service_name in services:
            endpoint = await service_mesh.get_endpoint(service_name)
            assert endpoint == services[service_name]
            assert service_mesh.health[endpoint].is_healthy
        
        # Wait for coordination events
        await asyncio.sleep(0.1)
        
        # Verify service coordination
        assert len(coordination_events) > 0
        for event in coordination_events:
            assert "service_name" in event.data
            assert "status" in event.data
            assert event.data["status"] == "operational"

@pytest.mark.asyncio
async def test_service_failover_scenario(service_mesh, event_bus):
    """Test service failover and recovery scenarios"""
    # Register multiple instances of each service
    services = {
        "emotional_processor": [
            "http://emotional1:8000",
            "http://emotional2:8000"
        ],
        "learning_orchestrator": [
            "http://learning1:8000",
            "http://learning2:8000"
        ]
    }
    
    for service_name, endpoints in services.items():
        for endpoint in endpoints:
            service_mesh.register_service(service_name, endpoint)
    
    # Track failover events
    failover_events = []
    
    async def track_failover(event):
        if event.data.get("action") == "service_failover":
            failover_events.append(event)
    
    event_bus.subscribe(EventType.SYSTEM, track_failover)
    
    # Simulate primary instance failure
    for service_name, endpoints in services.items():
        primary_endpoint = endpoints[0]
        
        # Mock failure response for primary
        async def mock_failing_get(url, **kwargs):
            if primary_endpoint in url:
                raise aiohttp.ClientError("Connection failed")
            
            # Secondary is healthy
            response = AsyncMock()
            response.status = 200
            response.headers = {"content-type": "application/json"}
            response.json = AsyncMock(return_value={"status": "healthy"})
            return response
        
        with patch("aiohttp.ClientSession.get", side_effect=mock_failing_get):
            # Check health to trigger failover
            await service_mesh._check_service_health(primary_endpoint)
            
            # Verify failover to secondary
            endpoint = await service_mesh.get_endpoint(service_name)
            assert endpoint == endpoints[1]
            
            # Verify failover events
            await asyncio.sleep(0.1)
            matching_events = [e for e in failover_events 
                             if e.data["service_name"] == service_name]
            assert len(matching_events) > 0
            assert matching_events[-1].data["from_endpoint"] == primary_endpoint
            assert matching_events[-1].data["to_endpoint"] == endpoints[1]
