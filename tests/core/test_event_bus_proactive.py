"""
Unit tests for EventBus proactive prompt functionality
"""
import asyncio
import unittest
from datetime import datetime
from unittest.mock import Mock, patch
from alejo.core.event_bus import EventBus, EventType, Event
import secrets  # More secure for cryptographic purposes

class TestEventBusProactive(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        """Set up test case"""
        self.event_bus = EventBus()
        await self.event_bus.start()
        self.received_events = []

    async def asyncTearDown(self):
        """Clean up after test"""
        if self.event_bus:
            await self.event_bus.stop()

    def event_handler(self, event):
        """Store received events for verification"""
        self.received_events.append(event)

    async def test_proactive_prompt_event_type(self):
        """Test that PROACTIVE_PROMPT is a valid EventType"""
        self.assertIn(EventType.PROACTIVE_PROMPT, EventType)
        self.assertEqual(EventType.PROACTIVE_PROMPT.value, "proactive_prompt")

    async def test_emit_proactive_prompt(self):
        """Test emitting a proactive prompt event"""
        # Subscribe to proactive prompt events
        await self.event_bus.subscribe(EventType.PROACTIVE_PROMPT, self.event_handler)

        # Emit a test prompt
        test_text = "How are you feeling today?"
        test_type = "empathy"
        test_rationale = "User seems stressed"
        
        await self.event_bus.emit_proactive_prompt(
            text=test_text,
            prompt_type=test_type,
            rationale=test_rationale
        )

        # Allow time for event processing
        await asyncio.sleep(0.1)

        # Verify event was received
        self.assertEqual(len(self.received_events), 1)
        event = self.received_events[0]
        
        self.assertEqual(event.type, EventType.PROACTIVE_PROMPT)
        self.assertEqual(event.data["text"], test_text)
        self.assertEqual(event.data["prompt_type"], test_type)
        self.assertEqual(event.data["rationale"], test_rationale)
        self.assertIn("timestamp", event.data)

    async def test_multiple_subscribers(self):
        """Test multiple subscribers receiving proactive prompt events"""
        handler1_events = []
        handler2_events = []

        async def handler1(event):
            handler1_events.append(event)

        async def handler2(event):
            handler2_events.append(event)

        # Subscribe both handlers
        await self.event_bus.subscribe(EventType.PROACTIVE_PROMPT, handler1)
        await self.event_bus.subscribe(EventType.PROACTIVE_PROMPT, handler2)

        # Emit test prompt
        await self.event_bus.emit_proactive_prompt(
            text="Test prompt",
            prompt_type="curiosity",
            rationale="Testing multiple subscribers"
        )

        # Allow time for event processing
        await asyncio.sleep(0.1)

        # Verify both handlers received the event
        self.assertEqual(len(handler1_events), 1)
        self.assertEqual(len(handler2_events), 1)
        self.assertEqual(
            handler1_events[0].data["text"],
            handler2_events[0].data["text"]
        )

    async def test_unsubscribe(self):
        """Test unsubscribing from proactive prompt events"""
        await self.event_bus.subscribe(EventType.PROACTIVE_PROMPT, self.event_handler)
        
        # Emit first prompt
        await self.event_bus.emit_proactive_prompt(
            text="First prompt",
            prompt_type="empathy",
            rationale="Testing unsubscribe"
        )
        
        await asyncio.sleep(0.1)
        self.assertEqual(len(self.received_events), 1)

        # Unsubscribe
        await self.event_bus.unsubscribe(EventType.PROACTIVE_PROMPT, self.event_handler)

        # Emit second prompt
        await self.event_bus.emit_proactive_prompt(
            text="Second prompt",
            prompt_type="empathy",
            rationale="Testing unsubscribe"
        )
        
        await asyncio.sleep(0.1)
        # Verify only first event was received
        self.assertEqual(len(self.received_events), 1)

if __name__ == '__main__':
    unittest.main()