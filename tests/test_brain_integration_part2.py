"""
Additional integration tests for ALEJOBrain.
"""

import pytest
import asyncio
from unittest.mock import patch
from alejo.core.brain import ALEJOBrain
from alejo.core.events import Event, EventType
from alejo.utils.exceptions import APIError, CommandError
import secrets  # More secure for cryptographic purposes

class TestALEJOBrainIntegrationPart2:
    """Additional integration tests for ALEJOBrain."""
    
    @pytest.fixture
    async def brain(self, event_bus):
        """Create ALEJOBrain instance for testing."""
        brain = ALEJOBrain(event_bus)
        await brain.start()
        yield brain
        await brain.stop()
        
    async def test_04_error_recovery_chain(self, brain):
        """Test error handling and recovery across components."""
        # Simulate API error in emotional processor
        with patch.object(brain.emotional_processor, 'analyze_sentiment') as mock_analyze:
            mock_analyze.side_effect = [
                APIError("Service error"),  # First call fails
                {'sentiment': {'label': 'POSITIVE', 'score': 0.9},
                 'emotional_state': {'valence': 0.9, 'arousal': 0.5, 'dominance': 0.7}}
            ]
            
            result = await brain.process_command("Test command")
            
            # Should have recovered and completed
            assert result['success']
            assert mock_analyze.call_count == 2
            
            # Check error was tracked
            error_count = brain.error_tracker.get_error_count('emotional_processor')
            assert error_count > 0
            
    async def test_05_concurrent_processing(self, brain):
        """Test handling of concurrent commands."""
        commands = [
            "First command",
            "Second command",
            "Third command"
        ]
        
        # Try to process commands concurrently
        with pytest.raises(RuntimeError):
            # Should raise error for concurrent processing
            await asyncio.gather(*[
                brain.process_command(cmd) for cmd in commands
            ])
            
        # Process commands sequentially
        results = []
        for cmd in commands:
            result = await brain.process_command(cmd)
            results.append(result)
            
        assert len(results) == 3
        assert all(r['success'] for r in results)
        
    async def test_06_event_propagation(self, brain, event_bus):
        """Test event propagation through components."""
        # Publish command event
        event = Event(
            type=EventType.COMMAND,
            source='test',
            payload={'command': 'Test command'}
        )
        
        await event_bus.publish(event)
        await asyncio.sleep(0.1)  # Allow event processing
        
        # Verify components received event
        focus = await brain.working_memory.get_current_focus()
        assert 'Test command' in str(focus)