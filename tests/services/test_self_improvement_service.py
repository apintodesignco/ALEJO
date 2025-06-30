"""
Tests for ALEJO's self-improvement service
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime

from alejo.services.self_improvement_service import (
    SelfImprovementService,
    AdaptationRequest,
    MetricsResponse
)
from alejo.learning.self_improvement import ImprovementMetrics

@pytest.fixture
def mock_improvement_system():
    """Create a mock self-improvement system"""
    mock = Mock()
    mock._collect_system_metrics = AsyncMock(return_value=ImprovementMetrics(
        error_recovery_rate=0.85,
        learning_efficiency=0.75,
        emotional_adaptation=0.9,
        performance_score=0.83,
        timestamp=datetime.now()
    ))
    mock.adaptation_strategies = {
        "error_handling_recurring": Mock(
            component="error_handling",
            trigger_condition={
                "error_type": "recurring",
                "frequency_threshold": 3,
                "time_window": 3600
            },
            success_criteria={
                "error_reduction": 0.5,
                "recovery_rate": 0.8
            },
            priority=1
        )
    }
    mock.active_adaptations = {}
    mock._apply_adaptation = AsyncMock()
    return mock

@pytest.fixture
def service():
    """Create a test self-improvement service"""
    return SelfImprovementService()

@pytest.fixture
def client(service, mock_improvement_system):
    """Create a test client"""
    service.improvement_system = mock_improvement_system
    return TestClient(service.app)

def test_health_check_success(client):
    """Test health check endpoint when system is healthy"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_health_check_failure(service):
    """Test health check endpoint when system is not initialized"""
    service.improvement_system = None
    client = TestClient(service.app)
    response = client.get("/health")
    assert response.status_code == 503
    assert "not initialized" in response.json()["detail"]

def test_get_metrics(client):
    """Test metrics endpoint"""
    response = client.get("/metrics")
    assert response.status_code == 200
    data = response.json()
    
    assert 0 <= data["error_recovery_rate"] <= 1
    assert 0 <= data["learning_efficiency"] <= 1
    assert 0 <= data["emotional_adaptation"] <= 1
    assert 0 <= data["performance_score"] <= 1
    assert isinstance(data["timestamp"], str)

def test_trigger_adaptation_success(client):
    """Test successful adaptation trigger"""
    request = AdaptationRequest(
        component="error_handling",
        trigger_type="recurring",
        context={"service": "test"}
    )
    
    response = client.post("/adapt", json=request.dict())
    assert response.status_code == 200
    assert response.json()["status"] == "adaptation_triggered"
    assert response.json()["strategy"] == "error_handling_recurring"

def test_trigger_adaptation_not_found(client):
    """Test adaptation trigger with unknown strategy"""
    request = AdaptationRequest(
        component="unknown",
        trigger_type="unknown",
        context={}
    )
    
    response = client.post("/adapt", json=request.dict())
    assert response.status_code == 404
    assert "No adaptation strategy found" in response.json()["detail"]

def test_get_active_adaptations(client):
    """Test getting active adaptations"""
    # Add a mock active adaptation
    test_time = datetime.now()
    client.app.state.improvement_system.active_adaptations = {
        "test_strategy": test_time
    }
    
    response = client.get("/adaptations/active")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data["active_adaptations"]) == 1
    assert data["active_adaptations"][0]["strategy_id"] == "test_strategy"
    assert isinstance(data["active_adaptations"][0]["start_time"], str)

def test_get_adaptation_strategies(client):
    """Test getting available adaptation strategies"""
    response = client.get("/strategies")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data["strategies"]) == 1
    strategy = data["strategies"][0]
    assert strategy["id"] == "error_handling_recurring"
    assert strategy["component"] == "error_handling"
    assert strategy["priority"] == 1
    assert "trigger_condition" in strategy
    assert "success_criteria" in strategy

@pytest.mark.asyncio
async def test_service_startup_shutdown():
    """Test service startup and shutdown events"""
    service = SelfImprovementService()
    
    # Test startup
    await service.app.router.startup()
    assert service.improvement_system is not None
    assert service.monitor_task is not None
    assert not service.monitor_task.done()
    
    # Test shutdown
    await service.app.router.shutdown()
    assert service.monitor_task.cancelled()

def test_service_integration():
    """Test service integration with FastAPI"""
    service = SelfImprovementService()
    assert service.app.title == "ALEJO Self-Improvement Service"
    
    # Verify route registration
    routes = {route.path: route.methods for route in service.app.routes}
    assert "/health" in routes
    assert "/metrics" in routes
    assert "/adapt" in routes
    assert "/adaptations/active" in routes
    assert "/strategies" in routes
