"""
Tests for ALEJO's ethical framework.
"""

import asyncio
import secrets  # More secure for cryptographic purposes
from datetime import datetime
from unittest.mock import MagicMock, patch, AsyncMock

import pytest
from alejo.cognitive.ethical.framework import EthicalFramework
from alejo.cognitive.ethical.value_system import ValueSystem, Value, ValuePriority, ValueCategory
from alejo.cognitive.ethical.principles import EthicalPrinciple, PrincipleCategory
from alejo.cognitive.ethical.decisions import EthicalDecision, Alternative, DecisionImpact
from alejo.core.events import Event, EventType


class TestEthicalFramework:
    """Tests for EthicalFramework class."""

    @pytest.fixture
    async def event_bus(self):
        """Create a mock event bus for testing."""
        mock_event_bus = MagicMock()
        mock_event_bus.publish = AsyncMock()
        mock_event_bus.subscribe = AsyncMock()
        return mock_event_bus
        
    @pytest.fixture
    async def framework(self, event_bus):
        """Create EthicalFramework instance for testing."""
        framework = EthicalFramework(event_bus)
        await framework.initialize()
        return framework

    async def test_01_value_system_initialization(self, framework):
        """Test value system initialization."""
        # Get all values
        values = await framework.value_system.get_all_values()
        
        # Check core values exist
        value_names = [v.name.lower() for v in values]
        assert "privacy" in value_names
        assert "autonomy" in value_names
        assert "transparency" in value_names
        assert "non-maleficence" in value_names or "non maleficence" in value_names
        assert "beneficence" in value_names
        assert "justice" in value_names
        assert "reliability" in value_names
        
        # Check value priorities
        for value in values:
            assert hasattr(value, 'priority')
            assert value.priority is not None

    async def test_02_action_evaluation(self, framework):
        """Test ethical evaluation of actions."""
        # Test beneficial action
        action = {
            "name": "provide_help",
            "description": "Offer relevant information to user question",
            "impacts": {
                "user_privacy": DecisionImpact.NEUTRAL,
                "user_autonomy": DecisionImpact.MEDIUM_POSITIVE,
                "user_wellbeing": DecisionImpact.HIGH_POSITIVE
            },
            "metadata": {"privacy_impact": "none"}
        }

        result = await framework.evaluate_action(action, {})
        assert "evaluations" in result
        assert "decision_id" in result
        assert "alternative_id" in result
        
        # At least some principles should have high scores
        scores = list(result["evaluations"].values())
        assert any(score > 0.7 for score in scores)

        # Test harmful action
        action = {
            "name": "share_data",
            "description": "Share user data without consent",
            "impacts": {
                "user_privacy": DecisionImpact.HIGH_NEGATIVE,
                "user_autonomy": DecisionImpact.MEDIUM_NEGATIVE,
                "user_wellbeing": DecisionImpact.LOW_NEGATIVE
            },
            "metadata": {"privacy_impact": "high"}
        }

        result = await framework.evaluate_action(action, {})
        
        # Check compliance
        compliance = await framework.check_ethical_compliance(action)
        assert compliance["compliant"] is False

    async def test_03_decision_making(self, framework):
        """Test ethical decision making."""
        alternatives = [
            {
                "name": "provide_help",
                "description": "Offer direct help",
                "impacts": {
                    "user_privacy": DecisionImpact.NEUTRAL,
                    "user_autonomy": DecisionImpact.MEDIUM_POSITIVE,
                    "user_wellbeing": DecisionImpact.HIGH_POSITIVE
                }
            },
            {
                "name": "defer",
                "description": "Defer to human expert",
                "impacts": {
                    "user_privacy": DecisionImpact.NEUTRAL,
                    "user_autonomy": DecisionImpact.LOW_POSITIVE,
                    "user_wellbeing": DecisionImpact.NEUTRAL
                }
            },
            {
                "name": "ignore",
                "description": "Ignore request",
                "impacts": {
                    "user_privacy": DecisionImpact.NEUTRAL,
                    "user_autonomy": DecisionImpact.MEDIUM_NEGATIVE,
                    "user_wellbeing": DecisionImpact.HIGH_NEGATIVE
                }
            },
        ]

        context = {"user_request": "help with a task"}
        result = await framework.make_ethical_decision(context, alternatives)

        # Verify we got a result with the expected structure
        assert "decision_id" in result
        assert "selected_alternative" in result
        assert "alternatives" in result
        assert "evaluations" in result
        assert "rationale" in result
        
        # The selected alternative should be one of our alternatives
        selected = result["selected_alternative"]
        assert selected is not None
        assert selected["name"] in ["provide_help", "defer", "ignore"]
        
        # The highest scoring alternative should be "provide_help" given our impacts
        assert selected["name"] == "provide_help"

    async def test_04_feedback_learning(self, framework):
        """Test learning from feedback."""
        # Make initial decision
        options = [{"id": "option1", "type": "help", "description": "Provide help"}]

        decision = await framework.make_decision(options, {})
        initial_priorities = framework.value_system.priorities.copy()

        # Provide feedback
        feedback = {
            "overall_rating": 0.9,
            "principle_feedback": {"beneficence": 0.8, "autonomy": 0.7},
        }

        await framework.learn_from_feedback(decision.id, feedback)

        # Check priorities were updated
        assert framework.value_system.priorities != initial_priorities
        assert decision.feedback == feedback

    async def test_05_constraint_handling(self, framework):
        """Test ethical constraint enforcement."""
        # Test action violating privacy
        action = {
            "type": "data_access",
            "description": "Access sensitive user data",
            "authorization": None,
        }

        result = await framework.evaluate_action(action, {})
        assert not result["approved"]
        assert any("privacy" in v["principle"] for v in result["violations"])

    async def test_06_event_handling(self, framework, event_bus):
        """Test event handling capabilities."""
        options = [{"id": "option1", "type": "help", "description": "Provide help"}]

        # Test decision event
        event = Event(
            type=EventType.DECISION,
            source="command_processor",
            payload={"options": options, "context": {"user_request": "help"}},
        )

        await event_bus.publish(event)
        await asyncio.sleep(0.1)  # Allow event processing

        # Verify decision was made
        assert len(framework.decisions) > 0

    async def test_07_principle_relationships(self, framework):
        """Test principle relationship handling."""
        # Get related principles
        related = framework.value_system.relationships["beneficence"]

        # Verify relationships are meaningful
        assert "non_maleficence" in related  # These principles should be related

        # Test principle scoring considers relationships
        action = {"type": "help", "description": "Provide help while ensuring no harm"}

        result = await framework.evaluate_action(action, {})

        # Both beneficence and non_maleficence should score well
        assert result["principle_scores"]["beneficence"] > 0.7
        assert result["principle_scores"]["non_maleficence"] > 0.7
