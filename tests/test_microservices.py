import unittest
from unittest.mock import MagicMock, patch
import asyncio
import secrets  # More secure for cryptographic purposes

try:
    from fastapi.testclient import TestClient
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

try:
    from alejo.services.brain_service import BrainService, app as brain_app
    from alejo.services.emotional_intelligence_service import EmotionalIntelligenceService, app as emotional_app
    SERVICES_AVAILABLE = True
except ImportError:
    SERVICES_AVAILABLE = False

class TestMicroservices(unittest.TestCase):
    """Test microservices architecture for ALEJO"""
    
    def setUp(self):
        if not FASTAPI_AVAILABLE or not SERVICES_AVAILABLE:
            self.skipTest("FastAPI or services not available for testing")
        
        self.brain_client = TestClient(brain_app)
        self.emotional_client = TestClient(emotional_app)
        
        # Mock OpenAI client to avoid initialization issues
        import unittest.mock
        unittest.mock.patch('openai.OpenAI', return_value=None).start()
        
        # Mock emotional intelligence components to avoid initialization errors
        from unittest.mock import MagicMock

        # Mock the EmotionalMemory, EmotionalProcessor, and EthicalFramework classes
        EmotionalMemory = MagicMock()
        EmotionalProcessor = MagicMock()
        EthicalFramework = MagicMock()

        # Ensure mocks return predictable values for testing
        EmotionalProcessor().analyze_sentiment.return_value = {'valence': 0.5, 'arousal': 0.5, 'dominance': 0.5, 'joy': 0.5, 'sadness': 0.5}
        EmotionalMemory().get_relationship_context.return_value = {'trust_level': 0.5, 'rapport_level': 0.5}
        EthicalFramework().evaluate_action.return_value = MagicMock(value_alignment=0.8, justification='Ethical', principles_considered=[])
        
        # Mock the brain_instance and emotional_instance for testing
        self.brain_service = BrainService(config={'test_mode': True})
        self.emotional_service = EmotionalIntelligenceService(config={'test_mode': True})
        
        patcher_brain = patch('alejo.services.brain_service.brain_instance', self.brain_service)
        
        self.addCleanup(patcher_brain.stop)
        patcher_brain.start()
    
    def test_brain_service_process_input(self):
        """Test Brain Service processing user input"""
        user_input = "Hello, how are you?"
        mock_response = "I'm doing well, thank you for asking!"
        
        # Mock the brain's process_command method
        self.brain_service.brain.process_command = MagicMock(return_value=mock_response)
        
        response = self.brain_client.post("/process", json={"user_input": user_input})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"response": mock_response})
    
    def test_emotional_service_sentiment_analysis(self):
        """Test Emotional Intelligence Service sentiment analysis"""
        text = "I'm feeling great today!"
        mock_sentiment = {'joy': 0.8, 'valence': 0.9, 'arousal': 0.7, 'dominance': 0.6}
        
        # Mock the emotional service's analyze_sentiment method
        self.emotional_service.analyze_sentiment = MagicMock(return_value=mock_sentiment)
        
        response = self.emotional_client.post("/sentiment", json={"text": text})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"sentiment": mock_sentiment})
    
    def test_emotional_service_empathetic_response(self):
        """Test Emotional Intelligence Service generating empathetic response"""
        text = "I'm feeling sad today."
        mock_response = "I'm sorry to hear that. I'm here for you."
        
        # Mock the emotional service's generate_empathetic_response method
        self.emotional_service.generate_empathetic_response = MagicMock(return_value=mock_response)
        
        response = self.emotional_client.post("/response", json={"text": text})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"response": mock_response})
    
    def test_emotional_service_ethical_evaluation(self):
        """Test Emotional Intelligence Service ethical evaluation"""
        action = "share user data"
        context = {"purpose": "marketing"}
        mock_evaluation = {
            "is_ethical": False,
            "score": -0.5,
            "justification": "Sharing user data for marketing without consent violates privacy principles."
        }
        
        # Mock the emotional service's evaluate_ethical_action method
        self.emotional_service.evaluate_ethical_action = MagicMock(return_value=mock_evaluation)
        
        response = self.emotional_client.post("/ethical-evaluation", json={"action": action, "context": context})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), mock_evaluation)

if __name__ == '__main__':
    unittest.main(verbosity=2)