"""
Unit tests for voice service proactive prompt functionality
"""
import unittest
from unittest.mock import Mock, patch, MagicMock
import asyncio

from alejo.voice import VoiceService
from alejo.core.event_bus import Event, EventType

class TestProactiveVoice(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        """Set up test case"""
        self.brain = Mock()
        self.config = {}
        self.event_bus = Mock()
        self.voice_service = VoiceService(
            self.brain,
            self.config,
            event_bus=self.event_bus
        )
        # Mock voice manager to prevent actual TTS
        self.voice_service.voice_manager = Mock()

    async def asyncTearDown(self):
        """Clean up after test"""
        if self.voice_service:
            self.voice_service.stop()

    async def test_event_subscription(self):
        """Test subscription to proactive prompt events"""
        # Mock the event bus subscribe method
        self.event_bus.subscribe = Mock()
        
        # Create new voice service to trigger subscription
        voice_service = VoiceService(
            self.brain,
            self.config,
            event_bus=self.event_bus
        )
        
        # Allow time for async subscription
        await asyncio.sleep(0.1)
        
        # Verify subscribe was called with correct arguments
        self.event_bus.subscribe.assert_called_once_with(
            EventType.PROACTIVE_PROMPT,
            voice_service._handle_proactive_prompt
        )

    async def test_handle_proactive_prompt(self):
        """Test handling of proactive prompt events"""
        # Create mock event
        event = MagicMock()
        event.data = {
            'text': 'Test prompt',
            'prompt_type': 'empathy',
            'rationale': 'Testing voice'
        }
        
        # Mock the speak method
        self.voice_service.speak = Mock()
        
        # Call event handler
        self.voice_service._handle_proactive_prompt(event)
        
        # Verify speak was called with event text
        self.voice_service.speak.assert_called_once_with('Test prompt')

    @patch('alejo.voice.VoiceManager')
    async def test_speak_proactive_prompt(self, mock_voice_manager):
        """Test speaking a proactive prompt"""
        # Set up mock voice manager
        mock_voice_output = Mock()
        mock_voice_manager.return_value.voice_output = mock_voice_output
        
        # Create voice service with mock manager
        voice_service = VoiceService(
            self.brain,
            self.config,
            event_bus=self.event_bus
        )
        
        # Create and handle test event
        event = MagicMock()
        event.data = {
            'text': 'Test prompt',
            'prompt_type': 'curiosity',
            'rationale': 'Testing voice output'
        }
        
        voice_service._handle_proactive_prompt(event)
        
        # Verify voice output was called
        mock_voice_output.speak.assert_called_once_with('Test prompt')

    async def test_no_event_bus(self):
        """Test voice service works without event bus"""
        # Create voice service without event bus
        voice_service = VoiceService(self.brain, self.config)
        
        # Verify service initialized correctly
        self.assertIsNone(voice_service.event_bus)
        self.assertTrue(hasattr(voice_service, 'voice_manager'))

if __name__ == '__main__':
    unittest.main()
