"""
Unit tests for UI proactive prompt functionality
"""
import unittest
from unittest.mock import Mock, patch, MagicMock
from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import QApplication
import sys

from alejo.ui.pyside_ui import HolographicUIPySide, HolographicWidget
from alejo.core.event_bus import Event, EventType

class TestProactiveUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Create QApplication instance"""
        if not QApplication.instance():
            cls.app = QApplication(sys.argv)
        else:
            cls.app = QApplication.instance()

    def setUp(self):
        """Set up test case"""
        self.event_bus = Mock()
        self.config = {}
        self.ui = HolographicUIPySide(self.config, self.event_bus)

    def tearDown(self):
        """Clean up after test"""
        self.ui.close()

    def test_show_proactive_prompt(self):
        """Test showing a proactive prompt in the UI"""
        test_text = "How are you feeling?"
        test_type = "empathy"
        
        # Call show_proactive_prompt
        self.ui.show_proactive_prompt(test_text, test_type)
        
        # Verify widget state
        self.assertEqual(
            self.ui.central_widget.proactive_prompt_text,
            test_text
        )
        self.assertEqual(
            self.ui.central_widget.proactive_prompt_type,
            test_type
        )
        self.assertIsNotNone(self.ui.central_widget.proactive_prompt_timer)

    def test_prompt_auto_clear(self):
        """Test that prompts auto-clear after duration"""
        test_text = "Would you like to learn more?"
        self.ui.show_proactive_prompt(test_text, "curiosity", duration_ms=100)
        
        # Verify prompt is shown
        self.assertEqual(
            self.ui.central_widget.proactive_prompt_text,
            test_text
        )
        
        # Wait for timer
        QTimer.singleShot(200, self.app.quit)
        self.app.exec()
        
        # Verify prompt is cleared
        self.assertIsNone(self.ui.central_widget.proactive_prompt_text)
        self.assertIsNone(self.ui.central_widget.proactive_prompt_type)

    @patch('alejo.ui.pyside_ui.HolographicWidget.update')
    def test_event_handler(self, mock_update):
        """Test handling of proactive prompt events"""
        # Create mock event
        event = MagicMock()
        event.data = {
            'text': 'Test prompt',
            'prompt_type': 'empathy',
            'rationale': 'Testing events'
        }
        
        # Call event handler
        self.ui._handle_proactive_prompt(event)
        
        # Verify prompt was shown
        self.assertEqual(
            self.ui.central_widget.proactive_prompt_text,
            'Test prompt'
        )
        self.assertEqual(
            self.ui.central_widget.proactive_prompt_type,
            'empathy'
        )
        mock_update.assert_called_once()

    def test_event_subscription(self):
        """Test subscription to proactive prompt events"""
        # Mock the event bus subscribe method
        async def mock_subscribe(event_type, handler):
            self.assertEqual(event_type, EventType.PROACTIVE_PROMPT)
            self.assertEqual(handler, self.ui._handle_proactive_prompt)
        
        self.event_bus.subscribe = mock_subscribe
        
        # Create new UI instance to trigger subscription
        ui = HolographicUIPySide(self.config, self.event_bus)
        
        # Verify subscribe was called
        self.event_bus.subscribe.assert_called_once()

if __name__ == '__main__':
    unittest.main()
