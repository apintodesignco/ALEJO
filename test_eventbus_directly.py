"""
Simple script to test the EventBus implementation directly without pytest dependencies.
"""

import asyncio
import logging
from alejo.core.events import Event, EventType, EventBus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_event_bus():
    """Test the EventBus implementation."""
    logger.info("Starting EventBus test")
    
    # Get the EventBus instance
    event_bus = EventBus.get_instance()
    
    # Create a test event handler
    async def test_handler(event):
        logger.info(f"Received event: {event.type} from {event.source} with data {event.data}")
        return True
    
    # Subscribe to events
    subscription_id = await event_bus.subscribe(test_handler)
    logger.info(f"Subscribed with ID: {subscription_id}")
    
    # Create and publish a test event
    test_event = Event(
        type=EventType.USER_INPUT,
        source="test_script",
        data={"message": "Hello, EventBus!"}
    )
    
    logger.info(f"Publishing event: {test_event.type}")
    await event_bus.publish(test_event)
    
    # Wait a moment for async processing
    await asyncio.sleep(1)
    
    # Unsubscribe
    await event_bus.unsubscribe(subscription_id)
    logger.info(f"Unsubscribed ID: {subscription_id}")
    
    # Test filtering by type
    type_sub_id = await event_bus.subscribe_by_type(test_handler, EventType.SYSTEM_STARTUP)
    logger.info(f"Subscribed with type filter, ID: {type_sub_id}")
    
    # This event should be received (SYSTEM_STARTUP type)
    system_event = Event(
        type=EventType.SYSTEM_STARTUP,
        source="test_script",
        data={"message": "System event"}
    )
    
    # This event should not be received (USER_INPUT type)
    user_event = Event(
        type=EventType.USER_INPUT,
        source="test_script",
        data={"message": "User event"}
    )
    
    logger.info("Publishing system event (should be received)")
    await event_bus.publish(system_event)
    
    logger.info("Publishing user event (should NOT be received by type-filtered handler)")
    await event_bus.publish(user_event)
    
    # Wait a moment for async processing
    await asyncio.sleep(1)
    
    # Clean up
    await event_bus.unsubscribe(type_sub_id)
    
    logger.info("EventBus test completed successfully")

if __name__ == "__main__":
    asyncio.run(test_event_bus())
