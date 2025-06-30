"""
Tests for the ALEJO Self-Improvement Module

This module contains tests for the SelfImprovementEngine class and related functionality.
"""

import os
import sys
import time
import asyncio
import pytest
import json
from unittest.mock import MagicMock, patch
from typing import Dict, List, Any

# Import ALEJO modules
from alejo.core.self_improvement import SelfImprovementEngine, get_self_improvement_engine
from alejo.core.brain import Brain
from alejo.utils.events import EventBus
from alejo.utils.benchmarking import PerformanceBenchmark

# Test fixtures
@pytest.fixture
def mock_brain():
    """Create a mock brain for testing"""
    brain = MagicMock(spec=Brain)
    brain.event_bus = EventBus()
    return brain

@pytest.fixture
def self_improvement_engine(mock_brain):
    """Create a self-improvement engine for testing"""
    config = {
        "test_mode": True
    }
    return SelfImprovementEngine(mock_brain, config)

# Tests
@pytest.mark.asyncio
async def test_initialization(self_improvement_engine):
    """Test initialization of the self-improvement engine"""
    assert self_improvement_engine is not None
    assert self_improvement_engine.brain is not None
    assert self_improvement_engine.event_bus is not None
    assert self_improvement_engine.metrics is not None
    assert "response_times" in self_improvement_engine.metrics
    assert "memory_usage" in self_improvement_engine.metrics
    assert "inference_speed" in self_improvement_engine.metrics
    assert "bottlenecks" in self_improvement_engine.metrics

@pytest.mark.asyncio
async def test_event_handlers(self_improvement_engine, mock_brain):
    """Test event handlers"""
    # Trigger message processed event
    await mock_brain.event_bus.emit("brain.message_processed", {
        "processing_time": 0.5
    })
    
    # Check that the event was handled
    assert len(self_improvement_engine.metrics["response_times"]) == 1
    assert self_improvement_engine.metrics["response_times"][0] == 0.5
    
    # Trigger inference completed event
    await mock_brain.event_bus.emit("brain.inference_completed", {
        "inference_time": 0.3
    })
    
    # Check that the event was handled
    assert len(self_improvement_engine.metrics["inference_speed"]) == 1
    assert self_improvement_engine.metrics["inference_speed"][0] == 0.3
    
    # Trigger memory optimized event
    await mock_brain.event_bus.emit("brain.memory_optimized", {
        "memory_usage": 512
    })
    
    # Check that the event was handled
    assert len(self_improvement_engine.metrics["memory_usage"]) == 1
    assert self_improvement_engine.metrics["memory_usage"][0] == 512
    
    # Trigger bottleneck detected event
    bottleneck = {
        "component": "test_component",
        "issue": "memory leak",
        "severity": 8
    }
    await mock_brain.event_bus.emit("brain.bottleneck_detected", {
        "bottleneck": bottleneck
    })
    
    # Check that the event was handled
    assert len(self_improvement_engine.metrics["bottlenecks"]) == 1
    assert self_improvement_engine.metrics["bottlenecks"][0] == bottleneck

@pytest.mark.asyncio
async def test_analyze_performance(self_improvement_engine):
    """Test performance analysis"""
    # Add some test metrics
    self_improvement_engine.metrics["response_times"] = [0.5, 0.6, 0.7, 0.8, 0.9]
    self_improvement_engine.metrics["memory_usage"] = [512, 520, 530, 525, 515]
    self_improvement_engine.metrics["inference_speed"] = [0.3, 0.35, 0.32, 0.31, 0.33]
    self_improvement_engine.metrics["bottlenecks"] = [
        {"component": "test_component", "issue": "memory leak", "severity": 8}
    ]
    
    # Analyze performance
    analysis = await self_improvement_engine.analyze_performance()
    
    # Check analysis results
    assert analysis is not None
    assert "timestamp" in analysis
    assert "metrics" in analysis
    assert "response_time" in analysis["metrics"]
    assert "memory_usage" in analysis["metrics"]
    assert "inference_speed" in analysis["metrics"]
    assert "bottlenecks" in analysis
    
    # Check specific metrics
    assert abs(analysis["metrics"]["response_time"]["mean"] - 0.7) < 0.01
    assert abs(analysis["metrics"]["memory_usage"]["mean"] - 520.4) < 0.01
    assert abs(analysis["metrics"]["inference_speed"]["mean"] - 0.322) < 0.01

@pytest.mark.asyncio
async def test_analyze_bottleneck(self_improvement_engine):
    """Test bottleneck analysis"""
    # Create a test bottleneck
    bottleneck = {
        "component": "test_component",
        "issue": "memory leak",
        "severity": 8
    }
    
    # Analyze bottleneck
    suggestion = await self_improvement_engine.analyze_bottleneck(bottleneck)
    
    # Check suggestion
    assert suggestion is not None
    assert "timestamp" in suggestion
    assert "bottleneck" in suggestion
    assert "suggestions" in suggestion
    assert len(suggestion["suggestions"]) > 0
    
    # Check that suggestions are related to memory optimization
    for item in suggestion["suggestions"]:
        assert "memory_optimization" in item["type"]

@pytest.mark.asyncio
async def test_suggest_improvements(self_improvement_engine):
    """Test improvement suggestions"""
    # Add some test metrics
    self_improvement_engine.metrics["response_times"] = [1.5, 1.6, 1.7, 1.8, 1.9]  # High response times
    self_improvement_engine.metrics["memory_usage"] = [1500, 1520, 1530, 1525, 1515]  # High memory usage
    
    # Get improvement suggestions
    suggestions = await self_improvement_engine.suggest_improvements()
    
    # Check suggestions
    assert suggestions is not None
    assert len(suggestions) >= 2  # At least one for response time and one for memory
    
    # Check that suggestions include performance and memory optimizations
    has_performance = False
    has_memory = False
    
    for suggestion in suggestions:
        if suggestion["type"] == "performance_optimization":
            has_performance = True
        elif suggestion["type"] == "memory_optimization":
            has_memory = True
    
    assert has_performance
    assert has_memory

@pytest.mark.asyncio
async def test_generate_performance_report(self_improvement_engine, tmp_path):
    """Test performance report generation"""
    # Add some test metrics
    self_improvement_engine.metrics["response_times"] = [0.5, 0.6, 0.7, 0.8, 0.9]
    self_improvement_engine.metrics["memory_usage"] = [512, 520, 530, 525, 515]
    self_improvement_engine.metrics["inference_speed"] = [0.3, 0.35, 0.32, 0.31, 0.33]
    
    # Generate report
    report_path = os.path.join(tmp_path, "report.json")
    report = await self_improvement_engine.generate_performance_report(report_path)
    
    # Check report
    assert report is not None
    assert "timestamp" in report
    assert "analysis" in report
    assert "suggestions" in report
    assert "metrics" in report
    
    # Check that the file was created
    assert os.path.exists(report_path)
    
    # Check file contents
    with open(report_path, "r") as f:
        file_data = json.load(f)
    
    assert file_data["timestamp"] == report["timestamp"]

@pytest.mark.asyncio
async def test_singleton_instance():
    """Test singleton instance"""
    # Create a mock brain
    brain = MagicMock(spec=Brain)
    brain.event_bus = EventBus()
    
    # Get singleton instance
    engine1 = get_self_improvement_engine(brain)
    
    # Get singleton instance again
    engine2 = get_self_improvement_engine()
    
    # Check that both instances are the same
    assert engine1 is engine2

@pytest.mark.asyncio
async def test_run_tests(self_improvement_engine):
    """Test running tests"""
    # Mock subprocess.run
    with patch("subprocess.run") as mock_run:
        # Configure mock
        mock_process = MagicMock()
        mock_process.returncode = 0
        mock_process.stdout = "TOTAL      100     10    90%"
        mock_process.stderr = ""
        mock_run.return_value = mock_process
        
        # Run tests
        results = await self_improvement_engine.run_tests("alejo.core.brain")
        
        # Check results
        assert results is not None
        assert results["passed"] is True
        assert results["coverage"] == 90
        
        # Check that subprocess.run was called with the correct arguments
        mock_run.assert_called_once()
        args = mock_run.call_args[0][0]
        assert "pytest" in args
        assert "--cov=alejo" in args

@pytest.mark.asyncio
async def test_component_name_to_test_path(self_improvement_engine):
    """Test converting component name to test path"""
    # Test with a valid component name
    test_path = self_improvement_engine._component_name_to_test_path("alejo.core.brain.Brain")
    
    # The exact path might vary, but it should contain 'core' and 'brain'
    assert test_path is not None
    assert "core" in test_path
    
    # Test with an invalid component name
    test_path = self_improvement_engine._component_name_to_test_path("invalid.component")
    assert test_path is None
