"""
Emotional Intelligence System Benchmarks
Tests performance of emotional processing and memory components
"""

import asyncio
import secrets  # More secure for cryptographic purposes
from typing import Any, Dict, List

import pytest
from alejo.emotional_intelligence.emotional_core import EmotionalCore
from alejo.emotional_intelligence.emotional_memory import EmotionalMemoryService
from alejo.emotional_intelligence.models.emotion_models import (
    EmotionalDimension,
    EmotionalState,
)
from alejo.emotional_intelligence.models.multimodal_emotion import (
    MultimodalEmotionDetector,
)

from .benchmark_framework import Benchmarker, BenchmarkResult

# Initialize benchmarker
benchmarker = Benchmarker()


@pytest.fixture
async def emotional_core():
    """Create emotional core instance"""
    core = EmotionalCore()
    await core.initialize()
    yield core
    await core.shutdown()


@pytest.fixture
async def emotion_detector():
    """Create multimodal emotion detector"""
    detector = MultimodalEmotionDetector()
    await detector.initialize()
    yield detector
    await detector.shutdown()


@pytest.fixture
async def memory_service():
    """Create emotional memory service"""
    service = EmotionalMemoryService()
    await service.initialize()
    yield service
    await service.cleanup()


@pytest.mark.benchmark
class TestEmotionalBenchmarks:
    """Emotional system benchmark tests"""

    @pytest.mark.asyncio
    async def test_emotion_detection(self, emotion_detector):
        """Benchmark emotion detection performance"""
        # Sample multimodal input
        test_input = {
            "text": "I am feeling very happy today!",
            "audio_features": [0.5, 0.3, 0.8, 0.2],
            "facial_features": [0.7, 0.1, 0.2, 0.9],
            "gesture_data": {"confidence": 0.9, "gesture_type": "thumbs_up"},
        }

        @benchmarker.benchmark(
            name="emotion_detector", operation="detect_emotions", iterations=100
        )
        async def detect_emotions():
            await emotion_detector.detect_emotions(test_input)

        result = await detect_emotions()
        assert result.mean_time < 0.05, "Emotion detection too slow"

    @pytest.mark.asyncio
    async def test_emotional_memory(self, memory_service):
        """Benchmark emotional memory operations"""

        # Test memory storage
        test_state = EmotionalState(
            dimensions={
                EmotionalDimension.VALENCE: 0.8,
                EmotionalDimension.AROUSAL: 0.6,
                EmotionalDimension.DOMINANCE: 0.7,
            },
            confidence=0.9,
        )

        @benchmarker.benchmark(
            name="memory_service", operation="store_interaction", iterations=1000
        )
        async def store_memory():
            await memory_service.store_interaction(
                emotional_state=test_state,
                context="Test interaction",
                metadata={"source": "benchmark"},
            )

        store_result = await store_memory()
        assert store_result.mean_time < 0.01, "Memory storage too slow"

        # Test memory retrieval
        @benchmarker.benchmark(
            name="memory_service", operation="get_emotional_summary", iterations=100
        )
        async def get_summary():
            await memory_service.get_emotional_summary(time_window_minutes=60)

        retrieve_result = await get_summary()
        assert retrieve_result.mean_time < 0.05, "Memory retrieval too slow"

        # Test pattern analysis
        @benchmarker.benchmark(
            name="memory_service", operation="analyze_patterns", iterations=50
        )
        async def analyze_patterns():
            await memory_service.get_emotional_patterns(time_window_days=7)

        pattern_result = await analyze_patterns()
        assert pattern_result.mean_time < 0.1, "Pattern analysis too slow"

    @pytest.mark.asyncio
    async def test_emotional_core(self, emotional_core):
        """Benchmark emotional core processing"""

        # Test state updates
        test_input = {
            "emotion_detected": {"valence": 0.7, "arousal": 0.6, "dominance": 0.5},
            "context": {"interaction_type": "conversation", "user_state": "engaged"},
        }

        @benchmarker.benchmark(
            name="emotional_core", operation="update_state", iterations=100
        )
        async def update_state():
            await emotional_core.update_emotional_state(test_input)

        update_result = await update_state()
        assert update_result.mean_time < 0.02, "State update too slow"

        # Test response generation
        @benchmarker.benchmark(
            name="emotional_core", operation="generate_response", iterations=100
        )
        async def generate_response():
            await emotional_core.generate_emotional_response("How are you feeling?")

        response_result = await generate_response()
        assert response_result.mean_time < 0.05, "Response generation too slow"

    @pytest.mark.asyncio
    async def test_concurrent_processing(
        self, emotional_core, emotion_detector, memory_service
    ):
        """Benchmark concurrent emotional processing"""

        @benchmarker.benchmark(
            name="emotional_system", operation="concurrent_processing", iterations=50
        )
        async def process_concurrent():
            # Simulate concurrent operations
            tasks = []
            for _ in range(10):
                tasks.extend(
                    [
                        emotion_detector.detect_emotions(
                            {
                                "text": "Test input",
                                "audio_features": [0.5, 0.3, 0.8],
                            }
                        ),
                        memory_service.get_emotional_summary(time_window_minutes=30),
                        emotional_core.update_emotional_state(
                            {"emotion_detected": {"valence": 0.6}}
                        ),
                    ]
                )
            await asyncio.gather(*tasks)

        result = await process_concurrent()

        # Calculate operations per second
        ops_per_second = (10 * 3) / result.mean_time  # 10 iterations * 3 operations
        assert (
            ops_per_second >= 100
        ), f"Concurrent processing too slow: {ops_per_second:.1f} ops/s"
