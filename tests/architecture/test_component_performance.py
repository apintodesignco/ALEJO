"""
Component-level performance tests for ALEJO's vision and emotional processing systems
"""

import asyncio
import logging
import time
import psutil
import pytest
import pytest_asyncio
import numpy as np
from PIL import Image
from typing import Dict, List, Any
from dataclasses import dataclass

from alejo.vision.processor import VisionProcessor
from alejo.emotional_intelligence.processor import EmotionalProcessor
from alejo.core.event_bus import EventBus
from alejo.utils.performance import PerformanceMonitor

logger = logging.getLogger(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)

@pytest.fixture
def vision_processor():
    """Create a test vision processor instance"""
    processor = VisionProcessor(config_path=None)
    return processor

@pytest.fixture
def emotional_processor():
    """Create a test emotional processor instance"""
    processor = EmotionalProcessor()
    return processor

@pytest.fixture
def performance_monitor():
    """Create a performance monitor instance"""
    return PerformanceMonitor()

@pytest.mark.asyncio
async def test_vision_frame_processing_performance(
    vision_processor: VisionProcessor,
    performance_monitor: PerformanceMonitor
):
    """Test vision frame processing performance"""
    FRAME_COUNT = 100
    FRAME_WIDTH = 640
    FRAME_HEIGHT = 480
    
    # Generate test frames
    frames = []
    for i in range(FRAME_COUNT):
        # Create a simple test pattern
        frame = np.zeros((FRAME_HEIGHT, FRAME_WIDTH, 3), dtype=np.uint8)
        frame[100:200, 100:200] = 255  # White square
        frames.append(frame)
    
    # Process frames and measure performance
    for frame in frames:
        start_time = time.time()
        result = await vision_processor.process_frame(frame)
        latency = (time.time() - start_time) * 1000
        performance_monitor.record_latency('frame_processing', latency)
    
    metrics = performance_monitor.get_metrics()
    
    # Assert performance requirements
    assert metrics.avg_latency < 50, f"Average frame processing latency too high: {metrics.avg_latency}ms"
    assert metrics.service_latencies['frame_processing'] < 100, "Frame processing too slow"
    
    logger.info("Vision Frame Processing Performance:")
    logger.info(f"Average Latency: {metrics.avg_latency:.2f}ms")
    logger.info(f"Max Latency: {metrics.max_latency:.2f}ms")
    logger.info(f"Processing Rate: {1000/metrics.avg_latency:.2f} fps")
    logger.info(f"Memory Usage: {metrics.memory_usage:.2f}MB")
    logger.info(f"CPU Usage: {metrics.cpu_usage:.2f}%")

@pytest.mark.asyncio
async def test_vision_object_detection_performance(
    vision_processor: VisionProcessor,
    performance_monitor: PerformanceMonitor
):
    """Test object detection performance"""
    TEST_COUNT = 50
    
    # Create a test image with some shapes
    image = Image.new('RGB', (640, 480), color='white')
    image_bytes = image.tobytes()
    
    # Run object detection tests
    for _ in range(TEST_COUNT):
        start_time = time.time()
        objects = vision_processor.detect_objects(image_bytes)
        latency = (time.time() - start_time) * 1000
        performance_monitor.record_latency('object_detection', latency)
    
    metrics = performance_monitor.get_metrics()
    
    # Assert performance requirements
    assert metrics.service_latencies['object_detection'] < 200, "Object detection too slow"
    
    logger.info("Object Detection Performance:")
    logger.info(f"Average Latency: {metrics.service_latencies['object_detection']:.2f}ms")
    logger.info(f"Objects/second: {1000/metrics.service_latencies['object_detection']:.2f}")

@pytest.mark.asyncio
async def test_emotional_processing_performance(
    emotional_processor: EmotionalProcessor,
    performance_monitor: PerformanceMonitor
):
    """Test emotional processing performance"""
    TEST_COUNT = 100
    test_inputs = [
        "I'm really happy today!",
        "This makes me so angry.",
        "I feel a bit sad.",
        "That's absolutely amazing!",
        "I'm not sure how to feel about this."
    ]
    
    # Process test inputs
    for _ in range(TEST_COUNT):
        input_text = test_inputs[_ % len(test_inputs)]
        start_time = time.time()
        state = await emotional_processor.process_input(input_text)
        latency = (time.time() - start_time) * 1000
        performance_monitor.record_latency('emotional_processing', latency)
    
    metrics = performance_monitor.get_metrics()
    
    # Assert performance requirements
    assert metrics.avg_latency < 20, f"Average emotional processing latency too high: {metrics.avg_latency}ms"
    assert metrics.service_latencies['emotional_processing'] < 30, "Emotional processing too slow"
    
    logger.info("Emotional Processing Performance:")
    logger.info(f"Average Latency: {metrics.avg_latency:.2f}ms")
    logger.info(f"Max Latency: {metrics.max_latency:.2f}ms")
    logger.info(f"Processing Rate: {1000/metrics.avg_latency:.2f} texts/second")
    logger.info(f"Memory Usage: {metrics.memory_usage:.2f}MB")
    logger.info(f"CPU Usage: {metrics.cpu_usage:.2f}%")

@pytest.mark.asyncio
async def test_memory_stability_under_load(
    vision_processor: VisionProcessor,
    emotional_processor: EmotionalProcessor,
    performance_monitor: PerformanceMonitor
):
    """Test memory stability under concurrent vision and emotional processing"""
    process = psutil.Process()
    initial_memory = process.memory_info().rss
    
    # Create test data
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    test_inputs = ["Test input " + str(i) for i in range(50)]
    
    # Run concurrent processing
    async def process_vision():
        for _ in range(50):
            await vision_processor.process_frame(frame)
            await asyncio.sleep(0.01)
    
    async def process_emotional():
        for text in test_inputs:
            await emotional_processor.process_input(text)
            await asyncio.sleep(0.01)
    
    # Run both processors concurrently
    await asyncio.gather(
        process_vision(),
        process_emotional()
    )
    
    # Check memory usage
    final_memory = process.memory_info().rss
    memory_growth = final_memory - initial_memory
    
    # Memory growth should be reasonable (50MB)
    max_allowed_growth = 50 * 1024 * 1024
    assert memory_growth < max_allowed_growth, \
        f"Memory growth {memory_growth / 1024 / 1024:.1f}MB exceeds limit {max_allowed_growth / 1024 / 1024:.1f}MB"
    
    logger.info("Memory Stability Test:")
    logger.info(f"Initial Memory: {initial_memory / 1024 / 1024:.1f}MB")
    logger.info(f"Final Memory: {final_memory / 1024 / 1024:.1f}MB")
    logger.info(f"Memory Growth: {memory_growth / 1024 / 1024:.1f}MB")
