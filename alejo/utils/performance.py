"""
ALEJO Performance Optimization Module
Provides tools for monitoring, analyzing, and optimizing ALEJO's performance
"""

import time
import logging
import functools
import threading
import psutil
import os
from typing import Dict, Any, Callable, List, Optional, Tuple
from collections import defaultdict

logger = logging.getLogger("alejo.performance")

# Global performance metrics storage
_performance_metrics = defaultdict(list)
_performance_lock = threading.Lock()

class PerformanceMonitor:
    """
    Performance monitoring and optimization for ALEJO
    
    This class provides tools to:
    1. Track function execution times
    2. Monitor system resource usage
    3. Identify performance bottlenecks
    4. Apply optimizations
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the performance monitor
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        self.enabled = self.config.get('performance_monitoring', True)
        self.metrics = defaultdict(list)
        self.thresholds = {
            'slow_function': 1.0,  # seconds
            'high_cpu': 80.0,      # percent
            'high_memory': 80.0,   # percent
            'slow_response': 2.0   # seconds
        }
        self.optimizations = {
            'caching': self.config.get('enable_caching', True),
            'async_processing': self.config.get('enable_async', True),
            'resource_limiting': self.config.get('enable_resource_limiting', True)
        }
        logger.info("Performance monitor initialized")
    
    def track_execution_time(self, func: Callable) -> Callable:
        """
        Decorator to track function execution time
        
        Args:
            func: Function to track
            
        Returns:
            Wrapped function
        """
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if not self.enabled:
                return func(*args, **kwargs)
            
            start_time = time.time()
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Record the metric
            with _performance_lock:
                _performance_metrics[func.__name__].append(execution_time)
            
            # Log slow functions
            if execution_time > self.thresholds['slow_function']:
                logger.warning(f"Slow function: {func.__name__} took {execution_time:.4f} seconds")
            
            return result
        return wrapper
    
    def monitor_resources(self) -> Dict[str, float]:
        """
        Monitor system resource usage
        
        Returns:
            Dictionary of resource metrics
        """
        if not self.enabled:
            return {}
        
        # Get current process
        process = psutil.Process(os.getpid())
        
        # Collect metrics
        metrics = {
            'cpu_percent': process.cpu_percent(interval=0.1),
            'memory_percent': process.memory_percent(),
            'memory_mb': process.memory_info().rss / (1024 * 1024),
            'threads': len(process.threads()),
            'open_files': len(process.open_files()),
            'connections': len(process.connections())
        }
        
        # Log high resource usage
        if metrics['cpu_percent'] > self.thresholds['high_cpu']:
            logger.warning(f"High CPU usage: {metrics['cpu_percent']:.1f}%")
        
        if metrics['memory_percent'] > self.thresholds['high_memory']:
            logger.warning(f"High memory usage: {metrics['memory_percent']:.1f}%")
        
        return metrics
    
    def get_performance_report(self) -> Dict[str, Any]:
        """
        Generate a performance report
        
        Returns:
            Dictionary with performance metrics and recommendations
        """
        if not self.enabled or not _performance_metrics:
            return {"status": "No performance data available"}
        
        report = {
            "function_metrics": {},
            "system_metrics": self.monitor_resources(),
            "bottlenecks": [],
            "recommendations": []
        }
        
        # Process function metrics
        with _performance_lock:
            for func_name, times in _performance_metrics.items():
                if not times:
                    continue
                    
                avg_time = sum(times) / len(times)
                max_time = max(times)
                min_time = min(times)
                
                report["function_metrics"][func_name] = {
                    "calls": len(times),
                    "avg_time": avg_time,
                    "max_time": max_time,
                    "min_time": min_time
                }
                
                # Identify bottlenecks
                if avg_time > self.thresholds['slow_function']:
                    report["bottlenecks"].append({
                        "type": "slow_function",
                        "function": func_name,
                        "avg_time": avg_time
                    })
        
        # Generate recommendations
        if report["bottlenecks"]:
            for bottleneck in report["bottlenecks"]:
                if bottleneck["type"] == "slow_function":
                    report["recommendations"].append({
                        "target": bottleneck["function"],
                        "recommendation": "Consider caching results or optimizing algorithm",
                        "priority": "high" if bottleneck["avg_time"] > 2.0 else "medium"
                    })
        
        if report["system_metrics"].get("cpu_percent", 0) > self.thresholds["high_cpu"]:
            report["recommendations"].append({
                "target": "system",
                "recommendation": "Consider limiting concurrent operations or using async processing",
                "priority": "high"
            })
        
        if report["system_metrics"].get("memory_percent", 0) > self.thresholds["high_memory"]:
            report["recommendations"].append({
                "target": "system",
                "recommendation": "Check for memory leaks or implement resource cleanup",
                "priority": "high"
            })
        
        return report
    
    def optimize(self, target: str = None) -> bool:
        """
        Apply optimizations based on performance data
        
        Args:
            target: Optional specific target to optimize
            
        Returns:
            True if optimizations were applied
        """
        if not self.enabled:
            return False
        
        report = self.get_performance_report()
        optimizations_applied = False
        
        # Apply targeted optimizations
        if target and target in report["function_metrics"]:
            logger.info(f"Applying targeted optimizations for {target}")
            # Specific optimizations would be implemented here
            optimizations_applied = True
        
        # Apply general optimizations
        elif not target:
            # Apply caching for slow functions
            if self.optimizations['caching'] and report["bottlenecks"]:
                logger.info("Applying caching optimizations")
                # Implementation would enable caching for identified bottlenecks
                optimizations_applied = True
            
            # Apply resource limiting if needed
            if (self.optimizations['resource_limiting'] and 
                report["system_metrics"].get("cpu_percent", 0) > self.thresholds["high_cpu"]):
                logger.info("Applying resource limiting optimizations")
                # Implementation would limit concurrent operations
                optimizations_applied = True
        
        return optimizations_applied
    
    def reset_metrics(self) -> None:
        """Reset all collected performance metrics"""
        with _performance_lock:
            _performance_metrics.clear()
        logger.info("Performance metrics reset")

# Convenience decorators
def track_performance(func: Callable) -> Callable:
    """
    Decorator to track function performance
    
    Args:
        func: Function to track
        
    Returns:
        Wrapped function
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        execution_time = time.time() - start_time
        
        with _performance_lock:
            _performance_metrics[func.__name__].append(execution_time)
        
        return result
    return wrapper

def cache_result(ttl: int = 300) -> Callable:
    """
    Decorator to cache function results
    
    Args:
        ttl: Time to live for cached results in seconds
        
    Returns:
        Decorator function
    """
    def decorator(func: Callable) -> Callable:
        cache = {}
        cache_times = {}
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Create a cache key from the function arguments
            key = str(args) + str(sorted(kwargs.items()))
            
            # Check if result is in cache and not expired
            current_time = time.time()
            if key in cache and current_time - cache_times[key] < ttl:
                return cache[key]
            
            # Call the function and cache the result
            result = func(*args, **kwargs)
            cache[key] = result
            cache_times[key] = current_time
            
            return result
        return wrapper
    return decorator

# Singleton instance
_performance_monitor_instance = None

def get_performance_monitor(config: Dict[str, Any] = None) -> PerformanceMonitor:
    """
    Get or create the performance monitor instance
    
    Args:
        config: Optional configuration dictionary
        
    Returns:
        PerformanceMonitor instance
    """
    global _performance_monitor_instance
    if _performance_monitor_instance is None:
        _performance_monitor_instance = PerformanceMonitor(config)
    return _performance_monitor_instance
