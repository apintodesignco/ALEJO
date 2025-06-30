import unittest
from unittest.mock import MagicMock, patch
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.utils.error_handling import ErrorTracker

class TestMultimedia(unittest.TestCase):
    """Test multimedia processing capabilities in ALEJOBrain"""
    
    def setUp(self):
        self.error_tracker = ErrorTracker(config={"test_mode": True})
        patcher = patch('alejo.utils.error_handling.get_error_tracker', return_value=self.error_tracker)
        self.addCleanup(patcher.stop)
        patcher.start()
        
        self.brain = ALEJOBrain(config={"test_mode": True})
        
    def test_basic_image_analysis(self):
        """Test basic image analysis"""
        dummy_image = b"dummy_image_data"
        response = self.brain.process_image(dummy_image, analysis_type='basic')
        self.assertTrue(isinstance(response, str))
        self.assertNotEqual(response, "")
        
    def test_detailed_image_analysis(self):
        """Test detailed image analysis"""
        dummy_image = b"dummy_image_data"
        response = self.brain.process_image(dummy_image, analysis_type='detailed')
        self.assertTrue(isinstance(response, str))
        self.assertNotEqual(response, "")
        
    def test_object_detection_analysis(self):
        """Test object detection in image analysis"""
        dummy_image = b"dummy_image_data"
        response = self.brain.process_image(dummy_image, analysis_type='object_detection')
        self.assertTrue(isinstance(response, str))
        self.assertNotEqual(response, "")
        
if __name__ == '__main__':
    unittest.main(verbosity=2)
