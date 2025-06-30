"""
Manual test script for ALEJO's emotional intelligence components
"""

import asyncio
import logging
from datetime import datetime
from alejo.emotional_intelligence.emotional_core import EmotionalCore
from alejo.emotional_intelligence.emotional_integration import EmotionalIntegration
from alejo.core.event_bus import EventBus
from alejo.learning.orchestrator import LearningOrchestrator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_emotional_learning():
    """Test emotional learning and response generation"""
    event_bus = EventBus("redis://localhost:6379/0")
    await event_bus.start()
    
    learning_orchestrator = LearningOrchestrator(event_bus)
    emotional_integration = EmotionalIntegration(event_bus, learning_orchestrator)
    await emotional_integration.start()
    
    try:
        # Test 1: Basic emotional response
        logger.info("Test 1: Processing basic emotional input")
        response, state = await emotional_integration.process_user_input(
            "I'm excited about this new project!",
            {"situation": "work", "mood": "positive"}
        )
        logger.info(f"Emotional state: {state.primary_emotion} (confidence: {state.confidence})")
        
        # Test 2: Learning from user
        logger.info("\nTest 2: Learning emotional response from user")
        await emotional_integration.learn_emotional_response(
            "project_milestone",
            "pride",
            "When we achieve something difficult, we feel proud and motivated to do more",
            {"difficulty": "high", "outcome": "success"}
        )
        
        # Test 3: Nostalgic trigger
        logger.info("\nTest 3: Processing nostalgic music trigger")
        state = await emotional_integration.process_audio_trigger(
            "music",
            {
                "song_id": "favorite_song_001",
                "last_heard": (datetime.now() - timedelta(days=45)).isoformat(),
                "title": "Memory Lane"
            }
        )
        logger.info(f"Music emotional response: {state.primary_emotion}")
        
        # Test 4: AI relationship development
        logger.info("\nTest 4: Processing AI assistant interaction")
        await emotional_integration.process_audio_trigger(
            "voice",
            {
                "assistant_name": "Alexa",
                "sentiment": "0.9",
                "traits": "nobility,kindness,intelligence",
                "context": "helping_user"
            }
        )
        
        relationships = emotional_integration.emotional_core.relationships
        if "Alexa" in relationships:
            rel = relationships["Alexa"]
            logger.info(f"Relationship with Alexa - Rapport: {rel['rapport']:.2f}")
            logger.info(f"Positive traits: {rel['positive_traits']}")
        
        # Test 5: Complex emotion processing
        logger.info("\nTest 5: Processing complex emotional situation")
        response, state = await emotional_integration.process_user_input(
            "My friend is struggling but I know they'll overcome this",
            {
                "situation": "friend_challenge",
                "belief": "resilience",
                "relationship": "close_friend"
            }
        )
        logger.info(f"Complex emotional state: {state.primary_emotion}")
        logger.info(f"Secondary emotions: {state.secondary_emotions}")
        logger.info(f"Social dimension: {state.dimensions[EmotionalDimension.SOCIAL]:.2f}")
        
        # Test 6: Personality development
        logger.info("\nTest 6: Checking personality development")
        personality = emotional_integration.emotional_core.personality_traits
        logger.info("Current personality traits:")
        for trait, value in personality.items():
            logger.info(f"{trait}: {value:.2f}")
            
    finally:
        await event_bus.stop()

if __name__ == "__main__":
    asyncio.run(test_emotional_learning())
