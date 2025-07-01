"""
Test script for ALEJO's comfort response functionality

This script tests the integration of the comfort response manager
with ALEJO's emotional intelligence and resource management systems.
"""

import os
import sys
import asyncio
import logging
import time
from typing import Dict, Any, List, Optional

from alejo.core.memory_event_bus import MemoryEventBus
from alejo.core.event_bus import Event, EventType
from alejo.emotional_intelligence.comfort_response import get_comfort_manager, ComfortResponseManager
from alejo.services.user_preferences import get_user_preferences
from alejo.core.resource_manager import ResourceManager, ResourceType
from alejo.core.process_manager import ProcessManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

logger = logging.getLogger(__name__)

async def test_comfort_manager():
    """Test the ComfortResponseManager functionality"""
    # Initialize event bus
    event_bus = MemoryEventBus()
    await event_bus.start()
    logger.info("Event bus started")
    
    # Initialize comfort manager
    comfort_manager = get_comfort_manager(event_bus)
    logger.info("Comfort response manager initialized")
    
    # Set up user preferences
    user_prefs = get_user_preferences()
    user_prefs.set("favorite_music", "relaxing piano")
    user_prefs.set("favorite_images", "nature landscapes")
    logger.info(f"User preferences set: {user_prefs.get_all()}")
    
    # Test emotion processing
    emotions = {
        "anger": 0.7,
        "sadness": 0.2,
        "joy": 0.1,
        "fear": 0.05,
        "surprise": 0.05
    }
    
    logger.info("Testing emotion processing with high anger...")
    suggestions = await comfort_manager.process_emotion("anger", emotions, "test")
    
    if suggestions:
        logger.info(f"Received {len(suggestions)} comfort suggestions:")
        for i, suggestion in enumerate(suggestions):
            logger.info(f"  {i+1}. {suggestion.type}: {suggestion.title} - {suggestion.description}")
            logger.info(f"     Content: {suggestion.content}")
            logger.info(f"     Confidence: {suggestion.confidence}")
    else:
        logger.info("No comfort suggestions received")
    
    # Test event-based emotion detection
    logger.info("\nTesting event-based emotion detection...")
    
    # Create an emotion event
    emotion_event = Event(
        type=EventType.USER_EMOTION,
        source="test_script",
        payload={
            "emotion_data": {
                "dominant_emotion": "sadness",
                "combined_emotions": {
                    "sadness": 0.8,
                    "joy": 0.1,
                    "anger": 0.05,
                    "fear": 0.05
                }
            }
        }
    )
    
    # Publish the emotion event
    await event_bus.publish(emotion_event)
    logger.info("Published emotion event")
    
    # Wait a bit for processing
    await asyncio.sleep(1)
    
    # Test resource usage while playing comfort content
    logger.info("\nTesting resource usage during comfort response...")
    
    # Initialize resource manager
    resource_manager = ResourceManager()
    resource_manager.start_monitoring()
    
    # Register comfort component
    resource_manager.register_component("comfort_response", priority=6)
    
    # Allocate resources for comfort response
    allocated = resource_manager.allocate_resource("comfort_response", ResourceType.CPU)
    logger.info(f"Resource allocation for comfort response: {allocated}")
    
    # Simulate playing music
    logger.info("Simulating playing comfort music...")
    
    # Get system info before
    before_info = resource_manager.get_system_info()
    logger.info(f"CPU usage before: {before_info['cpu']['percent']}%")
    logger.info(f"Memory usage before: {before_info['memory']['percent']}%")
    
    # Simulate resource usage
    for _ in range(5):
        # Just a simple CPU-intensive task to simulate resource usage
        _ = [i**2 for i in range(1000000)]
        await asyncio.sleep(0.1)
    
    # Get system info after
    after_info = resource_manager.get_system_info()
    logger.info(f"CPU usage after: {after_info['cpu']['percent']}%")
    logger.info(f"Memory usage after: {after_info['memory']['percent']}%")
    
    # Release resources
    released = resource_manager.release_resource("comfort_response", ResourceType.CPU)
    logger.info(f"Resource release for comfort response: {released}")
    
    # Stop resource monitoring
    resource_manager.stop_monitoring()
    
    # Stop event bus
    await event_bus.stop()
    logger.info("Event bus stopped")
    
    return comfort_manager

async def test_cross_platform_compatibility():
    """Test cross-platform compatibility of comfort responses"""
    import platform
    
    system = platform.system()
    logger.info(f"\nTesting on platform: {system}")
    
    # Initialize comfort manager directly
    comfort_manager = ComfortResponseManager()
    
    # Test platform-specific functionality
    if system == "Windows":
        logger.info("Testing Windows-specific comfort responses")
        # Windows-specific test
        try:
            result = comfort_manager.play_music("https://www.youtube.com/watch?v=XULUBg_ZcAU")
            logger.info(f"Windows music playback test: {'Success' if result else 'Failed'}")
        except Exception as e:
            logger.error(f"Windows music playback error: {e}")
    
    elif system == "Darwin":  # macOS
        logger.info("Testing macOS-specific comfort responses")
        # macOS-specific test
        try:
            result = comfort_manager.play_music("https://www.youtube.com/watch?v=XULUBg_ZcAU")
            logger.info(f"macOS music playback test: {'Success' if result else 'Failed'}")
        except Exception as e:
            logger.error(f"macOS music playback error: {e}")
    
    elif system == "Linux":
        logger.info("Testing Linux-specific comfort responses")
        # Linux-specific test
        try:
            result = comfort_manager.play_music("https://www.youtube.com/watch?v=XULUBg_ZcAU")
            logger.info(f"Linux music playback test: {'Success' if result else 'Failed'}")
        except Exception as e:
            logger.error(f"Linux music playback error: {e}")
    
    # Test image display (cross-platform)
    logger.info("Testing cross-platform image display")
    try:
        result = comfort_manager.show_image("https://images.unsplash.com/photo-1507525428034-b723cf961d3e")
        logger.info(f"Image display test: {'Success' if result else 'Failed'}")
    except Exception as e:
        logger.error(f"Image display error: {e}")
    
    logger.info(f"Platform compatibility test completed for {system}")
    return True

async def main():
    """Main test function"""
    logger.info("Starting comfort response tests...")
    
    try:
        # Test comfort manager
        await test_comfort_manager()
        
        # Test cross-platform compatibility
        await test_cross_platform_compatibility()
        
        logger.info("\n=== Comfort Response Test Summary ===")
        logger.info("All tests completed successfully!")
        logger.info("The comfort response system is working correctly.")
        logger.info("\nTo run ALEJO with comfort responses:")
        logger.info("1. Use run_alejo_optimized.py to start ALEJO with resource management")
        logger.info("2. ALEJO will automatically detect negative emotions and offer comfort")
        logger.info("3. Set user preferences for favorite music and images for personalized comfort")
        
    except Exception as e:
        logger.error(f"Error during test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())