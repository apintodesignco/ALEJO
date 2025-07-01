"""
Integration tests for the ALEJO Brain Extensions module
"""

import os
import sys
import pytest
import asyncio
from unittest.mock import MagicMock, patch
import tempfile
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from alejo.core.brain_extensions import BrainExtensions
from alejo.core.event_bus import EventBus
from alejo.database.memory_store import MemoryStore
from alejo.utils.exceptions import BrainExtensionError
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

class MockMultimodalIntegration:
    """Mock multimodal integration for testing"""
    
    async def process_image_for_brain(self, image_path, query, user_id=None, context=None):
        """Mock process image"""
        return {
            "result": f"Processed image {image_path} with query: {query}",
            "query_type": "visual_qa" if "?" in query else "general",
            "confidence": 0.92
        }
    
    async def _handle_brain_visual_qa(self, data):
        """Mock visual QA handler"""
        return {
            "answer": f"Answer to question '{data['question']}' about image {data['image_path']}",
            "confidence": 0.89
        }
    
    async def _handle_brain_analyze_scene(self, data):
        """Mock scene analysis handler"""
        return {
            "analysis": f"{data['analysis_type']} analysis of image {data['image_path']}",
            "objects": ["person", "car", "tree"],
            "scene_type": "outdoor"
        }
    
    async def _handle_brain_caption_image(self, data):
        """Mock image captioning handler"""
        return {
            "caption": f"A {data['style']} caption for image {data['image_path']}",
            "confidence": 0.95
        }

class MockEmotionalIntelligenceIntegration:
    """Mock emotional intelligence integration for testing"""
    
    async def analyze_emotion(self, text, user_id=None, context=None):
        """Mock emotion analysis"""
        if "happy" in text.lower():
            return {
                "sentiment": "positive",
                "emotions": {"joy": 0.8, "surprise": 0.2},
                "intensity": 0.7
            }
        elif "sad" in text.lower():
            return {
                "sentiment": "negative",
                "emotions": {"sadness": 0.7, "disappointment": 0.3},
                "intensity": 0.6
            }
        else:
            return {
                "sentiment": "neutral",
                "emotions": {"neutral": 0.9},
                "intensity": 0.3
            }
    
    async def get_emotional_response(self, input_text, user_id=None, context=None, target_emotion=None):
        """Mock emotional response generation"""
        return {
            "response": f"Emotional response to: {input_text}",
            "emotion": target_emotion or {"empathy": 0.7, "curiosity": 0.3},
            "style": "supportive"
        }
    
    async def get_interaction_recommendation(self, user_id, current_context):
        """Mock interaction recommendation"""
        return {
            "recommended_style": "supportive",
            "tone_adjustments": {"formality": 0.3, "warmth": 0.8},
            "confidence": 0.85
        }

class MockEthicalIntegration:
    """Mock ethical integration for testing"""
    
    async def evaluate_ethics(self, action, context):
        """Mock ethical evaluation"""
        if "share" in action.lower() and "personal" in action.lower():
            return {
                "value_alignment": 0.3,
                "justification": "Sharing personal information raises privacy concerns",
                "principles_considered": ["privacy", "autonomy"],
                "recommendation": "reconsider"
            }
        else:
            return {
                "value_alignment": 0.9,
                "justification": "Action aligns with ethical principles",
                "principles_considered": ["beneficence", "autonomy"],
                "recommendation": "proceed"
            }
    
    async def get_ethical_principles(self):
        """Mock get ethical principles"""
        return {
            "principles": {
                "beneficence": {
                    "description": "Act in ways that benefit users",
                    "weight": 1.0
                },
                "privacy": {
                    "description": "Protect user privacy",
                    "weight": 0.95
                }
            }
        }

class MockRetrievalIntegration:
    """Mock retrieval integration for testing"""
    
    async def query(self, query, mode=None, user_id=None):
        """Mock retrieval query"""
        return {
            "results": [
                {"content": f"Result 1 for {query}", "relevance": 0.92},
                {"content": f"Result 2 for {query}", "relevance": 0.85}
            ],
            "mode": mode or "hybrid"
        }
    
    async def learn(self, content, metadata=None, user_id=None):
        """Mock learn information"""
        return {
            "success": True,
            "chunk_count": 3,
            "id": "doc_123"
        }
    
    async def set_mode(self, mode, rag_weight=None, cag_weight=None):
        """Mock set retrieval mode"""
        return {
            "mode": mode,
            "rag_weight": rag_weight or 0.5,
            "cag_weight": cag_weight or 0.5
        }

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
        "enabled_extensions": {
            "multimodal": True,
            "emotional_intelligence": True,
            "ethical_framework": True,
            "hybrid_retrieval": True
        },
        "extension_configs": {
            "multimodal": {
                "default_reasoning_depth": "deep"
            },
            "emotional_intelligence": {
                "empathy_threshold": 0.8
            }
        }
    }
    
    config_path = os.path.join(temp_dir, "brain_extensions_config.json")
    with open(config_path, 'w') as f:
        json.dump(config, f)
    
    return config_path

@pytest.fixture
def mock_brain():
    """Create a mock brain"""
    return MockBrain()

@pytest.fixture
def brain_extensions(mock_brain, monkeypatch):
    """Create brain extensions with mocked components"""
    # Mock the component classes
    monkeypatch.setattr("alejo.cognitive.multimodal.integration.MultimodalIntegration", 
                       lambda **kwargs: MockMultimodalIntegration())
    monkeypatch.setattr("alejo.emotional_intelligence.integration.EmotionalIntelligenceIntegration", 
                       lambda **kwargs: MockEmotionalIntelligenceIntegration())
    monkeypatch.setattr("alejo.ethical.integration.EthicalIntegration", 
                       lambda **kwargs: MockEthicalIntegration())
    monkeypatch.setattr("alejo.cognitive.retrieval.integration.RetrievalIntegration", 
                       lambda **kwargs: MockRetrievalIntegration())
    
    # Create brain extensions
    extensions = BrainExtensions(brain=mock_brain)
    return extensions

# Tests
@pytest.mark.asyncio
async def test_initialization(config_file):
    """Test initialization with config file"""
    with patch("alejo.core.brain.ALEJOBrain") as mock_brain_class:
        mock_brain = MockBrain()
        mock_brain_class.return_value = mock_brain
        
        # Mock component classes
        with patch("alejo.cognitive.multimodal.integration.MultimodalIntegration") as mock_multimodal_class, \
             patch("alejo.emotional_intelligence.integration.EmotionalIntelligenceIntegration") as mock_emotional_class, \
             patch("alejo.ethical.integration.EthicalIntegration") as mock_ethical_class, \
             patch("alejo.cognitive.retrieval.integration.RetrievalIntegration") as mock_retrieval_class:
            
            # Create mock instances
            mock_multimodal = MagicMock()
            mock_emotional = MagicMock()
            mock_ethical = MagicMock()
            mock_retrieval = MagicMock()
            
            # Set return values for mock classes
            mock_multimodal_class.return_value = mock_multimodal
            mock_emotional_class.return_value = mock_emotional
            mock_ethical_class.return_value = mock_ethical
            mock_retrieval_class.return_value = mock_retrieval
            
            # Create brain extensions
            extensions = BrainExtensions(brain=mock_brain, config_path=config_file)
            
            # Check that components were initialized
            assert mock_multimodal_class.called
            assert mock_emotional_class.called
            assert mock_ethical_class.called
            assert mock_retrieval_class.called
            
            # Check that config was loaded
            assert extensions.config["extension_configs"]["emotional_intelligence"]["empathy_threshold"] == 0.8

@pytest.mark.asyncio
async def test_multimodal_methods(brain_extensions):
    """Test multimodal processing methods"""
    # Test process_image
    result = await brain_extensions._process_image(
        image_path="/path/to/image.jpg",
        query="What's in this image?"
    )
    
    assert "result" in result
    assert "Processed image" in result["result"]
    assert "query_type" in result
    
    # Test visual_qa
    result = await brain_extensions._visual_qa(
        image_path="/path/to/image.jpg",
        question="What color is the car?"
    )
    
    assert "answer" in result
    assert "color is the car" in result["answer"]
    
    # Test analyze_scene
    result = await brain_extensions._analyze_scene(
        image_path="/path/to/image.jpg",
        analysis_type="detailed"
    )
    
    assert "analysis" in result
    assert "detailed analysis" in result["analysis"]
    assert "objects" in result
    
    # Test caption_image
    result = await brain_extensions._caption_image(
        image_path="/path/to/image.jpg",
        style="poetic"
    )
    
    assert "caption" in result
    assert "poetic caption" in result["caption"]

@pytest.mark.asyncio
async def test_emotional_intelligence_methods(brain_extensions):
    """Test emotional intelligence methods"""
    # Test analyze_emotion
    result = await brain_extensions._analyze_emotion(
        text="I'm feeling happy today!"
    )
    
    assert "sentiment" in result
    assert result["sentiment"] == "positive"
    assert "emotions" in result
    assert "joy" in result["emotions"]
    
    # Test with sad text
    result = await brain_extensions._analyze_emotion(
        text="I'm feeling sad about what happened."
    )
    
    assert result["sentiment"] == "negative"
    assert "sadness" in result["emotions"]
    
    # Test get_emotional_response
    result = await brain_extensions._get_emotional_response(
        input_text="I just got a promotion!",
        user_id="user123"
    )
    
    assert "response" in result
    assert "emotion" in result
    assert "style" in result
    
    # Test get_interaction_recommendation
    result = await brain_extensions._get_interaction_recommendation(
        user_id="user123",
        current_context={"recent_sentiment": "positive"}
    )
    
    assert "recommended_style" in result
    assert "tone_adjustments" in result

@pytest.mark.asyncio
async def test_ethical_framework_methods(brain_extensions):
    """Test ethical framework methods"""
    # Test evaluate_ethics with ethical action
    result = await brain_extensions._evaluate_ethics(
        action="Help the user find information",
        context={"user_request": "information search"}
    )
    
    assert "value_alignment" in result
    assert result["value_alignment"] > 0.8
    assert "recommendation" in result
    assert result["recommendation"] == "proceed"
    
    # Test with potentially unethical action
    result = await brain_extensions._evaluate_ethics(
        action="Share personal information about the user",
        context={"data_type": "personal"}
    )
    
    assert result["value_alignment"] < 0.5
    assert "privacy" in result["principles_considered"]
    assert result["recommendation"] == "reconsider"
    
    # Test get_ethical_principles
    result = await brain_extensions._get_ethical_principles()
    
    assert "principles" in result
    assert "beneficence" in result["principles"]
    assert "privacy" in result["principles"]

@pytest.mark.asyncio
async def test_hybrid_retrieval_methods(brain_extensions):
    """Test hybrid retrieval methods"""
    # Test retrieve_context
    result = await brain_extensions._retrieve_context(
        query="How does photosynthesis work?",
        mode="hybrid"
    )
    
    assert "results" in result
    assert len(result["results"]) > 0
    assert "mode" in result
    
    # Test learn_information
    result = await brain_extensions._learn_information(
        content="Photosynthesis is the process by which plants convert light energy into chemical energy.",
        metadata={"topic": "biology"}
    )
    
    assert "success" in result
    assert result["success"] is True
    assert "chunk_count" in result
    
    # Test set_retrieval_mode
    result = await brain_extensions._set_retrieval_mode(
        mode="rag_only",
        rag_weight=0.8,
        cag_weight=0.2
    )
    
    assert "mode" in result
    assert result["mode"] == "rag_only"
    assert "rag_weight" in result
    assert result["rag_weight"] == 0.8

@pytest.mark.asyncio
async def test_disabled_extensions(brain_extensions):
    """Test behavior when extensions are disabled"""
    # Disable multimodal extension
    brain_extensions.config["enabled_extensions"]["multimodal"] = False
    
    # Test that calling a multimodal method raises an error
    with pytest.raises(BrainExtensionError):
        await brain_extensions._process_image(
            image_path="/path/to/image.jpg",
            query="What's in this image?"
        )
    
    # Disable emotional intelligence extension
    brain_extensions.config["enabled_extensions"]["emotional_intelligence"] = False
    
    # Test that calling an emotional intelligence method raises an error
    with pytest.raises(BrainExtensionError):
        await brain_extensions._analyze_emotion(
            text="I'm feeling happy today!"
        )

@pytest.mark.asyncio
async def test_error_handling(brain_extensions):
    """Test error handling in brain extensions"""
    # Create a failing scenario for multimodal processing
    with patch.object(brain_extensions.multimodal, "process_image_for_brain", 
                     side_effect=Exception("Test error")):
        # Process should handle the error and re-raise as BrainExtensionError
        with pytest.raises(BrainExtensionError):
            await brain_extensions._process_image(
                image_path="/path/to/image.jpg",
                query="What's in this image?"
            )

if __name__ == "__main__":
    pytest.main(["-xvs", __file__])