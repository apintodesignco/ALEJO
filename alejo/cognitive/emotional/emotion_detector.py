"""
ALEJO Emotion Detector

This module implements basic emotion detection capabilities for text input.
It provides a foundation that can be extended for other modalities.
"""

import logging
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple

from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


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


class EmotionDetector:
    """
    Basic emotion detector for text analysis.
    
    This class provides methods to detect emotions from text input.
    It uses a simple keyword-based approach that can be extended with
    more sophisticated NLP models in the future.
    """
    
    def __init__(self):
        """Initialize the emotion detector."""
        # Emotion keywords for simple detection
        self.emotion_keywords = {
            EmotionCategory.JOY: [
                "happy", "joy", "delighted", "pleased", "glad", "excited",
                "thrilled", "cheerful", "content", "satisfied"
            ],
            EmotionCategory.SADNESS: [
                "sad", "unhappy", "depressed", "miserable", "down", "upset",
                "gloomy", "heartbroken", "disappointed", "grief"
            ],
            EmotionCategory.ANGER: [
                "angry", "furious", "annoyed", "irritated", "mad", "outraged",
                "enraged", "hostile", "bitter", "indignant"
            ],
            EmotionCategory.FEAR: [
                "afraid", "scared", "fearful", "terrified", "worried", "anxious",
                "nervous", "panicked", "alarmed", "dread"
            ],
            EmotionCategory.SURPRISE: [
                "surprised", "shocked", "amazed", "astonished", "stunned",
                "startled", "unexpected", "wonder", "awe"
            ],
            EmotionCategory.DISGUST: [
                "disgusted", "revolted", "appalled", "repulsed", "nauseated",
                "offensive", "distasteful", "objectionable"
            ],
            EmotionCategory.TRUST: [
                "trust", "believe", "confident", "faith", "sure", "certain",
                "reliable", "dependable", "assured"
            ],
            EmotionCategory.ANTICIPATION: [
                "anticipate", "expect", "looking forward", "hope", "await",
                "eager", "excited about", "anticipation"
            ]
        }
        
        logger.info("Emotion detector initialized")
    
    @handle_exceptions("Failed to detect emotion from text")
    def detect_from_text(self, text: str) -> Dict[str, Any]:
        """
        Detect emotions from text input.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary with detected emotions and confidence scores
        """
        if not text:
            return {
                "primary_emotion": EmotionCategory.NEUTRAL.value,
                "primary_intensity": 0.5,
                "secondary_emotions": {},
                "confidence": 0.5
            }
        
        # Count emotion keywords in text
        emotion_counts = {emotion: 0 for emotion in EmotionCategory}
        text_lower = text.lower()
        
        for emotion, keywords in self.emotion_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    emotion_counts[emotion] += 1
        
        # Find primary emotion
        max_count = max(emotion_counts.values())
        if max_count == 0:
            primary_emotion = EmotionCategory.NEUTRAL
            primary_intensity = 0.5
            confidence = 0.5
        else:
            primary_emotions = [e for e, c in emotion_counts.items() if c == max_count]
            primary_emotion = primary_emotions[0]  # Take first if multiple match
            primary_intensity = min(0.5 + (max_count * 0.1), 1.0)  # Scale intensity by count
            confidence = min(0.5 + (max_count * 0.1), 0.9)  # Simple confidence heuristic
        
        # Get secondary emotions
        secondary_emotions = {
            emotion.value: count / (max_count * 2) if max_count > 0 else 0
            for emotion, count in emotion_counts.items()
            if emotion != primary_emotion and count > 0
        }
        
        return {
            "primary_emotion": primary_emotion.value,
            "primary_intensity": primary_intensity,
            "secondary_emotions": secondary_emotions,
            "confidence": confidence
        }


# Example usage
def main():
    detector = EmotionDetector()
    
    # Test with some example text
    examples = [
        "I'm really happy about this new project!",
        "I'm feeling sad and disappointed today.",
        "That makes me so angry!",
        "I'm worried about the upcoming presentation."
    ]
    
    for text in examples:
        result = detector.detect_from_text(text)
        print(f"Text: {text}")
        print(f"Detected emotion: {result['primary_emotion']} "
              f"(intensity: {result['primary_intensity']:.2f}, "
              f"confidence: {result['confidence']:.2f})")
        print()


if __name__ == "__main__":
    main()
