"""
ALEJO Emotion Types

This module defines the core types, enums, and data structures used throughout
the emotional intelligence system.
"""

from enum import Enum, auto
from typing import Dict, Any, List, Optional, Union, TypedDict
from dataclasses import dataclass
from datetime import datetime


class EmotionCategory(Enum):
    """Categories of emotions that can be detected."""
    JOY = "joy"
    SADNESS = "sadness"
    ANGER = "anger"
    FEAR = "fear"
    SURPRISE = "surprise"
    DISGUST = "disgust"
    TRUST = "trust"
    ANTICIPATION = "anticipation"
    NEUTRAL = "neutral"


class EmotionIntensity(Enum):
    """Intensity levels for emotions."""
    VERY_LOW = "very_low"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"
    
    @classmethod
    def from_score(cls, score: float) -> 'EmotionIntensity':
        """Convert a numerical score (0-1) to an intensity level."""
        if score < 0.2:
            return cls.VERY_LOW
        elif score < 0.4:
            return cls.LOW
        elif score < 0.6:
            return cls.MODERATE
        elif score < 0.8:
            return cls.HIGH
        else:
            return cls.VERY_HIGH


class InputModality(Enum):
    """Types of input modalities for emotion detection."""
    TEXT = "text"
    VOICE = "voice"
    FACIAL = "facial"
    GESTURE = "gesture"
    MULTIMODAL = "multimodal"


class ConfidenceLevel(Enum):
    """Confidence levels for emotion detection."""
    VERY_LOW = "very_low"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"
    
    @classmethod
    def from_score(cls, score: float) -> 'ConfidenceLevel':
        """Convert a numerical score (0-1) to a confidence level."""
        if score < 0.2:
            return cls.VERY_LOW
        elif score < 0.4:
            return cls.LOW
        elif score < 0.6:
            return cls.MODERATE
        elif score < 0.8:
            return cls.HIGH
        else:
            return cls.VERY_HIGH


@dataclass
class EmotionScore:
    """Represents a detected emotion with its intensity and confidence."""
    category: EmotionCategory
    intensity: float  # 0.0 to 1.0
    intensity_level: EmotionIntensity
    confidence: float  # 0.0 to 1.0
    
    @classmethod
    def create(cls, category: EmotionCategory, intensity: float, confidence: float) -> 'EmotionScore':
        """Create an EmotionScore with calculated intensity level."""
        return cls(
            category=category,
            intensity=intensity,
            intensity_level=EmotionIntensity.from_score(intensity),
            confidence=confidence
        )


@dataclass
class EmotionDetectionResult:
    """Complete result of emotion detection across modalities."""
    # Primary detected emotion
    primary: EmotionScore
    
    # Secondary emotions detected (if any)
    secondary: Dict[EmotionCategory, EmotionScore]
    
    # Source modality
    modality: InputModality
    
    # Raw features that contributed to this detection
    features: Dict[str, Any]
    
    # Timestamp of detection
    timestamp: datetime = datetime.now()
    
    # Context information
    context: Optional[Dict[str, Any]] = None


class TextFeatures(TypedDict, total=False):
    """Features extracted from text for emotion analysis."""
    sentiment_score: float
    emotion_keywords: Dict[EmotionCategory, List[str]]
    emotion_phrases: Dict[EmotionCategory, List[str]]
    negation_count: int
    intensifier_count: int
    text_length: int
    language: str
    raw_text: str


class VoiceFeatures(TypedDict, total=False):
    """Features extracted from voice for emotion analysis."""
    pitch_mean: float
    pitch_range: float
    intensity_mean: float
    speech_rate: float
    voice_quality: str
    pauses: List[float]
    duration: float
    energy_variance: float


class FacialFeatures(TypedDict, total=False):
    """Features extracted from facial expressions for emotion analysis."""
    action_units: Dict[str, float]
    valence: float
    arousal: float
    dominant_expression: str
    expression_confidence: float
    face_id: Optional[str]
    gaze_direction: List[float]
    head_pose: List[float]


# Type for all possible feature types
ModalityFeatures = Union[TextFeatures, VoiceFeatures, FacialFeatures, Dict[str, Any]]


@dataclass
class EmotionContext:
    """Contextual information for emotion detection and tracking."""
    # User ID if available
    user_id: Optional[str] = None
    
    # Session ID
    session_id: Optional[str] = None
    
    # Conversation history
    history: List[EmotionDetectionResult] = None
    
    # User preferences
    preferences: Optional[Dict[str, Any]] = None
    
    # Environmental factors
    environment: Optional[Dict[str, Any]] = None
    
    # Application state
    app_state: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.history is None:
            self.history = []
