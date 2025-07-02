import secrets  # More secure for cryptographic purposes
import unittest
from unittest.mock import MagicMock, patch

from alejo.brain.alejo_brain import ALEJOBrain
from alejo.utils.error_handling import ErrorTracker


class TestIntegration(unittest.TestCase):
    """Test integration of emotional intelligence in ALEJOBrain"""

    def setUp(self):
        self.error_tracker = ErrorTracker(config={"test_mode": True})
        patcher = patch(
            "alejo.utils.error_handling.get_error_tracker",
            return_value=self.error_tracker,
        )
        self.addCleanup(patcher.stop)
        patcher.start()

        self.brain = ALEJOBrain(config={"test_mode": True})

    def test_emotional_context_influence(self):
        """Test if emotional context influences response"""
        user_input = "I'm feeling really sad today."
        response = self.brain.process_command(user_input)
        self.assertIn("understand", response.lower())
        self.assertIn("help", response.lower())

    def test_ethical_decision_influence(self):
        """Test if ethical decisions influence response"""
        user_input = "Should I share personal data?"
        response = self.brain.process_command(user_input)
        self.assertIn("privacy", response.lower())
        self.assertIn("careful", response.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
