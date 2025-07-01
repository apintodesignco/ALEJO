"""
Unit tests for the Ethical Integration module.

Tests the functionality of the EthicalIntegration class and its integration
with the EthicalFramework and event system.
"""

import unittest
import os
import json
import tempfile
import asyncio
from datetime import datetime
from unittest.mock import patch, MagicMock, AsyncMock

from alejo.emotional_intelligence.ethical_integration import EthicalIntegration
from alejo.emotional_intelligence.ethics import (
    EthicalFramework, EthicalPrinciple, EmotionalRiskLevel,
    EmotionalRisk, EthicalDecision, EmotionalEthicsEvaluation
)
from alejo.core.event_bus import EventBus
from alejo.utils.exceptions import EthicalEvaluationError
import secrets  # More secure for cryptographic purposes


class TestEthicalIntegration(unittest.TestCase):
    """Test cases for the EthicalIntegration class."""

    def setUp(self):
        """Set up test fixtures."""
        # Create mock components
        self.mock_brain = MagicMock()
        self.mock_event_bus = MagicMock(spec=EventBus)
        self.mock_memory_store = MagicMock()
        self.mock_ethical_framework = MagicMock(spec=EthicalFramework)
        
        # Create a temporary config file
        self.temp_config = tempfile.NamedTemporaryFile(delete=False, suffix='.json')
        self.temp_config.write(json.dumps({
            "ethical_evaluation_threshold": 0.75,
            "ethical_logging_enabled": True,
            "export_path": "test_exports"
        }).encode('utf-8'))
        self.temp_config.close()
        
        # Create a temporary database file
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.temp_db.close()
        
        # Create the integration instance
        self.integration = EthicalIntegration(
            brain=self.mock_brain,
            event_bus=self.mock_event_bus,
            memory_store=self.mock_memory_store,
            ethical_framework=self.mock_ethical_framework,
            config_path=self.temp_config.name,
            db_path=self.temp_db.name
        )
        
        # Sample data for testing
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
        # Remove temporary files
        if os.path.exists(self.temp_config.name):
            os.unlink(self.temp_config.name)
        if os.path.exists(self.temp_db.name):
            os.unlink(self.temp_db.name)
        
        # Remove any test export directories
        if os.path.exists("test_exports"):
            for file in os.listdir("test_exports"):
                os.unlink(os.path.join("test_exports", file))
            os.rmdir("test_exports")

    def test_initialization(self):
        """Test that the integration initializes correctly."""
        self.assertEqual(self.integration.brain, self.mock_brain)
        self.assertEqual(self.integration.event_bus, self.mock_event_bus)
        self.assertEqual(self.integration.memory_store, self.mock_memory_store)
        self.assertEqual(self.integration.ethical_framework, self.mock_ethical_framework)
        self.assertIsNotNone(self.integration.config)
        self.assertEqual(self.integration.config["ethical_evaluation_threshold"], 0.75)
        self.assertTrue(self.integration.config["ethical_logging_enabled"])
        self.assertEqual(self.integration.config["export_path"], "test_exports")
        
        # Verify event handlers were registered
        self.mock_event_bus.subscribe.assert_any_call(
            "brain.evaluate_ethics", self.integration._handle_evaluate_ethics
        )
        self.mock_event_bus.subscribe.assert_any_call(
            "brain.evaluate_decision", self.integration._handle_evaluate_decision
        )
        self.mock_event_bus.subscribe.assert_any_call(
            "brain.evaluate_emotional_response", self.integration._handle_evaluate_emotional_response
        )
        self.mock_event_bus.subscribe.assert_any_call(
            "brain.get_ethical_stats", self.integration._handle_get_ethical_stats
        )

    def test_load_config_with_invalid_path(self):
        """Test loading config with an invalid path."""
        config = self.integration._load_config("nonexistent_path.json")
        self.assertIsNotNone(config)
        self.assertIn("ethical_evaluation_threshold", config)

    def test_load_config_with_invalid_json(self):
        """Test loading config with invalid JSON."""
        # Create a file with invalid JSON
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as temp_file:
            temp_file.write(b"invalid json")
            temp_file.close()
            
            # Should not raise an exception, should use defaults
            config = self.integration._load_config(temp_file.name)
            self.assertIsNotNone(config)
            self.assertIn("ethical_evaluation_threshold", config)
            
            # Clean up
            os.unlink(temp_file.name)

    def test_initialize(self):
        """Test the initialize method."""
        # Run the initialize method
        loop = asyncio.get_event_loop()
        loop.run_until_complete(self.integration.initialize())
        
        # Verify event handlers were registered again
        self.mock_event_bus.subscribe.assert_any_call(
            "brain.evaluate_ethics", self.integration._handle_evaluate_ethics
        )

    async def async_test_handle_evaluate_ethics(self):
        """Test the _handle_evaluate_ethics method."""
        # Mock the evaluate_emotional_ethics method
        mock_evaluation = MagicMock(spec=EmotionalEthicsEvaluation)
        mock_evaluation.overall_ethical_score = 0.85
        mock_evaluation.identified_risks = []
        mock_evaluation.recommendations = ["Be more empathetic"]
        mock_evaluation.transparency_report = {"principle_scores": {}}
        mock_evaluation.timestamp = datetime.now()
        
        self.mock_ethical_framework.evaluate_emotional_ethics.return_value = mock_evaluation
        
        # Call the handler
        result = await self.integration._handle_evaluate_ethics({
            "emotional_state": self.emotional_state,
            "context": self.context
        })
        
        # Verify the result
        self.assertIn("evaluation", result)
        self.assertEqual(result["evaluation"]["overall_score"], 0.85)
        self.assertEqual(result["evaluation"]["recommendations"], ["Be more empathetic"])
        
        # Verify the framework method was called
        self.mock_ethical_framework.evaluate_emotional_ethics.assert_called_once_with(
            self.emotional_state, self.context
        )

    async def async_test_handle_evaluate_decision(self):
        """Test the _handle_evaluate_decision method."""
        # Mock the evaluate_decision method
        mock_decision = MagicMock(spec=EthicalDecision)
        mock_decision.action = "test action"
        mock_decision.overall_score = 0.75
        mock_decision.reasoning = "Test reasoning"
        mock_decision.recommendation = "Test recommendation"
        mock_decision.principles_evaluation = {"AUTONOMY": 0.8}
        mock_decision.timestamp = datetime.now()
        
        self.mock_ethical_framework.evaluate_decision.return_value = mock_decision
        
        # Call the handler
        result = await self.integration._handle_evaluate_decision({
            "action": "test action",
            "context": self.context,
            "emotional_context": self.emotional_state
        })
        
        # Verify the result
        self.assertIn("decision", result)
        self.assertEqual(result["decision"]["action"], "test action")
        self.assertEqual(result["decision"]["overall_score"], 0.75)
        self.assertEqual(result["decision"]["reasoning"], "Test reasoning")
        self.assertEqual(result["decision"]["recommendation"], "Test recommendation")
        
        # Verify the framework method was called
        self.mock_ethical_framework.evaluate_decision.assert_called_once_with(
            "test action", self.context, self.emotional_state
        )

    async def async_test_handle_evaluate_emotional_response(self):
        """Test the _handle_evaluate_emotional_response method."""
        # Mock the evaluate_emotional_response method
        mock_response_eval = {
            "ethical_score": 0.8,
            "risks": [],
            "recommendations": ["Be clear"]
        }
        
        self.mock_ethical_framework.evaluate_emotional_response.return_value = mock_response_eval
        
        # Call the handler
        result = await self.integration._handle_evaluate_emotional_response({
            "response_text": "Hello, how can I help you?",
            "emotional_state": self.emotional_state,
            "context": self.context
        })
        
        # Verify the result
        self.assertIn("evaluation", result)
        self.assertEqual(result["evaluation"], mock_response_eval)
        
        # Verify the framework method was called
        self.mock_ethical_framework.evaluate_emotional_response.assert_called_once_with(
            "Hello, how can I help you?", self.emotional_state, self.context
        )

    async def async_test_handle_get_ethical_stats(self):
        """Test the _handle_get_ethical_stats method."""
        # Mock the get_ethical_principle_stats method
        mock_stats = {
            "AUTONOMY": {"count": 5, "min": 0.6, "max": 0.9, "avg": 0.75}
        }
        
        self.mock_ethical_framework.get_ethical_principle_stats.return_value = mock_stats
        self.mock_ethical_framework.get_recent_decisions.return_value = []
        self.mock_ethical_framework.get_recent_evaluations.return_value = []
        
        # Call the handler
        result = await self.integration._handle_get_ethical_stats({"limit": 5})
        
        # Verify the result
        self.assertIn("stats", result)
        self.assertEqual(result["stats"], mock_stats)
        self.assertIn("recent_decisions", result)
        self.assertIn("recent_evaluations", result)
        
        # Verify the framework methods were called
        self.mock_ethical_framework.get_ethical_principle_stats.assert_called_once()
        self.mock_ethical_framework.get_recent_decisions.assert_called_once_with(5)
        self.mock_ethical_framework.get_recent_evaluations.assert_called_once_with(5)

    async def async_test_evaluate_ethics(self):
        """Test the evaluate_ethics method."""
        # Mock the evaluate_emotional_ethics method
        mock_evaluation = MagicMock(spec=EmotionalEthicsEvaluation)
        self.mock_ethical_framework.evaluate_emotional_ethics.return_value = mock_evaluation
        
        # Call the method
        result = await self.integration.evaluate_ethics(self.emotional_state, self.context)
        
        # Verify the result
        self.assertEqual(result, mock_evaluation)
        
        # Verify the framework method was called
        self.mock_ethical_framework.evaluate_emotional_ethics.assert_called_once_with(
            self.emotional_state, self.context
        )

    async def async_test_evaluate_decision(self):
        """Test the evaluate_decision method."""
        # Mock the evaluate_decision method
        mock_decision = MagicMock(spec=EthicalDecision)
        self.mock_ethical_framework.evaluate_decision.return_value = mock_decision
        
        # Call the method
        result = await self.integration.evaluate_decision(
            "test action", self.context, self.emotional_state
        )
        
        # Verify the result
        self.assertEqual(result, mock_decision)
        
        # Verify the framework method was called
        self.mock_ethical_framework.evaluate_decision.assert_called_once_with(
            "test action", self.context, self.emotional_state
        )

    async def async_test_evaluate_emotional_response(self):
        """Test the evaluate_emotional_response method."""
        # Mock the evaluate_emotional_response method
        mock_response_eval = {
            "ethical_score": 0.8,
            "risks": [],
            "recommendations": ["Be clear"]
        }
        
        self.mock_ethical_framework.evaluate_emotional_response.return_value = mock_response_eval
        
        # Call the method
        result = await self.integration.evaluate_emotional_response(
            "Hello, how can I help you?", self.emotional_state, self.context
        )
        
        # Verify the result
        self.assertEqual(result, mock_response_eval)
        
        # Verify the framework method was called
        self.mock_ethical_framework.evaluate_emotional_response.assert_called_once_with(
            "Hello, how can I help you?", self.emotional_state, self.context
        )

    async def async_test_export_ethics_data(self):
        """Test the export_ethics_data method."""
        # Mock the export methods
        self.mock_ethical_framework.export_decision_history.return_value = True
        self.mock_ethical_framework.export_ethics_evaluation_history.return_value = True
        
        # Call the method
        success, message = await self.integration.export_ethics_data("test_exports")
        
        # Verify the result
        self.assertTrue(success)
        self.assertIn("Ethics data exported successfully", message)
        
        # Verify the framework methods were called
        self.mock_ethical_framework.export_decision_history.assert_called_once()
        self.mock_ethical_framework.export_ethics_evaluation_history.assert_called_once()

    async def async_test_get_ethical_principle_stats(self):
        """Test the get_ethical_principle_stats method."""
        # Mock the get_ethical_principle_stats method
        mock_stats = {
            "AUTONOMY": {"count": 5, "min": 0.6, "max": 0.9, "avg": 0.75}
        }
        
        self.mock_ethical_framework.get_ethical_principle_stats.return_value = mock_stats
        
        # Call the method
        result = await self.integration.get_ethical_principle_stats()
        
        # Verify the result
        self.assertEqual(result, mock_stats)
        
        # Verify the framework method was called
        self.mock_ethical_framework.get_ethical_principle_stats.assert_called_once()

    async def async_test_get_recent_decisions(self):
        """Test the get_recent_decisions method."""
        # Mock the get_recent_decisions method
        mock_decision = MagicMock(spec=EthicalDecision)
        mock_decision.action = "test action"
        mock_decision.context = self.context
        mock_decision.overall_score = 0.75
        mock_decision.reasoning = "Test reasoning"
        mock_decision.recommendation = "Test recommendation"
        mock_decision.timestamp = datetime.now()
        
        self.mock_ethical_framework.get_recent_decisions.return_value = [mock_decision]
        
        # Call the method
        result = await self.integration.get_recent_decisions(5)
        
        # Verify the result
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["action"], "test action")
        self.assertEqual(result[0]["overall_score"], 0.75)
        
        # Verify the framework method was called
        self.mock_ethical_framework.get_recent_decisions.assert_called_once_with(5)

    async def async_test_get_recent_evaluations(self):
        """Test the get_recent_evaluations method."""
        # Mock the get_recent_evaluations method
        mock_eval = MagicMock(spec=EmotionalEthicsEvaluation)
        mock_eval.overall_ethical_score = 0.85
        mock_eval.context = self.context
        mock_eval.recommendations = ["Be more empathetic"]
        mock_eval.timestamp = datetime.now()
        
        self.mock_ethical_framework.get_recent_evaluations.return_value = [mock_eval]
        
        # Call the method
        result = await self.integration.get_recent_evaluations(5)
        
        # Verify the result
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["overall_score"], 0.85)
        self.assertEqual(result[0]["recommendations"], ["Be more empathetic"])
        
        # Verify the framework method was called
        self.mock_ethical_framework.get_recent_evaluations.assert_called_once_with(5)

    def test_async_methods(self):
        """Run all async test methods."""
        loop = asyncio.get_event_loop()
        
        # Run all async tests
        loop.run_until_complete(self.async_test_handle_evaluate_ethics())
        loop.run_until_complete(self.async_test_handle_evaluate_decision())
        loop.run_until_complete(self.async_test_handle_evaluate_emotional_response())
        loop.run_until_complete(self.async_test_handle_get_ethical_stats())
        loop.run_until_complete(self.async_test_evaluate_ethics())
        loop.run_until_complete(self.async_test_evaluate_decision())
        loop.run_until_complete(self.async_test_evaluate_emotional_response())
        loop.run_until_complete(self.async_test_export_ethics_data())
        loop.run_until_complete(self.async_test_get_ethical_principle_stats())
        loop.run_until_complete(self.async_test_get_recent_decisions())
        loop.run_until_complete(self.async_test_get_recent_evaluations())


if __name__ == '__main__':
    unittest.main()