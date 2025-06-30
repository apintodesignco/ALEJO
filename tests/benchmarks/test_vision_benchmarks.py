"""
Vision Pipeline Benchmarks
Tests performance of vision processing components
"""

import os
import asyncio
import pytest
import logging
import numpy as np
import cv2
from typing import List
from unittest.mock import MagicMock, AsyncMock

from alejo.vision.processor import VisionProcessor
from alejo.vision.stream_manager import StreamManager, StreamManagerConfig
from alejo.vision.optimized_stream import OptimizedVideoStream, StreamConfig
from alejo.core.event_bus import EventBus
from .benchmark_framework import Benchmarker, BenchmarkResult

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize benchmarker
benchmarker = Benchmarker()

@pytest.fixture
def sample_frames() -> List[np.ndarray]:
    """Generate sample frames for testing"""
    frames = []
    for i in range(10):
        # Create synthetic test frame
        frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
        # Add some shapes for detection
        cv2.rectangle(frame, (100, 100), (200, 200), (0, 255, 0), 2)
        cv2.circle(frame, (400, 300), 50, (0, 0, 255), -1)
        frames.append(frame)
    return frames

@pytest.fixture
async def vision_processor():
    """Create vision processor instance with mocked dependencies"""
    logger.info("Setting up vision_processor fixture...")
    
    # Create mock event bus
    mock_event_bus = MagicMock(spec=EventBus)
    mock_event_bus.publish = AsyncMock()
    
    try:
        # Initialize with minimal dependencies
        processor = VisionProcessor(event_bus=mock_event_bus)
        logger.info("VisionProcessor instance created successfully")
        
        # Start processing
        logger.info("Starting vision processing...")
        await processor.start_processing()
        logger.info("Vision processing started successfully")
        
        yield processor
        
        # Cleanup
        logger.info("Stopping vision processing...")
        await processor.stop_processing()
        logger.info("Vision processing stopped successfully")
        
    except Exception as e:
        logger.error(f"Error in vision_processor fixture: {str(e)}")
        raise

@pytest.fixture
async def stream_manager(vision_processor):
    """Create stream manager instance"""
    config = StreamManagerConfig(
        enable_gpu=True,
        max_batch_size=4,
        buffer_size=30,
        frame_rate=30
    )
    manager = StreamManager(
        vision_processor=vision_processor,
        event_bus=EventBus(),
        config=config
    )
    yield manager
    await manager.stop()

@pytest.mark.benchmark
class TestVisionBenchmarks:
    """Vision pipeline benchmark tests"""
    
    def setup_method(self, method):
        """Setup before each test method"""
        logger.info(f"Setting up test method: {method.__name__}")
    
    def teardown_method(self, method):
        """Cleanup after each test method"""
        logger.info(f"Tearing down test method: {method.__name__}")

    """Vision pipeline benchmark tests"""
    
    @pytest.mark.asyncio
    async def test_single_frame_processing(
        self,
        vision_processor: VisionProcessor,
        sample_frames: List[np.ndarray]
    ):
        """Benchmark single frame processing"""
        frame = sample_frames[0]
        
        @benchmarker.benchmark(
            name="vision_processor",
            operation="single_frame",
            iterations=100
        )
        async def process_single():
            await vision_processor.process_frame(frame)
            
        result = await process_single()
        assert result.mean_time < 0.1, "Single frame processing too slow"
    
    @pytest.mark.asyncio
    async def test_batch_processing(
        self,
        vision_processor: VisionProcessor,
        sample_frames: List[np.ndarray]
    ):
        """Benchmark batch frame processing"""
        batch_sizes = [2, 4, 8]
        
        for batch_size in batch_sizes:
            frames = sample_frames[:batch_size]
            
            @benchmarker.benchmark(
                name="vision_processor",
                operation=f"batch_size_{batch_size}",
                iterations=50,
                batch_size=batch_size
            )
            async def process_batch():
                await vision_processor.process_batch(frames)
            
            result = await process_batch()
            
            # Calculate per-frame time
            per_frame_time = result.mean_time / batch_size
            assert per_frame_time < 0.1, f"Batch processing ({batch_size}) too slow"
    
    @pytest.mark.asyncio
    async def test_stream_processing(
        self,
        stream_manager: StreamManager,
        sample_frames: List[np.ndarray]
    ):
        """Benchmark stream processing"""
        
        @benchmarker.benchmark(
            name="stream_manager",
            operation="process_stream",
            iterations=10
        )
        async def process_stream():
            # Process frames through stream
            for frame in sample_frames:
                await stream_manager.stream.process_frame(frame)
                await asyncio.sleep(0.01)  # Simulate realistic frame timing
        
        result = await process_stream()
        
        # Calculate effective FPS
        fps = len(sample_frames) / result.mean_time
        assert fps >= 20, f"Stream processing too slow: {fps:.1f} FPS"
    
    @pytest.mark.asyncio
    async def test_memory_usage(
        self,
        vision_processor: VisionProcessor,
        sample_frames: List[np.ndarray]
    ):
        """Benchmark memory usage during processing"""
        frame = sample_frames[0]
        
        @benchmarker.benchmark(
            name="vision_processor",
            operation="memory_test",
            iterations=1000  # Many iterations to check for memory leaks
        )
        async def process_repeatedly():
            await vision_processor.process_frame(frame)
        
        result = await process_repeatedly()
        
        # Check for memory stability
        assert result.memory_usage < 1000, "Memory usage too high"  # MB
        
    @pytest.mark.asyncio
    async def test_compare_gpu_cpu(
        self,
        vision_processor: VisionProcessor,
        sample_frames: List[np.ndarray]
    ):
        """Compare GPU vs CPU performance"""
        logger.info("Starting GPU vs CPU comparison benchmark")
        frame = sample_frames[0]
        
        # Force CPU
        vision_processor.device = "cpu"
        logger.info("Testing CPU performance...")
        
        @benchmarker.benchmark(
            name="vision_processor",
            operation="cpu_processing",
            iterations=50
        )
        async def process_cpu():
            await vision_processor.process_frame(frame)
            
        cpu_result = await process_cpu()
        logger.info(f"CPU processing time: {cpu_result.mean_time:.4f}s")
        
        # Switch to GPU if available
        if torch.cuda.is_available():
            logger.info("GPU available, testing GPU performance...")
            vision_processor.device = "cuda"
            
            @benchmarker.benchmark(
                name="vision_processor",
                operation="gpu_processing",
                iterations=50
            )
            async def process_gpu():
                await vision_processor.process_frame(frame)
                
            gpu_result = await process_gpu()
            logger.info(f"GPU processing time: {gpu_result.mean_time:.4f}s")
            
            # GPU should be significantly faster
            assert gpu_result.mean_time < cpu_result.mean_time * 0.5, \
                "GPU not providing expected speedup"
        else:
            logger.info("No GPU available, skipping GPU comparison")
