"""
ALEJO Facial Expression Emotion Analyzer

This module provides facial expression analysis capabilities for emotion detection.
It analyzes facial action units and expressions to determine emotional states.
"""

import logging
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Set

from alejo.cognitive.emotional.emotion_types import (
    EmotionCategory, EmotionIntensity, EmotionScore, 
    EmotionDetectionResult, InputModality, FacialFeatures
)
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class FacialEmotionAnalyzer:
    """
    Analyzes facial expressions to detect emotions.
    
    This class provides methods to detect emotions from facial expressions
    using facial action units and other visual features.
    """
    
    def __init__(self):
        """Initialize the facial emotion analyzer."""
        # Facial Action Coding System (FACS) mappings to emotions
        # Based on Ekman's research on universal facial expressions
        self.emotion_au_mappings = {
            EmotionCategory.JOY: {
                'AU6': 0.8,  # Cheek raiser
                'AU12': 1.0,  # Lip corner puller
                'AU25': 0.4,  # Lips part
            },
            EmotionCategory.SADNESS: {
                'AU1': 0.7,  # Inner brow raiser
                'AU4': 0.7,  # Brow lowerer
                'AU15': 0.9,  # Lip corner depressor
                'AU17': 0.5,  # Chin raiser
            },
            EmotionCategory.ANGER: {
                'AU4': 0.9,  # Brow lowerer
                'AU5': 0.7,  # Upper lid raiser
                'AU7': 0.6,  # Lid tightener
                'AU23': 0.8,  # Lip tightener
                'AU24': 0.5,  # Lip presser
            },
            EmotionCategory.FEAR: {
                'AU1': 0.7,  # Inner brow raiser
                'AU2': 0.7,  # Outer brow raiser
                'AU4': 0.5,  # Brow lowerer
                'AU5': 0.9,  # Upper lid raiser
                'AU20': 0.7,  # Lip stretcher
                'AU26': 0.5,  # Jaw drop
            },
            EmotionCategory.SURPRISE: {
                'AU1': 0.9,  # Inner brow raiser
                'AU2': 0.9,  # Outer brow raiser
                'AU5': 0.8,  # Upper lid raiser
                'AU26': 0.8,  # Jaw drop
            },
            EmotionCategory.DISGUST: {
                'AU9': 1.0,  # Nose wrinkler
                'AU10': 0.8,  # Upper lip raiser
                'AU15': 0.5,  # Lip corner depressor
                'AU17': 0.5,  # Chin raiser
            },
            EmotionCategory.TRUST: {
                'AU12': 0.6,  # Lip corner puller (slight smile)
                'AU13': 0.5,  # Cheek puffer
                'AU24': 0.3,  # Lip presser (slight)
            },
            EmotionCategory.ANTICIPATION: {
                'AU1': 0.5,  # Inner brow raiser
                'AU5': 0.3,  # Upper lid raiser (slight)
                'AU20': 0.4,  # Lip stretcher (slight)
            }
        }
        
        # Feature weights for emotion scoring
        self.feature_weights = {
            'action_units': 0.6,
            'valence': 0.2,
            'arousal': 0.2
        }
        
        logger.info("Facial emotion analyzer initialized")
    
    @handle_exceptions("Failed to analyze facial expressions for emotions")
    def analyze(
        self, 
        facial_features: FacialFeatures, 
        context: Optional[Dict[str, Any]] = None
    ) -> EmotionDetectionResult:
        """
        Analyze facial features to detect emotions.
        
        Args:
            facial_features: Extracted facial features
            context: Optional context information
            
        Returns:
            EmotionDetectionResult with detected emotions
        """
        if not facial_features or not facial_features.get('action_units'):
            # Return neutral emotion for empty features
            neutral_score = EmotionScore.create(
                category=EmotionCategory.NEUTRAL,
                intensity=0.5,
                confidence=0.5
            )
            return EmotionDetectionResult(
                primary=neutral_score,
                secondary={},
                modality=InputModality.FACIAL,
                features={}
            )
        
        # Calculate emotion scores based on facial features
        emotion_scores = self._calculate_emotion_scores(facial_features)
        
        # Determine primary emotion
        primary_emotion, secondary_emotions = self._determine_primary_emotion(emotion_scores)
        
        # Create detection result
        return EmotionDetectionResult(
            primary=primary_emotion,
            secondary=secondary_emotions,
            modality=InputModality.FACIAL,
            features=facial_features,
            context=context
        )
    
    def _calculate_emotion_scores(self, features: FacialFeatures) -> Dict[EmotionCategory, EmotionScore]:
        """
        Calculate emotion scores based on facial features.
        
        Args:
            features: Facial features
            
        Returns:
            Dictionary mapping emotion categories to scores
        """
        action_units = features.get('action_units', {})
        valence = features.get('valence', 0.0)
        arousal = features.get('arousal', 0.0)
        
        # Calculate AU-based scores for each emotion
        emotion_scores = {}
        
        for emotion in EmotionCategory:
            if emotion == EmotionCategory.NEUTRAL:
                continue  # Skip neutral, it's a fallback
                
            # Calculate AU-based score
            au_score = self._calculate_au_score(action_units, emotion)
            
            # Adjust score based on valence-arousal
            va_score = self._calculate_valence_arousal_score(valence, arousal, emotion)
            
            # Weighted combination of scores
            combined_score = (
                au_score * self.feature_weights['action_units'] +
                va_score * (self.feature_weights['valence'] + self.feature_weights['arousal'])
            )
            
            # Calculate confidence based on match strength and feature quality
            confidence = min(0.5 + (au_score * 0.4), 0.9)
            
            # Only include emotions with significant scores
            if combined_score > 0.3:  # Threshold for detection
                emotion_scores[emotion] = EmotionScore.create(
                    category=emotion,
                    intensity=combined_score,
                    confidence=confidence
                )
        
        # If no emotions detected, return neutral
        if not emotion_scores:
            neutral_score = EmotionScore.create(
                category=EmotionCategory.NEUTRAL,
                intensity=0.5,
                confidence=0.7
            )
            return {EmotionCategory.NEUTRAL: neutral_score}
            
        return emotion_scores
    
    def _calculate_au_score(self, action_units: Dict[str, float], emotion: EmotionCategory) -> float:
        """
        Calculate score based on facial action units.
        
        Args:
            action_units: Dictionary of action units and their intensities
            emotion: Emotion category to score
            
        Returns:
            Score for this emotion based on action units (0-1)
        """
        if emotion not in self.emotion_au_mappings:
            return 0.0
            
        emotion_aus = self.emotion_au_mappings[emotion]
        
        # Calculate match score
        total_weight = sum(emotion_aus.values())
        weighted_score = 0.0
        
        for au, weight in emotion_aus.items():
            if au in action_units:
                au_intensity = action_units[au]
                weighted_score += au_intensity * weight
        
        # Normalize score
        return weighted_score / total_weight if total_weight > 0 else 0.0
    
    def _calculate_valence_arousal_score(
        self, 
        valence: float, 
        arousal: float, 
        emotion: EmotionCategory
    ) -> float:
        """
        Calculate score based on valence-arousal dimensions.
        
        Args:
            valence: Valence value (-1 to 1)
            arousal: Arousal value (0 to 1)
            emotion: Emotion category to score
            
        Returns:
            Score for this emotion based on valence-arousal (0-1)
        """
        # Typical valence-arousal positions for emotions
        # Based on Russell's circumplex model of affect
        va_positions = {
            EmotionCategory.JOY: {'valence': 0.8, 'arousal': 0.6},
            EmotionCategory.SADNESS: {'valence': -0.8, 'arousal': 0.3},
            EmotionCategory.ANGER: {'valence': -0.7, 'arousal': 0.8},
            EmotionCategory.FEAR: {'valence': -0.7, 'arousal': 0.7},
            EmotionCategory.SURPRISE: {'valence': 0.1, 'arousal': 0.9},
            EmotionCategory.DISGUST: {'valence': -0.6, 'arousal': 0.5},
            EmotionCategory.TRUST: {'valence': 0.6, 'arousal': 0.3},
            EmotionCategory.ANTICIPATION: {'valence': 0.3, 'arousal': 0.7}
        }
        
        if emotion not in va_positions:
            return 0.0
            
        # Calculate Euclidean distance in VA space
        emotion_valence = va_positions[emotion]['valence']
        emotion_arousal = va_positions[emotion]['arousal']
        
        # Normalize valence to 0-1 for distance calculation
        normalized_valence = (valence + 1) / 2
        normalized_emotion_valence = (emotion_valence + 1) / 2
        
        distance = np.sqrt(
            (normalized_valence - normalized_emotion_valence) ** 2 + 
            (arousal - emotion_arousal) ** 2
        )
        
        # Convert distance to similarity score (1 - normalized distance)
        # Max distance in 2D space with coordinates in [0,1] is sqrt(2)
        max_distance = np.sqrt(2)
        similarity = 1.0 - (distance / max_distance)
        
        return similarity
    
    def _determine_primary_emotion(
        self, emotion_scores: Dict[EmotionCategory, EmotionScore]
    ) -> Tuple[EmotionScore, Dict[EmotionCategory, EmotionScore]]:
        """
        Determine the primary emotion and secondary emotions.
        
        Args:
            emotion_scores: Dictionary of emotion scores
            
        Returns:
            Tuple of (primary_emotion, secondary_emotions)
        """
        if not emotion_scores:
            # Default to neutral if no emotions detected
            neutral_score = EmotionScore.create(
                category=EmotionCategory.NEUTRAL,
                intensity=0.5,
                confidence=0.5
            )
            return neutral_score, {}
        
        # Find primary emotion (highest intensity * confidence)
        primary_emotion = max(
            emotion_scores.values(),
            key=lambda score: score.intensity * score.confidence
        )
        
        # Secondary emotions are all others
        secondary_emotions = {
            emotion: score for emotion, score in emotion_scores.items()
            if emotion != primary_emotion.category
        }
        
        return primary_emotion, secondary_emotions


# Example usage
def main():
    analyzer = FacialEmotionAnalyzer()
    
    # Test with some example facial features
    examples = [
        {
            # Happy face
            "action_units": {
                "AU6": 0.8,  # Cheek raiser
                "AU12": 0.9,  # Lip corner puller
                "AU25": 0.5,  # Lips part
            },
            "valence": 0.8,
            "arousal": 0.6,
            "dominant_expression": "happy",
            "expression_confidence": 0.85
        },
        {
            # Angry face
            "action_units": {
                "AU4": 0.9,  # Brow lowerer
                "AU5": 0.7,  # Upper lid raiser
                "AU7": 0.6,  # Lid tightener
                "AU23": 0.8,  # Lip tightener
            },
            "valence": -0.7,
            "arousal": 0.8,
            "dominant_expression": "angry",
            "expression_confidence": 0.8
        }
    ]
    
    for features in examples:
        result = analyzer.analyze(features)
        print(f"Facial features: {features['dominant_expression']}")
        print(f"Primary emotion: {result.primary.category.value} "
              f"(intensity: {result.primary.intensity:.2f}, "
              f"confidence: {result.primary.confidence:.2f})")
        
        if result.secondary:
            print("Secondary emotions:")
            for emotion, score in result.secondary.items():
                print(f"  - {emotion.value}: intensity={score.intensity:.2f}, "
                      f"confidence={score.confidence:.2f}")
        print()


if __name__ == "__main__":
    main()
