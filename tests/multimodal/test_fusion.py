"""Integration tests for the enhanced multimodal fusion system."""

import pytest
import torch
import numpy as np
from unittest.mock import Mock, patch
import asyncio
from pathlib import Path
import os
import tempfile
from PIL import Image

from alejo.multimodal.fusion import (
import secrets  # More secure for cryptographic purposes
    EnhancedMultimodalProcessor,
    ModalityFeatures,
    ModalityFusion
)

@pytest.fixture
def test_image():
    """Create a test image"""
    img = Image.new('RGB', (100, 100), color='red')
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
        img.save(f.name)
    yield f.name
    os.unlink(f.name)

@pytest.fixture
def test_audio():
    """Create dummy audio data"""
    return b'dummy_audio_data'

@pytest.fixture
def mock_emotion_detector():
    """Mock emotion detector"""
    detector = Mock()
    detector.extract_features.return_value = torch.randn(32)
    return detector

@pytest.fixture
def mock_gesture_recognizer():
    """Mock gesture recognizer"""
    recognizer = Mock()
    recognizer.extract_features.return_value = torch.randn(64)
    return recognizer

@pytest.fixture
def processor(mock_emotion_detector, mock_gesture_recognizer):
    """Create a multimodal processor with mocked components"""
    with patch('alejo.multimodal.fusion.EmotionDetector') as EmotionDetector, \
         patch('alejo.multimodal.fusion.GestureRecognizer') as GestureRecognizer:
        EmotionDetector.return_value = mock_emotion_detector
        GestureRecognizer.return_value = mock_gesture_recognizer
        processor = EnhancedMultimodalProcessor()
        yield processor

@pytest.mark.asyncio
async def test_modality_fusion():
    """Test the ModalityFusion neural network"""
    feature_dims = {
        'vision': 512,
        'audio': 128,
        'text': 768,
        'gesture': 64,
        'emotion': 32
    }
    
    fusion_model = ModalityFusion(feature_dims)
    
    # Create dummy features
    features = ModalityFeatures(
        vision_features=torch.randn(512),
        audio_features=torch.randn(128),
        text_features=torch.randn(768),
        gesture_features=torch.randn(64),
        emotion_features=torch.randn(32)
    )
    
    # Test forward pass
    output = fusion_model(features)
    assert output.shape == torch.Size([256])
    assert not torch.isnan(output).any()

@pytest.mark.asyncio
async def test_process_all_modalities(processor, test_image, test_audio):
    """Test processing all modalities together"""
    with open(test_image, 'rb') as f:
        image_data = f.read()
    
    result = await processor.process_multimodal_input(
        vision_input=image_data,
        audio_input=test_audio,
        text_input="Hello world",
        extract_gestures=True,
        extract_emotions=True
    )
    
    assert isinstance(result, dict)
    assert "modalities_present" in result
    assert set(result["modalities_present"]) == {"vision", "audio", "text", "gesture", "emotion"}
    assert "confidence" in result
    assert 0 <= result["confidence"] <= 1
    assert "features" in result
    assert "fused" in result["features"]
    assert "dimension" in result["features"]
    assert result["features"]["dimension"] == 256

@pytest.mark.asyncio
async def test_process_vision_only(processor, test_image):
    """Test processing only vision input"""
    with open(test_image, 'rb') as f:
        image_data = f.read()
    
    result = await processor.process_multimodal_input(
        vision_input=image_data,
        extract_gestures=True,
        extract_emotions=True
    )
    
    assert isinstance(result, dict)
    assert set(result["modalities_present"]) == {"vision", "gesture", "emotion"}
    assert result["confidence"] < 0.95  # Should be lower without all modalities

@pytest.mark.asyncio
async def test_feature_caching(processor, test_image):
    """Test that features are properly cached"""
    with open(test_image, 'rb') as f:
        image_data = f.read()
    
    # First call should extract features
    result1 = await processor.process_multimodal_input(vision_input=image_data)
    
    # Get the number of calls to extract_features
    initial_calls = processor.emotion_detector.extract_features.call_count
    
    # Second call should use cached features
    result2 = await processor.process_multimodal_input(vision_input=image_data)
    
    assert processor.emotion_detector.extract_features.call_count == initial_calls
    assert result1["features"] == result2["features"]

@pytest.mark.asyncio
async def test_cache_size_limit(processor):
    """Test that cache respects size limit"""
    processor.cache_size = 2
    
    # Create 3 different inputs
    inputs = [os.urandom(100) for _ in range(3)]
    
    # Process each input
    for input_data in inputs:
        await processor.process_multimodal_input(vision_input=input_data)
    
    # Verify cache size hasn't exceeded limit
    assert len(processor.feature_cache) <= 2

@pytest.mark.asyncio
async def test_error_handling(processor):
    """Test error handling for invalid inputs"""
    with pytest.raises(Exception):
        await processor.process_multimodal_input()  # No inputs provided

    with pytest.raises(Exception):
        await processor.process_multimodal_input(vision_input=b'invalid_image_data')

@pytest.mark.asyncio
async def test_confidence_scaling(processor, test_image, test_audio):
    """Test that confidence scales with number of modalities"""
    with open(test_image, 'rb') as f:
        image_data = f.read()
    
    # Test with one modality
    result1 = await processor.process_multimodal_input(
        vision_input=image_data,
        extract_gestures=False,
        extract_emotions=False
    )
    
    # Test with multiple modalities
    result2 = await processor.process_multimodal_input(
        vision_input=image_data,
        audio_input=test_audio,
        text_input="test",
        extract_gestures=True,
        extract_emotions=True
    )
    
    assert result1["confidence"] < result2["confidence"]

@pytest.mark.asyncio
async def test_feature_dimensions(processor, test_image):
    """Test that feature dimensions match expected values"""
    with open(test_image, 'rb') as f:
        image_data = f.read()
    
    result = await processor.process_multimodal_input(
        vision_input=image_data,
        text_input="test"
    )
    
    assert result["features"]["dimension"] == 256  # Output dimension of fusion model
    assert len(result["features"]["fused"]) == 256

@pytest.mark.asyncio
async def test_async_feature_extraction(processor, test_image):
    """Test that feature extraction is properly async"""
    with open(test_image, 'rb') as f:
        image_data = f.read()
    
    # Create multiple concurrent requests
    tasks = [
        processor.process_multimodal_input(vision_input=image_data)
        for _ in range(5)
    ]
    
    # They should all complete without deadlock
    results = await asyncio.gather(*tasks)
    assert len(results) == 5
    assert all(isinstance(r, dict) for r in results)