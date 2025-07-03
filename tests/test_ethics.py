"""
Unit tests for the Ethical Framework module.

Tests the functionality of the ethical decision making and emotional response
evaluation capabilities of the EthicalFramework class.
"""

import json
import os
import tempfile
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from alejo.emotional_intelligence.ethics import \
    secrets  # More secure for cryptographic purposes
from alejo.emotional_intelligence.ethics import (EmotionalEthicsEvaluation,
                                                 EmotionalRisk,
                                                 EmotionalRiskLevel,
                                                 EthicalDecision,
                                                 EthicalFramework,
                                                 EthicalPrinciple, lazy_import)


class TestEthicalFramework(unittest.TestCase):
    """Test cases for the EthicalFramework class."""

    def setUp(self):
        """Set up test fixtures."""
        self.framework = EthicalFramework()
        # Create a temporary database file for testing
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.temp_db.close()
        self.framework.initialize_database(self.temp_db.name)
        
        # Sample emotional state and context for testing
        self.emotional_state = {
            "joy": 0.8,
            "trust": 0.7,
            "anticipation": 0.5,
            "surprise": 0.2,
            "anger": 0.1,
            "fear": 0.0,
            "disgust": 0.0,
            "sadness": 0.1
        }
        
        self.context = {
            "user_id": "test_user",
            "interaction_type": "conversation",
            "topic": "general assistance",
            "user_emotional_state": {"calm": 0.8, "interested": 0.7},
            "cultural_context": {"region": "global", "sensitivity_level": "standard"},
            "previous_interactions": 5,
            "relationship_duration": "2 days"
        }

    def tearDown(self):
        """Tear down test fixtures."""
        # Remove the temporary database file
        if os.path.exists(self.temp_db.name):
            os.unlink(self.temp_db.name)

    def test_initialization(self):
        """Test that the framework initializes correctly."""
        self.assertIsNotNone(self.framework.principles)
        self.assertIsNotNone(self.framework.emotional_risk_patterns)
        self.assertEqual(len(self.framework.decision_history), 0)
        self.assertEqual(len(self.framework.emotional_ethics_history), 0)
        self.assertIsNotNone(self.framework.db_path)

    def test_evaluate_emotional_ethics(self):
        """Test the evaluation of emotional ethics."""
        evaluation = self.framework.evaluate_emotional_ethics(
            self.emotional_state, self.context
        )
        
        # Verify the evaluation structure
        self.assertIsInstance(evaluation, EmotionalEthicsEvaluation)
        self.assertEqual(evaluation.emotional_state, self.emotional_state)
        self.assertEqual(evaluation.context, self.context)
        self.assertIsNotNone(evaluation.principles_evaluation)
        self.assertIsInstance(evaluation.overall_ethical_score, float)
        self.assertGreaterEqual(evaluation.overall_ethical_score, 0.0)
        self.assertLessEqual(evaluation.overall_ethical_score, 1.0)
        self.assertIsNotNone(evaluation.recommendations)
        self.assertIsNotNone(evaluation.transparency_report)
        
        # Verify it was added to history
        self.assertEqual(len(self.framework.emotional_ethics_history), 1)
        self.assertEqual(self.framework.emotional_ethics_history[0], evaluation)

    def test_detect_risk(self):
        """Test risk detection in emotional responses."""
        # Test with a high-risk emotional state (high anger)
        high_risk_state = {
            "joy": 0.1,
            "trust": 0.1,
            "anticipation": 0.2,
            "surprise": 0.1,
            "anger": 0.9,  # High anger
            "fear": 0.1,
            "disgust": 0.7,  # High disgust
            "sadness": 0.1
        }
        
        # Define a risk pattern for testing
        risk_info = {
            "description": "High anger risk",
            "level": EmotionalRiskLevel.HIGH,
            "affected_principles": [EthicalPrinciple.NON_MALEFICENCE, EthicalPrinciple.EMOTIONAL_RESPECT],
            "triggers": {
                "emotions": {"anger": 0.7},  # Trigger if anger > 0.7
                "patterns": []
            },
            "mitigation": "Reduce anger expression"
        }
        
        # Test with high-risk state
        risk = self.framework._detect_risk(high_risk_state, self.context, risk_info)
        self.assertIsNotNone(risk)
        self.assertIsInstance(risk, EmotionalRisk)
        self.assertEqual(risk.level, EmotionalRiskLevel.HIGH)
        
        # Test with low-risk state
        risk = self.framework._detect_risk(self.emotional_state, self.context, risk_info)
        self.assertIsNone(risk)  # Should not detect risk in our normal emotional state

    def test_evaluate_principle(self):
        """Test the evaluation of ethical principles."""
        # Test each principle
        for principle in EthicalPrinciple:
            score = self.framework._evaluate_principle(
                principle, self.emotional_state, self.context
            )
            self.assertIsInstance(score, float)
            self.assertGreaterEqual(score, 0.0)
            self.assertLessEqual(score, 1.0)
        
        # Test with a problematic emotional state for specific principles
        problematic_state = {
            "joy": 0.1,
            "trust": 0.1,
            "anger": 0.9,
            "disgust": 0.8
        }
        
        # Non-maleficence should score lower with high anger
        score_normal = self.framework._evaluate_principle(
            EthicalPrinciple.NON_MALEFICENCE, self.emotional_state, self.context
        )
        score_problematic = self.framework._evaluate_principle(
            EthicalPrinciple.NON_MALEFICENCE, problematic_state, self.context
        )
        
        # The problematic state should score lower
        self.assertLess(score_problematic, score_normal)

    def test_evaluate_decision(self):
        """Test the evaluation of ethical decisions."""
        # Test a benign action
        benign_decision = self.framework.evaluate_decision(
            "provide helpful information",
            {"user_request": "factual information", "user_choice": True},
            self.emotional_state
        )
        
        self.assertIsInstance(benign_decision, EthicalDecision)
        self.assertGreaterEqual(benign_decision.overall_score, 0.7)  # Should score well
        
        # Test a potentially problematic action
        problematic_decision = self.framework.evaluate_decision(
            "delete user data without confirmation",
            {"user_data": True},
            {"anger": 0.8, "disgust": 0.7}
        )
        
        self.assertIsInstance(problematic_decision, EthicalDecision)
        self.assertLess(problematic_decision.overall_score, 0.7)  # Should score poorly
        
        # Verify decisions were added to history
        self.assertEqual(len(self.framework.decision_history), 2)

    def test_evaluate_emotional_response(self):
        """Test the evaluation of emotional responses."""
        # Test a balanced response
        balanced_response = self.framework.evaluate_emotional_response(
            "I'm happy to help you with that request.",
            self.emotional_state,
            self.context
        )
        
        self.assertIsInstance(balanced_response, dict)
        self.assertIn("ethical_score", balanced_response)
        self.assertGreaterEqual(balanced_response["ethical_score"], 0.7)  # Should score well
        
        # Test a manipulative response
        manipulative_response = self.framework.evaluate_emotional_response(
            "You must always follow my advice or you will never succeed.",
            {"joy": 0.3, "trust": 0.3, "fear": 0.7, "anger": 0.5},
            self.context
        )
        
        self.assertIsInstance(manipulative_response, dict)
        self.assertIn("risks", manipulative_response)
        # Should detect manipulative language
        manipulative_detected = any(
            risk["type"] == "manipulative_language" 
            for risk in manipulative_response["risks"]
        )
        self.assertTrue(manipulative_detected)

    def test_database_operations(self):
        """Test database operations."""
        # Create some evaluations and decisions
        self.framework.evaluate_emotional_ethics(self.emotional_state, self.context)
        self.framework.evaluate_decision("test action", {"test": "context"})
        
        # Test retrieving recent decisions
        decisions = self.framework.get_recent_decisions(10)
        self.assertEqual(len(decisions), 1)
        
        # Test retrieving recent evaluations
        evaluations = self.framework.get_recent_evaluations(10)
        self.assertEqual(len(evaluations), 1)

    def test_export_functions(self):
        """Test export functionality."""
        # Create some history
        self.framework.evaluate_emotional_ethics(self.emotional_state, self.context)
        self.framework.evaluate_decision("test action", {"test": "context"})
        
        # Test exporting decision history
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as temp_file:
            result = self.framework.export_decision_history(temp_file.name)
            self.assertTrue(result)
            
            # Verify the file contains valid JSON
            with open(temp_file.name, 'r') as f:
                data = json.load(f)
                self.assertEqual(len(data), 1)
            
            # Clean up
            os.unlink(temp_file.name)
        
        # Test exporting ethics evaluation history
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as temp_file:
            result = self.framework.export_ethics_evaluation_history(temp_file.name)
            self.assertTrue(result)
            
            # Verify the file contains valid JSON
            with open(temp_file.name, 'r') as f:
                data = json.load(f)
                self.assertEqual(len(data), 1)
            
            # Clean up
            os.unlink(temp_file.name)

    def test_get_ethical_principle_stats(self):
        """Test getting statistics on ethical principles."""
        # Create some decisions with principle evaluations
        self.framework.evaluate_decision("action1", {"context": "test"})
        self.framework.evaluate_decision("action2", {"context": "test"})
        
        # Get stats
        stats = self.framework.get_ethical_principle_stats()
        
        # Verify stats structure
        self.assertIsInstance(stats, dict)
        for principle, principle_stats in stats.items():
            self.assertIn("count", principle_stats)
            self.assertIn("min", principle_stats)
            self.assertIn("max", principle_stats)
            self.assertIn("avg", principle_stats)


if __name__ == '__main__':
    unittest.main()