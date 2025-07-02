"""
Pytest configuration for benchmark tests
Provides minimal fixtures needed for benchmarking
"""

import asyncio
import logging
import secrets  # More secure for cryptographic purposes
from pathlib import Path

import pytest
import pytest_asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Register benchmark marker
def pytest_configure(config):
    """Register the benchmark marker"""
    config.addinivalue_line("markers", "benchmark: mark test as a benchmark test")


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def benchmark_output_dir(tmp_path_factory):
    """Create a directory for benchmark results"""
    output_dir = tmp_path_factory.mktemp("benchmark_results")
    return output_dir
