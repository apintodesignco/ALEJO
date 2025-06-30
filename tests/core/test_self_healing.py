"""Integration tests for the self-healing system."""

import pytest
import asyncio
from unittest.mock import Mock, patch
from datetime import datetime

from alejo.core.self_healing import SelfHealingSystem, HealingStrategy, ComponentHealth
from alejo.core.event_bus import EventBus
from alejo.services.brain_service import BrainService

@pytest.fixture
async def event_bus():
    """Create and start an event bus instance."""
    bus = EventBus()
    yield bus
    await bus.stop()

@pytest.fixture
def healing_system(event_bus):
    """Create a self-healing system instance."""
    return SelfHealingSystem(event_bus)

@pytest.fixture
async def brain_service():
    """Create a brain service instance with self-healing enabled."""
    service = BrainService()
    yield service
    if service.healing_system:
        await service.healing_system.stop_monitoring()

@pytest.mark.asyncio
async def test_component_registration():
    """Test that components can be registered with healing strategies."""
    bus = EventBus()
    system = SelfHealingSystem(bus)
    
    # Register a test component
    system.register_component("test_component", [
        HealingStrategy.RETRY,
        HealingStrategy.RESTART
    ])
    
    # Verify component is registered
    health = system.get_component_health("test_component")
    assert health is not None
    assert health.name == "test_component"
    assert health.status == "healthy"
    assert health.error_count == 0

@pytest.mark.asyncio
async def test_error_reporting_and_recovery():
    """Test error reporting and automatic recovery attempts."""
    bus = EventBus()
    system = SelfHealingSystem(bus)
    
    # Register component with mock recovery
    system.register_component("test_component", [HealingStrategy.RETRY])
    
    # Mock the recovery method
    async def mock_recovery(*args):
        return True
    
    system._retry_with_backoff = mock_recovery
    
    # Report an error
    test_error = ValueError("Test error")
    system.report_error("test_component", test_error)
    
    # Verify error is recorded
    health = system.get_component_health("test_component")
    assert health.status == "error"
    assert health.error_count == 1
    assert str(test_error) in health.last_error
    
    # Attempt recovery
    success = await system._attempt_recovery("test_component")
    assert success
    
    # Verify component health is restored
    health = system.get_component_health("test_component")
    assert health.status == "healthy"
    assert health.error_count == 0
    assert health.recovery_attempts == 1

@pytest.mark.asyncio
async def test_brain_service_integration():
    """Test integration between BrainService and SelfHealingSystem."""
    service = BrainService()
    assert service.healing_system is not None
    
    # Verify core components are registered
    health = service.healing_system.get_all_health()
    assert "brain" in health
    assert "emotional_processor" in health
    assert "emotional_memory" in health
    
    # Test error recovery in process_user_input
    with patch.object(service.brain, 'process_text') as mock_process:
        # First call raises error
        mock_process.side_effect = [
            RuntimeError("Test error"),  # First call fails
            "Test response"  # Retry succeeds
        ]
        
        # Process input should succeed after recovery
        response = await service.process_user_input("test input")
        assert response == "Test response"
        
        # Verify error was reported and recovered
        health = service.healing_system.get_component_health("brain")
        assert health.recovery_attempts > 0

@pytest.mark.asyncio
async def test_health_check_endpoint():
    """Test the health check endpoint with self-healing status."""
    from fastapi.testclient import TestClient
    from alejo.services.brain_service import app, brain_instance
    
    # Initialize brain instance
    brain_instance = BrainService()
    
    # Create test client
    client = TestClient(app)
    
    # Get health status
    response = client.get("/health")
    assert response.status_code == 200
    
    data = response.json()
    assert "status" in data
    assert "components" in data
    assert "uptime" in data
    
    # Verify component health is included
    components = data["components"]
    assert "brain" in components
    assert "status" in components["brain"]
    assert "error_count" in components["brain"]

@pytest.mark.asyncio
async def test_multiple_recovery_strategies():
    """Test that multiple recovery strategies are attempted in order."""
    bus = EventBus()
    system = SelfHealingSystem(bus)
    
    # Register component with multiple strategies
    system.register_component("test_component", [
        HealingStrategy.RETRY,
        HealingStrategy.RESTART,
        HealingStrategy.DEGRADE
    ])
    
    # Mock strategy methods
    async def mock_retry(*args):
        return False  # Retry fails
        
    async def mock_restart(*args):
        return True  # Restart succeeds
    
    system._retry_with_backoff = mock_retry
    system._restart_component = mock_restart
    
    # Report error and attempt recovery
    system.report_error("test_component", ValueError("Test error"))
    success = await system._attempt_recovery("test_component")
    
    # Verify restart was successful after retry failed
    assert success
    health = system.get_component_health("test_component")
    assert health.status == "healthy"
    assert health.recovery_attempts == 1

@pytest.mark.asyncio
async def test_monitoring_task():
    """Test that the health monitoring task runs and checks components."""
    bus = EventBus()
    system = SelfHealingSystem(bus)
    
    # Register test component
    system.register_component("test_component", [HealingStrategy.RETRY])
    
    # Start monitoring
    await system.start_monitoring()
    
    # Report an error
    system.report_error("test_component", ValueError("Test error"))
    
    # Wait for monitoring cycle
    await asyncio.sleep(1)
    
    # Stop monitoring
    await system.stop_monitoring()
    
    # Verify monitoring attempted recovery
    health = system.get_component_health("test_component")
    assert health.recovery_attempts > 0
