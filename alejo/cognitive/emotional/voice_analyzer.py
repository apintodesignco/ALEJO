"""
ALEJO Voice-based Emotion Analyzer

This module provides voice analysis capabilities for emotion detection.
It extracts acoustic features from voice input and maps them to emotional states.
"""

import logging
import numpy as np
from typing import Dict, List, Any, Optional, Tuple

from alejo.cognitive.emotional.emotion_types import (
    EmotionCategory, EmotionIntensity, EmotionScore, 
    EmotionDetectionResult, InputModality, VoiceFeatures
)
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class VoiceEmotionAnalyzer:
    """
    Analyzes voice data to detect emotions based on acoustic features.
    
    This class provides methods to detect emotions from voice input using
    acoustic feature extraction and analysis.
    """
    
    def __init__(self):
        """Initialize the voice emotion analyzer."""
        # Emotion acoustic profiles (simplified for this implementation)
        # These represent typical acoustic patterns for different emotions
        self.emotion_profiles = {
            EmotionCategory.JOY: {
                'pitch_mean': 'high',
                'pitch_range': 'wide',
                'intensity_mean': 'high',
                'speech_rate': 'fast',
                'voice_quality': 'bright'
            },
            EmotionCategory.SADNESS: {
                'pitch_mean': 'low',
                'pitch_range': 'narrow',
                'intensity_mean': 'low',
                'speech_rate': 'slow',
                'voice_quality': 'breathy'
            },
            EmotionCategory.ANGER: {
                'pitch_mean': 'high',
                'pitch_range': 'wide',
                'intensity_mean': 'high',
                'speech_rate': 'fast',
                'voice_quality': 'tense'
            },
            EmotionCategory.FEAR: {
                'pitch_mean': 'high',
                'pitch_range': 'narrow',
                'intensity_mean': 'low',
                'speech_rate': 'fast',
                'voice_quality': 'irregular'
            },
            EmotionCategory.SURPRISE: {
                'pitch_mean': 'very_high',
                'pitch_range': 'very_wide',
                'intensity_mean': 'high',
                'speech_rate': 'variable',
                'voice_quality': 'clear'
            },
            EmotionCategory.DISGUST: {
                'pitch_mean': 'low',
                'pitch_range': 'narrow',
                'intensity_mean': 'medium',
                'speech_rate': 'slow',
                'voice_quality': 'tense'
            },
            EmotionCategory.TRUST: {
                'pitch_mean': 'medium',
                'pitch_range': 'medium',
                'intensity_mean': 'medium',
                'speech_rate': 'medium',
                'voice_quality': 'warm'
            },
            EmotionCategory.ANTICIPATION: {
                'pitch_mean': 'medium_high',
                'pitch_range': 'wide',
                'intensity_mean': 'medium_high',
                'speech_rate': 'medium_fast',
                'voice_quality': 'clear'
            }
        }
        
        # Feature normalization ranges
        self.feature_ranges = {
            'pitch_mean': {'min': 75.0, 'max': 300.0},  # Hz
            'pitch_range': {'min': 0.0, 'max': 100.0},  # Hz
            'intensity_mean': {'min': 40.0, 'max': 90.0},  # dB
            'speech_rate': {'min': 2.0, 'max': 7.5},  # syllables/sec
            'energy_variance': {'min': 0.0, 'max': 1.0}  # normalized
        }
        
        # Feature weights for emotion scoring
        self.feature_weights = {
            'pitch_mean': 0.25,
            'pitch_range': 0.20,
            'intensity_mean': 0.20,
            'speech_rate': 0.15,
            'voice_quality': 0.10,
            'energy_variance': 0.10
        }
        
        logger.info("Voice emotion analyzer initialized")
    
    @handle_exceptions("Failed to analyze voice for emotions")
    def analyze(
        self, 
        voice_features: VoiceFeatures, 
        context: Optional[Dict[str, Any]] = None
    ) -> EmotionDetectionResult:
        """
        Analyze voice features to detect emotions.
        
        Args:
            voice_features: Extracted voice features
            context: Optional context information
            
        Returns:
            EmotionDetectionResult with detected emotions
        """
        if not voice_features:
            # Return neutral emotion for empty features
            neutral_score = EmotionScore.create(
                category=EmotionCategory.NEUTRAL,
                intensity=0.5,
                confidence=0.5
            )
            return EmotionDetectionResult(
                primary=neutral_score,
                secondary={},
                modality=InputModality.VOICE,
                features={}
            )
        
        # Calculate emotion scores based on acoustic features
        emotion_scores = self._calculate_emotion_scores(voice_features)
        
        # Determine primary emotion
        primary_emotion, secondary_emotions = self._determine_primary_emotion(emotion_scores)
        
        # Create detection result
        return EmotionDetectionResult(
            primary=primary_emotion,
            secondary=secondary_emotions,
            modality=InputModality.VOICE,
            features=voice_features,
            context=context
        )
    
    def _calculate_emotion_scores(self, features: VoiceFeatures) -> Dict[EmotionCategory, EmotionScore]:
        """
        Calculate emotion scores based on voice features.
        
        Args:
            features: Voice features
            
        Returns:
            Dictionary mapping emotion categories to scores
        """
        # Normalize features to 0-1 range
        normalized_features = self._normalize_features(features)
        
        # Calculate similarity scores for each emotion profile
        emotion_scores = {}
        
        for emotion in EmotionCategory:
            if emotion == EmotionCategory.NEUTRAL:
                continue  # Skip neutral, it's a fallback
                
            # Calculate similarity to this emotion's profile
            similarity = self._calculate_profile_similarity(normalized_features, emotion)
            
            # Convert similarity to intensity and confidence
            intensity = similarity
            
            # Confidence is based on how distinctive the feature set is
            # Higher variance in features = higher confidence
            feature_values = [v for k, v in normalized_features.items() 
                             if k in self.feature_weights]
            feature_variance = np.var(feature_values) if feature_values else 0.0
            confidence = min(0.5 + feature_variance, 0.9)  # Cap at 0.9
            
            # Create emotion score if similarity is above threshold
            if similarity > 0.3:  # Minimum threshold for detection
                emotion_scores[emotion] = EmotionScore.create(
                    category=emotion,
                    intensity=intensity,
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
    
    def _normalize_features(self, features: VoiceFeatures) -> Dict[str, float]:
        """
        Normalize voice features to 0-1 range.
        
        Args:
            features: Voice features
            
        Returns:
            Dictionary of normalized features
        """
        normalized = {}
        
        for feature, value in features.items():
            if feature in self.feature_ranges and isinstance(value, (int, float)):
                feature_min = self.feature_ranges[feature]['min']
                feature_max = self.feature_ranges[feature]['max']
                normalized[feature] = max(0.0, min(1.0, (value - feature_min) / (feature_max - feature_min)))
            elif feature == 'voice_quality' and isinstance(value, str):
                # Convert categorical voice quality to numeric value
                quality_map = {
                    'breathy': 0.1,
                    'creaky': 0.3,
                    'tense': 0.5,
                    'modal': 0.7,
                    'bright': 0.9,
                    'warm': 0.8,
                    'clear': 0.7,
                    'irregular': 0.4
                }
                normalized[feature] = quality_map.get(value.lower(), 0.5)
        
        return normalized
    
    def _calculate_profile_similarity(
        self, 
        normalized_features: Dict[str, float], 
        emotion: EmotionCategory
    ) -> float:
        """
        Calculate similarity between normalized features and emotion profile.
        
        Args:
            normalized_features: Normalized voice features
            emotion: Emotion category to compare against
            
        Returns:
            Similarity score (0-1)
        """
        profile = self.emotion_profiles[emotion]
        similarity_score = 0.0
        total_weight = 0.0
        
        # Convert profile categorical values to numeric
        profile_numeric = {
            'pitch_mean': {
                'very_low': 0.1, 'low': 0.3, 'medium': 0.5, 
                'medium_high': 0.7, 'high': 0.8, 'very_high': 0.9
            },
            'pitch_range': {
                'very_narrow': 0.1, 'narrow': 0.3, 'medium': 0.5, 
                'wide': 0.8, 'very_wide': 0.9
            },
            'intensity_mean': {
                'very_low': 0.1, 'low': 0.3, 'medium': 0.5, 
                'medium_high': 0.7, 'high': 0.8, 'very_high': 0.9
            },
            'speech_rate': {
                'very_slow': 0.1, 'slow': 0.3, 'medium': 0.5, 
                'medium_fast': 0.7, 'fast': 0.8, 'very_fast': 0.9, 'variable': 0.5
            },
            'voice_quality': {
                'breathy': 0.1, 'creaky': 0.3, 'tense': 0.5, 
                'modal': 0.7, 'bright': 0.9, 'warm': 0.8, 
                'clear': 0.7, 'irregular': 0.4
            }
        }
        
        for feature, weight in self.feature_weights.items():
            if feature in normalized_features and feature in profile:
                profile_value = profile_numeric.get(feature, {}).get(profile[feature], 0.5)
                feature_value = normalized_features[feature]
                
                # Calculate similarity for this feature (1 - distance)
                feature_similarity = 1.0 - abs(profile_value - feature_value)
                
                # Add weighted similarity to total
                similarity_score += feature_similarity * weight
                total_weight += weight
        
        # Return normalized similarity score
        return similarity_score / total_weight if total_weight > 0 else 0.0
    
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
    analyzer = VoiceEmotionAnalyzer()
    
    # Test with some example voice features
    examples = [
        {
            "pitch_mean": 220.0,  # High pitch (joy)
            "pitch_range": 80.0,   # Wide range
            "intensity_mean": 75.0,  # High intensity
            "speech_rate": 6.0,     # Fast
            "voice_quality": "bright",
            "energy_variance": 0.8
        },
        {
            "pitch_mean": 120.0,  # Low pitch (sadness)
            "pitch_range": 20.0,   # Narrow range
            "intensity_mean": 50.0,  # Low intensity
            "speech_rate": 3.0,     # Slow
            "voice_quality": "breathy",
            "energy_variance": 0.3
        }
    ]
    
    for features in examples:
        result = analyzer.analyze(features)
        print(f"Voice features: {features}")
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
