"""
Integration tests for multimodal emotion detection system
"""

import pytest
import numpy as np
import torch
import base64
import os
import librosa
import cv2
from PIL import Image
import io
from pathlib import Path
from unittest.mock import patch, MagicMock

from alejo.emotional_intelligence.models.multimodal_emotion import (
import secrets  # More secure for cryptographic purposes
    TextEmotionDetector,
    AudioEmotionDetector,
    FacialEmotionDetector,
    MultimodalEmotionDetector
)

# Test data paths
TEST_DATA_DIR = Path(__file__).parent / "test_data" / "multimodal"
TEST_AUDIO_PATH = TEST_DATA_DIR / "test_audio.wav"
TEST_IMAGE_PATH = TEST_DATA_DIR / "test_face.jpg"

@pytest.fixture(scope="session", autouse=True)
def setup_test_data(tmp_path_factory):
    """Create test data directory and sample files"""
    test_dir = tmp_path_factory.mktemp("multimodal")
    
    # Create test audio
    audio_path = test_dir / "test_audio.wav"
    sample_rate = 16000
    duration = 3  # seconds
    t = np.linspace(0, duration, int(sample_rate * duration))
    audio = 0.5 * np.sin(2 * np.pi * 440 * t)  # 440 Hz sine wave
    librosa.output.write_wav(str(audio_path), audio, sample_rate)
    
    # Create test image
    image_path = test_dir / "test_face.jpg"
    img = np.zeros((224, 224, 3), dtype=np.uint8)
    cv2.circle(img, (112, 112), 50, (255, 255, 255), -1)  # Simple face shape
    cv2.imwrite(str(image_path), img)
    
    return test_dir

@pytest.fixture
def text_detector():
    """Text emotion detector fixture"""
    return TextEmotionDetector()

@pytest.fixture
def audio_detector():
    """Audio emotion detector fixture"""
    return AudioEmotionDetector()

@pytest.fixture
def facial_detector():
    """Facial emotion detector fixture"""
    return FacialEmotionDetector()

@pytest.fixture
def multimodal_detector():
    """Multimodal emotion detector fixture"""
    return MultimodalEmotionDetector()

class TestTextEmotionDetector:
    """Test text-based emotion detection"""
    
    @pytest.mark.parametrize("text,expected_emotion", [
        ("I am so happy today!", "joy"),
        ("This makes me really sad.", "sadness"),
        ("I'm furious about this!", "anger"),
        ("I'm really scared right now.", "fear")
    ])
    def test_emotion_detection(self, text_detector, text, expected_emotion):
        """Test basic emotion detection from text"""
        emotions = text_detector.detect_emotions(text)
        
        assert isinstance(emotions, dict)
        assert len(emotions) > 0
        assert expected_emotion in emotions
        assert emotions[expected_emotion] > 0.3  # Should have significant confidence
        
    def test_empty_text(self, text_detector):
        """Test handling of empty text"""
        emotions = text_detector.detect_emotions("")
        
        assert isinstance(emotions, dict)
        assert len(emotions) > 0
        assert all(0.0 <= score <= 1.0 for score in emotions.values())
        
    def test_long_text(self, text_detector):
        """Test handling of long text"""
        long_text = "I am feeling " * 200
        emotions = text_detector.detect_emotions(long_text)
        
        assert isinstance(emotions, dict)
        assert len(emotions) > 0
        assert all(0.0 <= score <= 1.0 for score in emotions.values())

class TestAudioEmotionDetector:
    """Test audio-based emotion detection"""
    
    def test_file_input(self, audio_detector, setup_test_data):
        """Test emotion detection from audio file"""
        audio_path = setup_test_data / "test_audio.wav"
        audio_array = audio_detector.preprocess_audio(str(audio_path))
        emotions = audio_detector.detect_emotions(audio_array)
        
        assert isinstance(emotions, dict)
        assert len(emotions) > 0
        assert all(0.0 <= score <= 1.0 for score in emotions.values())
        
    def test_base64_input(self, audio_detector, setup_test_data):
        """Test emotion detection from base64 audio"""
        audio_path = setup_test_data / "test_audio.wav"
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        audio_base64 = base64.b64encode(audio_bytes).decode()
        
        emotions = audio_detector.detect_emotions(audio_base64)
        
        assert isinstance(emotions, dict)
        assert len(emotions) > 0
        assert all(0.0 <= score <= 1.0 for score in emotions.values())
        
    def test_invalid_audio(self, audio_detector):
        """Test handling of invalid audio"""
        invalid_audio = np.zeros(1600)  # Too short
        emotions = audio_detector.detect_emotions(invalid_audio)
        
        assert isinstance(emotions, dict)
        assert len(emotions) > 0
        assert all(score == 0.0 for score in emotions.values())

class TestFacialEmotionDetector:
    """Test facial expression detection"""
    
    def test_file_input(self, facial_detector, setup_test_data):
        """Test emotion detection from image file"""
        image_path = setup_test_data / "test_face.jpg"
        image = Image.open(image_path)
        emotions = facial_detector.detect_emotions(np.array(image))
        
        assert isinstance(emotions, dict)
        assert len(emotions) > 0
        assert all(0.0 <= score <= 1.0 for score in emotions.values())
        
    def test_base64_input(self, facial_detector, setup_test_data):
        """Test emotion detection from base64 image"""
        image_path = setup_test_data / "test_face.jpg"
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        image_base64 = base64.b64encode(image_bytes).decode()
        
        emotions = facial_detector.detect_emotions(image_base64)
        
        assert isinstance(emotions, dict)
        assert len(emotions) > 0
        assert all(0.0 <= score <= 1.0 for score in emotions.values())
        
    def test_no_face(self, facial_detector):
        """Test handling of image with no face"""
        empty_image = np.zeros((224, 224, 3), dtype=np.uint8)
        emotions = facial_detector.detect_emotions(empty_image)
        
        assert isinstance(emotions, dict)
        assert len(emotions) > 0
        assert all(score == 0.0 for score in emotions.values())
        
    def test_face_detection(self, facial_detector, setup_test_data):
        """Test face detection functionality"""
        image_path = setup_test_data / "test_face.jpg"
        image = Image.open(image_path)
        
        face = facial_detector._detect_face(image)
        
        assert face is not None
        assert isinstance(face, Image.Image)
        assert face.size[0] > 0 and face.size[1] > 0

class TestMultimodalEmotionDetector:
    """Test multimodal emotion detection integration"""
    
    def test_text_only(self, multimodal_detector):
        """Test detection with only text input"""
        result = multimodal_detector.detect_emotions(
            text="I am feeling very happy today!"
        )
        
        assert result.text_emotions is not None
        assert result.audio_emotions == {}
        assert result.facial_emotions == {}
        assert result.combined_emotions is not None
        assert result.dominant_emotion is not None
        assert 0.0 <= result.confidence_scores["overall"] <= 1.0
        
    def test_audio_only(self, multimodal_detector, setup_test_data):
        """Test detection with only audio input"""
        audio_path = setup_test_data / "test_audio.wav"
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        audio_base64 = base64.b64encode(audio_bytes).decode()
        
        result = multimodal_detector.detect_emotions(
            audio_data=audio_base64
        )
        
        assert result.text_emotions == {}
        assert result.audio_emotions is not None
        assert result.facial_emotions == {}
        assert result.combined_emotions is not None
        assert result.dominant_emotion is not None
        assert 0.0 <= result.confidence_scores["overall"] <= 1.0
        
    def test_facial_only(self, multimodal_detector, setup_test_data):
        """Test detection with only facial input"""
        image_path = setup_test_data / "test_face.jpg"
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        image_base64 = base64.b64encode(image_bytes).decode()
        
        result = multimodal_detector.detect_emotions(
            image_data=image_base64
        )
        
        assert result.text_emotions == {}
        assert result.audio_emotions == {}
        assert result.facial_emotions is not None
        assert result.combined_emotions is not None
        assert result.dominant_emotion is not None
        assert 0.0 <= result.confidence_scores["overall"] <= 1.0
        
    def test_all_modalities(self, multimodal_detector, setup_test_data):
        """Test detection with all modalities"""
        # Prepare audio data
        audio_path = setup_test_data / "test_audio.wav"
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        audio_base64 = base64.b64encode(audio_bytes).decode()
        
        # Prepare image data
        image_path = setup_test_data / "test_face.jpg"
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        image_base64 = base64.b64encode(image_bytes).decode()
        
        result = multimodal_detector.detect_emotions(
            text="I am feeling very happy today!",
            audio_data=audio_base64,
            image_data=image_base64
        )
        
        assert result.text_emotions is not None
        assert result.audio_emotions is not None
        assert result.facial_emotions is not None
        assert result.combined_emotions is not None
        assert result.dominant_emotion is not None
        assert 0.0 <= result.confidence_scores["overall"] <= 1.0
        assert len(result.modality_weights) == 3
        assert abs(sum(result.modality_weights.values()) - 1.0) < 1e-6
        
    def test_emotion_fusion(self, multimodal_detector):
        """Test emotion fusion with conflicting emotions"""
        # Mock detector responses
        text_emotions = {"joy": 0.8, "sadness": 0.1}
        audio_emotions = {"happy": 0.3, "sad": 0.6}
        facial_emotions = {"happy": 0.7, "sad": 0.2}
        
        with patch.object(multimodal_detector.text_detector, "detect_emotions",
                         return_value=text_emotions), \
             patch.object(multimodal_detector.audio_detector, "detect_emotions",
                         return_value=audio_emotions), \
             patch.object(multimodal_detector.facial_detector, "detect_emotions",
                         return_value=facial_emotions):
                             
            result = multimodal_detector.detect_emotions(
                text="test",
                audio_data=np.zeros(16000),
                image_data=np.zeros((224, 224, 3))
            )
            
            assert result.combined_emotions["joy"] > result.combined_emotions["sadness"]
            assert result.dominant_emotion == "joy"
            
    def test_error_handling(self, multimodal_detector):
        """Test error handling with invalid inputs"""
        result = multimodal_detector.detect_emotions(
            text=None,
            audio_data=None,
            image_data=None
        )
        
        assert isinstance(result.combined_emotions, dict)
        assert result.dominant_emotion == "neutral"
        assert result.confidence_scores["overall"] == 0.0
        
    def test_weight_normalization(self, multimodal_detector):
        """Test modality weight normalization"""
        weights = multimodal_detector._normalize_weights(["text", "audio"])
        
        assert len(weights) == 2
        assert abs(sum(weights.values()) - 1.0) < 1e-6
        assert all(0.0 <= w <= 1.0 for w in weights.values())