"""
Tests for I/O optimization and monitoring
"""

import asyncio
import pytest
from unittest.mock import Mock, patch, AsyncMock
import psutil
import tempfile
import os
from pathlib import Path
import shutil
import time
from datetime import datetime

from alejo.core.io_optimizer import IOOptimizer
import secrets  # More secure for cryptographic purposes

@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir

@pytest.fixture
def io_optimizer(temp_dir):
    return IOOptimizer(
        base_dir=temp_dir,
        io_threshold_mb_s=1.0,  # Low threshold for testing
        sample_interval=1,      # 1 second for faster testing
        history_size=10         # Smaller history for testing
    )

@pytest.mark.asyncio
async def test_io_monitoring(io_optimizer):
    # Mock disk I/O data
    mock_counters = Mock(
        read_bytes=1024 * 1024,    # 1MB
        write_bytes=2 * 1024 * 1024  # 2MB
    )
    
    with patch('psutil.disk_io_counters', return_value={'sda': mock_counters}):
        # Collect some samples
        for i in range(3):
            mock_counters.read_bytes += 1024 * 1024  # +1MB per sample
            mock_counters.write_bytes += 2 * 1024 * 1024  # +2MB per sample
            await io_optimizer._collect_io_samples()
            await asyncio.sleep(0.1)
        
        # Get I/O statistics
        stats = io_optimizer.get_io_statistics()
        
        assert 'sda' in stats
        assert stats['sda']['avg_read_rate_mb_s'] > 0
        assert stats['sda']['avg_write_rate_mb_s'] > 0

@pytest.mark.asyncio
async def test_hot_path_detection(io_optimizer, temp_dir):
    # Create a test file
    test_file = Path(temp_dir) / "test.log"
    test_file.write_text("test data")
    
    # Mock process with open files
    mock_process = Mock()
    mock_process.open_files.return_value = [Mock(path=str(test_file))]
    mock_process.io_counters.return_value = Mock(
        read_bytes=5 * 1024 * 1024,  # 5MB
        write_bytes=10 * 1024 * 1024  # 10MB
    )
    
    with patch('psutil.process_iter', return_value=[mock_process]):
        await io_optimizer._identify_hot_paths('sda')
        
        assert len(io_optimizer.hot_paths) > 0
        assert 'test.log' in str(list(io_optimizer.hot_paths.keys())[0])

@pytest.mark.asyncio
async def test_optimization_suggestions(io_optimizer):
    # Mock high I/O activity
    mock_counters = Mock(
        read_bytes=50 * 1024 * 1024,    # 50MB
        write_bytes=100 * 1024 * 1024   # 100MB
    )
    
    with patch('psutil.disk_io_counters', return_value={'sda': mock_counters}):
        await io_optimizer._collect_io_samples()
        
        # Get optimization suggestions
        suggestions = io_optimizer.get_optimization_suggestions()
        
        assert len(suggestions) > 0
        assert any(s['type'] in ('high_read_rate', 'high_write_rate') 
                  for s in suggestions)

@pytest.mark.asyncio
async def test_monitoring_lifecycle(io_optimizer):
    # Test start/stop monitoring
    monitor_task = asyncio.create_task(
        io_optimizer.start_monitoring()
    )
    
    # Let it run briefly
    await asyncio.sleep(0.5)
    
    # Stop monitoring
    await io_optimizer.stop_monitoring()
    
    # Wait for task to complete
    try:
        await asyncio.wait_for(monitor_task, timeout=1.0)
    except asyncio.TimeoutError:
        pytest.fail("Monitoring task did not stop properly")

@pytest.mark.asyncio
async def test_log_rotation(io_optimizer, temp_dir):
    # Create a large test log file
    test_log = Path(temp_dir) / "test.log"
    with test_log.open('wb') as f:
        f.write(b'x' * (150 * 1024 * 1024))  # 150MB
    
    # Mock process data
    mock_process = Mock()
    mock_process.open_files.return_value = [Mock(path=str(test_log))]
    mock_process.io_counters.return_value = Mock(
        read_bytes=0,
        write_bytes=1024 * 1024 * 200  # 200MB written
    )
    
    with patch('psutil.process_iter', return_value=[mock_process]):
        # Identify hot paths
        await io_optimizer._identify_hot_paths('sda')
        
        # Get suggestions
        suggestions = io_optimizer.get_optimization_suggestions()
        
        # Should suggest log rotation
        assert any(s['type'] == 'hot_path' and 'test.log' in s['path'] 
                  for s in suggestions)

@pytest.mark.asyncio
async def test_error_handling(io_optimizer):
    # Test handling of disk errors
    with patch('psutil.disk_io_counters', 
              side_effect=psutil.Error("Disk error")):
        # Should not raise exception
        await io_optimizer._collect_io_samples()
        stats = io_optimizer.get_io_statistics()
        assert len(stats) == 0