"""
Integration tests for connecting the Multimodal Processor to ALEJO Brain
"""

import os
import sys
import pytest
import asyncio
from unittest.mock import MagicMock, patch
import tempfile
import shutil
from pathlib import Path

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from alejo.cognitive.multimodal.integration import MultimodalIntegration
from alejo.cognitive.multimodal.processor import MultimodalProcessor
from alejo.core.brain import ALEJOBrain
from alejo.core.event_bus import EventBus
from alejo.database.memory_store import MemoryStore
from alejo.vision.processor import VisionProcessor
from alejo.llm_client.base import LLMResponse
import secrets  # More secure for cryptographic purposes

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
    
    async def add_to_conversation_history(self, user_id, message):
        """Add to conversation history"""
        if user_id not in self.conversation_history:
            self.conversation_history[user_id] = []
        self.conversation_history[user_id].append(message)
        return True

class MockMultimodalProcessor:
    """Mock multimodal processor for testing"""
    
    async def process_image_with_text(self, image_path, prompt, **kwargs):
        """Mock processing image with text"""
        return {
            "content": f"Analysis of {os.path.basename(image_path)} with prompt: {prompt}",
            "model": "mock-vlm",
            "processing_time": 0.5,
            "image_path": image_path
        }
    
    async def visual_qa(self, image_path, question):
        """Mock visual QA"""
        return {
            "question": question,
            "answer": f"Answer to '{question}' about {os.path.basename(image_path)}",
            "image_path": image_path,
            "processing_time": 0.3
        }
    
    async def analyze_scene(self, image_path, analysis_type):
        """Mock scene analysis"""
        return {
            "scene_context": {
                "objects": [{"label": "person", "confidence": 0.95}],
                "environment": {"setting": "indoor"},
                "scene_type": "office",
                "confidence": 0.9
            },
            "vlm_analysis": f"Analysis of {os.path.basename(image_path)} scene: office setting",
            "processing_time": 0.7,
            "image_path": image_path
        }
    
    async def caption_image(self, image_path, style):
        """Mock image captioning"""
        return {
            "caption": f"{style.capitalize()} caption for {os.path.basename(image_path)}",
            "style": style,
            "image_path": image_path,
            "processing_time": 0.4
        }

# Fixtures
@pytest.fixture
def temp_dir():
    """Create a temporary directory"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def temp_image(temp_dir):
    """Create a temporary test image"""
    from PIL import Image
    import numpy as np
    
    # Create a simple test image
    img = Image.fromarray(np.zeros((100, 100, 3), dtype=np.uint8))
    img_path = os.path.join(temp_dir, "test_image.jpg")
    img.save(img_path)
    
    return img_path

@pytest.fixture
def mock_brain():
    """Create a mock brain"""
    return MockBrain()

@pytest.fixture
def mock_multimodal_processor():
    """Create a mock multimodal processor"""
    return MockMultimodalProcessor()

@pytest.fixture
def multimodal_integration(mock_brain, mock_multimodal_processor):
    """Create a multimodal integration with mocks"""
    return MultimodalIntegration(
        brain=mock_brain,
        event_bus=mock_brain.event_bus,
        memory_store=mock_brain.memory_store,
        multimodal_processor=mock_multimodal_processor
    )

# Tests
@pytest.mark.asyncio
async def test_initialization():
    """Test initialization of multimodal integration"""
    # Patch the MultimodalProcessor to avoid actual initialization
    with patch('alejo.cognitive.multimodal.processor.MultimodalProcessor') as mock_processor_class:
        mock_processor = MagicMock()
        mock_processor_class.return_value = mock_processor
        
        # Create integration
        integration = MultimodalIntegration()
        
        # Check that processor was initialized
        assert mock_processor_class.called
        assert integration.multimodal_processor == mock_processor

@pytest.mark.asyncio
async def test_process_image_for_brain_question(multimodal_integration, temp_image):
    """Test processing image with a question"""
    # Process image with a question
    result = await multimodal_integration.process_image_for_brain(
        image_path=temp_image,
        query="What is in this image?",
        user_id="test_user"
    )
    
    # Check result
    assert "answer" in result
    assert "test_image.jpg" in result["answer"]
    assert "processing_type" in result
    assert result["processing_type"] == "visual_qa"
    assert "user_id" in result
    assert result["user_id"] == "test_user"

@pytest.mark.asyncio
async def test_process_image_for_brain_description(multimodal_integration, temp_image):
    """Test processing image with a description request"""
    # Process image with a description request
    result = await multimodal_integration.process_image_for_brain(
        image_path=temp_image,
        query="Describe this image in detail",
        user_id="test_user"
    )
    
    # Check result
    assert "caption" in result
    assert "Detailed caption" in result["caption"]
    assert "processing_type" in result
    assert result["processing_type"] == "caption"

@pytest.mark.asyncio
async def test_process_image_for_brain_general(multimodal_integration, temp_image):
    """Test processing image with a general prompt"""
    # Process image with a general prompt
    result = await multimodal_integration.process_image_for_brain(
        image_path=temp_image,
        query="This is an interesting image",
        user_id="test_user"
    )
    
    # Check result
    assert "content" in result
    assert "test_image.jpg" in result["content"]
    assert "processing_type" in result
    assert result["processing_type"] == "general"

@pytest.mark.asyncio
async def test_brain_context_update(multimodal_integration, mock_brain, temp_image):
    """Test updating brain context"""
    # Process image
    await multimodal_integration.process_image_for_brain(
        image_path=temp_image,
        query="What is in this image?",
        user_id="test_user"
    )
    
    # Check that brain context was updated
    assert len(mock_brain.short_term_memory) == 1
    assert mock_brain.short_term_memory[0]["type"] == "multimodal_interaction"
    assert mock_brain.short_term_memory[0]["image_path"] == temp_image
    
    # Check conversation history
    assert "test_user" in mock_brain.conversation_history
    assert len(mock_brain.conversation_history["test_user"]) == 2
    assert mock_brain.conversation_history["test_user"][0]["role"] == "user"
    assert mock_brain.conversation_history["test_user"][1]["role"] == "assistant"

@pytest.mark.asyncio
async def test_caption_style_detection(multimodal_integration):
    """Test caption style detection"""
    # Test different caption style requests
    assert multimodal_integration._determine_caption_style("Give me a brief description") == "concise"
    assert multimodal_integration._determine_caption_style("Describe this in detail") == "detailed"
    assert multimodal_integration._determine_caption_style("Create a creative caption") == "creative"
    assert multimodal_integration._determine_caption_style("What's in this image?") == "descriptive"

@pytest.mark.asyncio
async def test_question_detection(multimodal_integration):
    """Test question detection"""
    # Test question detection
    assert multimodal_integration._is_question("What is this?")
    assert multimodal_integration._is_question("How many people are in the image?")
    assert multimodal_integration._is_question("Is there a dog in this picture?")
    assert not multimodal_integration._is_question("This is a nice picture.")
    assert not multimodal_integration._is_question("Describe this image.")

@pytest.mark.asyncio
async def test_description_request_detection(multimodal_integration):
    """Test description request detection"""
    # Test description request detection
    assert multimodal_integration._is_description_request("Describe this image")
    assert multimodal_integration._is_description_request("Caption this for me")
    assert multimodal_integration._is_description_request("Tell me about this image")
    assert not multimodal_integration._is_description_request("Is there a dog in this picture?")
    assert not multimodal_integration._is_description_request("This is a nice picture.")

@pytest.mark.asyncio
async def test_event_handlers(multimodal_integration, temp_image):
    """Test event handlers"""
    # Test process_image event handler
    result = await multimodal_integration._handle_brain_process_image({
        "image_path": temp_image,
        "query": "What is in this image?",
        "user_id": "test_user"
    })
    
    assert "answer" in result
    assert "test_image.jpg" in result["answer"]
    
    # Test visual_qa event handler
    result = await multimodal_integration._handle_brain_visual_qa({
        "image_path": temp_image,
        "question": "How many people?"
    })
    
    assert "answer" in result
    assert "How many people?" in result["question"]
    
    # Test analyze_scene event handler
    result = await multimodal_integration._handle_brain_analyze_scene({
        "image_path": temp_image,
        "analysis_type": "detailed"
    })
    
    assert "scene_context" in result
    assert "vlm_analysis" in result
    
    # Test caption_image event handler
    result = await multimodal_integration._handle_brain_caption_image({
        "image_path": temp_image,
        "style": "creative"
    })
    
    assert "caption" in result
    assert "Creative caption" in result["caption"]

@pytest.mark.asyncio
async def test_error_handling(multimodal_integration, temp_image):
    """Test error handling"""
    # Create a failing scenario
    with patch.object(multimodal_integration.multimodal_processor, 'visual_qa', side_effect=Exception("Test error")):
        # Process should handle the error gracefully
        result = await multimodal_integration.process_image_for_brain(
            image_path=temp_image,
            query="What is in this image?",
            user_id="test_user"
        )
        
        # Check that error was returned
        assert "error" in result
        assert "Failed to process image" in result["error"]

if __name__ == "__main__":
    pytest.main(["-xvs", __file__])