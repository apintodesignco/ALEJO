"""
Simple script to test the emotion detector directly without pytest dependencies.
"""

import asyncio
import logging
from alejo.cognitive.emotional.emotion_detector_updated import EmotionDetector
from alejo.core.events import Event, EventType, EventBus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_emotion_detector():
    """Test the EmotionDetector implementation."""
    logger.info("Starting EmotionDetector test")
    
    # Get the EventBus instance
    event_bus = EventBus.get_instance()
    
    # Create a test event handler to receive emotion detection results
    async def emotion_handler(event):
        if event.type == EventType.EMOTION_DETECTED:
            logger.info(f"Received emotion event: {event.data}")
        return True
    
    # Subscribe to emotion events
    subscription_id = await event_bus.subscribe_by_type(emotion_handler, EventType.EMOTION_DETECTED)
    logger.info(f"Subscribed to emotion events with ID: {subscription_id}")
    
    # Create an emotion detector with the EventBus singleton
    detector = EmotionDetector(event_bus=event_bus)
    logger.info("Emotion detector initialized with EventBus singleton")
    
    # Test with some sample text
    text_samples = [
        "I am feeling very happy today!",
        "This makes me so angry and frustrated.",
        "I'm really sad about what happened yesterday.",
        "I'm quite nervous about the upcoming presentation."
    ]
    
    for text in text_samples:
        logger.info(f"Processing text: '{text}'")
        result = await detector.detect_from_text(text, session_id="test_session")
        logger.info(f"Detected emotion: {result.primary.category.value} (intensity: {result.primary.intensity:.2f})")
        
        # Wait briefly to allow event processing
        await asyncio.sleep(0.1)
    
    # Clean up
    await event_bus.unsubscribe(subscription_id)
    
    logger.info("EmotionDetector test completed successfully")

if __name__ == "__main__":
    asyncio.run(test_emotion_detector())
