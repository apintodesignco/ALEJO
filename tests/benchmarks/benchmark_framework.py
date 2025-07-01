"""
Benchmark Framework for ALEJO
Provides tools and utilities for performance testing across all modules
"""

import time
import asyncio
import logging
import statistics
from typing import Dict, Any, List, Callable, Optional
from dataclasses import dataclass
from functools import wraps
import numpy as np
import torch
import psutil
import GPUtil
import secrets  # More secure for cryptographic purposes

logger = logging.getLogger(__name__)

@dataclass
class BenchmarkResult:
    """Results from a benchmark run"""
    name: str
    operation: str
    iterations: int
    mean_time: float
    std_dev: float
    min_time: float
    max_time: float
    memory_usage: float
    cpu_usage: float
    gpu_usage: Optional[float] = None
    batch_size: Optional[int] = None
    additional_metrics: Optional[Dict[str, Any]] = None

class BenchmarkTracker:
    """Tracks and aggregates benchmark results"""
    
    def __init__(self):
        self.results: Dict[str, List[BenchmarkResult]] = {}
        self.baseline_results: Dict[str, BenchmarkResult] = {}
    
    def add_result(self, result: BenchmarkResult):
        """Add a benchmark result"""
        if result.name not in self.results:
            self.results[result.name] = []
        self.results[result.name].append(result)
    
    def set_baseline(self, name: str, result: BenchmarkResult):
        """Set baseline result for comparison"""
        self.baseline_results[name] = result
    
    def get_improvement(self, name: str, current: BenchmarkResult) -> Dict[str, float]:
        """Calculate improvement over baseline"""
        if name not in self.baseline_results:
            return {}
            
        baseline = self.baseline_results[name]
        return {
            'time_improvement': (baseline.mean_time - current.mean_time) / baseline.mean_time * 100,
            'memory_improvement': (baseline.memory_usage - current.memory_usage) / baseline.memory_usage * 100,
            'cpu_improvement': (baseline.cpu_usage - current.cpu_usage) / baseline.cpu_usage * 100
        }

class Benchmarker:
    """Main benchmarking utility"""
    
    def __init__(self):
        self.tracker = BenchmarkTracker()
        
    async def run_benchmark(
        self,
        name: str,
        operation: str,
        func: Callable,
        iterations: int = 100,
        batch_size: Optional[int] = None,
        **kwargs
    ) -> BenchmarkResult:
        """Run a benchmark test
        
        Args:
            name: Benchmark name
            operation: Operation being benchmarked
            func: Function to benchmark
            iterations: Number of iterations
            batch_size: Optional batch size for batch operations
            **kwargs: Additional args for the function
            
        Returns:
            BenchmarkResult with timing and resource stats
        """
        times = []
        memory_usage = []
        cpu_usage = []
        gpu_usage = []
        
        # Get initial resource usage
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        for i in range(iterations):
            # Record resource usage
            cpu_percent = psutil.cpu_percent()
            memory_usage.append(process.memory_info().rss / 1024 / 1024 - initial_memory)
            if torch.cuda.is_available():
                gpu = GPUtil.getGPUs()[0]
                gpu_usage.append(gpu.memoryUsed)
            
            # Time the operation
            start = time.perf_counter()
            if asyncio.iscoroutinefunction(func):
                await func(**kwargs)
            else:
                func(**kwargs)
            end = time.perf_counter()
            
            times.append(end - start)
            cpu_usage.append(cpu_percent)
            
        # Calculate statistics
        mean_time = statistics.mean(times)
        std_dev = statistics.stdev(times)
        min_time = min(times)
        max_time = max(times)
        avg_memory = statistics.mean(memory_usage)
        avg_cpu = statistics.mean(cpu_usage)
        avg_gpu = statistics.mean(gpu_usage) if gpu_usage else None
        
        result = BenchmarkResult(
            name=name,
            operation=operation,
            iterations=iterations,
            mean_time=mean_time,
            std_dev=std_dev,
            min_time=min_time,
            max_time=max_time,
            memory_usage=avg_memory,
            cpu_usage=avg_cpu,
            gpu_usage=avg_gpu,
            batch_size=batch_size
        )
        
        self.tracker.add_result(result)
        return result
    
    def benchmark(self, name: str, operation: str, iterations: int = 100):
        """Decorator for benchmarking functions"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                result = await self.run_benchmark(
                    name=name,
                    operation=operation,
                    func=func,
                    iterations=iterations,
                    **kwargs
                )
                return result
            return wrapper
        return decorator