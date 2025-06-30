"""
ALEJO Performance Benchmarking Module

This module provides tools for benchmarking and optimizing the performance
of ALEJO's AI components, particularly focusing on memory usage, inference
speed, and resource utilization.
"""

import os
import sys
import time
import logging
import asyncio
import functools
import statistics
from typing import Dict, List, Any, Callable, Optional, Union, Tuple
import json
import psutil
import gc

# Conditional imports for torch
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

logger = logging.getLogger("alejo.utils.benchmarking")

class PerformanceBenchmark:
    """
    Performance benchmarking for ALEJO AI components
    
    This class provides tools to:
    1. Measure execution time of functions and methods
    2. Track memory usage during execution
    3. Compare different implementations
    4. Generate performance reports
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the performance benchmark
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        self.results = {}
        self.baseline_results = {}
        self.current_benchmark = None
    
    def benchmark_function(
        self,
        func: Callable,
        args: List = None,
        kwargs: Dict = None,
        iterations: int = 10,
        warmup: int = 2,
        name: str = None,
        track_memory: bool = True
    ) -> Dict[str, Any]:
        """
        Benchmark a function's performance
        
        Args:
            func: Function to benchmark
            args: List of positional arguments
            kwargs: Dictionary of keyword arguments
            iterations: Number of iterations to run
            warmup: Number of warmup iterations
            name: Name for this benchmark
            track_memory: Whether to track memory usage
            
        Returns:
            Dictionary with benchmark results
        """
        args = args or []
        kwargs = kwargs or {}
        name = name or func.__name__
        
        logger.info(f"Benchmarking function: {name}")
        self.current_benchmark = name
        
        # Collect garbage before benchmarking
        gc.collect()
        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        # Track initial memory
        initial_memory = self._get_memory_usage() if track_memory else None
        
        # Run warmup iterations
        for _ in range(warmup):
            func(*args, **kwargs)
        
        # Run benchmark iterations
        execution_times = []
        memory_usages = []
        
        for i in range(iterations):
            # Collect garbage between iterations
            gc.collect()
            
            # Track memory before iteration
            if track_memory:
                before_memory = self._get_memory_usage()
            
            # Time execution
            start_time = time.perf_counter()
            result = func(*args, **kwargs)
            end_time = time.perf_counter()
            
            # Calculate execution time
            execution_time = end_time - start_time
            execution_times.append(execution_time)
            
            # Track memory after iteration
            if track_memory:
                after_memory = self._get_memory_usage()
                memory_delta = after_memory - before_memory
                memory_usages.append(memory_delta)
            
            logger.debug(f"Iteration {i+1}/{iterations}: {execution_time:.6f}s")
        
        # Calculate statistics
        stats = {
            "name": name,
            "iterations": iterations,
            "mean_time": statistics.mean(execution_times),
            "median_time": statistics.median(execution_times),
            "min_time": min(execution_times),
            "max_time": max(execution_times),
            "stdev_time": statistics.stdev(execution_times) if iterations > 1 else 0,
        }
        
        # Add memory statistics if tracked
        if track_memory:
            stats.update({
                "initial_memory_mb": initial_memory,
                "mean_memory_delta_mb": statistics.mean(memory_usages) if memory_usages else 0,
                "max_memory_delta_mb": max(memory_usages) if memory_usages else 0,
            })
        
        # Store results
        self.results[name] = stats
        
        logger.info(f"Benchmark complete: {name}")
        logger.info(f"Mean execution time: {stats['mean_time']:.6f}s")
        if track_memory:
            logger.info(f"Mean memory delta: {stats['mean_memory_delta_mb']:.2f} MB")
        
        return stats
    
    async def benchmark_async_function(
        self,
        func: Callable,
        args: List = None,
        kwargs: Dict = None,
        iterations: int = 10,
        warmup: int = 2,
        name: str = None,
        track_memory: bool = True
    ) -> Dict[str, Any]:
        """
        Benchmark an async function's performance
        
        Args:
            func: Async function to benchmark
            args: List of positional arguments
            kwargs: Dictionary of keyword arguments
            iterations: Number of iterations to run
            warmup: Number of warmup iterations
            name: Name for this benchmark
            track_memory: Whether to track memory usage
            
        Returns:
            Dictionary with benchmark results
        """
        args = args or []
        kwargs = kwargs or {}
        name = name or func.__name__
        
        logger.info(f"Benchmarking async function: {name}")
        self.current_benchmark = name
        
        # Collect garbage before benchmarking
        gc.collect()
        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        # Track initial memory
        initial_memory = self._get_memory_usage() if track_memory else None
        
        # Run warmup iterations
        for _ in range(warmup):
            await func(*args, **kwargs)
        
        # Run benchmark iterations
        execution_times = []
        memory_usages = []
        
        for i in range(iterations):
            # Collect garbage between iterations
            gc.collect()
            
            # Track memory before iteration
            if track_memory:
                before_memory = self._get_memory_usage()
            
            # Time execution
            start_time = time.perf_counter()
            result = await func(*args, **kwargs)
            end_time = time.perf_counter()
            
            # Calculate execution time
            execution_time = end_time - start_time
            execution_times.append(execution_time)
            
            # Track memory after iteration
            if track_memory:
                after_memory = self._get_memory_usage()
                memory_delta = after_memory - before_memory
                memory_usages.append(memory_delta)
            
            logger.debug(f"Iteration {i+1}/{iterations}: {execution_time:.6f}s")
        
        # Calculate statistics
        stats = {
            "name": name,
            "iterations": iterations,
            "mean_time": statistics.mean(execution_times),
            "median_time": statistics.median(execution_times),
            "min_time": min(execution_times),
            "max_time": max(execution_times),
            "stdev_time": statistics.stdev(execution_times) if iterations > 1 else 0,
        }
        
        # Add memory statistics if tracked
        if track_memory:
            stats.update({
                "initial_memory_mb": initial_memory,
                "mean_memory_delta_mb": statistics.mean(memory_usages) if memory_usages else 0,
                "max_memory_delta_mb": max(memory_usages) if memory_usages else 0,
            })
        
        # Store results
        self.results[name] = stats
        
        logger.info(f"Benchmark complete: {name}")
        logger.info(f"Mean execution time: {stats['mean_time']:.6f}s")
        if track_memory:
            logger.info(f"Mean memory delta: {stats['mean_memory_delta_mb']:.2f} MB")
        
        return stats
    
    def set_baseline(self, name: str = None):
        """
        Set the current results as baseline for comparison
        
        Args:
            name: Name of the benchmark to use as baseline (default: current)
        """
        name = name or self.current_benchmark
        if name not in self.results:
            logger.error(f"No benchmark results found for: {name}")
            return
        
        self.baseline_results[name] = self.results[name]
        logger.info(f"Set baseline: {name}")
    
    def compare_with_baseline(self, name: str = None) -> Dict[str, Any]:
        """
        Compare current results with baseline
        
        Args:
            name: Name of the benchmark to compare (default: current)
            
        Returns:
            Dictionary with comparison results
        """
        name = name or self.current_benchmark
        if name not in self.results:
            logger.error(f"No benchmark results found for: {name}")
            return {}
        
        if name not in self.baseline_results:
            logger.error(f"No baseline results found for: {name}")
            return {}
        
        current = self.results[name]
        baseline = self.baseline_results[name]
        
        # Calculate time difference
        time_diff = current["mean_time"] - baseline["mean_time"]
        time_percent = (time_diff / baseline["mean_time"]) * 100
        
        comparison = {
            "name": name,
            "current_mean_time": current["mean_time"],
            "baseline_mean_time": baseline["mean_time"],
            "time_diff": time_diff,
            "time_percent": time_percent,
        }
        
        # Add memory comparison if available
        if "mean_memory_delta_mb" in current and "mean_memory_delta_mb" in baseline:
            memory_diff = current["mean_memory_delta_mb"] - baseline["mean_memory_delta_mb"]
            memory_percent = (memory_diff / baseline["mean_memory_delta_mb"]) * 100 if baseline["mean_memory_delta_mb"] else 0
            
            comparison.update({
                "current_memory_delta": current["mean_memory_delta_mb"],
                "baseline_memory_delta": baseline["mean_memory_delta_mb"],
                "memory_diff": memory_diff,
                "memory_percent": memory_percent,
            })
        
        # Log comparison
        logger.info(f"Comparison for {name}:")
        logger.info(f"Time: {time_diff:.6f}s ({time_percent:.2f}%)")
        if "memory_diff" in comparison:
            logger.info(f"Memory: {memory_diff:.2f} MB ({memory_percent:.2f}%)")
        
        return comparison
    
    def generate_report(self, output_file: str = None) -> Dict[str, Any]:
        """
        Generate a performance report
        
        Args:
            output_file: Optional file to write report to
            
        Returns:
            Dictionary with report data
        """
        report = {
            "timestamp": time.time(),
            "results": self.results,
            "baseline_results": self.baseline_results,
            "system_info": self._get_system_info(),
        }
        
        # Write report to file if specified
        if output_file:
            try:
                os.makedirs(os.path.dirname(output_file), exist_ok=True)
                with open(output_file, "w") as f:
                    json.dump(report, f, indent=2)
                logger.info(f"Report written to: {output_file}")
            except Exception as e:
                logger.error(f"Error writing report: {e}")
        
        return report
    
    def _get_memory_usage(self) -> float:
        """
        Get current memory usage in MB
        
        Returns:
            Memory usage in MB
        """
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        return memory_info.rss / (1024 * 1024)  # Convert to MB
    
    def _get_system_info(self) -> Dict[str, Any]:
        """
        Get system information
        
        Returns:
            Dictionary with system information
        """
        info = {
            "platform": sys.platform,
            "python_version": sys.version,
            "cpu_count": psutil.cpu_count(),
            "total_memory_gb": psutil.virtual_memory().total / (1024 * 1024 * 1024),
        }
        
        # Add GPU information if available
        if TORCH_AVAILABLE and torch.cuda.is_available():
            info.update({
                "cuda_available": True,
                "cuda_version": torch.version.cuda,
                "gpu_count": torch.cuda.device_count(),
                "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.device_count() > 0 else None,
            })
        else:
            info["cuda_available"] = False
        
        return info

# Benchmark decorator
def benchmark(iterations: int = 10, warmup: int = 2, track_memory: bool = True):
    """
    Decorator to benchmark a function
    
    Args:
        iterations: Number of iterations to run
        warmup: Number of warmup iterations
        track_memory: Whether to track memory usage
        
    Returns:
        Decorated function
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Create benchmark instance
            benchmark = PerformanceBenchmark()
            
            # Run benchmark
            stats = benchmark.benchmark_function(
                func=func,
                args=args,
                kwargs=kwargs,
                iterations=iterations,
                warmup=warmup,
                track_memory=track_memory
            )
            
            # Call function and return result
            return func(*args, **kwargs)
        
        return wrapper
    
    return decorator

# Async benchmark decorator
def async_benchmark(iterations: int = 10, warmup: int = 2, track_memory: bool = True):
    """
    Decorator to benchmark an async function
    
    Args:
        iterations: Number of iterations to run
        warmup: Number of warmup iterations
        track_memory: Whether to track memory usage
        
    Returns:
        Decorated function
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Create benchmark instance
            benchmark = PerformanceBenchmark()
            
            # Run benchmark
            stats = await benchmark.benchmark_async_function(
                func=func,
                args=args,
                kwargs=kwargs,
                iterations=iterations,
                warmup=warmup,
                track_memory=track_memory
            )
            
            # Call function and return result
            return await func(*args, **kwargs)
        
        return wrapper
    
    return decorator
