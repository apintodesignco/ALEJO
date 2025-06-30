"""
Multimodal Emotion Detection for ALEJO
Combines text, audio, and facial expression analysis
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Wav2Vec2Processor,
    Wav2Vec2ForSequenceClassification,
    ViTImageProcessor,
    ViTForImageClassification
)
import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Union
from ...vision.gesture_recognition import GestureRecognizer, Hand
from ..emotional_core import EmotionalCore, EmotionalDimension
import logging
from PIL import Image
import librosa
import cv2
import base64
import io

logger = logging.getLogger(__name__)

@dataclass
class MultimodalEmotionResult:
    """Combined emotion detection result"""
    text_emotions: Dict[str, float]
    audio_emotions: Optional[Dict[str, float]]
    facial_emotions: Optional[Dict[str, float]]
    gesture_emotions: Optional[Dict[str, float]]  # New: emotions from gesture analysis
    combined_emotions: Dict[str, float]
    confidence_scores: Dict[str, float]
    dominant_emotion: str
    modality_weights: Dict[str, float]
    emotional_dimensions: Dict[EmotionalDimension, float]  # New: dimensional emotion data

class TextEmotionDetector:
    """Text-based emotion detection using RoBERTa"""
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._tokenizer = None
        self._model = None
        
        self.emotion_labels = [
            "joy", "sadness", "anger", "fear",
            "surprise", "disgust", "trust", "anticipation"
        ]
    
    def _load_model(self):
        """Lazy load the RoBERTa model"""
        if self._tokenizer is None:
            self._tokenizer = AutoTokenizer.from_pretrained("j-hartmann/emotion-english-distilroberta-base")
        if self._model is None:
            self._model = AutoModelForSequenceClassification.from_pretrained(
                "j-hartmann/emotion-english-distilroberta-base"
            ).to(self.device)
        
    def detect_emotions(self, text: str) -> Dict[str, float]:
        """Detect emotions in text"""
        try:
            self._load_model()
            
            inputs = self._tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=512
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self._model(**inputs)
                probs = F.softmax(outputs.logits, dim=1)[0]
                
            emotions = {
                label: float(prob)
                for label, prob in zip(self.emotion_labels, probs)
            }
            
            return emotions
            
        except Exception as e:
            logger.error(f"Error in text emotion detection: {e}")
            return {label: 0.0 for label in self.emotion_labels}

class AudioEmotionDetector:
    """Audio-based emotion detection using Wav2Vec2"""
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._processor = None
        self._model = None
        
        self.emotion_labels = [
            "neutral", "happy", "sad", "angry",
            "fearful", "disgust", "surprised"
        ]
    
    def _load_model(self):
        """Lazy load the Wav2Vec2 model"""
        if self._processor is None:
            self._processor = Wav2Vec2Processor.from_pretrained("superb/wav2vec2-base-superb-er")
        if self._model is None:
            self._model = Wav2Vec2ForSequenceClassification.from_pretrained(
                "superb/wav2vec2-base-superb-er"
            ).to(self.device)
        
    def detect_emotions(self, audio_data: Union[str, np.ndarray]) -> Dict[str, float]:
        """Detect emotions in audio"""
        try:
            self._load_model()
            
            # Load and preprocess audio
            if isinstance(audio_data, str):
                # Base64 encoded audio
                audio_bytes = base64.b64decode(audio_data)
                audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
            else:
                audio_array = audio_data
            
            # Ensure correct sampling rate (16kHz for Wav2Vec2)
            if len(audio_array.shape) > 1:
                audio_array = np.mean(audio_array, axis=1)  # Convert stereo to mono
            audio_array = librosa.resample(audio_array, orig_sr=44100, target_sr=16000)
            
            # Process audio with Wav2Vec2
            inputs = self._processor(
                audio_array,
                sampling_rate=16000,
                return_tensors="pt"
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self._model(**inputs)
                probs = F.softmax(outputs.logits, dim=1)[0]
            
            emotions = {
                label: float(prob)
                for label, prob in zip(self.emotion_labels, probs)
            }
            
            return emotions
            
        except Exception as e:
            logger.error(f"Error in audio emotion detection: {e}")
            return {label: 0.0 for label in self.emotion_labels}
            
    def preprocess_audio(self, audio_path: str) -> np.ndarray:
        """Preprocess audio file for emotion detection"""
        try:
            # Load and resample audio
            audio_array, _ = librosa.load(audio_path, sr=16000)
            
            # Apply preprocessing
            audio_array = librosa.effects.preemphasis(audio_array)
            audio_array = librosa.util.normalize(audio_array)
            
            return audio_array
            
        except Exception as e:
            logger.error(f"Error preprocessing audio: {e}")
            return np.zeros(16000)  # 1 second of silence

class FacialEmotionDetector:
    """Facial emotion detection using ViT"""
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._processor = None
        self._model = None
        self._face_cascade = None
        
        self.emotion_labels = [
            "neutral", "happy", "sad", "angry",
            "fearful", "disgusted", "surprised"
        ]
    
    def _load_models(self):
        """Lazy load the ViT model and face detector"""
        if self._processor is None:
            self._processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224")
        if self._model is None:
            self._model = ViTForImageClassification.from_pretrained(
                "google/vit-base-patch16-224"
            ).to(self.device)
        if self._face_cascade is None:
            self._face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
        
    def detect_emotions(self, image_data: Union[str, np.ndarray]) -> Dict[str, float]:
        """Detect emotions in facial image"""
        try:
            self._load_models()
            
            # Convert image data to PIL Image
            if isinstance(image_data, str):
                # Base64 encoded image
                image_bytes = base64.b64decode(image_data)
                image = Image.open(io.BytesIO(image_bytes))
            else:
                image = Image.fromarray(image_data)
            
            # Detect and crop face
            face = self._detect_face(image)
            if face is None:
                logger.warning("No face detected in image")
                return {label: 0.0 for label in self.emotion_labels}
            
            # Process face with ViT
            inputs = self._processor(
                face,
                return_tensors="pt"
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self._model(**inputs)
                probs = F.softmax(outputs.logits, dim=1)[0]
            
            emotions = {
                label: float(prob)
                for label, prob in zip(self.emotion_labels, probs)
            }
            
            return emotions
            
        except Exception as e:
            logger.error(f"Error in facial emotion detection: {e}")
            return {label: 0.0 for label in self.emotion_labels}
    
    def _detect_face(self, image: Image.Image) -> Optional[Image.Image]:
        """Detect and crop face from image"""
        self._load_models()
        
        # Convert PIL Image to OpenCV format
        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Detect faces
        faces = self._face_cascade.detectMultiScale(
            cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY),
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        if len(faces) == 0:
            return None
            
        # Get largest face
        x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
        
        # Add margin around face
        margin = int(0.2 * max(w, h))
        x = max(0, x - margin)
        y = max(0, y - margin)
        w = min(cv_image.shape[1] - x, w + 2 * margin)
        h = min(cv_image.shape[0] - y, h + 2 * margin)
        
        # Crop and convert back to PIL
        face_cv = cv_image[y:y+h, x:x+w]
        face_rgb = cv2.cvtColor(face_cv, cv2.COLOR_BGR2RGB)
        return Image.fromarray(face_rgb)

class MultimodalEmotionDetector:
    """
    Combined multimodal emotion detection system
    """
    
    def __init__(self, emotional_core: Optional[EmotionalCore] = None):
        self.text_detector = TextEmotionDetector()
        self.audio_detector = AudioEmotionDetector()
        self.facial_detector = FacialEmotionDetector()
        self.gesture_recognizer = GestureRecognizer()
        self.emotional_core = emotional_core
        
        # Initialize modality weights
        self.modality_weights = {
            "text": 0.35,
            "audio": 0.25,
            "facial": 0.25,
            "gesture": 0.15  # New: gesture modality weight
        }
        
        # Gesture to emotion mappings
        self.gesture_emotion_map = {
            "open_palm": {"trust": 0.7, "openness": 0.6},
            "closed_fist": {"anger": 0.6, "determination": 0.7},
            "pointing": {"dominance": 0.5, "assertiveness": 0.6},
            "thumbs_up": {"joy": 0.8, "approval": 0.9},
            "thumbs_down": {"disapproval": 0.8, "sadness": 0.5},
            "peace": {"joy": 0.6, "trust": 0.7},
            "ok_sign": {"approval": 0.8, "confidence": 0.7},
            "wave": {"joy": 0.6, "friendliness": 0.8}
        }
        
        # Emotion mapping between different modalities
        self.emotion_mapping = {
            "joy": ["joy", "happy", "happy"],
            "sadness": ["sadness", "sad", "sad"],
            "anger": ["anger", "angry", "angry"],
            "fear": ["fear", "fearful", "fearful"],
            "surprise": ["surprise", "surprised", "surprised"],
            "disgust": ["disgust", "disgust", "disgusted"],
            "neutral": ["trust", "neutral", "neutral"]
        }
        
    async def detect_emotions(self, 
                       text: Optional[str] = None,
                       audio_data: Optional[Union[str, np.ndarray]] = None,
                       image_data: Optional[Union[str, np.ndarray]] = None,
                       gesture_data: Optional[List[Hand]] = None
                       ) -> MultimodalEmotionResult:
        """Detect emotions across all available modalities"""
        try:
            # Initialize results
            text_emotions = {}
            audio_emotions = {}
            facial_emotions = {}
            gesture_emotions = {}
            available_modalities = []
            
            # Process each available modality
            if text:
                text_emotions = self.text_detector.detect_emotions(text)
                available_modalities.append("text")
            
            if audio_data is not None:
                audio_emotions = self.audio_detector.detect_emotions(audio_data)
                available_modalities.append("audio")
                
            if image_data is not None:
                facial_emotions = self.facial_detector.detect_emotions(image_data)
                available_modalities.append("facial")
                
            if gesture_data:
                gesture_emotions = self._analyze_gestures(gesture_data)
                available_modalities.append("gesture")
                
            # Normalize weights based on available modalities
            weights = self._normalize_weights([
                "text" if text else None,
                "audio" if audio_data is not None else None,
                "facial" if image_data is not None else None,
                "gesture" if gesture_data else None
            ])
            
            # Combine emotions
            combined_emotions = self._combine_emotions(
                text_emotions,
                audio_emotions,
                facial_emotions,
                gesture_emotions,
                weights
            )
            
            # Calculate confidence scores
            confidence = self._calculate_confidence(
                text_emotions,
                audio_emotions,
                facial_emotions,
                gesture_emotions,
                weights
            )
            
            # Calculate emotional dimensions
            dimensions = self._calculate_emotional_dimensions(
                text_emotions,
                audio_emotions,
                facial_emotions,
                gesture_emotions,
                weights
            )
            
            # Determine dominant emotion
            dominant_emotion = max(
                combined_emotions.items(),
                key=lambda x: x[1]
            )[0]
            
            # Update emotional core if available
            if self.emotional_core:
                await self.emotional_core.process_emotion(
                    trigger="multimodal_input",
                    context={
                        "text_present": bool(text),
                        "audio_present": audio_data is not None,
                        "facial_present": image_data is not None,
                        "gesture_present": gesture_data is not None,
                        "dominant_emotion": dominant_emotion,
                        "confidence": max(confidence.values())
                    }
                )
            
            return MultimodalEmotionResult(
                text_emotions=text_emotions,
                audio_emotions=audio_emotions,
                facial_emotions=facial_emotions,
                gesture_emotions=gesture_emotions,
                combined_emotions=combined_emotions,
                confidence_scores=confidence,
                dominant_emotion=dominant_emotion,
                modality_weights=weights,
                emotional_dimensions=dimensions
            )
            
        except Exception as e:
            logger.error(f"Error in multimodal emotion detection: {e}")
            return self._get_fallback_result()
            
    def _normalize_weights(self, available_modalities: List[str]) -> Dict[str, float]:
        """Normalize weights based on available modalities"""
        if not available_modalities:
            return {mode: 0.0 for mode in self.modality_weights}
            
        weights = {
            mode: self.modality_weights[mode]
            for mode in available_modalities
        }
        
        total = sum(weights.values())
        return {
            mode: weight / total
            for mode, weight in weights.items()
        }
        
    def _combine_emotions(self,
                         text_emotions: Dict[str, float],
                         audio_emotions: Dict[str, float],
                         facial_emotions: Dict[str, float],
                         gesture_emotions: Dict[str, float],
                         weights: Dict[str, float]
                         ) -> Dict[str, float]:
        """Combine emotions from different modalities"""
        combined = {}
        
        # Map emotions to common space
        for emotion, mappings in self.emotion_mapping.items():
            text_val = text_emotions.get(mappings[0], 0.0) if text_emotions else 0.0
            audio_val = audio_emotions.get(mappings[1], 0.0) if audio_emotions else 0.0
            facial_val = facial_emotions.get(mappings[2], 0.0) if facial_emotions else 0.0
            gesture_val = gesture_emotions.get(emotion, 0.0) if gesture_emotions else 0.0
            
            # Weighted combination
            combined[emotion] = (
                text_val * weights.get("text", 0.0) +
                audio_val * weights.get("audio", 0.0) +
                facial_val * weights.get("facial", 0.0) +
                gesture_val * weights.get("gesture", 0.0)
            )
            
        return combined
        
    def _calculate_confidence(self,
                            text_emotions: Dict[str, float],
                            audio_emotions: Dict[str, float],
                            facial_emotions: Dict[str, float],
                            gesture_emotions: Dict[str, float],
                            weights: Dict[str, float]
                            ) -> Dict[str, float]:
        """Calculate confidence scores for each modality"""
        confidence = {}
        
        if text_emotions:
            confidence["text"] = max(text_emotions.values()) * weights.get("text", 0.0)
            
        if audio_emotions:
            confidence["audio"] = max(audio_emotions.values()) * weights.get("audio", 0.0)
            
        if facial_emotions:
            confidence["facial"] = max(facial_emotions.values()) * weights.get("facial", 0.0)
            
        if gesture_emotions:
            confidence["gesture"] = max(gesture_emotions.values()) * weights.get("gesture", 0.0)
            
        # Overall confidence
        confidence["overall"] = sum(confidence.values()) / len(confidence) if confidence else 0.0
        
        return confidence
        
    def _get_fallback_result(self) -> MultimodalEmotionResult:
        """Return fallback result when detection fails"""
        empty_emotions = {"neutral": 1.0}
        empty_weights = {"text": 0.0, "audio": 0.0, "facial": 0.0, "gesture": 0.0}
        empty_dimensions = {dim: 0.0 for dim in EmotionalDimension}
        
        return MultimodalEmotionResult(
            text_emotions=empty_emotions,
            audio_emotions=None,
            facial_emotions=None,
            gesture_emotions=None,
            combined_emotions=empty_emotions,
            confidence_scores={"overall": 0.0},
            dominant_emotion="neutral",
            modality_weights=empty_weights,
            emotional_dimensions=empty_dimensions
        )
        
    def _analyze_gestures(self, hands: List[Hand]) -> Dict[str, float]:
        """Analyze emotional content from detected hand gestures"""
        emotions = {}
        
        for hand in hands:
            if hand.gesture and hand.gesture in self.gesture_emotion_map:
                gesture_emotions = self.gesture_emotion_map[hand.gesture]
                for emotion, value in gesture_emotions.items():
                    # Weight by gesture confidence
                    weighted_value = value * hand.confidence
                    if emotion in emotions:
                        # Take max value if emotion already present
                        emotions[emotion] = max(emotions[emotion], weighted_value)
                    else:
                        emotions[emotion] = weighted_value
        
        # Normalize if any emotions were detected
        if emotions:
            max_value = max(emotions.values())
            emotions = {k: v/max_value for k, v in emotions.items()}
        else:
            emotions = {"neutral": 1.0}
            
        return emotions
        
    def _calculate_emotional_dimensions(self,
                                     text_emotions: Dict[str, float],
                                     audio_emotions: Dict[str, float],
                                     facial_emotions: Dict[str, float],
                                     gesture_emotions: Dict[str, float],
                                     weights: Dict[str, float]
                                     ) -> Dict[EmotionalDimension, float]:
        """Calculate emotional dimensions from all modalities"""
        dimensions = {dim: 0.0 for dim in EmotionalDimension}
        
        # Emotion to dimension mappings
        emotion_dimension_map = {
            "joy": {EmotionalDimension.VALENCE: 0.8, EmotionalDimension.AROUSAL: 0.6},
            "sadness": {EmotionalDimension.VALENCE: -0.7, EmotionalDimension.AROUSAL: -0.4},
            "anger": {EmotionalDimension.VALENCE: -0.6, EmotionalDimension.AROUSAL: 0.8},
            "fear": {EmotionalDimension.VALENCE: -0.8, EmotionalDimension.DOMINANCE: -0.7},
            "surprise": {EmotionalDimension.AROUSAL: 0.7},
            "trust": {EmotionalDimension.SOCIAL: 0.7, EmotionalDimension.MORAL: 0.5},
            "disgust": {EmotionalDimension.VALENCE: -0.6, EmotionalDimension.MORAL: -0.4},
            "anticipation": {EmotionalDimension.TEMPORAL: 0.6, EmotionalDimension.AROUSAL: 0.3}
        }
        
        # Process each modality
        for emotions, weight_key in [
            (text_emotions, "text"),
            (audio_emotions, "audio"),
            (facial_emotions, "facial"),
            (gesture_emotions, "gesture")
        ]:
            if emotions and weight_key in weights:
                weight = weights[weight_key]
                for emotion, value in emotions.items():
                    if emotion in emotion_dimension_map:
                        for dim, dim_value in emotion_dimension_map[emotion].items():
                            dimensions[dim] += dim_value * value * weight
        
        # Normalize dimensions to [-1, 1]
        dimensions = {dim: max(-1.0, min(1.0, value)) 
                     for dim, value in dimensions.items()}
                     
        return dimensions
