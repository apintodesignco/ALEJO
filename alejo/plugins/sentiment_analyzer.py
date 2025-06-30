"""
Sentiment Analysis Plugin for ALEJO
Provides advanced sentiment analysis capabilities
"""
import re
import logging
from typing import Dict, Any, List, Tuple
from collections import defaultdict

# Plugin metadata
PLUGIN_NAME = "sentiment_analyzer"
PLUGIN_VERSION = "1.0.0"
PLUGIN_DESCRIPTION = "Advanced sentiment analysis for text processing"
PLUGIN_AUTHOR = "ALEJO Development Team"
PLUGIN_DEPENDENCIES = {}
PLUGIN_REQUIRES_ALEJO = "0.1.0"
PLUGIN_TAGS = ["nlp", "sentiment", "text_processing", "emotional_intelligence"]

logger = logging.getLogger(__name__)

class SentimentAnalyzer:
    """
    Production-ready sentiment analysis plugin that enhances ALEJO's emotional intelligence
    capabilities by providing detailed sentiment analysis of text.
    """
    
    def __init__(self):
        self.positive_words = {
            'happy', 'joy', 'excellent', 'good', 'great', 'positive', 'wonderful', 
            'fantastic', 'delighted', 'pleased', 'love', 'awesome', 'amazing',
            'excited', 'thrilled', 'satisfied', 'glad', 'cheerful', 'content'
        }
        
        self.negative_words = {
            'sad', 'angry', 'upset', 'terrible', 'bad', 'awful', 'horrible', 
            'disappointed', 'miserable', 'hate', 'dislike', 'unfortunate', 'poor',
            'frustrating', 'annoyed', 'unhappy', 'depressed', 'worried', 'anxious'
        }
        
        self.intensity_modifiers = {
            'very': 1.5,
            'extremely': 2.0,
            'somewhat': 0.5,
            'slightly': 0.3,
            'really': 1.5,
            'absolutely': 2.0,
            'completely': 1.8,
            'totally': 1.8,
            'utterly': 1.9,
            'quite': 1.2,
            'rather': 1.1
        }
        
        # Initialize with default weights
        self.weights = {
            'word_sentiment': 1.0,
            'punctuation': 0.5,
            'capitalization': 0.7,
            'negation': 1.5
        }
        
    def analyze(self, text: str) -> Dict[str, Any]:
        """
        Analyze the sentiment of the provided text.
        
        Args:
            text: The text to analyze
            
        Returns:
            Dictionary containing sentiment analysis results
        """
        if not text or not isinstance(text, str):
            return {
                'sentiment': 'neutral',
                'score': 0.0,
                'confidence': 0.0,
                'emotions': {},
                'analysis': {}
            }
            
        # Clean and normalize text
        cleaned_text = self._preprocess_text(text)
        
        # Calculate base sentiment score
        sentiment_score, word_matches = self._calculate_base_sentiment(cleaned_text)
        
        # Apply modifiers
        sentiment_score = self._apply_modifiers(cleaned_text, sentiment_score)
        
        # Determine sentiment label
        sentiment_label = self._get_sentiment_label(sentiment_score)
        
        # Calculate confidence based on text length and match quality
        confidence = min(0.5 + (len(word_matches) / max(len(cleaned_text.split()), 1)) * 0.5, 0.95)
        
        # Detect emotions
        emotions = self._detect_emotions(cleaned_text)
        
        return {
            'sentiment': sentiment_label,
            'score': round(sentiment_score, 2),
            'confidence': round(confidence, 2),
            'emotions': emotions,
            'analysis': {
                'word_matches': word_matches,
                'text_length': len(cleaned_text.split()),
                'intensity': abs(sentiment_score)
            }
        }
        
    def _preprocess_text(self, text: str) -> str:
        """Preprocess text for analysis"""
        # Convert to lowercase
        text = text.lower()
        
        # Replace multiple spaces with single space
        text = re.sub(r'\s+', ' ', text)
        
        # Remove extra punctuation but preserve sentence endings
        text = re.sub(r'([.!?])\1+', r'\1', text)
        
        return text.strip()
        
    def _calculate_base_sentiment(self, text: str) -> Tuple[float, List[str]]:
        """Calculate base sentiment score from word matching"""
        words = text.split()
        score = 0.0
        matches = []
        
        for i, word in enumerate(words):
            # Clean word of punctuation for matching
            clean_word = re.sub(r'[^\w\s]', '', word)
            if not clean_word:
                continue
                
            # Check for negation (simple approach)
            negation = False
            if i > 0 and words[i-1] in {'not', "don't", "doesn't", "didn't", "won't", "can't", "no"}:
                negation = True
                
            # Match against sentiment lexicons
            if clean_word in self.positive_words:
                word_score = 1.0
                if negation:
                    word_score = -word_score * self.weights['negation']
                score += word_score * self.weights['word_sentiment']
                matches.append(clean_word)
                
            elif clean_word in self.negative_words:
                word_score = -1.0
                if negation:
                    word_score = -word_score * self.weights['negation']
                score += word_score * self.weights['word_sentiment']
                matches.append(clean_word)
                
        return score, matches
        
    def _apply_modifiers(self, text: str, base_score: float) -> float:
        """Apply various modifiers to the base sentiment score"""
        score = base_score
        
        # Check for intensity modifiers
        words = text.split()
        for i, word in enumerate(words):
            if word in self.intensity_modifiers and i < len(words) - 1:
                next_word = re.sub(r'[^\w\s]', '', words[i+1])
                if next_word in self.positive_words or next_word in self.negative_words:
                    # Apply intensity modifier
                    if base_score > 0:
                        score += base_score * (self.intensity_modifiers[word] - 1.0)
                    else:
                        score += base_score * (self.intensity_modifiers[word] - 1.0)
        
        # Check for exclamation marks (excitement/intensity)
        exclamations = text.count('!')
        if exclamations > 0:
            intensity = min(exclamations * 0.3, 1.0) * self.weights['punctuation']
            if score > 0:
                score += intensity
            elif score < 0:
                score -= intensity
                
        # Check for ALL CAPS (intensity)
        original_words = text.split()
        caps_words = [w for w in original_words if w.isupper() and len(w) > 1]
        if caps_words:
            caps_intensity = min(len(caps_words) / len(original_words), 0.8) * self.weights['capitalization']
            if score > 0:
                score += caps_intensity
            elif score < 0:
                score -= caps_intensity
                
        return score
        
    def _get_sentiment_label(self, score: float) -> str:
        """Convert sentiment score to label"""
        if score > 1.5:
            return "very positive"
        elif score > 0.5:
            return "positive"
        elif score > 0.0:
            return "slightly positive"
        elif score == 0.0:
            return "neutral"
        elif score > -0.5:
            return "slightly negative"
        elif score > -1.5:
            return "negative"
        else:
            return "very negative"
            
    def _detect_emotions(self, text: str) -> Dict[str, float]:
        """Detect specific emotions in text"""
        emotions = {
            'joy': 0.0,
            'sadness': 0.0,
            'anger': 0.0,
            'fear': 0.0,
            'surprise': 0.0,
            'disgust': 0.0
        }
        
        # Simple emotion detection based on keywords
        emotion_keywords = {
            'joy': ['happy', 'joy', 'delighted', 'pleased', 'glad', 'excited'],
            'sadness': ['sad', 'unhappy', 'depressed', 'miserable', 'gloomy'],
            'anger': ['angry', 'furious', 'annoyed', 'irritated', 'enraged'],
            'fear': ['afraid', 'scared', 'frightened', 'terrified', 'anxious'],
            'surprise': ['surprised', 'amazed', 'astonished', 'shocked'],
            'disgust': ['disgusted', 'revolted', 'repulsed', 'appalled']
        }
        
        words = set(text.split())
        for emotion, keywords in emotion_keywords.items():
            matches = words.intersection(set(keywords))
            if matches:
                emotions[emotion] = min(len(matches) / len(keywords) * 2.0, 1.0)
                
        return emotions
        
    def process(self, text: str) -> Dict[str, Any]:
        """
        Process text for sentiment analysis (alias for analyze).
        
        Args:
            text: The text to analyze
            
        Returns:
            Dictionary containing sentiment analysis results
        """
        return self.analyze(text)
        
    def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the plugin with the given parameters.
        
        Args:
            params: Dictionary containing parameters, must include 'text'
            
        Returns:
            Dictionary containing sentiment analysis results
        """
        if 'text' not in params:
            return {'error': 'Missing required parameter: text'}
            
        return self.analyze(params['text'])


# Plugin registration function
def register():
    """Return a plugin instance when the plugin is loaded"""
    return SentimentAnalyzer()
