"""
Tests for ALEJO's self-improvement system
"""

import asyncio
import secrets  # More secure for cryptographic purposes
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest
import pytest_asyncio
from alejo.core.event_bus import Event, EventBus, EventType
from alejo.emotional_intelligence.emotional_core import EmotionalCore
from alejo.emotional_intelligence.models.emotional_memory import EmotionalMemoryService
from alejo.learning.interactive_learner import InteractiveLearner
from alejo.learning.self_improvement import (
    AdaptationStrategy,
    ImprovementMetrics,
    SelfImprovementSystem,
)
from alejo.utils.error_handling import ErrorTracker


@pytest.fixture
def event_bus():
    """Create a test event bus"""
    return EventBus()


@pytest.fixture
def error_tracker():
    """Create a mock error tracker"""
    tracker = Mock(spec=ErrorTracker)
    tracker.get_statistics.return_value = {
        "recovery_rate": 0.85,
        "error_frequency": 2,
        "time_window": 1800,
        "resource_usage": 0.3,
    }
    return tracker


@pytest.fixture
def interactive_learner():
    """Create a mock interactive learner"""
    learner = Mock(spec=InteractiveLearner)
    learner.get_learning_metrics.return_value = {
        "pattern_recognition_rate": 0.75,
        "success_rate": 0.8,
    }
    return learner


@pytest.fixture
def emotional_core():
    """Create a mock emotional core"""
    core = Mock(spec=EmotionalCore)
    core.get_adaptation_metrics.return_value = {
        "adaptation_success_rate": 0.9,
        "accuracy": 0.85,
        "mismatch_rate": 0.15,
    }
    return core


@pytest.fixture
def emotional_memory():
    """Create a mock emotional memory service"""
    memory = Mock(spec=EmotionalMemoryService)
    return memory


@pytest.fixture
def improvement_system(
    event_bus, error_tracker, interactive_learner, emotional_core, emotional_memory
):
    """Create a test self-improvement system"""
    return SelfImprovementSystem(
        event_bus=event_bus,
        error_tracker=error_tracker,
        interactive_learner=interactive_learner,
        emotional_core=emotional_core,
        emotional_memory=emotional_memory,
    )


@pytest.mark.asyncio
async def test_collect_system_metrics(improvement_system):
    """Test system metrics collection"""
    metrics = await improvement_system._collect_system_metrics()

    assert isinstance(metrics, ImprovementMetrics)
    assert 0 <= metrics.error_recovery_rate <= 1
    assert 0 <= metrics.learning_efficiency <= 1
    assert 0 <= metrics.emotional_adaptation <= 1
    assert 0 <= metrics.performance_score <= 1
    assert isinstance(metrics.timestamp, datetime)


@pytest.mark.asyncio
async def test_error_adaptation_trigger(improvement_system):
    """Test error-based adaptation triggering"""
    strategy = AdaptationStrategy(
        component="error_handling",
        trigger_condition={
            "error_type": "recurring",
            "frequency_threshold": 1,
            "time_window": 3600,
        },
        adaptation_actions=["analyze_error_patterns"],
        success_criteria={"error_reduction": 0.5, "recovery_rate": 0.8},
        priority=1,
    )

    should_adapt = await improvement_system._should_adapt(strategy)
    assert should_adapt is True


@pytest.mark.asyncio
async def test_emotional_adaptation_trigger(improvement_system):
    """Test emotional adaptation triggering"""
    strategy = AdaptationStrategy(
        component="emotional_intelligence",
        trigger_condition={
            "feedback_type": "emotional_mismatch",
            "mismatch_threshold": 0.2,
        },
        adaptation_actions=["analyze_emotional_patterns"],
        success_criteria={"response_accuracy": 0.8, "user_satisfaction": 0.7},
        priority=2,
    )

    should_adapt = await improvement_system._should_adapt(strategy)
    assert (
        should_adapt is False
    )  # Should be false as mismatch_rate (0.15) < threshold (0.2)


@pytest.mark.asyncio
async def test_performance_adaptation_trigger(improvement_system):
    """Test performance adaptation triggering"""
    # Add historical metrics
    improvement_system.metrics_history = [
        ImprovementMetrics(
            error_recovery_rate=0.9,
            learning_efficiency=0.8,
            emotional_adaptation=0.85,
            performance_score=0.85,
            timestamp=datetime.now() - timedelta(minutes=5),
        ),
        ImprovementMetrics(
            error_recovery_rate=0.8,
            learning_efficiency=0.7,
            emotional_adaptation=0.75,
            performance_score=0.65,  # Significant degradation
            timestamp=datetime.now(),
        ),
    ]

    strategy = AdaptationStrategy(
        component="system",
        trigger_condition={"metric_type": "performance_degradation", "threshold": 0.2},
        adaptation_actions=["analyze_performance_bottlenecks"],
        success_criteria={"performance_improvement": 0.15, "stability_duration": 3600},
        priority=3,
    )

    should_adapt = await improvement_system._should_adapt(strategy)
    assert should_adapt is True


@pytest.mark.asyncio
async def test_adaptation_success_evaluation(improvement_system):
    """Test evaluation of adaptation success"""
    strategy = AdaptationStrategy(
        component="error_handling",
        trigger_condition={
            "error_type": "recurring",
            "frequency_threshold": 3,
            "time_window": 3600,
        },
        adaptation_actions=["analyze_error_patterns"],
        success_criteria={"error_reduction": 0.5, "recovery_rate": 0.8},
        priority=1,
    )

    # Configure mock error tracker with success metrics
    improvement_system.error_tracker.get_statistics.return_value = {
        "error_reduction": 0.6,  # Above threshold of 0.5
        "recovery_rate": 0.9,  # Above threshold of 0.8
    }

    success = await improvement_system._check_adaptation_success(strategy)
    assert success is True


@pytest.mark.asyncio
async def test_monitor_and_improve_loop(improvement_system):
    """Test the main improvement monitoring loop"""
    # Setup test event tracking
    events_received = []

    async def track_events(event: Event):
        events_received.append(event)

    improvement_system.event_bus.subscribe(
        EventType.SYSTEM_IMPROVEMENT_UPDATE, track_events
    )

    # Run monitor loop for a short time
    monitor_task = asyncio.create_task(improvement_system.monitor_and_improve())
    await asyncio.sleep(0.1)  # Let it run briefly
    monitor_task.cancel()

    try:
        await monitor_task
    except asyncio.CancelledError:
        pass

    # Verify events were emitted
    assert len(events_received) > 0
    assert all(e.type == EventType.SYSTEM_IMPROVEMENT_UPDATE for e in events_received)
    assert all("metrics" in e.data for e in events_received)


@pytest.mark.asyncio
async def test_analyze_and_update_error_patterns(improvement_system):
    """Test error pattern analysis and strategy updates"""
    mock_patterns = [
        Mock(
            error_type="connection_timeout",
            frequency=5,
            threshold=3,
            conditions={"service": "database"},
            suggested_actions=["increase_timeout", "retry_connection"],
            severity=2,
        )
    ]
    improvement_system.error_tracker.analyze_error_patterns.return_value = mock_patterns

    await improvement_system._analyze_and_update_error_patterns()

    # Verify error tracker methods were called
    improvement_system.error_tracker.analyze_error_patterns.assert_called_once()
    improvement_system.error_tracker.update_recovery_strategy.assert_called_once_with(
        "connection_timeout",
        {
            "error_type": "connection_timeout",
            "conditions": {"service": "database"},
            "actions": ["increase_timeout", "retry_connection"],
            "priority": 2,
        },
    )


@pytest.mark.asyncio
async def test_analyze_and_update_emotional_patterns(improvement_system):
    """Test emotional pattern analysis and parameter updates"""
    mock_patterns = [
        Mock(
            context="greeting",
            confidence=0.8,
            suggested_parameters={"empathy_level": 0.7, "formality_level": 0.5},
        )
    ]
    improvement_system.emotional_memory.analyze_patterns.return_value = mock_patterns

    await improvement_system._analyze_and_update_emotional_patterns()

    # Verify emotional core methods were called
    improvement_system.emotional_memory.analyze_patterns.assert_called_once()
    improvement_system.emotional_core.update_response_parameters.assert_called_once_with(
        "greeting", {"empathy_level": 0.7, "formality_level": 0.5}
    )


@pytest.mark.asyncio
async def test_analyze_and_optimize_performance(improvement_system):
    """Test performance analysis and optimization"""
    # Configure system with poor performance metrics
    improvement_system.metrics_history = [
        ImprovementMetrics(
            error_recovery_rate=0.6,  # Below threshold
            learning_efficiency=0.6,  # Below threshold
            emotional_adaptation=0.6,  # Below threshold
            performance_score=0.6,  # Below threshold
            timestamp=datetime.now(),
        )
    ]

    await improvement_system._analyze_and_optimize_performance()

    # Verify optimization methods were called
    improvement_system.error_tracker.adjust_monitoring_frequency.assert_called_once()
    improvement_system.interactive_learner.optimize_pattern_recognition.assert_called_once()
    improvement_system.emotional_core.optimize_processing_parameters.assert_called_once()
