"""
Stress tests for ALEJO's error handling system.
Tests behavior under high load and complex failure scenarios.
"""

import pytest
import asyncio
import random
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List
from unittest.mock import MagicMock, patch

from alejo.utils.error_handling import ErrorTracker, handle_errors
from alejo.utils.exceptions import RateLimitError, APIError

class TestErrorHandlingStress:
    """Stress tests for error handling system."""
    
    @pytest.fixture
    def mock_service(self):
        """Create a mock service for testing."""
        service = MagicMock()
        service.rotate_api_key = MagicMock()
        service.clear_context = MagicMock()
        return service
    
    async def test_01_concurrent_error_tracking(self):
        """Test error tracking under concurrent load."""
        tracker = ErrorTracker()
        num_threads = 10
        errors_per_thread = 100
        
        async def generate_errors():
            for i in range(errors_per_thread):
                error = Exception(f"Test error {i}")
                await tracker.track_error(
                    "test_component",
                    "test_error",
                    error,
                    {"thread_id": threading.get_ident()}
                )
                await asyncio.sleep(0.001)  # Small delay to simulate work
                
        # Run concurrent error generation
        tasks = [generate_errors() for _ in range(num_threads)]
        await asyncio.gather(*tasks)
        
        # Verify results
        error_count = tracker.get_error_count("test_component")
        assert error_count == num_threads * errors_per_thread
        
        # Check component health
        assert not tracker.is_component_healthy("test_component")
        
    async def test_02_recovery_under_load(self, mock_service):
        """Test recovery strategies under heavy load."""
        tracker = ErrorTracker()
        num_concurrent = 50
        
        async def test_recovery():
            error = RateLimitError("API rate limit exceeded")
            context = {
                'retry_count': 0,
                'max_retries': 3,
                'api_keys': ['key1', 'key2'],
                'service': mock_service
            }
            
            result = await tracker.track_error(
                "llm_service",
                "rate_limit",
                error,
                context
            )
            return result
            
        # Run concurrent recovery attempts
        tasks = [test_recovery() for _ in range(num_concurrent)]
        results = await asyncio.gather(*tasks)
        
        # Verify results
        success_count = sum(1 for r in results if r['recovery']['success'])
        assert success_count > 0
        
        # Check API key rotation was called
        assert mock_service.rotate_api_key.call_count > 0
        
    async def test_03_cascading_failures(self):
        """Test handling of cascading failures across components."""
        tracker = ErrorTracker()
        components = ['api_service', 'database', 'cache', 'processor']
        num_cascades = 10
        
        async def trigger_cascade():
            # Simulate failure in one component triggering others
            for component in components:
                error = Exception(f"{component} failure")
                await tracker.track_error(
                    component,
                    "cascade_failure",
                    error,
                    {"cascade_id": random.randint(1, 1000)}
                )
                await asyncio.sleep(0.01)  # Small delay between failures
                
        # Run multiple cascading failure scenarios
        tasks = [trigger_cascade() for _ in range(num_cascades)]
        await asyncio.gather(*tasks)
        
        # Verify all components are marked unhealthy
        for component in components:
            assert not tracker.is_component_healthy(component)
            
        # Check error counts
        total_errors = sum(tracker.get_error_count(c) for c in components)
        assert total_errors == len(components) * num_cascades
        
    async def test_04_error_logging_performance(self):
        """Test error logging performance under high volume."""
        tracker = ErrorTracker()
        num_errors = 1000
        start_time = time.time()
        
        # Generate many errors quickly
        for i in range(num_errors):
            error = Exception(f"Performance test error {i}")
            await tracker.track_error(
                "perf_test",
                "high_volume",
                error,
                {"index": i}
            )
            
        end_time = time.time()
        duration = end_time - start_time
        
        # Check performance
        errors_per_second = num_errors / duration
        assert errors_per_second > 100  # Should handle at least 100 errors/second
        
        # Verify all errors were tracked
        assert tracker.get_error_count("perf_test") == num_errors
        
    @pytest.mark.parametrize("error_type,expected_recovery", [
        ("connection", True),
        ("memory", True),
        ("permission", True),
        ("network", True),
        ("file", True)
    ])
    async def test_05_recovery_strategy_reliability(self, error_type, expected_recovery):
        """Test reliability of different recovery strategies under stress."""
        tracker = ErrorTracker()
        num_attempts = 50
        
        async def test_strategy():
            error = Exception(f"{error_type} error")
            context = {"attempt": i}
            result = await tracker.track_error(
                "stress_test",
                error_type,
                error,
                context
            )
            return result['recovery']['success'] if 'recovery' in result else False
            
        # Run multiple recovery attempts
        tasks = [test_strategy() for i in range(num_attempts)]
        results = await asyncio.gather(*tasks)
        
        # Calculate success rate
        success_rate = sum(1 for r in results if r) / len(results)
        
        if expected_recovery:
            assert success_rate > 0.8  # At least 80% success rate
            
    async def test_06_memory_leak_check(self):
        """Test for memory leaks in error tracking system."""
        tracker = ErrorTracker()
        initial_memory = get_memory_usage()
        num_iterations = 1000
        
        # Generate errors in loops
        for i in range(num_iterations):
            error = Exception(f"Memory test error {i}")
            await tracker.track_error(
                "memory_test",
                "leak_check",
                error,
                {"iteration": i}
            )
            
            if i % 100 == 0:
                # Force garbage collection
                import gc
                gc.collect()
                
        final_memory = get_memory_usage()
        memory_growth = final_memory - initial_memory
        
        # Check memory growth is reasonable
        assert memory_growth < 10 * 1024 * 1024  # Less than 10MB growth
        
    async def test_07_error_handler_decorator_stress(self):
        """Test error handling decorator under stress."""
        num_calls = 1000
        success_count = 0
        error_count = 0
        
        @handle_errors(component='test_component')
        async def test_function(should_fail: bool):
            if should_fail:
                raise Exception("Intentional failure")
            return "success"
            
        # Make many concurrent calls
        async def make_call(i: int):
            try:
                should_fail = i % 2 == 0
                result = await test_function(should_fail)
                return True
            except:
                return False
                
        tasks = [make_call(i) for i in range(num_calls)]
        results = await asyncio.gather(*tasks)
        
        # Count successes and failures
        success_count = sum(1 for r in results if r)
        error_count = sum(1 for r in results if not r)
        
        assert success_count == num_calls // 2  # Half should succeed
        assert error_count == num_calls // 2    # Half should fail
        
def get_memory_usage():
    """Get current memory usage."""
    import psutil
    process = psutil.Process()
    return process.memory_info().rss
