"""
Simple script to test the EventBus integration with a mock emotion detector.
This avoids the PyTorch dependency issues while still testing the event system.
"""

import asyncio
import logging
import random
from alejo.core.events import Event, EventType, EventBus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MockEmotionDetector:
    """Mock implementation of the EmotionDetector for testing."""
    
    def __init__(self):
        self.event_bus = EventBus.get_instance()
        self.emotions = ["happy", "sad", "angry", "surprised", "fearful", "disgusted", "neutral"]
        
    async def initialize(self):
        """Initialize the detector."""
        logger.info("Mock emotion detector initialized")
        return True
        
    async def detect_emotion_from_text(self, text):
        """Mock emotion detection from text."""
        # Simple keyword-based emotion detection for testing
        text = text.lower()
        if "happy" in text or "joy" in text or "glad" in text:
            emotion = "happy"
        elif "sad" in text or "unhappy" in text or "depressed" in text:
            emotion = "sad"
        elif "angry" in text or "mad" in text or "frustrated" in text:
            emotion = "angry"
        elif "surprised" in text or "shocked" in text or "amazed" in text:
            emotion = "surprised"
        elif "scared" in text or "afraid" in text or "nervous" in text:
            emotion = "fearful"
        elif "disgust" in text or "gross" in text or "repulsed" in text:
            emotion = "disgusted"
        else:
            emotion = "neutral"
            
        confidence = random.uniform(0.7, 0.95)
        result = {"emotion": emotion, "confidence": confidence}
        
        # Publish the emotion detection event
        await self.event_bus.publish(
            Event(
                type=EventType.EMOTION_DETECTED,
                source="mock_emotion_detector",
                data=result
            )
        )
        
        return result

async def test_emotion_detector():
    """Test the MockEmotionDetector implementation."""
    logger.info("Starting MockEmotionDetector test")
    
    # Get the EventBus instance
    event_bus = EventBus.get_instance()
    
    # Create a test event handler to receive emotion detection results
    async def emotion_handler(event):
        logger.info(f"Received emotion event: {event.data}")
        return True
    
    # Subscribe to emotion events
    subscription_id = await event_bus.subscribe_by_type(emotion_handler, EventType.EMOTION_DETECTED)
    logger.info(f"Subscribed to emotion events with ID: {subscription_id}")
    
    # Create a mock emotion detector
    detector = MockEmotionDetector()
    
    # Initialize the detector
    await detector.initialize()
    
    # Test with some sample text
    text_samples = [
        "I am feeling very happy today!",
        "This makes me so angry and frustrated.",
        "I'm really sad about what happened yesterday.",
        "I'm quite nervous about the upcoming presentation.",
        "That's disgusting!",
        "Wow, I'm really surprised by this news.",
        "The weather is nice today."
    ]
    
    for text in text_samples:
        logger.info(f"Processing text: '{text}'")
        result = await detector.detect_emotion_from_text(text)
        logger.info(f"Detected emotion: {result}")
        # Small delay to see the events clearly
        await asyncio.sleep(0.5)
    
    # Clean up
    await event_bus.unsubscribe(subscription_id)
    
    logger.info("MockEmotionDetector test completed successfully")

if __name__ == "__main__":
    asyncio.run(test_emotion_detector())
