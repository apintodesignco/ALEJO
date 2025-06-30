import logging
from typing import Dict

logger = logging.getLogger(__name__)

class EmotionRecognition:
    """Stub for the EmotionRecognition model."""
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(EmotionRecognition, cls).__new__(cls)
        return cls._instance

    def __init__(self, model_name: str = 'default'):
        logger.info("Initializing EmotionRecognition stub.")
        self.model_name = model_name

    def analyze_emotion(self, text: str) -> Dict[str, float]:
        """Returns a mock emotional analysis based on keywords."""
        logger.debug(f"Analyzing emotion for text (stub): {text[:30]}...")
        text = text.lower()
        if "happy" in text or "joy" in text:
            return {'joy': 0.8, 'sadness': 0.1, 'neutral': 0.1}
        if "sad" in text or "cry" in text:
            return {'joy': 0.1, 'sadness': 0.8, 'neutral': 0.1}
        if "angry" in text or "furious" in text:
            return {'anger': 0.8, 'sadness': 0.1, 'neutral': 0.1}
        
        return {
            'joy': 0.1,
            'sadness': 0.1,
            'anger': 0.1,
            'fear': 0.1,
            'surprise': 0.1,
            'disgust': 0.1,
            'neutral': 0.4
        }

    def get_dominant_emotion(self, text: str) -> str:
        """Returns the dominant emotion from the mock analysis."""
        emotions = self.analyze_emotion(text)
        return max(emotions, key=emotions.get)
