"""
Tests for the MultimodalProcessor
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

from alejo.cognitive.multimodal.processor import MultimodalProcessor
from alejo.llm_client.vlm_client import VLMClient, VLMConfig
from alejo.llm_client.base import LLMResponse
from alejo.vision.processor import VisionProcessor
from alejo.vision.scene_analyzer import SceneContext, SceneObject, EnvironmentalContext
from alejo.core.event_bus import EventBus
from alejo.database.memory_store import MemoryStore

# Create mock classes for testing
class MockVLMClient:
    """Mock VLM client for testing"""
    
    async def process_image_and_text(self, image_path, prompt, **kwargs):
        """Mock processing image and text"""
        # Return different responses based on prompt keywords
        if "describe" in prompt.lower():
            content = "This image shows a person standing in a garden with flowers."
        elif "question" in prompt.lower():
            content = "The answer to your question is: There are approximately 5 flowers visible in the image."
        else:
            content = "This is a general analysis of the image content."
        
        return LLMResponse(
            content=content,
            model="mock-vlm-model",
            usage={"prompt_tokens": 50, "completion_tokens": 30, "total_tokens": 80},
            elapsed_time=0.5,
            metadata={"mock": True}
        )

class MockVisionProcessor:
    """Mock vision processor for testing"""
    
    async def analyze_scene(self, image_path):
        """Mock scene analysis"""
        return SceneContext(
            objects=[
                SceneObject(label="person", confidence=0.95, bbox=[10, 10, 100, 200]),
                SceneObject(label="flower", confidence=0.85, bbox=[150, 150, 50, 50])
            ],
            environment=EnvironmentalContext(
                lighting="bright",
                setting="outdoor",
                time_of_day="day"
            ),
            scene_type="garden",
            confidence=0.9
        )

class MockMemoryStore:
    """Mock memory store for testing"""
    
    def __init__(self):
        self.memories = []
    
    async def store_memory(self, memory_data):
        """Mock storing memory"""
        self.memories.append(memory_data)
        return True

class MockEventBus:
    """Mock event bus for testing"""
    
    def __init__(self):
        self.subscribers = {}
    
    def subscribe(self, event_type, callback):
        """Mock subscribe method"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)
    
    async def publish(self, event_type, data=None):
        """Mock publish method"""
        return {"success": True}

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
def mock_vlm_client():
    """Create a mock VLM client"""
    return MockVLMClient()

@pytest.fixture
def mock_vision_processor():
    """Create a mock vision processor"""
    return MockVisionProcessor()

@pytest.fixture
def mock_memory_store():
    """Create a mock memory store"""
    return MockMemoryStore()

@pytest.fixture
def mock_event_bus():
    """Create a mock event bus"""
    return MockEventBus()

@pytest.fixture
def multimodal_processor(temp_dir, mock_vlm_client, mock_vision_processor, mock_memory_store, mock_event_bus):
    """Create a multimodal processor with mocks"""
    # Create a config file
    config_path = os.path.join(temp_dir, "config.json")
    
    # Patch the factory to return our mock client
    with patch('alejo.llm_client.factory.LLMClientFactory.create_client', return_value=mock_vlm_client):
        # Create the processor
        processor = MultimodalProcessor(
            config_path=config_path,
            event_bus=mock_event_bus,
            memory_store=mock_memory_store,
            vision_processor=mock_vision_processor
        )
        
        yield processor

# Tests
@pytest.mark.asyncio
async def test_initialization(temp_dir):
    """Test initialization of multimodal processor"""
    # Patch the factory to avoid actual VLM initialization
    with patch('alejo.llm_client.factory.LLMClientFactory.create_client') as mock_factory:
        # Create the processor
        processor = MultimodalProcessor(config_path=os.path.join(temp_dir, "config.json"))
        
        # Check that initialization was attempted
        assert mock_factory.called
        
        # Check that config was loaded
        assert processor.config is not None
        assert "vlm_model" in processor.config
        assert "cache_dir" in processor.config

@pytest.mark.asyncio
async def test_process_image_with_text(multimodal_processor, temp_image):
    """Test processing image with text"""
    # Process image with text
    result = await multimodal_processor.process_image_with_text(
        image_path=temp_image,
        prompt="Describe this image"
    )
    
    # Check result
    assert "content" in result
    assert "person standing in a garden" in result["content"]
    assert "model" in result
    assert "processing_time" in result
    assert "image_path" in result
    assert result["image_path"] == temp_image

@pytest.mark.asyncio
async def test_analyze_scene(multimodal_processor, temp_image):
    """Test scene analysis"""
    # Analyze scene
    result = await multimodal_processor.analyze_scene(
        image_path=temp_image,
        analysis_type="comprehensive"
    )
    
    # Check result
    assert "scene_context" in result
    assert "objects" in result["scene_context"]
    assert len(result["scene_context"]["objects"]) == 2
    assert result["scene_context"]["objects"][0]["label"] == "person"
    assert "vlm_analysis" in result
    assert "processing_time" in result

@pytest.mark.asyncio
async def test_visual_qa(multimodal_processor, temp_image):
    """Test visual question answering"""
    # Ask a question about the image
    result = await multimodal_processor.visual_qa(
        image_path=temp_image,
        question="How many flowers are in the image?"
    )
    
    # Check result
    assert "question" in result
    assert "answer" in result
    assert "5 flowers" in result["answer"]
    assert "processing_time" in result

@pytest.mark.asyncio
async def test_caption_image(multimodal_processor, temp_image):
    """Test image captioning"""
    # Caption the image
    result = await multimodal_processor.caption_image(
        image_path=temp_image,
        style="descriptive"
    )
    
    # Check result
    assert "caption" in result
    assert "style" in result
    assert result["style"] == "descriptive"
    assert "processing_time" in result

@pytest.mark.asyncio
async def test_memory_integration(multimodal_processor, temp_image, mock_memory_store):
    """Test memory integration"""
    # Process image with text
    await multimodal_processor.process_image_with_text(
        image_path=temp_image,
        prompt="Describe this image"
    )
    
    # Check that memory was stored
    assert len(mock_memory_store.memories) == 1
    assert "content" in mock_memory_store.memories[0]
    assert "memory_type" in mock_memory_store.memories[0]
    assert mock_memory_store.memories[0]["memory_type"] == "multimodal"

@pytest.mark.asyncio
async def test_event_handlers(multimodal_processor, temp_image, mock_event_bus):
    """Test event handlers"""
    # Check that event handlers were registered
    assert "multimodal.process_image" in mock_event_bus.subscribers
    assert "multimodal.analyze_scene" in mock_event_bus.subscribers
    assert "multimodal.visual_qa" in mock_event_bus.subscribers
    assert "multimodal.caption_image" in mock_event_bus.subscribers
    
    # Test process_image event handler
    handler = mock_event_bus.subscribers["multimodal.process_image"][0]
    result = await handler({
        "image_path": temp_image,
        "prompt": "Describe this image"
    })
    
    # Check result
    assert "content" in result
    assert "person standing in a garden" in result["content"]

@pytest.mark.asyncio
async def test_prompt_enhancement(multimodal_processor):
    """Test prompt enhancement"""
    # Test different reasoning depths and response lengths
    original_prompt = "Describe this image"
    
    # Low reasoning, short response
    enhanced = multimodal_processor._enhance_prompt(original_prompt, "low", "short")
    assert "straightforward" in enhanced
    assert "concise" in enhanced
    
    # High reasoning, long response
    enhanced = multimodal_processor._enhance_prompt(original_prompt, "high", "long")
    assert "deep, thorough" in enhanced
    assert "comprehensive" in enhanced

@pytest.mark.asyncio
async def test_error_handling(multimodal_processor, temp_image):
    """Test error handling"""
    # Create a failing scenario by patching the VLM client
    with patch.object(multimodal_processor, 'vlm_client', side_effect=Exception("Test error")):
        # Process should handle the error gracefully
        result = await multimodal_processor.process_image_with_text(
            image_path=temp_image,
            prompt="Describe this image"
        )
        
        # Check that error was returned
        assert "error" in result
        assert "Test error" in result["error"]

if __name__ == "__main__":
    pytest.main(["-xvs", __file__])
