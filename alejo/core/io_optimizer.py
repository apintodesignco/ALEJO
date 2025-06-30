"""
Disk I/O optimization and monitoring for ALEJO
"""

import asyncio
import logging
import os
import psutil
import time
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

class IOOptimizer:
    """Optimizes disk I/O operations and monitors I/O patterns"""
    
    def __init__(self, 
                 base_dir: str,
                 io_threshold_mb_s: float = 50.0,  # 50 MB/s threshold
                 sample_interval: int = 60,         # 1 minute
                 history_size: int = 1440):         # 24 hours
        self.base_dir = Path(base_dir)
        self.io_threshold = io_threshold_mb_s * 1024 * 1024  # Convert to bytes
        self.sample_interval = sample_interval
        self.history_size = history_size
        
        self.io_history: Dict[str, List[Tuple[float, float, float]]] = defaultdict(list)
        self.hot_paths: Dict[str, float] = {}
        self._lock = asyncio.Lock()
        self._running = False
        
    async def start_monitoring(self):
        """Start I/O monitoring"""
        self._running = True
        while self._running:
            await self._collect_io_samples()
            await self._analyze_io_patterns()
            await asyncio.sleep(self.sample_interval)
            
    async def stop_monitoring(self):
        """Stop I/O monitoring"""
        self._running = False
        
    async def _collect_io_samples(self):
        """Collect disk I/O samples"""
        async with self._lock:
            current_time = time.time()
            
            # Get disk I/O counters for all mounted partitions
            disk_io = psutil.disk_io_counters(perdisk=True)
            
            for disk_name, counters in disk_io.items():
                read_bytes = counters.read_bytes
                write_bytes = counters.write_bytes
                total_io = read_bytes + write_bytes
                
                self.io_history[disk_name].append(
                    (current_time, read_bytes, write_bytes)
                )
                
                # Maintain history size
                if len(self.io_history[disk_name]) > self.history_size:
                    self.io_history[disk_name] = \
                        self.io_history[disk_name][-self.history_size:]
                    
    async def _analyze_io_patterns(self):
        """Analyze I/O patterns and identify hot spots"""
        async with self._lock:
            for disk_name, history in self.io_history.items():
                if len(history) < 2:
                    continue
                
                # Calculate I/O rates
                prev_time, prev_read, prev_write = history[-2]
                curr_time, curr_read, curr_write = history[-1]
                
                time_diff = curr_time - prev_time
                if time_diff <= 0:
                    continue
                
                read_rate = (curr_read - prev_read) / time_diff
                write_rate = (curr_write - prev_write) / time_diff
                total_rate = read_rate + write_rate
                
                # Check if I/O rate exceeds threshold
                if total_rate > self.io_threshold:
                    await self._identify_hot_paths(disk_name)
                    
    async def _identify_hot_paths(self, disk_name: str):
        """Identify paths with high I/O activity"""
        hot_paths = {}
        
        for proc in psutil.process_iter(['pid', 'name', 'open_files']):
            try:
                # Get open files for the process
                open_files = proc.open_files()
                if not open_files:
                    continue
                
                for file in open_files:
                    if file.path.startswith(str(self.base_dir)):
                        path_key = str(Path(file.path).relative_to(self.base_dir))
                        
                        # Get process I/O counters
                        io_counters = proc.io_counters()
                        io_rate = (io_counters.read_bytes + io_counters.write_bytes) \
                            / self.sample_interval
                            
                        # Accumulate I/O rates for paths
                        hot_paths[path_key] = hot_paths.get(path_key, 0) + io_rate
                        
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
                
        # Update hot paths
        self.hot_paths = {
            path: rate for path, rate in hot_paths.items()
            if rate > self.io_threshold
        }
        
        if self.hot_paths:
            logger.warning(f"High I/O activity detected in paths: {self.hot_paths}")
            
    def get_io_statistics(self) -> Dict[str, any]:
        """Get I/O statistics and analysis"""
        stats = {}
        
        for disk_name, history in self.io_history.items():
            if len(history) < 2:
                continue
                
            times, reads, writes = zip(*history)
            times = np.array(times)
            reads = np.array(reads)
            writes = np.array(writes)
            
            # Calculate rates
            time_diffs = np.diff(times)
            read_rates = np.diff(reads) / time_diffs
            write_rates = np.diff(writes) / time_diffs
            
            stats[disk_name] = {
                'avg_read_rate_mb_s': np.mean(read_rates) / 1024 / 1024,
                'avg_write_rate_mb_s': np.mean(write_rates) / 1024 / 1024,
                'peak_read_rate_mb_s': np.max(read_rates) / 1024 / 1024,
                'peak_write_rate_mb_s': np.max(write_rates) / 1024 / 1024,
                'total_read_gb': reads[-1] / 1024 / 1024 / 1024,
                'total_write_gb': writes[-1] / 1024 / 1024 / 1024,
                'hot_paths': self.hot_paths
            }
            
        return stats
        
    def get_optimization_suggestions(self) -> List[Dict[str, any]]:
        """Get I/O optimization suggestions"""
        suggestions = []
        
        for disk_name, stats in self.get_io_statistics().items():
            if stats['avg_read_rate_mb_s'] > self.io_threshold / 1024 / 1024:
                suggestions.append({
                    'type': 'high_read_rate',
                    'disk': disk_name,
                    'current_rate_mb_s': stats['avg_read_rate_mb_s'],
                    'suggestion': 'Consider implementing read caching or buffering'
                })
                
            if stats['avg_write_rate_mb_s'] > self.io_threshold / 1024 / 1024:
                suggestions.append({
                    'type': 'high_write_rate',
                    'disk': disk_name,
                    'current_rate_mb_s': stats['avg_write_rate_mb_s'],
                    'suggestion': 'Consider implementing write batching or buffering'
                })
                
            for path, rate in stats['hot_paths'].items():
                suggestions.append({
                    'type': 'hot_path',
                    'disk': disk_name,
                    'path': path,
                    'io_rate_mb_s': rate / 1024 / 1024,
                    'suggestion': 'Consider moving to faster storage or implementing caching'
                })
                
        return suggestions
