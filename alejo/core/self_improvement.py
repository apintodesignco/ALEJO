"""
ALEJO Self-Improvement Module

This module implements the Darwin Gödel Machine self-evolution capabilities
mentioned in the master roadmap. It enables ALEJO to analyze its own performance,
suggest improvements, and implement them with proper testing and validation.
"""

import os
import sys
import time
import logging
import asyncio
import json
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
import importlib
import inspect
import ast
import re

# Import ALEJO modules
from alejo.core.brain import Brain
from alejo.utils.benchmarking import PerformanceBenchmark
from alejo.utils.memory_optimization import get_memory_optimizer
from alejo.utils.config import Config
from alejo.utils.events import EventBus

logger = logging.getLogger("alejo.core.self_improvement")

class SelfImprovementEngine:
    """
    Self-improvement engine for ALEJO
    
    This class implements the Darwin Gödel Machine self-evolution capabilities,
    allowing ALEJO to analyze its own performance, suggest improvements, and
    implement them with proper testing and validation.
    """
    
    def __init__(self, brain: Brain, config: Dict[str, Any] = None):
        """
        Initialize the self-improvement engine
        
        Args:
            brain: ALEJO Brain instance
            config: Optional configuration dictionary
        """
        self.brain = brain
        self.config = config or {}
        self.event_bus = brain.event_bus
        self.memory_optimizer = get_memory_optimizer()
        self.benchmark = PerformanceBenchmark()
        
        # Performance metrics
        self.metrics = {
            "response_times": [],
            "memory_usage": [],
            "inference_speed": [],
            "bottlenecks": []
        }
        
        # Improvement suggestions
        self.improvement_suggestions = []
        
        # Register event handlers
        self._register_event_handlers()
        
        logger.info("Self-improvement engine initialized")
    
    def _register_event_handlers(self):
        """Register event handlers for monitoring performance"""
        self.event_bus.on("brain.message_processed", self._on_message_processed)
        self.event_bus.on("brain.inference_completed", self._on_inference_completed)
        self.event_bus.on("brain.memory_optimized", self._on_memory_optimized)
        self.event_bus.on("brain.bottleneck_detected", self._on_bottleneck_detected)
    
    async def _on_message_processed(self, data: Dict[str, Any]):
        """
        Handle message processed event
        
        Args:
            data: Event data including processing time
        """
        if "processing_time" in data:
            self.metrics["response_times"].append(data["processing_time"])
            
            # Keep only the last 100 measurements
            if len(self.metrics["response_times"]) > 100:
                self.metrics["response_times"] = self.metrics["response_times"][-100:]
    
    async def _on_inference_completed(self, data: Dict[str, Any]):
        """
        Handle inference completed event
        
        Args:
            data: Event data including inference time
        """
        if "inference_time" in data:
            self.metrics["inference_speed"].append(data["inference_time"])
            
            # Keep only the last 100 measurements
            if len(self.metrics["inference_speed"]) > 100:
                self.metrics["inference_speed"] = self.metrics["inference_speed"][-100:]
    
    async def _on_memory_optimized(self, data: Dict[str, Any]):
        """
        Handle memory optimized event
        
        Args:
            data: Event data including memory usage
        """
        if "memory_usage" in data:
            self.metrics["memory_usage"].append(data["memory_usage"])
            
            # Keep only the last 100 measurements
            if len(self.metrics["memory_usage"]) > 100:
                self.metrics["memory_usage"] = self.metrics["memory_usage"][-100:]
    
    async def _on_bottleneck_detected(self, data: Dict[str, Any]):
        """
        Handle bottleneck detected event
        
        Args:
            data: Event data including bottleneck information
        """
        if "bottleneck" in data:
            self.metrics["bottlenecks"].append(data["bottleneck"])
            
            # Keep only the last 20 bottlenecks
            if len(self.metrics["bottlenecks"]) > 20:
                self.metrics["bottlenecks"] = self.metrics["bottlenecks"][-20:]
            
            # Analyze bottleneck and suggest improvements
            await self.analyze_bottleneck(data["bottleneck"])
    
    async def analyze_performance(self) -> Dict[str, Any]:
        """
        Analyze current performance metrics
        
        Returns:
            Dictionary with performance analysis
        """
        logger.info("Analyzing performance metrics")
        
        analysis = {
            "timestamp": time.time(),
            "metrics": {
                "response_time": {
                    "mean": 0,
                    "median": 0,
                    "min": 0,
                    "max": 0
                },
                "memory_usage": {
                    "mean": 0,
                    "median": 0,
                    "min": 0,
                    "max": 0
                },
                "inference_speed": {
                    "mean": 0,
                    "median": 0,
                    "min": 0,
                    "max": 0
                }
            },
            "bottlenecks": self.metrics["bottlenecks"][-5:] if self.metrics["bottlenecks"] else []
        }
        
        # Calculate response time metrics
        if self.metrics["response_times"]:
            response_times = self.metrics["response_times"]
            analysis["metrics"]["response_time"] = {
                "mean": sum(response_times) / len(response_times),
                "median": sorted(response_times)[len(response_times) // 2],
                "min": min(response_times),
                "max": max(response_times)
            }
        
        # Calculate memory usage metrics
        if self.metrics["memory_usage"]:
            memory_usage = self.metrics["memory_usage"]
            analysis["metrics"]["memory_usage"] = {
                "mean": sum(memory_usage) / len(memory_usage),
                "median": sorted(memory_usage)[len(memory_usage) // 2],
                "min": min(memory_usage),
                "max": max(memory_usage)
            }
        
        # Calculate inference speed metrics
        if self.metrics["inference_speed"]:
            inference_speed = self.metrics["inference_speed"]
            analysis["metrics"]["inference_speed"] = {
                "mean": sum(inference_speed) / len(inference_speed),
                "median": sorted(inference_speed)[len(inference_speed) // 2],
                "min": min(inference_speed),
                "max": max(inference_speed)
            }
        
        # Emit performance analysis event
        await self.event_bus.emit("brain.performance_analyzed", analysis)
        
        return analysis
    
    async def analyze_bottleneck(self, bottleneck: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a detected bottleneck and suggest improvements
        
        Args:
            bottleneck: Bottleneck information
            
        Returns:
            Dictionary with improvement suggestions
        """
        logger.info(f"Analyzing bottleneck: {bottleneck.get('component', 'unknown')}")
        
        suggestion = {
            "timestamp": time.time(),
            "bottleneck": bottleneck,
            "suggestions": []
        }
        
        # Analyze based on bottleneck type
        component = bottleneck.get("component", "")
        issue = bottleneck.get("issue", "")
        
        if "memory" in issue.lower():
            # Memory-related bottleneck
            suggestion["suggestions"].append({
                "type": "memory_optimization",
                "description": "Implement lazy loading for this component",
                "priority": "high" if bottleneck.get("severity", 0) > 7 else "medium"
            })
            
            suggestion["suggestions"].append({
                "type": "memory_optimization",
                "description": "Add cache TTL to reduce memory footprint",
                "priority": "medium"
            })
        
        elif "speed" in issue.lower() or "performance" in issue.lower():
            # Performance-related bottleneck
            suggestion["suggestions"].append({
                "type": "performance_optimization",
                "description": "Implement parallel processing for this component",
                "priority": "high" if bottleneck.get("severity", 0) > 7 else "medium"
            })
            
            suggestion["suggestions"].append({
                "type": "performance_optimization",
                "description": "Add result caching to avoid redundant computation",
                "priority": "medium"
            })
        
        # Add the suggestion to the list
        self.improvement_suggestions.append(suggestion)
        
        # Emit improvement suggestion event
        await self.event_bus.emit("brain.improvement_suggested", suggestion)
        
        return suggestion
    
    async def benchmark_component(self, component_name: str) -> Dict[str, Any]:
        """
        Benchmark a specific component
        
        Args:
            component_name: Name of the component to benchmark
            
        Returns:
            Dictionary with benchmark results
        """
        logger.info(f"Benchmarking component: {component_name}")
        
        # Get component class or function
        component = self._get_component_by_name(component_name)
        if not component:
            logger.error(f"Component not found: {component_name}")
            return {"error": f"Component not found: {component_name}"}
        
        # Create benchmark instance
        benchmark = PerformanceBenchmark()
        
        # Benchmark based on component type
        if inspect.isclass(component):
            # Benchmark class methods
            instance = self._instantiate_component(component)
            if not instance:
                return {"error": f"Failed to instantiate component: {component_name}"}
            
            results = {}
            for method_name, method in inspect.getmembers(instance, predicate=inspect.ismethod):
                if not method_name.startswith("_"):  # Skip private methods
                    try:
                        if asyncio.iscoroutinefunction(method):
                            # Async method
                            result = await benchmark.benchmark_async_function(
                                func=method,
                                name=f"{component_name}.{method_name}"
                            )
                        else:
                            # Sync method
                            result = benchmark.benchmark_function(
                                func=method,
                                name=f"{component_name}.{method_name}"
                            )
                        results[method_name] = result
                    except Exception as e:
                        logger.error(f"Error benchmarking {component_name}.{method_name}: {e}")
            
            return {
                "component": component_name,
                "type": "class",
                "results": results
            }
        
        elif inspect.isfunction(component) or inspect.ismethod(component):
            # Benchmark function
            try:
                if asyncio.iscoroutinefunction(component):
                    # Async function
                    result = await benchmark.benchmark_async_function(
                        func=component,
                        name=component_name
                    )
                else:
                    # Sync function
                    result = benchmark.benchmark_function(
                        func=component,
                        name=component_name
                    )
                
                return {
                    "component": component_name,
                    "type": "function",
                    "results": result
                }
            except Exception as e:
                logger.error(f"Error benchmarking {component_name}: {e}")
                return {"error": f"Error benchmarking {component_name}: {e}"}
        
        else:
            logger.error(f"Unsupported component type: {type(component)}")
            return {"error": f"Unsupported component type: {type(component)}"}
    
    def _get_component_by_name(self, component_name: str) -> Any:
        """
        Get a component by its fully qualified name
        
        Args:
            component_name: Fully qualified component name (e.g., 'alejo.core.brain.Brain')
            
        Returns:
            Component class or function, or None if not found
        """
        try:
            # Split into module and attribute parts
            parts = component_name.split(".")
            module_name = ".".join(parts[:-1])
            attr_name = parts[-1]
            
            # Import the module
            module = importlib.import_module(module_name)
            
            # Get the attribute
            return getattr(module, attr_name)
        except (ImportError, AttributeError) as e:
            logger.error(f"Error getting component {component_name}: {e}")
            return None
    
    def _instantiate_component(self, component_class: Any) -> Any:
        """
        Instantiate a component class
        
        Args:
            component_class: Component class to instantiate
            
        Returns:
            Component instance, or None if instantiation fails
        """
        try:
            # Get constructor signature
            signature = inspect.signature(component_class.__init__)
            
            # Create arguments dictionary
            kwargs = {}
            for param_name, param in signature.parameters.items():
                if param_name == "self":
                    continue
                
                # Try to provide required parameters
                if param_name == "brain":
                    kwargs[param_name] = self.brain
                elif param_name == "config":
                    kwargs[param_name] = self.config
                elif param_name == "event_bus":
                    kwargs[param_name] = self.event_bus
                elif param.default is inspect.Parameter.empty:
                    # Required parameter that we can't provide
                    logger.warning(f"Cannot provide required parameter: {param_name}")
                    return None
            
            # Instantiate the class
            return component_class(**kwargs)
        except Exception as e:
            logger.error(f"Error instantiating component: {e}")
            return None
    
    async def run_tests(self, component_name: str = None) -> Dict[str, Any]:
        """
        Run tests for a specific component or all tests
        
        Args:
            component_name: Optional component name to test
            
        Returns:
            Dictionary with test results
        """
        logger.info(f"Running tests for: {component_name or 'all components'}")
        
        # Prepare test command
        cmd = ["pytest", "-q"]
        
        if component_name:
            # Convert component name to test path
            test_path = self._component_name_to_test_path(component_name)
            if test_path:
                cmd.append(test_path)
            else:
                return {"error": f"Could not determine test path for component: {component_name}"}
        
        # Add coverage reporting
        cmd.extend(["--cov=alejo", "--cov-report=term-missing"])
        
        # Run tests
        try:
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False
            )
            
            # Parse results
            results = {
                "component": component_name or "all",
                "returncode": process.returncode,
                "passed": process.returncode == 0,
                "output": process.stdout,
                "errors": process.stderr
            }
            
            # Parse coverage information
            coverage_match = re.search(r"TOTAL\s+\d+\s+\d+\s+(\d+)%", process.stdout)
            if coverage_match:
                results["coverage"] = int(coverage_match.group(1))
            
            return results
        except Exception as e:
            logger.error(f"Error running tests: {e}")
            return {"error": f"Error running tests: {e}"}
    
    def _component_name_to_test_path(self, component_name: str) -> Optional[str]:
        """
        Convert a component name to a test path
        
        Args:
            component_name: Component name (e.g., 'alejo.core.brain.Brain')
            
        Returns:
            Test path, or None if not found
        """
        try:
            # Split into module and attribute parts
            parts = component_name.split(".")
            module_parts = parts[:-1]  # Remove class/function name
            
            # Convert to test path
            test_path = "tests/" + "/".join(module_parts[1:])  # Remove 'alejo' prefix
            
            # Check if test directory exists
            if os.path.isdir(test_path):
                return test_path
            
            # Try to find a specific test file
            test_file = f"test_{parts[-1].lower()}.py"
            test_file_path = os.path.join(test_path, test_file)
            
            if os.path.isfile(test_file_path):
                return test_file_path
            
            # Try to find any test file in the directory
            for file in os.listdir(test_path):
                if file.startswith("test_") and file.endswith(".py"):
                    return os.path.join(test_path, file)
            
            return None
        except Exception as e:
            logger.error(f"Error converting component name to test path: {e}")
            return None
    
    async def suggest_improvements(self) -> List[Dict[str, Any]]:
        """
        Suggest improvements based on performance analysis and bottlenecks
        
        Returns:
            List of improvement suggestions
        """
        logger.info("Suggesting improvements")
        
        # Analyze performance first
        await self.analyze_performance()
        
        # Generate suggestions based on metrics and bottlenecks
        suggestions = []
        
        # Check response time
        if self.metrics["response_times"]:
            mean_response_time = sum(self.metrics["response_times"]) / len(self.metrics["response_times"])
            if mean_response_time > 1.0:  # More than 1 second
                suggestions.append({
                    "type": "performance_optimization",
                    "component": "response_time",
                    "description": "Response time is too high, consider optimizing message processing",
                    "priority": "high" if mean_response_time > 2.0 else "medium"
                })
        
        # Check memory usage
        if self.metrics["memory_usage"]:
            max_memory = max(self.metrics["memory_usage"])
            if max_memory > 1024:  # More than 1GB
                suggestions.append({
                    "type": "memory_optimization",
                    "component": "memory_usage",
                    "description": "Memory usage is too high, consider implementing more aggressive cleanup",
                    "priority": "high" if max_memory > 2048 else "medium"
                })
        
        # Add existing bottleneck suggestions
        for suggestion in self.improvement_suggestions:
            for item in suggestion.get("suggestions", []):
                if item not in suggestions:
                    suggestions.append(item)
        
        # Emit improvement suggestions event
        await self.event_bus.emit("brain.improvements_suggested", {"suggestions": suggestions})
        
        return suggestions
    
    async def apply_improvement(self, improvement: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply an improvement suggestion
        
        Args:
            improvement: Improvement suggestion
            
        Returns:
            Dictionary with result of applying the improvement
        """
        logger.info(f"Applying improvement: {improvement.get('description', 'unknown')}")
        
        # This is a placeholder for the actual implementation
        # In a real implementation, this would modify code or configuration
        
        result = {
            "improvement": improvement,
            "applied": False,
            "message": "Automatic code modification is not implemented yet"
        }
        
        # Emit improvement applied event
        await self.event_bus.emit("brain.improvement_applied", result)
        
        return result
    
    async def generate_performance_report(self, output_file: str = None) -> Dict[str, Any]:
        """
        Generate a comprehensive performance report
        
        Args:
            output_file: Optional file to write report to
            
        Returns:
            Dictionary with report data
        """
        logger.info("Generating performance report")
        
        # Analyze performance
        analysis = await self.analyze_performance()
        
        # Get improvement suggestions
        suggestions = await self.suggest_improvements()
        
        # Create report
        report = {
            "timestamp": time.time(),
            "analysis": analysis,
            "suggestions": suggestions,
            "metrics": self.metrics
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
        
        # Emit report generated event
        await self.event_bus.emit("brain.performance_report_generated", {"report": report})
        
        return report


# Singleton instance
_self_improvement_engine = None

def get_self_improvement_engine(brain: Brain = None, config: Dict[str, Any] = None) -> SelfImprovementEngine:
    """
    Get the singleton instance of the self-improvement engine
    
    Args:
        brain: ALEJO Brain instance (required on first call)
        config: Optional configuration dictionary
        
    Returns:
        SelfImprovementEngine instance
    """
    global _self_improvement_engine
    
    if _self_improvement_engine is None:
        if brain is None:
            raise ValueError("Brain instance is required for first initialization")
        _self_improvement_engine = SelfImprovementEngine(brain, config)
    
    return _self_improvement_engine
