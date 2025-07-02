"""
Integration tests for proactive prompt system
"""

import asyncio
import secrets  # More secure for cryptographic purposes
import sys
import unittest
from unittest.mock import Mock, patch

from alejo.brain import ALEJOBrain
from alejo.core.event_bus import EventBus
from alejo.ui.pyside_ui import HolographicUIPySide
from alejo.voice import VoiceService
from PySide6.QtWidgets import QApplication


class TestProactiveIntegration(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        """Create QApplication instance"""
        if not QApplication.instance():
            cls.app = QApplication(sys.argv)
        else:
            cls.app = QApplication.instance()

    async def asyncSetUp(self):
        """Set up test case"""
        # Initialize event bus
        self.event_bus = EventBus()
        await self.event_bus.start()

        # Initialize components with event bus
        self.config = {}

        # Mock LLM and other external dependencies
        with patch("alejo.brain.alejo_brain.OpenAI"):
            self.brain = ALEJOBrain(self.config, event_bus=self.event_bus)

        self.ui = HolographicUIPySide(self.config, self.event_bus)
        self.voice = VoiceService(self.brain, self.config, event_bus=self.event_bus)

        # Mock voice output to prevent actual TTS
        self.voice.voice_manager.voice_output = Mock()

    async def asyncTearDown(self):
        """Clean up after test"""
        if self.voice:
            self.voice.stop()
        if self.ui:
            self.ui.close()
        if self.event_bus:
            await self.event_bus.stop()

    async def test_end_to_end_empathy_prompt(self):
        """Test end-to-end flow of empathy prompt from brain to UI and voice"""
        # Mock brain's empathy generation to emit a test prompt
        test_prompt = "I notice you seem frustrated. Would you like to talk about it?"

        async def mock_process_text(*args, **kwargs):
            await self.event_bus.emit_proactive_prompt(
                text=test_prompt,
                prompt_type="empathy",
                rationale="User showing signs of frustration",
            )
            yield "Response"

        self.brain.process_text = mock_process_text

        # Process some text to trigger the prompt
        async for _ in self.brain.process_text("This is so annoying!"):
            pass

        # Allow time for event processing
        await asyncio.sleep(0.1)

        # Verify UI received and displayed prompt
        self.assertEqual(self.ui.central_widget.proactive_prompt_text, test_prompt)
        self.assertEqual(self.ui.central_widget.proactive_prompt_type, "empathy")

        # Verify voice service spoke the prompt
        self.voice.voice_manager.voice_output.speak.assert_called_once_with(test_prompt)

    async def test_end_to_end_curiosity_prompt(self):
        """Test end-to-end flow of curiosity prompt from brain to UI and voice"""
        # Mock brain's curiosity generation to emit a test prompt
        test_prompt = "Would you like to learn more about handling frustration?"

        async def mock_process_text(*args, **kwargs):
            await self.event_bus.emit_proactive_prompt(
                text=test_prompt,
                prompt_type="curiosity",
                rationale="User might benefit from coping strategies",
            )
            yield "Response"

        self.brain.process_text = mock_process_text

        # Process some text to trigger the prompt
        async for _ in self.brain.process_text("I don't know how to deal with this."):
            pass

        # Allow time for event processing
        await asyncio.sleep(0.1)

        # Verify UI received and displayed prompt
        self.assertEqual(self.ui.central_widget.proactive_prompt_text, test_prompt)
        self.assertEqual(self.ui.central_widget.proactive_prompt_type, "curiosity")

        # Verify voice service spoke the prompt
        self.voice.voice_manager.voice_output.speak.assert_called_once_with(test_prompt)

    async def test_component_failure_handling(self):
        """Test system resilience when a component fails"""
        # Make voice service fail
        self.voice.voice_manager.voice_output.speak.side_effect = Exception(
            "TTS failed"
        )

        # Emit a test prompt
        await self.event_bus.emit_proactive_prompt(
            text="Test prompt",
            prompt_type="empathy",
            rationale="Testing failure handling",
        )

        # Allow time for event processing
        await asyncio.sleep(0.1)

        # Verify UI still received and displayed prompt despite voice failure
        self.assertEqual(self.ui.central_widget.proactive_prompt_text, "Test prompt")
        self.assertEqual(self.ui.central_widget.proactive_prompt_type, "empathy")

    async def test_prompt_timing(self):
        """Test timing of prompt delivery across components"""
        prompts = []
        timestamps = {}

        # Add timing instrumentation
        async def ui_handler(event):
            prompts.append(("ui", event.data["text"]))
            timestamps["ui"] = asyncio.get_event_loop().time()
            await self.ui._handle_proactive_prompt(event)

        async def voice_handler(event):
            prompts.append(("voice", event.data["text"]))
            timestamps["voice"] = asyncio.get_event_loop().time()
            self.voice._handle_proactive_prompt(event)

        # Replace handlers with instrumented versions
        await self.event_bus.subscribe(
            self.event_bus.EventType.PROACTIVE_PROMPT, ui_handler
        )
        await self.event_bus.subscribe(
            self.event_bus.EventType.PROACTIVE_PROMPT, voice_handler
        )

        # Emit test prompt
        start_time = asyncio.get_event_loop().time()
        await self.event_bus.emit_proactive_prompt(
            text="Timing test prompt",
            prompt_type="empathy",
            rationale="Testing delivery timing",
        )

        # Allow time for event processing
        await asyncio.sleep(0.1)

        # Verify both components received prompt
        self.assertEqual(len(prompts), 2)
        self.assertEqual(prompts[0][1], prompts[1][1])

        # Verify timing
        ui_latency = timestamps["ui"] - start_time
        voice_latency = timestamps["voice"] - start_time

        # Both should receive prompt within 50ms
        self.assertLess(ui_latency, 0.05)
        self.assertLess(voice_latency, 0.05)


if __name__ == "__main__":
    unittest.main()
