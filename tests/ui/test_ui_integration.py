"""
Tests for UI components integration with ALEJO Brain
"""

import os
import sys
import pytest
import asyncio
from unittest.mock import MagicMock, patch
import tempfile
from pathlib import Path

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Mock gradio
sys.modules['gradio'] = MagicMock()
import gradio as gr

# Import UI components
from alejo.ui.components.emotional_insights import EmotionalInsightsComponent
from alejo.ui.components.multimodal_interface import MultimodalInterfaceComponent
from alejo.ui.main_interface import AlejoUI

# Import ALEJO core
from alejo.core.brain import Brain
from alejo.core.event_bus import EventBus
from alejo.core.memory_store import MemoryStore
import secrets  # More secure for cryptographic purposes

# Fixtures
@pytest.fixture
def mock_brain():
    """Create a mock brain for testing"""
    brain = MagicMock(spec=Brain)
    
    # Mock event bus
    event_bus = MagicMock(spec=EventBus)
    brain.event_bus = event_bus
    
    # Mock memory store
    memory_store = MagicMock(spec=MemoryStore)
    brain.memory_store = memory_store
    
    # Mock methods
    brain.process_message = MagicMock(return_value=asyncio.Future())
    brain.process_message.return_value.set_result("Mock response")
    
    brain.process_image = MagicMock(return_value=asyncio.Future())
    brain.process_image.return_value.set_result(True)
    
    brain.visual_qa = MagicMock(return_value=asyncio.Future())
    brain.visual_qa.return_value.set_result("Mock answer")
    
    brain.generate_image_caption = MagicMock(return_value=asyncio.Future())
    brain.generate_image_caption.return_value.set_result("Mock caption")
    
    brain.analyze_scene = MagicMock(return_value=asyncio.Future())
    brain.analyze_scene.return_value.set_result({
        "objects": ["person", "car"],
        "scene_type": "outdoor",
        "description": "A person standing next to a car"
    })
    
    brain.get_state = MagicMock(return_value={"status": "ready"})
    
    return brain

@pytest.fixture
def emotional_component(mock_brain):
    """Create an emotional insights component for testing"""
    return EmotionalInsightsComponent(
        brain=mock_brain,
        event_bus=mock_brain.event_bus,
        config={}
    )

@pytest.fixture
def multimodal_component(mock_brain):
    """Create a multimodal interface component for testing"""
    return MultimodalInterfaceComponent(
        brain=mock_brain,
        event_bus=mock_brain.event_bus,
        config={}
    )

@pytest.fixture
def alejo_ui(mock_brain):
    """Create an ALEJO UI for testing"""
    return AlejoUI(
        brain=mock_brain,
        config={"ui": {"test": True}}
    )

# Tests
@pytest.mark.asyncio
async def test_emotional_component_initialization(emotional_component):
    """Test initialization of emotional insights component"""
    assert emotional_component is not None
    assert emotional_component.brain is not None
    assert emotional_component.event_bus is not None

@pytest.mark.asyncio
async def test_emotional_component_event_handlers(emotional_component):
    """Test emotional component event handlers"""
    # Test emotion analysis handler
    await emotional_component.handle_emotion_analysis({
        "emotions": {
            "joy": 0.8,
            "sadness": 0.1,
            "anger": 0.05,
            "fear": 0.05
        }
    })
    
    assert emotional_component.current_emotions == {
        "joy": 0.8,
        "sadness": 0.1,
        "anger": 0.05,
        "fear": 0.05
    }
    
    # Test sentiment analysis handler
    await emotional_component.handle_sentiment_analysis({
        "sentiment": 0.75
    })
    
    assert emotional_component.current_sentiment == 0.75
    
    # Test ethical decision handler
    await emotional_component.handle_ethical_decision({
        "decision": {
            "action": "approve",
            "evaluation": "positive",
            "principles": {
                "autonomy": 0.9,
                "beneficence": 0.8,
                "non-maleficence": 0.7
            },
            "explanation": "The action respects user autonomy and provides benefit."
        }
    })
    
    assert emotional_component.current_ethical_decision is not None
    assert emotional_component.current_ethical_decision["action"] == "approve"

@pytest.mark.asyncio
async def test_multimodal_component_initialization(multimodal_component):
    """Test initialization of multimodal interface component"""
    assert multimodal_component is not None
    assert multimodal_component.brain is not None
    assert multimodal_component.event_bus is not None

@pytest.mark.asyncio
async def test_multimodal_component_visual_qa(multimodal_component, mock_brain):
    """Test multimodal component visual QA"""
    # Mock image
    mock_image = MagicMock()
    
    # Set current image
    multimodal_component.current_image = mock_image
    multimodal_component.current_image_path = "/tmp/test.jpg"
    
    # Test visual QA
    result = await multimodal_component.handle_visual_qa(mock_image, "What's in this image?")
    
    # Check that brain.visual_qa was called
    mock_brain.visual_qa.assert_called_once_with(
        multimodal_component.current_image_path,
        "What's in this image?"
    )
    
    # Check result
    assert "Mock answer" in result

@pytest.mark.asyncio
async def test_multimodal_component_image_captioning(multimodal_component, mock_brain):
    """Test multimodal component image captioning"""
    # Mock image
    mock_image = MagicMock()
    
    # Set current image
    multimodal_component.current_image = mock_image
    multimodal_component.current_image_path = "/tmp/test.jpg"
    
    # Test image captioning
    result = await multimodal_component.handle_image_captioning(mock_image)
    
    # Check that brain.generate_image_caption was called
    mock_brain.generate_image_caption.assert_called_once_with(
        multimodal_component.current_image_path
    )
    
    # Check result
    assert result == "Mock caption"

@pytest.mark.asyncio
async def test_multimodal_component_scene_analysis(multimodal_component, mock_brain):
    """Test multimodal component scene analysis"""
    # Mock image
    mock_image = MagicMock()
    
    # Set current image
    multimodal_component.current_image = mock_image
    multimodal_component.current_image_path = "/tmp/test.jpg"
    
    # Test scene analysis
    result = await multimodal_component.handle_scene_analysis(mock_image)
    
    # Check that brain.analyze_scene was called
    mock_brain.analyze_scene.assert_called_once_with(
        multimodal_component.current_image_path
    )
    
    # Check result
    assert "Detected Objects" in result
    assert "person" in result
    assert "car" in result

def test_alejo_ui_initialization(alejo_ui, mock_brain):
    """Test initialization of ALEJO UI"""
    assert alejo_ui is not None
    assert alejo_ui.brain is mock_brain
    assert alejo_ui.event_bus is mock_brain.event_bus
    assert alejo_ui.config["ui"]["test"] is True

def test_alejo_ui_create_components(alejo_ui):
    """Test creating UI components"""
    alejo_ui._create_components()
    
    assert "emotional" in alejo_ui.components
    assert "multimodal" in alejo_ui.components

@pytest.mark.asyncio
async def test_alejo_ui_handle_chat_message(alejo_ui, mock_brain):
    """Test handling chat message"""
    # Test with empty message
    result = await alejo_ui._handle_chat_message("", [])
    assert result[0] == ""
    assert result[1] == []
    
    # Test with valid message
    result = await alejo_ui._handle_chat_message("Hello", [])
    
    # Check that brain.process_message was called
    mock_brain.process_message.assert_called_once_with("Hello")
    
    # Check result
    assert result[0] == ""  # Input cleared
    assert len(result[1]) == 1  # One message in history
    assert result[1][0][0] == "Hello"  # User message
    assert result[1][0][1] == "Mock response"  # Bot response

def test_alejo_ui_get_brain_state(alejo_ui, mock_brain):
    """Test getting brain state"""
    # Test with valid brain
    state, memory = alejo_ui._get_brain_state()
    
    # Check that brain.get_state was called
    mock_brain.get_state.assert_called_once()
    
    # Check result
    assert state == {"status": "ready"}
    assert "MB" in memory

@patch("json.dump")
def test_alejo_ui_save_settings(mock_json_dump, alejo_ui, mock_brain):
    """Test saving settings"""
    # Mock open
    with patch("builtins.open", create=True) as mock_open:
        # Test saving settings
        result = alejo_ui._save_settings("local/llama-3-8b", 0.7, 2048)
        
        # Check that open was called
        mock_open.assert_called_once()
        
        # Check that json.dump was called
        mock_json_dump.assert_called_once()
        
        # Check result
        assert "✅" in result
        
        # Check that config was updated
        assert alejo_ui.config["llm"]["default_model"] == "local/llama-3-8b"
        assert alejo_ui.config["llm"]["temperature"] == 0.7
        assert alejo_ui.config["memory"]["limit_mb"] == 2048
        
        # Check that brain.update_config was called
        mock_brain.update_config.assert_called_once_with(alejo_ui.config)

if __name__ == "__main__":
    pytest.main(["-xvs", __file__])