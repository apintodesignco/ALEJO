"""
Tests for ALEJO's advanced learning and cleanup features
"""

import asyncio
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
from alejo.cognitive.learning.advanced_features import (
    CurriculumManager,
    MetaLearner,
    TransferLearning,
)
from alejo.core.advanced_cleanup import (
    AdvancedSystemCleaner,
    ResourcePredictor,
    SystemOptimizer,
)

# Learning Tests


@pytest.fixture
def curriculum_manager():
    """Create CurriculumManager instance"""
    return CurriculumManager(min_success_rate=0.7)


@pytest.fixture
def meta_learner():
    """Create MetaLearner instance"""
    return MetaLearner()


@pytest.fixture
def transfer_learning(temp_dir):
    """Create TransferLearning instance"""
    return TransferLearning(model_dir=temp_dir)


@pytest.fixture
def temp_dir():
    """Create temporary directory"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.mark.asyncio
async def test_curriculum_task_readiness(curriculum_manager):
    """Test task readiness evaluation"""
    # Simple task
    task = {"complexity": 0.3, "command": "test_command", "context": {}}

    assert curriculum_manager.evaluate_task_readiness(task)

    # Update skill levels
    curriculum_manager.update_skill_levels(task, True, 0.9)
    assert "basic_io" in curriculum_manager.skill_levels

    # Complex task requiring skills
    complex_task = {
        "complexity": 0.8,
        "command": "debug_api_test",
        "context": {"critical": True},
    }

    # Should not be ready for complex task yet
    assert not curriculum_manager.evaluate_task_readiness(complex_task)


@pytest.mark.asyncio
async def test_meta_learner_strategy_selection(meta_learner):
    """Test learning strategy selection"""
    task = {"complexity": 0.5, "command": "test_task"}
    context = {"system_load": 0.3}

    # Initial strategy selection
    strategy = await meta_learner.select_learning_strategy(task, context)
    assert strategy in [
        "default",
        "exploration_focused",
        "exploitation_focused",
        "error_minimizing",
        "speed_optimizing",
    ]

    # Update performance and select again
    meta_learner.update_strategy_performance(0.8)
    new_strategy = await meta_learner.select_learning_strategy(task, context)
    assert new_strategy in [
        "default",
        "exploration_focused",
        "exploitation_focused",
        "error_minimizing",
        "speed_optimizing",
    ]


@pytest.mark.asyncio
async def test_transfer_learning(transfer_learning):
    """Test knowledge transfer between tasks"""
    source_task = "task_1"
    target_task = "task_2"

    # Create test embeddings
    transfer_learning.task_embeddings[source_task] = (
        transfer_learning._compute_task_embedding(
            {"complexity": 0.5, "description": "test api function"}
        )
    )
    transfer_learning.task_embeddings[target_task] = (
        transfer_learning._compute_task_embedding(
            {"complexity": 0.6, "description": "test api endpoint"}
        )
    )

    # Find related tasks
    related = await transfer_learning.find_related_tasks(
        {"complexity": 0.5, "description": "test api method"}
    )
    assert len(related) > 0

    # Transfer knowledge
    result = await transfer_learning.transfer_knowledge(
        source_task, target_task, {"learning_rate": 0.001}
    )
    assert result["success"]
    assert "adapted_params" in result


# Cleanup Tests


@pytest.fixture
def resource_predictor():
    """Create ResourcePredictor instance"""
    return ResourcePredictor(history_size=100)


@pytest.fixture
def system_optimizer():
    """Create SystemOptimizer instance"""
    return SystemOptimizer()


@pytest.fixture
async def advanced_cleaner(temp_dir):
    """Create AdvancedSystemCleaner instance"""
    cleaner = AdvancedSystemCleaner(
        base_dir=temp_dir, config={"cleanup_interval": 3600}
    )
    await cleaner.start()
    return cleaner


def test_resource_prediction(resource_predictor):
    """Test resource usage prediction"""
    # Add some sample measurements
    for i in range(10):
        resource_predictor.add_measurement(
            cpu_usage=50.0 + i, memory_usage=60.0 + i, disk_usage=70.0 + i
        )

    # Get predictions
    predictions = resource_predictor.predict_usage(hours_ahead=1.0)
    assert "cpu" in predictions
    assert "memory" in predictions
    assert "disk" in predictions

    # Verify predictions are within reasonable bounds
    for value in predictions.values():
        assert 0.0 <= value <= 100.0


@pytest.mark.asyncio
async def test_system_optimization(system_optimizer):
    """Test system resource optimization"""
    # Perform optimization
    result = await system_optimizer.optimize_resources()

    assert "timestamp" in result
    assert "optimizations" in result
    assert "resources" in result

    # Check optimization history
    assert len(system_optimizer.optimization_history) > 0


@pytest.mark.asyncio
async def test_advanced_cleanup(advanced_cleaner, temp_dir):
    """Test advanced cleanup system"""
    # Create some test files
    temp_path = Path(temp_dir)

    # Create temp files
    (temp_path / "temp").mkdir(exist_ok=True)
    (temp_path / "temp" / "test.tmp").write_text("test")

    # Create old log
    (temp_path / "logs").mkdir(exist_ok=True)
    old_log = temp_path / "logs" / "old.log"
    old_log.write_text("old log")

    # Modify timestamp to make it old
    old_time = datetime.now() - timedelta(days=10)
    os.utime(old_log, (old_time.timestamp(), old_time.timestamp()))

    # Run cleanup
    await advanced_cleaner._perform_cleanup("test")

    # Verify cleanup
    assert not (temp_path / "temp" / "test.tmp").exists()
    assert not old_log.exists()

    # Check status
    status = advanced_cleaner.get_status()
    assert "scheduled_cleanups" in status
    assert "resource_predictions" in status
    assert "cleanup_history" in status


@pytest.mark.asyncio
async def test_predictive_maintenance(advanced_cleaner):
    """Test predictive maintenance scheduling"""
    # Add high resource usage
    advanced_cleaner.resource_predictor.add_measurement(
        cpu_usage=90.0, memory_usage=85.0, disk_usage=95.0
    )

    # Run predictive maintenance
    await advanced_cleaner._predictive_maintenance()

    # Verify cleanup was scheduled
    assert len(advanced_cleaner.cleanup_schedule) > 0

    # Check cleanup history after running scheduled cleanups
    await advanced_cleaner._run_scheduled_cleanups()
    assert len(advanced_cleaner.cleanup_history) > 0
