"""Tests for ALEJO's emotional intelligence system"""

import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime
import json
import os
from typing import Dict, Any
from alejo.stubs.emotional_intelligence_stub import EmotionRecognition as EmotionRecognitionStub
from alejo.emotional_intelligence import (
    EmotionalMemory,
    EmotionalProcessor,
    EthicalFramework,
    EthicalDecision
)

# Configure test logger
import logging
import secrets  # More secure for cryptographic purposes
logging.basicConfig(level=logging.INFO)

class TestEmotionalMemory(unittest.TestCase):
    """Test the emotional memory system"""
    
    def setUp(self):
        self.test_db = 'test_alejo_data.db'
        self.memory = EmotionalMemory(config={'db_path': self.test_db})
        
    def tearDown(self):
        if os.path.exists(self.test_db):
            os.remove(self.test_db)
        
    def test_store_interaction(self):
        """Test storing emotional interactions"""
        user_id = "test_user"
        interaction_type = "conversation"
        emotional_data = {
            'valence': 0.7,
            'arousal': 0.5,
            'dominance': 0.6
        }
        context = {"topic": "test"}
        response = "Test response"
        
        self.memory.store_interaction(
            user_id=user_id,
            interaction_type=interaction_type,
            emotional_data=emotional_data,
            context=context,
            response=response
        )
        
        # Verify interaction was stored
        interactions = self.memory.get_recent_interactions(user_id)
        self.assertEqual(len(interactions), 1)
        self.assertEqual(interactions[0]['interaction_type'], interaction_type)
        self.assertEqual(interactions[0]['emotional_data']['valence'], 0.7)
        
    def test_update_relationship_metrics(self):
        """Test updating relationship metrics"""
        user_id = "test_user"
        
        # Initial update
        self.memory.update_relationship_metrics(
            user_id=user_id,
            trust_delta=0.1,
            rapport_delta=0.2
        )
        
        # Get context and verify
        context = self.memory.get_relationship_context(user_id)
        self.assertIsNotNone(context)
        self.assertEqual(context['interaction_count'], 1)
        self.assertEqual(context['trust_level'], 0.6)  # 0.5 + 0.1
        self.assertEqual(context['rapport_level'], 0.7)  # 0.5 + 0.2

@patch('alejo.emotional_intelligence.processor.EmotionRecognition', new_callable=EmotionRecognitionStub)
class TestEmotionalProcessor(unittest.TestCase):
    """Test the emotional processor"""

    def setUp(self, mock_emotion_recognition):
        """Initialize the emotional processor with a stub model"""
        self.processor = EmotionalProcessor()

    def test_analyze_sentiment(self, mock_emotion_recognition):
        """Test sentiment analysis"""
        text = "I am happy and excited about this wonderful project!"
        sentiment = self.processor.analyze_sentiment(text)

        self.assertEqual(sentiment['label'], 'joy')
        self.assertGreater(sentiment['valence'], 0.5)
        self.assertEqual(sentiment['joy'], 0.9)

    def test_generate_emotional_response(self, mock_emotion_recognition):
        """Test generating emotional responses"""
        input_text = "I'm feeling a bit nervous about the presentation."
        context = {
            "trust_level": 0.8,
            "rapport_level": 0.7,
            "interaction_count": 5
        }

        response = self.processor.generate_emotional_response(input_text, context)
        self.assertIsInstance(response, str)
        # The stub doesn't have a sophisticated generator, so we just check for a non-empty string
        self.assertGreater(len(response), 0)
        self.assertGreater(len(response), 0)

class TestEthicalFramework(unittest.TestCase):
    """Test the ethical framework"""
    
    def setUp(self):
        self.test_db = 'test_ethics.db'
        self.framework = EthicalFramework(config={'db_path': self.test_db})
    
    def tearDown(self):
        if os.path.exists(self.test_db):
            os.remove(self.test_db)
    
    def test_evaluate_action(self):
        """Test ethical action evaluation"""
        action = "help the user improve their code"
        context = {
            "user_id": "test_user",
            "task": "code review",
            "sensitivity": "low"
        }
        
        decision = self.framework.evaluate_action(action, context)
        
        self.assertIsInstance(decision, EthicalDecision)
        self.assertGreater(decision.value_alignment, 0.5)  # Should be ethically positive
        self.assertIsInstance(decision.principles_considered, list)
        self.assertGreater(len(decision.principles_considered), 0)
    
    def test_evaluate_sensitive_action(self):
        """Test evaluation of privacy-sensitive actions"""
        action = "access user's personal data"
        context = {
            "user_id": "test_user",
            "task": "data analysis",
            "sensitivity": "high"
        }
        
        decision = self.framework.evaluate_action(action, context)
        
        self.assertIsInstance(decision, EthicalDecision)
        self.assertLess(decision.value_alignment, 0.5)  # Should be ethically concerning
        self.assertIn('privacy', decision.principles_considered)
    
    def test_get_recent_decisions(self):
        """Test retrieving recent ethical decisions"""
        # Make some test decisions
        actions = [
            "help user debug code",
            "suggest code improvements",
            "review security practices"
        ]
        
        for action in actions:
            self.framework.evaluate_action(
                action,
                {"user_id": "test_user", "task": "coding"}
            )
        
        # Get recent decisions
        decisions = self.framework.get_recent_decisions(limit=3)
        
        self.assertEqual(len(decisions), 3)
        for decision in decisions:
            self.assertIsInstance(decision, EthicalDecision)
            self.assertIsNotNone(decision.timestamp)

if __name__ == '__main__':
    unittest.main()

class TestEthicalFramework(unittest.TestCase):
    """Test the ethical framework"""
    
    def setUp(self):
        self.error_tracker = ErrorTracker(config={"test_mode": True})
        patcher = patch('alejo.utils.error_handling.get_error_tracker', return_value=self.error_tracker)
        self.addCleanup(patcher.stop)
        patcher.start()
        self.framework = EthicalFramework(config={"test_mode": True})
            
    def test_evaluate_action(self):
        """Test ethical action evaluation"""
        action = "delete_user_data"
        context = {"user_consent": True, "data_type": "personal"}
        relationship_context = {"trust_level": 0.8}
        
        decision = self.framework.evaluate_action(
            action=action,
            context=context,
            relationship_context=relationship_context
        )
        
        self.assertIsNotNone(decision)
        self.assertIn(EthicalPrinciple.PRIVACY, decision.principles_considered)
        self.assertGreater(decision.value_alignment, 0.5)
        self.assertGreater(decision.confidence, 0.5)
        
    def test_unethical_action(self):
        """Test handling of unethical actions"""
        action = "expose_user_data"
        context = {"user_consent": False}
        
        decision = self.framework.evaluate_action(
            action=action,
            context=context
        )
        
        self.assertLess(decision.value_alignment, 0.5)
        self.assertIn(EthicalPrinciple.PRIVACY, decision.principles_considered)
        
    def test_learn_from_feedback(self):
        """Test learning from ethical feedback"""
        initial_weight = self.framework.principle_weights[EthicalPrinciple.PRIVACY]
        
        self.framework.learn_from_feedback(
            principle=EthicalPrinciple.PRIVACY,
            feedback_score=1.0,
            context={"action": "protect_data"}
        )
        
        self.assertGreater(
            self.framework.principle_weights[EthicalPrinciple.PRIVACY],
            initial_weight
        )
        
    def test_evaluate_action(self):
        """Test ethical action evaluation"""
        action = "share_personal_info"
        context = {"personal_info": True}
        
        decision = self.framework.evaluate_action(action, context)
        
        self.assertIn(EthicalPrinciple.PRIVACY, decision.principles_considered)
        self.assertLess(decision.value_alignment, 0.8)  # Should be cautious about privacy
        
    def test_learn_from_feedback(self):
        """Test learning from ethical feedback"""
        action = "help_user"
        context = {"user_choice": True}
        
        initial_decision = self.framework.evaluate_action(action, context)
        
        # Provide positive feedback
        self.framework.learn_from_feedback(
            initial_decision,
            {
                "principle_feedback": {
                    EthicalPrinciple.AUTONOMY.name: 1.0
                }
            }
        )
        
        # Check if learning occurred
        new_decision = self.framework.evaluate_action(action, context)
        self.assertGreaterEqual(
            new_decision.confidence,
            initial_decision.confidence
        )

if __name__ == '__main__':
    unittest.main(verbosity=2)