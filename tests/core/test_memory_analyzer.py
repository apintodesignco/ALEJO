"""
Tests for memory leak detection and analysis
"""

import asyncio
import pytest
from unittest.mock import Mock, patch, AsyncMock
import psutil
import time
from datetime import datetime, timedelta
import numpy as np

from alejo.core.memory_analyzer import MemoryLeakDetector

@pytest.fixture
def memory_detector():
    return MemoryLeakDetector(
        sample_interval=1,  # 1 second for faster testing
        history_size=10,    # Smaller history for testing
        growth_threshold=0.05
    )

@pytest.mark.asyncio
async def test_memory_leak_detection(memory_detector):
    # Mock process data
    mock_process = Mock()
    mock_process.info = {
        'memory_info': Mock(rss=1024 * 1024 * 100)  # 100MB
    }
    
    with patch('psutil.process_iter', return_value=[mock_process]):
        # Collect some samples
        for i in range(5):
            # Simulate increasing memory usage
            mock_process.info['memory_info'].rss = 1024 * 1024 * (100 + i * 10)
            await memory_detector._collect_memory_samples()
            await asyncio.sleep(0.1)
        
        # Analyze for leaks
        leaks = memory_detector.analyze_leaks()
        
        assert len(leaks) > 0
        assert 'pid' in leaks[0]
        assert 'growth_rate_mb_per_hour' in leaks[0]
        assert leaks[0]['growth_rate_mb_per_hour'] > 0

@pytest.mark.asyncio
async def test_process_memory_trend(memory_detector):
    # Mock process data
    mock_process = Mock()
    mock_process.info = {
        'memory_info': Mock(rss=1024 * 1024 * 100)
    }
    
    with patch('psutil.process_iter', return_value=[mock_process]):
        # Collect samples with linear growth
        for i in range(5):
            mock_process.info['memory_info'].rss = 1024 * 1024 * (100 + i * 20)
            await memory_detector._collect_memory_samples()
            await asyncio.sleep(0.1)
        
        # Get trend analysis
        trend = memory_detector.get_process_memory_trend(mock_process.pid)
        
        assert trend is not None
        assert 'statistics' in trend
        assert 'trend' in trend
        assert 'prediction' in trend
        assert trend['trend']['r_squared'] > 0.9  # Strong correlation
        assert trend['statistics']['avg_memory_mb'] > 0

@pytest.mark.asyncio
async def test_monitoring_lifecycle(memory_detector):
    # Test start/stop monitoring
    monitor_task = asyncio.create_task(
        memory_detector.start_monitoring()
    )
    
    # Let it run briefly
    await asyncio.sleep(0.5)
    
    # Stop monitoring
    await memory_detector.stop_monitoring()
    
    # Wait for task to complete
    try:
        await asyncio.wait_for(monitor_task, timeout=1.0)
    except asyncio.TimeoutError:
        pytest.fail("Monitoring task did not stop properly")

@pytest.mark.asyncio
async def test_memory_leak_detection_no_leak(memory_detector):
    # Mock process with stable memory usage
    mock_process = Mock()
    mock_process.info = {
        'memory_info': Mock(rss=1024 * 1024 * 100)  # Constant 100MB
    }
    
    with patch('psutil.process_iter', return_value=[mock_process]):
        # Collect samples with stable memory
        for _ in range(5):
            await memory_detector._collect_memory_samples()
            await asyncio.sleep(0.1)
        
        # Should not detect leaks
        leaks = memory_detector.analyze_leaks()
        assert len(leaks) == 0

@pytest.mark.asyncio
async def test_error_handling(memory_detector):
    # Test handling of process errors
    mock_process = Mock()
    mock_process.info = {
        'memory_info': Mock(side_effect=psutil.NoSuchProcess(1234))
    }
    
    with patch('psutil.process_iter', return_value=[mock_process]):
        # Should not raise exception
        await memory_detector._collect_memory_samples()
        leaks = memory_detector.analyze_leaks()
        assert len(leaks) == 0
