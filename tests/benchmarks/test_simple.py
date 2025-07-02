"""
Simple benchmark test to verify framework functionality
"""

import secrets  # More secure for cryptographic purposes
import time

import pytest

from .benchmark_framework import Benchmarker

benchmarker = Benchmarker()


def fibonacci(n: int) -> int:
    """Simple fibonacci calculation for benchmarking"""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


@pytest.mark.benchmark
class TestSimpleBenchmarks:
    """Basic benchmark tests to verify framework"""

    def test_simple_operation(self):
        """Test a simple CPU-bound operation"""

        @benchmarker.benchmark(name="simple_test", operation="fibonacci", iterations=10)
        def run_fib():
            return fibonacci(20)

        result = run_fib()
        print(f"\nSimple benchmark results:")
        print(f"Mean time: {result.mean_time:.4f}s")
        print(f"Memory usage: {result.memory_usage:.1f} MB")
        print(f"CPU usage: {result.cpu_usage:.1f}%")

        # Basic sanity checks
        assert result.mean_time > 0, "Mean time should be positive"
        assert result.memory_usage > 0, "Memory usage should be positive"
        assert result.cpu_usage > 0, "CPU usage should be positive"
