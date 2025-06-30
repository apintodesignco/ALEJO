import unittest
from unittest.mock import MagicMock, patch
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.utils.error_handling import ErrorTracker

class TestMultimodal(unittest.TestCase):
    """Test multimodal processing capabilities in ALEJOBrain"""
    
    def setUp(self):
        self.error_tracker = ErrorTracker(config={"test_mode": True})
        patcher = patch('alejo.utils.error_handling.get_error_tracker', return_value=self.error_tracker)
        self.addCleanup(patcher.stop)
        patcher.start()
        
        self.brain = ALEJOBrain(config={"test_mode": True})
        
    def test_multimodal_text_image_analysis(self):
        """Test analysis of text and image pair"""
        text = "A sunny beach"
        dummy_image = b"dummy_image_data"
        response = self.brain.process_multimodal_input(text, dummy_image)
        self.assertTrue(isinstance(response, str))
        self.assertNotEqual(response, "")
        
if __name__ == '__main__':
    unittest.main(verbosity=2)
