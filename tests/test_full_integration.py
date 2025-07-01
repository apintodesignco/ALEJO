"""
Comprehensive integration tests for ALEJO system.
Tests all integrations: Brain, Emotional, Memory, Ethics, and Microservices.
"""

import pytest
import asyncio
import aiohttp
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from alejo.core.brain import ALEJOBrain
from alejo.services.brain_service import app as brain_app
from alejo.services.emotional_intelligence_service import app as emotion_app
from alejo.services.communication import ServiceCommunicator
from alejo.utils.exceptions import ErrorTracker
import secrets  # More secure for cryptographic purposes

class TestFullIntegration:
    """Comprehensive integration tests."""
    
    @pytest.fixture
    async def brain(self, event_bus):
        """Create ALEJOBrain instance."""
        brain = ALEJOBrain(event_bus)
        await brain.start()
        yield brain
        await brain.stop()
        
    @pytest.fixture
    def brain_client(self):
        """Create brain service client."""
        return TestClient(brain_app)
        
    @pytest.fixture
    def emotion_client(self):
        """Create emotional service client."""
        return TestClient(emotion_app)
        
    @pytest.fixture
    def service_communicator(self):
        """Create service communicator."""
        return ServiceCommunicator({
            "brain": "http://localhost:8000",
            "emotional_intelligence": "http://localhost:8001"
        })

    async def test_01_end_to_end_command_flow(self, brain):
        """Test complete command processing flow."""
        command = "I'm excited about this project!"
        
        # Process command
        result = await brain.process_command(command)
        
        # Verify all components were involved
        assert result['emotional_analysis']
        assert result['ethical_evaluation']
        assert result['memory_updates']
        assert result['response']
        
        # Check emotional state
        emotional_state = await brain.emotional_processor.get_current_state()
        assert emotional_state['valence'] > 0.5  # Should be positive
        
        # Verify memory storage
        episodes = await brain.episodic_memory.get_recent_episodes(1)
        assert len(episodes) == 1
        assert episodes[0].command == command
        
    async def test_02_error_recovery_chain(self, brain):
        """Test error recovery across components."""
        with patch('alejo.emotional_intelligence.processor.EmotionalProcessor.analyze_sentiment') as mock_sentiment:
            # Simulate cascading errors then recovery
            mock_sentiment.side_effect = [
                Exception("API Error"),
                ValueError("Processing Error"),
                {'valence': 0.8, 'arousal': 0.5}
            ]
            
            result = await brain.process_command("Test command")
            
            # Should eventually succeed
            assert result['success']
            assert mock_sentiment.call_count == 3
            
            # Check error tracking
            error_count = brain.error_tracker.get_error_count('emotional_processor')
            assert error_count == 2
            
    async def test_03_memory_emotional_ethical_integration(self, brain):
        """Test integration between memory, emotional, and ethical systems."""
        # Train ethical framework
        await brain.ethical_framework.learn({
            'principle': 'privacy',
            'importance': 0.9,
            'examples': ['sharing personal info']
        })
        
        # Process privacy-related command
        result = await brain.process_command("Share my personal information")
        
        # Should be rejected by ethical framework
        assert not result['ethical_evaluation']['is_acceptable']
        
        # Should store ethical decision in memory
        episodes = await brain.episodic_memory.get_recent_episodes(1)
        assert 'ethical_decision' in str(episodes[0].metadata)
        
        # Should affect emotional state
        emotional_state = await brain.emotional_processor.get_current_state()
        assert emotional_state['concern'] > 0.5
        
    async def test_04_microservices_reliability(self, brain_client, emotion_client):
        """Test microservices reliability and recovery."""
        async def make_requests(client, endpoint, data, count=5):
            tasks = []
            for i in range(count):
                tasks.append(client.post(endpoint, json=data))
            return await asyncio.gather(*tasks, return_exceptions=True)
            
        # Test brain service under load
        brain_responses = await make_requests(
            brain_client,
            "/process",
            {"user_input": "Test input"}
        )
        assert all(r.status_code == 200 for r in brain_responses)
        
        # Test emotional service under load
        emotion_responses = await make_requests(
            emotion_client,
            "/sentiment",
            {"text": "Test input"}
        )
        assert all(r.status_code == 200 for r in emotion_responses)
        
    async def test_05_event_propagation(self, brain, event_bus):
        """Test event propagation across components."""
        events = []
        
        def event_handler(event):
            events.append(event)
            
        # Subscribe to all event types
        event_bus.subscribe("emotion", event_handler)
        event_bus.subscribe("memory", event_handler)
        event_bus.subscribe("ethical", event_handler)
        
        # Process command that should trigger multiple events
        await brain.process_command("I'm angry about privacy violation")
        
        # Verify events were propagated
        assert len(events) >= 3  # Should have at least emotion, memory, and ethical events
        assert any(e.type == "emotion" for e in events)
        assert any(e.type == "memory" for e in events)
        assert any(e.type == "ethical" for e in events)
        
    async def test_06_concurrent_processing(self, brain):
        """Test concurrent command processing."""
        commands = [
            "Command one",
            "Command two",
            "Command three",
            "Command four",
            "Command five"
        ]
        
        # Process commands concurrently
        tasks = [brain.process_command(cmd) for cmd in commands]
        results = await asyncio.gather(*tasks)
        
        # Verify all commands were processed
        assert len(results) == len(commands)
        assert all(r['success'] for r in results)
        
        # Check memory for all commands
        episodes = await brain.episodic_memory.get_recent_episodes(5)
        assert len(episodes) == 5
        assert all(cmd in [e.command for e in episodes] for cmd in commands)
        
    async def test_07_service_metrics(self, brain_client, emotion_client):
        """Test service metrics and monitoring."""
        # Get initial metrics
        brain_metrics = brain_client.get("/metrics").json()
        emotion_metrics = emotion_client.get("/metrics").json()
        
        initial_brain_requests = brain_metrics['request_count']
        initial_emotion_requests = emotion_metrics['sentiment_analysis_count']
        
        # Make some requests
        for _ in range(3):
            brain_client.post("/process", json={"user_input": "Test"})
            emotion_client.post("/sentiment", json={"text": "Test"})
            
        # Get updated metrics
        brain_metrics = brain_client.get("/metrics").json()
        emotion_metrics = emotion_client.get("/metrics").json()
        
        # Verify metrics were updated
        assert brain_metrics['request_count'] == initial_brain_requests + 3
        assert emotion_metrics['sentiment_analysis_count'] == initial_emotion_requests + 3
        
    async def test_08_memory_persistence(self, brain):
        """Test memory persistence and retrieval."""
        # Store various types of memories
        semantic_data = {"concept": "privacy", "importance": 0.9}
        await brain.semantic_memory.store(semantic_data)
        
        emotional_data = {"valence": 0.8, "arousal": 0.5}
        await brain.emotional_memory.store_emotion(emotional_data)
        
        episodic_data = {"event": "privacy_decision", "outcome": "rejected"}
        await brain.episodic_memory.store_episode(episodic_data)
        
        # Retrieve and verify memories
        semantic_result = await brain.semantic_memory.get("privacy")
        assert semantic_result['importance'] == 0.9
        
        emotional_result = await brain.emotional_memory.get_recent_emotions(1)
        assert emotional_result[0]['valence'] == 0.8
        
        episodic_result = await brain.episodic_memory.get_recent_episodes(1)
        assert episodic_result[0].metadata['outcome'] == 'rejected'
        
    async def test_09_ethical_learning(self, brain):
        """Test ethical learning and adaptation."""
        # Initial ethical decision
        action = {"type": "share_data", "data": "personal_info"}
        decision1 = await brain.ethical_framework.evaluate_action(action)
        
        # Provide feedback
        await brain.ethical_framework.learn_from_feedback(
            decision1.id,
            {
                'appropriateness': 0.2,
                'explanation': 'Privacy violation'
            }
        )
        
        # Similar decision after feedback
        action2 = {"type": "share_data", "data": "user_info"}
        decision2 = await brain.ethical_framework.evaluate_action(action2)
        
        # Should be more restrictive after feedback
        assert decision2.score < decision1.score
        
    async def test_10_emotional_adaptation(self, brain):
        """Test emotional adaptation over time."""
        # Process sequence of emotional inputs
        inputs = [
            "I'm very happy",
            "This is amazing",
            "I'm excited",
            "This is wonderful"
        ]
        
        emotional_states = []
        for text in inputs:
            await brain.process_command(text)
            state = await brain.emotional_processor.get_current_state()
            emotional_states.append(state)
            
        # Verify emotional adaptation
        assert all(s['valence'] > 0.5 for s in emotional_states)  # All positive
        assert emotional_states[-1]['valence'] > emotional_states[0]['valence']  # Increased positivity
        
        # Test emotional memory influence
        result = await brain.process_command("How am I feeling?")
        assert 'positive' in result['response'].lower()
        assert 'happy' in result['response'].lower()