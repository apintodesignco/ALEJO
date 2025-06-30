"""
Final set of integration tests for ALEJOBrain.
"""

import pytest
import asyncio
from alejo.core.brain import ALEJOBrain
from alejo.utils.exceptions import APIError

class TestALEJOBrainIntegrationPart3:
    """Final set of integration tests for ALEJOBrain."""
    
    @pytest.fixture
    async def brain(self, event_bus):
        """Create ALEJOBrain instance for testing."""
        brain = ALEJOBrain(event_bus)
        await brain.start()
        yield brain
        await brain.stop()
        
    async def test_07_ethical_emotional_feedback(self, brain):
        """Test feedback loop between ethical and emotional components."""
        # Process command that triggers ethical consideration
        command = "I'm frustrated with someone"
        
        result = await brain.process_command(command)
        
        # Verify emotional state influenced ethical decision
        decision = result['decision']
        assert any('emotion' in str(c) for c in decision.context.values())
        
        # Provide feedback
        await brain.ethical_framework.learn_from_feedback(
            decision.id,
            {
                'overall_rating': 0.8,
                'principle_feedback': {
                    'beneficence': 0.9,
                    'non_maleficence': 0.8
                }
            }
        )
        
        # Process similar command
        result2 = await brain.process_command("I'm annoyed with someone")
        
        # Should show learning from feedback
        assert result2['decision'].reasoning != decision.reasoning
        
    async def test_08_memory_emotional_state(self, brain):
        """Test interaction between memory and emotional state."""
        # Process emotional command
        command = "I'm really excited about this project!"
        
        await brain.process_command(command)
        
        # Check emotional memory
        state = await brain.emotional_memory.get_current_state()
        assert state.valence > 0
        assert state.arousal > 0
        
        # Verify episodic memory captured emotional state
        episodes = await brain.episodic_memory.get_recent_episodes(1)
        assert 'emotional_state' in str(episodes[0])
        
        # Process related command
        result = await brain.process_command("How was I feeling earlier?")
        
        # Should reference previous emotional state
        assert 'excited' in result['response'].lower()
        
    async def test_09_error_handling_stress(self, brain):
        """Test error handling under stress conditions."""
        error_types = [
            APIError("API Error"),
            ValueError("Value Error"),
            RuntimeError("Runtime Error")
        ]
        
        with patch.object(brain.emotional_processor, 'analyze_sentiment') as mock_analyze:
            # Simulate series of errors then success
            mock_analyze.side_effect = error_types + [
                {'sentiment': {'label': 'NEUTRAL', 'score': 0.5},
                 'emotional_state': {'valence': 0, 'arousal': 0, 'dominance': 0}}
            ]
            
            result = await brain.process_command("Test command")
            
            # Should eventually succeed
            assert result['success']
            assert mock_analyze.call_count == len(error_types) + 1
            
            # Check error tracking
            error_count = brain.error_tracker.get_error_count('emotional_processor')
            assert error_count == len(error_types)
            
    async def test_10_memory_persistence(self, brain):
        """Test memory persistence across interactions."""
        # Store multiple memories
        commands = [
            "My favorite color is blue",
            "I enjoy programming",
            "Python is my preferred language"
        ]
        
        for cmd in commands:
            await brain.process_command(cmd)
            
        # Query semantic memory
        programming_concepts = await brain.semantic_memory.get_related_concepts("programming")
        assert len(programming_concepts) > 0
        assert any('python' in str(c).lower() for c in programming_concepts)
        
        # Check emotional context is preserved
        state = await brain.emotional_memory.get_current_state()
        assert state.valence >= 0  # Should be neutral or positive
        
        # Verify episodic sequence
        episodes = await brain.episodic_memory.get_recent_episodes(3)
        assert len(episodes) == 3
        assert all(cmd in str(episodes) for cmd in commands)
