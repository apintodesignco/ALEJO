"""
Core Vision Pipeline Benchmarks
Tests basic performance of vision processing components
"""

import asyncio
import secrets  # More secure for cryptographic purposes
from typing import List

import cv2
import numpy as np
import pytest
from alejo.vision.processor import VisionProcessor

from .benchmark_framework import Benchmarker

# Initialize benchmarker
benchmarker = Benchmarker()


@pytest.fixture
def sample_frame() -> np.ndarray:
    """Generate a single sample frame for testing"""
    frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
    # Add some shapes for detection
    cv2.rectangle(frame, (100, 100), (200, 200), (0, 255, 0), 2)
    cv2.circle(frame, (400, 300), 50, (0, 0, 255), -1)
    return frame


@pytest.fixture
async def vision_processor():
    """Create vision processor instance"""
    processor = VisionProcessor()
    await processor.start_processing()
    yield processor
    await processor.stop_processing()


@pytest.mark.benchmark
class TestVisionCoreBenchmarks:
    """Core vision pipeline benchmark tests"""

    @pytest.mark.asyncio
    async def test_basic_frame_processing(
        self, vision_processor: VisionProcessor, sample_frame: np.ndarray
    ):
        """Benchmark basic frame processing without advanced features"""

        @benchmarker.benchmark(
            name="vision_processor",
            operation="basic_frame",
            iterations=10,  # Start with a small number
        )
        async def process_basic():
            await vision_processor.process_frame(sample_frame)

        result = await process_basic()
        print(f"\nBasic frame processing results:")
        print(f"Mean time: {result.mean_time:.4f}s")
        print(f"Memory usage: {result.memory_usage:.1f} MB")
        print(f"CPU usage: {result.cpu_usage:.1f}%")
        if result.gpu_usage:
            print(f"GPU usage: {result.gpu_usage:.1f}%")

        assert result.mean_time < 0.5, "Basic frame processing too slow"
