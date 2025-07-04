"""
ALEJO Text-based Emotion Analyzer

This module provides text analysis capabilities for emotion detection.
It uses lexicon-based approaches and can be extended with more advanced NLP models.
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple, Set

from alejo.cognitive.emotional.emotion_types import (
    EmotionCategory, EmotionIntensity, EmotionScore, 
    EmotionDetectionResult, InputModality, TextFeatures
)
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class TextEmotionAnalyzer:
    """
    Analyzes text to detect emotions using lexicon-based approaches.
    
    This class provides methods to detect emotions from text input using
    keyword matching, negation handling, and intensity analysis.
    """
    
    def __init__(self):
        """Initialize the text emotion analyzer with emotion lexicons."""
        # Emotion keywords for detection
        self.emotion_lexicon = self._initialize_emotion_lexicon()
        
        # Negation words that can flip emotion polarity
        self.negation_words = {
            "not", "no", "never", "none", "nobody", "nothing", "nowhere",
            "hardly", "barely", "scarcely", "doesn't", "isn't", "wasn't",
            "shouldn't", "wouldn't", "couldn't", "won't", "can't", "don't"
        }
        
        # Intensifier words that can amplify emotion intensity
        self.intensifiers = {
            "very", "extremely", "incredibly", "absolutely", "completely",
            "totally", "utterly", "really", "so", "too", "quite", "particularly",
            "especially", "exceedingly", "immensely", "enormously"
        }
        
        logger.info("Text emotion analyzer initialized")
    
    def _initialize_emotion_lexicon(self) -> Dict[EmotionCategory, Set[str]]:
        """
        Initialize the emotion lexicon with keywords for each emotion category.
        
        Returns:
            Dictionary mapping emotion categories to sets of keywords
        """
        lexicon = {
            EmotionCategory.JOY: {
                "happy", "joy", "delighted", "pleased", "glad", "cheerful",
                "content", "satisfied", "thrilled", "elated", "ecstatic",
                "overjoyed", "jubilant", "blissful", "enjoyment", "happiness",
                "delight", "pleasure", "triumph", "euphoria", "wonderful",
                "great", "excellent", "fantastic", "terrific", "awesome",
                "love", "adore", "like", "fond", "celebrate", "congratulate"
            },
            EmotionCategory.SADNESS: {
                "sad", "unhappy", "depressed", "miserable", "down", "upset",
                "gloomy", "heartbroken", "disappointed", "grief", "sorrow",
                "melancholy", "despair", "despondent", "disheartened", "forlorn",
                "dejected", "downcast", "blue", "dismal", "mourn", "regret",
                "miss", "lonely", "alone", "isolated", "abandoned", "rejected",
                "hurt", "pain", "ache", "suffer", "crying", "tears", "weeping"
            },
            EmotionCategory.ANGER: {
                "angry", "furious", "annoyed", "irritated", "mad", "outraged",
                "enraged", "hostile", "bitter", "indignant", "irate", "fuming",
                "seething", "livid", "infuriated", "incensed", "resentful",
                "hate", "hatred", "dislike", "despise", "loathe", "detest",
                "contempt", "disgusted", "frustrated", "exasperated", "provoked",
                "offended", "insulted", "agitated", "aggravated"
            },
            EmotionCategory.FEAR: {
                "afraid", "scared", "fearful", "terrified", "worried", "anxious",
                "nervous", "panicked", "alarmed", "dread", "horror", "terror",
                "fright", "frightened", "petrified", "startled", "threatened",
                "intimidated", "apprehensive", "uneasy", "tense", "stressed",
                "distressed", "phobia", "panic", "paranoid", "suspicious",
                "concern", "concerned", "troubled", "disturbed"
            },
            EmotionCategory.SURPRISE: {
                "surprised", "shocked", "amazed", "astonished", "stunned",
                "startled", "unexpected", "wonder", "awe", "bewildered",
                "dumbfounded", "flabbergasted", "staggered", "taken aback",
                "astounded", "speechless", "incredulous", "unbelievable",
                "incredible", "extraordinary", "remarkable", "striking",
                "stunning", "overwhelming", "breathtaking", "unexpected"
            },
            EmotionCategory.DISGUST: {
                "disgusted", "revolted", "appalled", "repulsed", "nauseated",
                "offensive", "distasteful", "objectionable", "repugnant",
                "repellent", "sickened", "gross", "nasty", "foul", "vile",
                "loathsome", "abhorrent", "hideous", "detestable", "odious",
                "repulsive", "sickening", "yucky", "icky", "unpleasant"
            },
            EmotionCategory.TRUST: {
                "trust", "believe", "confident", "faith", "sure", "certain",
                "reliable", "dependable", "assured", "conviction", "credible",
                "trustworthy", "honest", "loyal", "faithful", "devoted",
                "dedicated", "committed", "secure", "safe", "protected",
                "reliance", "count on", "rely", "respect", "admire"
            },
            EmotionCategory.ANTICIPATION: {
                "anticipate", "expect", "looking forward", "hope", "await",
                "eager", "excited about", "anticipation", "prospect",
                "forthcoming", "upcoming", "future", "soon", "predict",
                "forecast", "foresee", "envisage", "planning", "prepare",
                "ready", "waiting", "countdown", "suspense", "expectancy"
            }
        }
        
        # Convert lists to sets for faster lookup
        return {emotion: set(words) for emotion, words in lexicon.items()}
    
    @handle_exceptions("Failed to analyze text for emotions")
    def analyze(self, text: str, context: Optional[Dict[str, Any]] = None) -> EmotionDetectionResult:
        """
        Analyze text to detect emotions.
        
        Args:
            text: Text to analyze
            context: Optional context information
            
        Returns:
            EmotionDetectionResult with detected emotions
        """
        if not text:
            # Return neutral emotion for empty text
            neutral_score = EmotionScore.create(
                category=EmotionCategory.NEUTRAL,
                intensity=0.5,
                confidence=0.9
            )
            return EmotionDetectionResult(
                primary=neutral_score,
                secondary={},
                modality=InputModality.TEXT,
                features={"raw_text": ""}
            )
        
        # Extract features from text
        features = self._extract_features(text)
        
        # Calculate emotion scores
        emotion_scores = self._calculate_emotion_scores(features)
        
        # Determine primary emotion
        primary_emotion, secondary_emotions = self._determine_primary_emotion(emotion_scores)
        
        # Create detection result
        return EmotionDetectionResult(
            primary=primary_emotion,
            secondary=secondary_emotions,
            modality=InputModality.TEXT,
            features=features,
            context=context
        )
    
    def _extract_features(self, text: str) -> TextFeatures:
        """
        Extract features from text for emotion analysis.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary of extracted features
        """
        text_lower = text.lower()
        
        # Count emotion keywords
        emotion_keywords = {}
        for emotion, keywords in self.emotion_lexicon.items():
            found_keywords = []
            for keyword in keywords:
                # Look for whole words only
                pattern = r'\b' + re.escape(keyword) + r'\b'
                if re.search(pattern, text_lower):
                    found_keywords.append(keyword)
            
            if found_keywords:
                emotion_keywords[emotion] = found_keywords
        
        # Count negation words
        negation_count = sum(1 for word in self.negation_words if re.search(r'\b' + re.escape(word) + r'\b', text_lower))
        
        # Count intensifier words
        intensifier_count = sum(1 for word in self.intensifiers if re.search(r'\b' + re.escape(word) + r'\b', text_lower))
        
        # Calculate simple sentiment score (-1.0 to 1.0)
        # Positive emotions contribute positive sentiment, negative emotions contribute negative
        positive_emotions = [EmotionCategory.JOY, EmotionCategory.TRUST, EmotionCategory.ANTICIPATION]
        negative_emotions = [EmotionCategory.SADNESS, EmotionCategory.ANGER, EmotionCategory.FEAR, EmotionCategory.DISGUST]
        
        positive_count = sum(len(emotion_keywords.get(emotion, [])) for emotion in positive_emotions)
        negative_count = sum(len(emotion_keywords.get(emotion, [])) for emotion in negative_emotions)
        
        total_count = positive_count + negative_count
        sentiment_score = 0.0
        if total_count > 0:
            sentiment_score = (positive_count - negative_count) / total_count
            # Adjust for negations
            if negation_count > 0:
                sentiment_score *= -1
        
        return {
            "emotion_keywords": emotion_keywords,
            "negation_count": negation_count,
            "intensifier_count": intensifier_count,
            "text_length": len(text),
            "sentiment_score": sentiment_score,
            "raw_text": text
        }
    
    def _calculate_emotion_scores(self, features: TextFeatures) -> Dict[EmotionCategory, EmotionScore]:
        """
        Calculate emotion scores based on extracted features.
        
        Args:
            features: Extracted text features
            
        Returns:
            Dictionary mapping emotion categories to scores
        """
        emotion_scores = {}
        emotion_keywords = features.get("emotion_keywords", {})
        
        # If no emotions detected, return neutral
        if not emotion_keywords:
            neutral_score = EmotionScore.create(
                category=EmotionCategory.NEUTRAL,
                intensity=0.5,
                confidence=0.7
            )
            return {EmotionCategory.NEUTRAL: neutral_score}
        
        # Calculate base scores from keyword counts
        max_keywords = max(len(keywords) for keywords in emotion_keywords.values())
        
        for emotion, keywords in emotion_keywords.items():
            # Base intensity from keyword count relative to max
            base_intensity = len(keywords) / max_keywords if max_keywords > 0 else 0.5
            
            # Adjust intensity based on intensifiers
            intensity = min(base_intensity * (1.0 + 0.2 * features.get("intensifier_count", 0)), 1.0)
            
            # Calculate confidence based on keyword count and text length
            # More keywords and shorter text = higher confidence
            keyword_ratio = len(keywords) / features.get("text_length", 1) * 10  # Scale factor
            confidence = min(0.5 + keyword_ratio, 0.9)  # Cap at 0.9
            
            # Create emotion score
            emotion_scores[emotion] = EmotionScore.create(
                category=emotion,
                intensity=intensity,
                confidence=confidence
            )
        
        return emotion_scores
    
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
    analyzer = TextEmotionAnalyzer()
    
    # Test with some example text
    examples = [
        "I'm really happy about this new project!",
        "I'm feeling sad and disappointed today.",
        "That makes me so angry!",
        "I'm worried about the upcoming presentation."
    ]
    
    for text in examples:
        result = analyzer.analyze(text)
        print(f"Text: {text}")
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
