"""
Memory leak detection and analysis for ALEJO
"""

import asyncio
import logging
import psutil
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Set, Optional, Tuple

import numpy as np
from scipy import stats

logger = logging.getLogger(__name__)

class MemoryLeakDetector:
    """Detects potential memory leaks by analyzing process memory patterns"""
    
    def __init__(self, 
                 sample_interval: int = 300,  # 5 minutes
                 history_size: int = 288,     # 24 hours worth of 5-min samples
                 growth_threshold: float = 0.05):  # 5% continuous growth threshold
        self.sample_interval = sample_interval
        self.history_size = history_size
        self.growth_threshold = growth_threshold
        self.process_memory: Dict[int, List[Tuple[float, float]]] = defaultdict(list)
        self._lock = asyncio.Lock()
        self._running = False
        
    async def start_monitoring(self):
        """Start memory leak monitoring"""
        self._running = True
        while self._running:
            await self._collect_memory_samples()
            await asyncio.sleep(self.sample_interval)
            
    async def stop_monitoring(self):
        """Stop memory leak monitoring"""
        self._running = False
        
    async def _collect_memory_samples(self):
        """Collect memory usage samples for all processes"""
        async with self._lock:
            current_time = time.time()
            
            for proc in psutil.process_iter(['pid', 'name', 'memory_info']):
                try:
                    mem_info = proc.info['memory_info']
                    if mem_info:
                        # Store timestamp and RSS memory in MB
                        self.process_memory[proc.pid].append(
                            (current_time, mem_info.rss / 1024 / 1024)
                        )
                        
                        # Maintain history size
                        if len(self.process_memory[proc.pid]) > self.history_size:
                            self.process_memory[proc.pid] = \
                                self.process_memory[proc.pid][-self.history_size:]
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
                    
    def analyze_leaks(self) -> List[Dict[str, any]]:
        """Analyze collected data for memory leaks"""
        potential_leaks = []
        
        for pid in list(self.process_memory.keys()):
            try:
                if len(self.process_memory[pid]) < 3:
                    continue
                    
                # Extract timestamps and memory values
                times, memories = zip(*self.process_memory[pid])
                times = np.array(times)
                memories = np.array(memories)
                
                # Calculate growth rate using linear regression
                slope, intercept, r_value, p_value, std_err = \
                    stats.linregress(times, memories)
                
                # Calculate relative growth rate
                avg_memory = np.mean(memories)
                relative_growth = (slope * self.sample_interval) / avg_memory \
                    if avg_memory > 0 else 0
                
                # Check for significant growth
                if (relative_growth > self.growth_threshold and 
                    r_value > 0.8 and  # Strong correlation
                    p_value < 0.05):    # Statistically significant
                    
                    proc = psutil.Process(pid)
                    leak_info = {
                        'pid': pid,
                        'name': proc.name(),
                        'growth_rate_mb_per_hour': slope * 3600,
                        'r_squared': r_value ** 2,
                        'avg_memory_mb': avg_memory,
                        'current_memory_mb': memories[-1],
                        'detection_time': datetime.now().isoformat()
                    }
                    potential_leaks.append(leak_info)
                    
                    logger.warning(f"Potential memory leak detected: {leak_info}")
                    
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                # Process no longer exists or can't be accessed
                del self.process_memory[pid]
                continue
                
        return potential_leaks
        
    def get_process_memory_trend(self, pid: int) -> Optional[Dict[str, any]]:
        """Get detailed memory trend analysis for a specific process"""
        if pid not in self.process_memory or len(self.process_memory[pid]) < 2:
            return None
            
        times, memories = zip(*self.process_memory[pid])
        times = np.array(times)
        memories = np.array(memories)
        
        # Calculate basic statistics
        stats_info = {
            'min_memory_mb': np.min(memories),
            'max_memory_mb': np.max(memories),
            'avg_memory_mb': np.mean(memories),
            'std_dev_mb': np.std(memories),
            'samples_count': len(memories)
        }
        
        # Calculate growth metrics
        slope, intercept, r_value, p_value, std_err = \
            stats.linregress(times, memories)
            
        trend_info = {
            'growth_rate_mb_per_hour': slope * 3600,
            'r_squared': r_value ** 2,
            'p_value': p_value,
            'trend_reliability': 'high' if r_value ** 2 > 0.8 else 'medium' \
                if r_value ** 2 > 0.5 else 'low'
        }
        
        # Predict future usage
        hours_ahead = 24
        future_time = times[-1] + (hours_ahead * 3600)
        predicted_memory = slope * future_time + intercept
        
        prediction_info = {
            'predicted_memory_24h_mb': max(0, predicted_memory),
            'prediction_time': datetime.fromtimestamp(future_time).isoformat()
        }
        
        return {
            'pid': pid,
            'statistics': stats_info,
            'trend': trend_info,
            'prediction': prediction_info,
            'analysis_time': datetime.now().isoformat()
        }
