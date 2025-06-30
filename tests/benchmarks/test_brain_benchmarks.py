"""
Brain Service Benchmarks
Tests performance of ALEJO's core brain processing and multimodal integration
"""

import asyncio
import pytest
from typing import Dict, Any, List

from alejo.brain.alejo_brain import ALEJOBrain
from alejo.services.brain_service import BrainService
from alejo.multimodal.fusion import EnhancedMultimodalProcessor
from alejo.core.event_bus import EventBus
from .benchmark_framework import Benchmarker, BenchmarkResult

# Initialize benchmarker
benchmarker = Benchmarker()

@pytest.fixture
async def brain_service():
    """Create brain service instance"""
    service = BrainService()
    await service.initialize()
    yield service
    await service.cleanup()

@pytest.fixture
async def alejo_brain():
    """Create ALEJO brain instance"""
    brain = ALEJOBrain()
    await brain.setup()
    yield brain
    await brain.cleanup()

@pytest.fixture
async def multimodal_processor():
    """Create multimodal processor"""
    processor = EnhancedMultimodalProcessor()
    await processor.initialize()
    yield processor
    await processor.cleanup()

@pytest.mark.benchmark
class TestBrainBenchmarks:
    """Brain system benchmark tests"""
    
    @pytest.mark.asyncio
    async def test_text_processing(self, brain_service):
        """Benchmark text processing performance"""
        test_inputs = [
            "Hello ALEJO, how are you today?",
            "Can you help me with a programming task?",
            "I'm feeling quite happy with the progress we're making!",
            "What's the weather like in New York?",
            "Tell me a joke about programming."
        ]
        
        @benchmarker.benchmark(
            name="brain_service",
            operation="process_text",
            iterations=50
        )
        async def process_text():
            for text in test_inputs:
                await brain_service.process_text(text)
        
        result = await process_text()
        
        # Calculate texts per second
        texts_per_second = len(test_inputs) / result.mean_time
        assert texts_per_second >= 10, f"Text processing too slow: {texts_per_second:.1f} texts/s"
    
    @pytest.mark.asyncio
    async def test_multimodal_fusion(self, multimodal_processor):
        """Benchmark multimodal fusion performance"""
        test_input = {
            'text': 'I really enjoy working with ALEJO!',
            'audio': {
                'features': [0.7, 0.3, 0.8, 0.4],
                'mfcc': [[0.1, 0.2], [0.3, 0.4]],
                'pitch': 220.0
            },
            'vision': {
                'facial_features': [0.6, 0.2, 0.8],
                'gesture_data': {'type': 'wave', 'confidence': 0.9},
                'emotion_scores': {'happy': 0.8, 'neutral': 0.2}
            }
        }
        
        @benchmarker.benchmark(
            name="multimodal_processor",
            operation="fuse_modalities",
            iterations=100
        )
        async def fuse_modalities():
            await multimodal_processor.process_input(test_input)
        
        result = await fuse_modalities()
        assert result.mean_time < 0.05, "Multimodal fusion too slow"
    
    @pytest.mark.asyncio
    async def test_proactive_dialogue(self, alejo_brain):
        """Benchmark proactive dialogue checking"""
        context = {
            'emotional_state': {'valence': 0.7, 'arousal': 0.4},
            'interaction_history': ['Hello!', 'How are you?'],
            'user_profile': {'engagement_level': 'high'}
        }
        
        @benchmarker.benchmark(
            name="alejo_brain",
            operation="check_proactive",
            iterations=200
        )
        async def check_proactive():
            await alejo_brain._check_proactive_dialogue(context)
        
        result = await check_proactive()
        assert result.mean_time < 0.02, "Proactive dialogue check too slow"
    
    @pytest.mark.asyncio
    async def test_command_processing(self, brain_service):
        """Benchmark command processing performance"""
        test_commands = [
            {'type': 'query', 'content': 'What time is it?'},
            {'type': 'action', 'content': 'Set a timer for 5 minutes'},
            {'type': 'system', 'content': 'Check system status'},
        ]
        
        @benchmarker.benchmark(
            name="brain_service",
            operation="process_command",
            iterations=50
        )
        async def process_commands():
            for cmd in test_commands:
                await brain_service.process_command(cmd)
        
        result = await process_commands()
        
        # Calculate commands per second
        cmds_per_second = len(test_commands) / result.mean_time
        assert cmds_per_second >= 20, f"Command processing too slow: {cmds_per_second:.1f} cmds/s"
    
    @pytest.mark.asyncio
    async def test_concurrent_brain_operations(self, brain_service, alejo_brain):
        """Benchmark concurrent brain operations"""
        
        @benchmarker.benchmark(
            name="brain_system",
            operation="concurrent_ops",
            iterations=20
        )
        async def run_concurrent():
            # Simulate realistic concurrent workload
            tasks = []
            for _ in range(5):
                tasks.extend([
                    brain_service.process_text("Hello ALEJO!"),
                    alejo_brain._check_proactive_dialogue({}),
                    brain_service.process_command({'type': 'query', 'content': 'status'})
                ])
            await asyncio.gather(*tasks)
        
        result = await run_concurrent()
        
        # Calculate operations per second
        ops_per_second = (5 * 3) / result.mean_time  # 5 iterations * 3 operations
        assert ops_per_second >= 50, f"Concurrent operations too slow: {ops_per_second:.1f} ops/s"
    
    @pytest.mark.asyncio
    async def test_memory_impact(self, brain_service):
        """Benchmark memory usage during extended operation"""
        
        @benchmarker.benchmark(
            name="brain_service",
            operation="memory_stability",
            iterations=1000  # Long test to check for memory leaks
        )
        async def extended_operation():
            await brain_service.process_text(
                "This is a test message to check memory stability"
            )
        
        result = await extended_operation()
        
        # Check memory stability
        assert result.memory_usage < 500, f"Memory usage too high: {result.memory_usage:.1f} MB"
        
        # Check for memory growth
        memory_growth = result.additional_metrics.get('memory_growth', 0)
        assert memory_growth < 50, f"Excessive memory growth: {memory_growth:.1f} MB"
