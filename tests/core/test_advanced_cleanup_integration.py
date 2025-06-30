"""
Integration tests for the advanced cleanup system
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

from alejo.core.advanced_cleanup import AdvancedSystemCleaner
from alejo.core.memory_analyzer import MemoryLeakDetector
from alejo.core.io_optimizer import IOOptimizer

@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir

@pytest.fixture
def cleanup_system(temp_dir):
    system = AdvancedSystemCleaner(
        base_dir=temp_dir,
        config={
            'cleanup_interval': 1,  # 1 second for testing
            'memory_threshold': 80.0,
            'disk_threshold': 80.0
        }
    )
    return system

@pytest.mark.asyncio
async def test_full_cleanup_cycle(cleanup_system, temp_dir):
    # Create test files and directories
    test_files = []
    for i in range(5):
        path = Path(temp_dir) / f"test{i}.log"
        path.write_text("test data")
        test_files.append(path)
    
    # Mock system resources
    mock_memory = Mock(percent=85.0)
    mock_disk = Mock(percent=85.0)
    
    with patch('psutil.virtual_memory', return_value=mock_memory), \
         patch('psutil.disk_usage', return_value=mock_disk):
        
        # Start the cleanup system
        cleanup_task = asyncio.create_task(cleanup_system.start())
        
        # Let it run for a short time
        await asyncio.sleep(2)
        
        # Stop the system
        await cleanup_system.stop()
        
        # Check results
        status = cleanup_system.get_status()
        assert status['detected_issues'] is not None
        assert len(status['cleanup_history']) > 0

@pytest.mark.asyncio
async def test_memory_leak_handling(cleanup_system):
    # Mock a process with memory leak
    mock_process = Mock()
    mock_process.info = {
        'memory_info': Mock(rss=1024 * 1024 * 100)  # Start at 100MB
    }
    mock_process.pid = 12345
    mock_process.name.return_value = "test_process"
    
    with patch('psutil.process_iter', return_value=[mock_process]), \
         patch('psutil.Process', return_value=mock_process):
        
        # Start monitoring
        monitor_task = asyncio.create_task(cleanup_system.start())
        
        # Simulate memory growth
        for i in range(5):
            mock_process.info['memory_info'].rss = 1024 * 1024 * (100 + i * 50)
            await asyncio.sleep(0.5)
        
        # Stop monitoring
        await cleanup_system.stop()
        
        # Check if leak was detected and handled
        status = cleanup_system.get_status()
        memory_leaks = status['memory_leaks']
        
        assert len(memory_leaks) > 0
        assert any(leak['pid'] == 12345 for leak in memory_leaks)

@pytest.mark.asyncio
async def test_io_optimization(cleanup_system, temp_dir):
    # Create a large log file
    test_log = Path(temp_dir) / "test.log"
    with test_log.open('wb') as f:
        f.write(b'x' * (150 * 1024 * 1024))  # 150MB
    
    # Mock disk I/O
    mock_counters = Mock(
        read_bytes=50 * 1024 * 1024,    # 50MB
        write_bytes=100 * 1024 * 1024   # 100MB
    )
    
    with patch('psutil.disk_io_counters', return_value={'sda': mock_counters}):
        # Start monitoring
        monitor_task = asyncio.create_task(cleanup_system.start())
        
        # Let it run briefly
        await asyncio.sleep(2)
        
        # Stop monitoring
        await cleanup_system.stop()
        
        # Check if I/O issues were detected
        status = cleanup_system.get_status()
        io_suggestions = status['io_suggestions']
        
        assert len(io_suggestions) > 0
        assert any('test.log' in str(sugg.get('path', '')) 
                  for sugg in io_suggestions)

@pytest.mark.asyncio
async def test_system_health_score(cleanup_system):
    # Mock healthy system state
    mock_memory = Mock(percent=50.0)
    mock_disk = Mock(percent=50.0)
    mock_cpu = 50.0
    
    with patch('psutil.virtual_memory', return_value=mock_memory), \
         patch('psutil.disk_usage', return_value=mock_disk), \
         patch('psutil.cpu_percent', return_value=mock_cpu):
        
        # Start monitoring
        monitor_task = asyncio.create_task(cleanup_system.start())
        
        # Let it run briefly
        await asyncio.sleep(1)
        
        # Get health score
        health_score = await cleanup_system._check_system_health()
        
        # Stop monitoring
        await cleanup_system.stop()
        
        # Check health score
        assert health_score > 70  # Should be healthy

@pytest.mark.asyncio
async def test_predictive_maintenance(cleanup_system):
    # Mock increasing resource usage
    mock_memory = Mock()
    mock_disk = Mock()
    memory_values = [60.0, 65.0, 70.0, 75.0, 80.0]
    disk_values = [60.0, 70.0, 75.0, 80.0, 85.0]
    
    async def mock_monitor():
        for mem, disk in zip(memory_values, disk_values):
            mock_memory.percent = mem
            mock_disk.percent = disk
            await asyncio.sleep(0.5)
    
    with patch('psutil.virtual_memory', return_value=mock_memory), \
         patch('psutil.disk_usage', return_value=mock_disk):
        
        # Start monitoring
        monitor_task = asyncio.create_task(cleanup_system.start())
        mock_task = asyncio.create_task(mock_monitor())
        
        # Let it run
        await asyncio.sleep(3)
        
        # Stop monitoring
        await cleanup_system.stop()
        
        # Check if cleanups were scheduled
        status = cleanup_system.get_status()
        assert len(status['scheduled_cleanups']) > 0

@pytest.mark.asyncio
async def test_error_recovery(cleanup_system):
    # Mock system error
    mock_memory = Mock(side_effect=Exception("Memory error"))
    
    with patch('psutil.virtual_memory', side_effect=mock_memory):
        # Start monitoring
        monitor_task = asyncio.create_task(cleanup_system.start())
        
        # Let it run briefly
        await asyncio.sleep(1)
        
        # Stop monitoring
        await cleanup_system.stop()
        
        # System should continue running despite errors
        assert monitor_task.done() is False
