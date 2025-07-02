"""
Integration tests for the Ethical Framework integration with ALEJO Brain
"""

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import secrets  # More secure for cryptographic purposes

from alejo.core.event_bus import EventBus
from alejo.database.memory_store import MemoryStore
from alejo.emotional_intelligence.ethics import EthicalDecision, EthicalFramework
from alejo.ethical.integration import EthicalIntegration


# Mock classes
class MockBrain:
    """Mock brain for testing"""

    def __init__(self):
        self.event_bus = MagicMock()
        self.memory_store = MagicMock()
        self.short_term_memory = []
        self.conversation_history = {}

    async def add_to_short_term_memory(self, entry):
        """Add to short-term memory"""
        self.short_term_memory.append(entry)
        return True


class MockEthicalFramework:
    """Mock ethical framework for testing"""

    def __init__(self):
        self.principles = {
            "beneficence": {
                "description": "Act in ways that benefit users and promote well-being",
                "weight": 1.0,
            },
            "non_maleficence": {
                "description": "Avoid causing harm to users or others",
                "weight": 1.0,
            },
            "privacy": {
                "description": "Protect user privacy and confidential information",
                "weight": 0.95,
            },
        }
        self.decisions = []

    def evaluate_action(self, action, context):
        """Mock ethical evaluation"""
        if "share" in action.lower() and "personal" in action.lower():
            decision = EthicalDecision(
                action=action,
                context=context,
                value_alignment=0.3,
                justification="Sharing personal information raises privacy concerns",
                principles_considered=["privacy", "autonomy"],
            )
        else:
            decision = EthicalDecision(
                action=action,
                context=context,
                value_alignment=0.9,
                justification="Action aligns with ethical principles",
                principles_considered=["beneficence", "autonomy"],
            )

        self.decisions.append(decision)
        return decision

    def update_principle_weight(self, principle, weight):
        """Update principle weight"""
        if principle not in self.principles:
            raise ValueError(f"Unknown principle: {principle}")

        self.principles[principle]["weight"] = weight

    def get_recent_decisions(self, limit=10):
        """Get recent decisions"""
        return self.decisions[:limit]


# Fixtures
@pytest.fixture
def temp_dir():
    """Create a temporary directory"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    # Clean up
    import shutil

    shutil.rmtree(temp_dir)


@pytest.fixture
def config_file(temp_dir):
    """Create a temporary config file"""
    config = {
        "evaluation_threshold": 0.8,
        "logging_enabled": True,
        "principles": {"beneficence": 0.9, "non_maleficence": 1.0, "autonomy": 0.8},
    }

    config_path = os.path.join(temp_dir, "ethical_config.json")
    with open(config_path, "w") as f:
        json.dump(config, f)

    return config_path


@pytest.fixture
def mock_brain():
    """Create a mock brain"""
    return MockBrain()


@pytest.fixture
def mock_ethical_framework():
    """Create a mock ethical framework"""
    return MockEthicalFramework()


@pytest.fixture
def ethical_integration(mock_brain, mock_ethical_framework):
    """Create an ethical integration with mocks"""
    return EthicalIntegration(
        brain=mock_brain,
        event_bus=mock_brain.event_bus,
        memory_store=mock_brain.memory_store,
        ethical_framework=mock_ethical_framework,
    )


# Tests
@pytest.mark.asyncio
async def test_initialization(config_file):
    """Test initialization of ethical integration"""
    # Test with config file
    with patch(
        "alejo.emotional_intelligence.ethics.EthicalFramework"
    ) as mock_framework_class:
        mock_framework = MagicMock()
        mock_framework_class.return_value = mock_framework

        # Create integration
        integration = EthicalIntegration(config_path=config_file)

        # Check that components were initialized
        assert mock_framework_class.called
        assert integration.ethical_framework == mock_framework

        # Check that config was loaded
        assert integration.config["evaluation_threshold"] == 0.8
        assert "principles" in integration.config


@pytest.mark.asyncio
async def test_evaluate_ethics(ethical_integration):
    """Test evaluating ethics"""
    # Test with ethical action
    result = await ethical_integration.evaluate_ethics(
        action="Help the user find information",
        context={"user_request": "information search"},
    )

    # Check result
    assert result["value_alignment"] > 0.8
    assert "principles_considered" in result
    assert len(result["principles_considered"]) > 0
    assert "recommendation" in result
    assert result["recommendation"] == "proceed"

    # Test with potentially unethical action
    result = await ethical_integration.evaluate_ethics(
        action="Share personal information about the user",
        context={"data_type": "personal"},
    )

    # Check result
    assert result["value_alignment"] < 0.5
    assert "privacy" in result["principles_considered"]
    assert "justification" in result
    assert "privacy concerns" in result["justification"].lower()
    assert "recommendation" in result
    assert result["recommendation"] == "reconsider"


@pytest.mark.asyncio
async def test_get_ethical_principles(ethical_integration, mock_ethical_framework):
    """Test getting ethical principles"""
    result = await ethical_integration.get_ethical_principles()

    # Check result
    assert "principles" in result
    assert "beneficence" in result["principles"]
    assert "non_maleficence" in result["principles"]
    assert "privacy" in result["principles"]
    assert result["principles"]["beneficence"]["weight"] == 1.0
    assert "description" in result["principles"]["beneficence"]


@pytest.mark.asyncio
async def test_update_ethical_principle(ethical_integration, mock_ethical_framework):
    """Test updating ethical principle"""
    # Test valid update
    result = await ethical_integration.update_ethical_principle(
        principle="beneficence", weight=0.8
    )

    # Check result
    assert result["success"] is True
    assert result["principle"] == "beneficence"
    assert result["weight"] == 0.8
    assert mock_ethical_framework.principles["beneficence"]["weight"] == 0.8

    # Test invalid weight
    result = await ethical_integration.update_ethical_principle(
        principle="beneficence", weight=1.5
    )

    # Check result
    assert result["success"] is False
    assert "error" in result

    # Test invalid principle
    with patch.object(
        mock_ethical_framework,
        "update_principle_weight",
        side_effect=ValueError("Unknown principle"),
    ):
        result = await ethical_integration.update_ethical_principle(
            principle="unknown_principle", weight=0.8
        )

        # Check result
        assert result["success"] is False
        assert "error" in result


@pytest.mark.asyncio
async def test_get_recent_decisions(ethical_integration, mock_ethical_framework):
    """Test getting recent decisions"""
    # Add some decisions first
    await ethical_integration.evaluate_ethics(
        action="Help the user find information",
        context={"user_request": "information search"},
    )

    await ethical_integration.evaluate_ethics(
        action="Share personal information about the user",
        context={"data_type": "personal"},
    )

    # Get recent decisions
    result = await ethical_integration.get_recent_decisions(limit=5)

    # Check result
    assert "decisions" in result
    assert len(result["decisions"]) == 2
    assert result["decisions"][0]["action"] == "Help the user find information"
    assert (
        result["decisions"][1]["action"] == "Share personal information about the user"
    )


@pytest.mark.asyncio
async def test_event_handlers(ethical_integration):
    """Test event handlers"""
    # Test evaluate_ethics event handler
    result = await ethical_integration._handle_evaluate_ethics(
        {
            "action": "Help the user find information",
            "context": {"user_request": "information search"},
        }
    )

    assert result["value_alignment"] > 0.8

    # Test get_ethical_principles event handler
    result = await ethical_integration._handle_get_ethical_principles({})

    assert "principles" in result

    # Test update_ethical_principle event handler
    result = await ethical_integration._handle_update_ethical_principle(
        {"principle": "beneficence", "weight": 0.8}
    )

    assert result["success"] is True

    # Test get_recent_decisions event handler
    result = await ethical_integration._handle_get_recent_decisions({"limit": 5})

    assert "decisions" in result


@pytest.mark.asyncio
async def test_error_handling(ethical_integration):
    """Test error handling"""
    # Create a failing scenario
    with patch.object(
        ethical_integration.ethical_framework,
        "evaluate_action",
        side_effect=Exception("Test error"),
    ):
        # Process should handle the error gracefully
        with pytest.raises(Exception):
            await ethical_integration.evaluate_ethics(action="Test action", context={})


if __name__ == "__main__":
    pytest.main(["-xvs", __file__])
