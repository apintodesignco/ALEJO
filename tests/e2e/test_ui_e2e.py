"""
End-to-End tests for ALEJO UI using Playwright

This module contains E2E tests for the ALEJO UI components using Playwright.
These tests verify that the UI components work correctly in a real browser environment
and interact properly with the ALEJO Brain.
"""

import asyncio
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pytest

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import secrets  # More secure for cryptographic purposes

from alejo.core.brain import Brain

# Import ALEJO modules
from alejo.ui.main_interface import AlejoUI
from alejo.utils.config import Config

# Import pytest-playwright
pytest_plugins = ["pytest-playwright"]

# Constants
UI_PORT = 7861  # Use a different port than default to avoid conflicts
TEST_TIMEOUT = 60000  # 60 seconds timeout for tests
UI_STARTUP_WAIT = 5  # Seconds to wait for UI to start


# Fixtures
@pytest.fixture(scope="module")
def config():
    """Create a test configuration"""
    # Create a temporary config file
    config_dir = tempfile.mkdtemp()
    config_path = os.path.join(config_dir, "test_config.json")

    # Test configuration
    test_config = {
        "brain": {"test_mode": True, "mock_responses": True},
        "llm": {"default_model": "local/test-model", "temperature": 0.7},
        "memory": {"limit_mb": 1024},
        "ui": {
            "test_mode": True,
            "emotional": {"test_mode": True},
            "multimodal": {"test_mode": True, "max_history_size": 5},
        },
        "config_path": config_path,
    }

    # Write config to file
    with open(config_path, "w") as f:
        json.dump(test_config, f, indent=2)

    yield test_config

    # Cleanup
    shutil.rmtree(config_dir)


@pytest.fixture(scope="module")
def mock_brain(config):
    """Create a mock brain for testing"""
    # Create a brain with test configuration
    brain = Brain(config.get("brain", {}))

    # Override methods with mock implementations
    async def mock_process_message(message):
        """Mock process_message method"""
        return f"Mock response to: {message}"

    async def mock_process_image(image_path):
        """Mock process_image method"""
        return True

    async def mock_visual_qa(image_path, question):
        """Mock visual_qa method"""
        return f"Mock answer to: {question}"

    async def mock_generate_image_caption(image_path):
        """Mock generate_image_caption method"""
        return "This is a mock image caption for testing purposes."

    async def mock_analyze_scene(image_path):
        """Mock analyze_scene method"""
        return {
            "objects": ["person", "car", "tree"],
            "scene_type": "outdoor",
            "description": "A person standing next to a car under a tree.",
        }

    # Apply mock methods
    brain.process_message = mock_process_message
    brain.process_image = mock_process_image
    brain.visual_qa = mock_visual_qa
    brain.generate_image_caption = mock_generate_image_caption
    brain.analyze_scene = mock_analyze_scene

    # Emit test events
    async def emit_test_events():
        """Emit test events for UI components"""
        # Wait for event handlers to be registered
        await asyncio.sleep(1)

        # Emit emotion analysis event
        await brain.event_bus.emit(
            "brain.emotion_analyzed",
            {"emotions": {"joy": 0.8, "sadness": 0.1, "anger": 0.05, "fear": 0.05}},
        )

        # Emit sentiment analysis event
        await brain.event_bus.emit("brain.sentiment_analyzed", {"sentiment": 0.75})

        # Emit ethical decision event
        await brain.event_bus.emit(
            "brain.ethical_decision",
            {
                "decision": {
                    "action": "approve",
                    "evaluation": "positive",
                    "principles": {
                        "autonomy": 0.9,
                        "beneficence": 0.8,
                        "non-maleficence": 0.7,
                    },
                    "explanation": "The action respects user autonomy and provides benefit.",
                }
            },
        )

        # Emit interaction recommendation event
        await brain.event_bus.emit(
            "brain.interaction_recommendation",
            {
                "recommendation": "Consider asking follow-up questions to clarify intent."
            },
        )

    # Add emit_test_events method to brain
    brain.emit_test_events = emit_test_events

    return brain


@pytest.fixture(scope="module")
def ui_server(mock_brain, config):
    """Start the UI server for testing"""
    # Create UI
    ui = AlejoUI(brain=mock_brain, config=config)

    # Start UI server
    server = ui.start(port=UI_PORT, share=False)

    # Wait for server to start
    time.sleep(UI_STARTUP_WAIT)

    yield f"http://localhost:{UI_PORT}"

    # Stop UI server
    ui.stop()


# Tests
@pytest.mark.timeout(TEST_TIMEOUT)
async def test_ui_loads(page, ui_server):
    """Test that the UI loads correctly"""
    # Navigate to UI
    await page.goto(ui_server)

    # Check that the page loaded
    assert await page.title() == "ALEJO AI"

    # Check that the header is present
    header = await page.query_selector("#header")
    assert header is not None

    # Check that the header contains the correct text
    header_text = await header.inner_text()
    assert "ALEJO AI Platform" in header_text


@pytest.mark.timeout(TEST_TIMEOUT)
async def test_chat_interface(page, ui_server, mock_brain):
    """Test the chat interface"""
    # Navigate to UI
    await page.goto(ui_server)

    # Wait for chat input to be available
    await page.wait_for_selector("#chat_input")

    # Type a message
    await page.fill("#chat_input", "Hello, ALEJO!")

    # Send the message
    await page.click("text=Send")

    # Wait for response
    await page.wait_for_function(
        """
        () => {
            const chatHistory = document.querySelector('.chatbot');
            return chatHistory && chatHistory.textContent.includes('Mock response');
        }
    """
    )

    # Check that the response is correct
    chat_history = await page.query_selector(".chatbot")
    chat_text = await chat_history.inner_text()
    assert "Hello, ALEJO!" in chat_text
    assert "Mock response to: Hello, ALEJO!" in chat_text


@pytest.mark.timeout(TEST_TIMEOUT)
async def test_emotional_insights_tab(page, ui_server, mock_brain):
    """Test the emotional insights tab"""
    # Navigate to UI
    await page.goto(ui_server)

    # Click on the Emotional Intelligence tab
    await page.click("text=Emotional Intelligence")

    # Wait for tab to load
    await page.wait_for_selector("text=Emotional Intelligence Insights")

    # Emit test events
    await mock_brain.emit_test_events()

    # Click refresh button
    await page.click("text=Refresh Insights")

    # Wait for sentiment score to update
    await page.wait_for_function(
        """
        () => {
            const sentimentElement = document.querySelector('input[aria-label="Sentiment Score"]');
            return sentimentElement && sentimentElement.value === '0.75';
        }
    """
    )

    # Check that ethical decision is displayed
    ethical_display = await page.query_selector("text=Ethical Decision")
    assert ethical_display is not None

    # Check that recommendation is displayed
    recommendation_box = await page.query_selector(
        'input[aria-label="Interaction Recommendations"]'
    )
    recommendation_value = await recommendation_box.input_value()
    assert "follow-up questions" in recommendation_value


@pytest.mark.timeout(TEST_TIMEOUT)
async def test_multimodal_interface_tab(page, ui_server):
    """Test the multimodal interface tab"""
    # Navigate to UI
    await page.goto(ui_server)

    # Click on the Multimodal tab
    await page.click("text=Multimodal")

    # Wait for tab to load
    await page.wait_for_selector("text=Multimodal Processing Interface")

    # Check that the tabs are present
    visual_qa_tab = await page.query_selector("text=Visual Q&A")
    assert visual_qa_tab is not None

    captioning_tab = await page.query_selector("text=Image Captioning")
    assert captioning_tab is not None

    scene_analysis_tab = await page.query_selector("text=Scene Analysis")
    assert scene_analysis_tab is not None


@pytest.mark.timeout(TEST_TIMEOUT)
async def test_settings_tab(page, ui_server):
    """Test the settings tab"""
    # Navigate to UI
    await page.goto(ui_server)

    # Click on the Settings tab
    await page.click("text=Settings")

    # Wait for tab to load
    await page.wait_for_selector("text=ALEJO Settings")

    # Check that model settings are present
    model_dropdown = await page.query_selector('select[aria-label="Default LLM Model"]')
    assert model_dropdown is not None

    # Check that temperature slider is present
    temperature_slider = await page.query_selector('input[aria-label="Temperature"]')
    assert temperature_slider is not None

    # Check that memory settings are present
    memory_slider = await page.query_selector('input[aria-label="Memory Limit (MB)"]')
    assert memory_slider is not None

    # Change settings
    await page.select_option(
        'select[aria-label="Default LLM Model"]', "local/mistral-7b"
    )
    await page.fill('input[aria-label="Temperature"]', "0.5")
    await page.fill('input[aria-label="Memory Limit (MB)"]', "2048")

    # Save settings
    await page.click("text=Save Settings")

    # Wait for success message
    await page.wait_for_selector("text=✅ Settings saved successfully")


if __name__ == "__main__":
    pytest.main(["-xvs", __file__])
