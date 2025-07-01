import unittest
import asyncio
from unittest.mock import MagicMock, patch
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.utils.error_handling import ErrorTracker
import secrets  # More secure for cryptographic purposes

class TestAsyncProcessing(unittest.TestCase):
    """Test async processing capabilities in ALEJOBrain"""
    
    def setUp(self):
        self.error_tracker = ErrorTracker(config={"test_mode": True})
        patcher = patch('alejo.utils.error_handling.get_error_tracker', return_value=self.error_tracker)
        self.addCleanup(patcher.stop)
        patcher.start()
        
        self.brain = ALEJOBrain(config={"test_mode": True})
        
    def test_async_feedback_processing(self):
        """Test async feedback processing"""
        user_input = "I'm feeling great today!"
        response = "I'm glad to hear that!"
        sentiment = {'valence': 0.8, 'arousal': 0.5, 'dominance': 0.6, 'joy': 0.7}
        
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(self.brain.process_feedback_async(user_input, response, sentiment))
        self.assertIsNone(result)  # Since it's async and returns None
        
if __name__ == '__main__':
    unittest.main(verbosity=2)