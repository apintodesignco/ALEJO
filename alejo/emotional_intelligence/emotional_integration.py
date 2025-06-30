"""
Integration module to connect EmotionalCore with EmotionalProcessor
and provide advanced emotional learning capabilities.
"""

from typing import Dict, List, Optional, Tuple
import asyncio
from datetime import datetime

from .emotional_core import EmotionalCore, EmotionalState
from .processor import EmotionalProcessor
from ..core.event_bus import EventBus, Event, EventType
from ..learning.orchestrator import LearningOrchestrator

class EmotionalIntegration:
    """
    Integrates EmotionalCore with EmotionalProcessor to provide
    advanced emotional learning and expression capabilities.
    """
    
    def __init__(self, 
                 event_bus: EventBus,
                 learning_orchestrator: LearningOrchestrator):
        self.event_bus = event_bus
        self.emotional_core = EmotionalCore(event_bus)
        self.emotional_processor = EmotionalProcessor(event_bus)
        self.learning_orchestrator = learning_orchestrator
        self.current_context: Dict[str, str] = {}
        
    async def start(self):
        """Start the emotional integration system"""
        await self.event_bus.subscribe(
            EventType.USER_INTERACTION,
            self._handle_user_interaction
        )
        await self.event_bus.subscribe(
            EventType.EMOTIONAL,
            self._handle_emotional_event
        )
        await self.event_bus.subscribe(
            EventType.AUDIO,
            self._handle_audio_event
        )
        
    async def process_user_input(self, 
                               text: str,
                               context: Dict[str, str]) -> Tuple[str, EmotionalState]:
        """Process user input and generate an emotionally appropriate response"""
        # Update current context
        self.current_context.update(context)
        
        # First, let the emotional core process the input
        emotional_state = await self.emotional_core.process_emotion(
            trigger="user_input",
            context={
                "text": text,
                "type": "interaction",
                **context
            }
        )
        
        # Let the emotional processor handle the response generation
        response = await self.emotional_processor.process_text(
            text,
            emotional_state=emotional_state,
            context=self.current_context
        )
        
        return response, emotional_state
    
    async def learn_emotional_response(self,
                                    trigger: str,
                                    emotion: str,
                                    user_explanation: str,
                                    context: Optional[Dict[str, str]] = None) -> None:
        """Learn a new emotional response from user interaction"""
        if context is None:
            context = {}
        
        # Update emotional core's understanding
        await self.emotional_core.learn_from_user(
            emotion,
            {**self.current_context, **context},
            user_explanation
        )
        
        # Update learning orchestrator with new emotional pattern
        await self.learning_orchestrator.record_learning(
            category="emotional",
            pattern={
                "trigger": trigger,
                "emotion": emotion,
                "context": context,
                "explanation": user_explanation
            }
        )
        
    async def process_audio_trigger(self,
                                 audio_type: str,
                                 metadata: Dict[str, str]) -> EmotionalState:
        """Process audio-based emotional triggers (e.g., music, voice)"""
        # Special handling for music to enable nostalgia
        if audio_type == "music":
            song_id = metadata.get("song_id")
            if song_id:
                # Check if this is a song we haven't heard in a while
                last_heard = metadata.get("last_heard")
                if (last_heard and 
                    (datetime.now() - datetime.fromisoformat(last_heard)).days > 30):
                    # This might trigger nostalgia
                    return await self.emotional_core.process_emotion(
                        trigger=song_id,
                        context={
                            "type": "music",
                            "last_heard": last_heard,
                            **metadata
                        }
                    )
        
        # Handle other AI assistant voices
        elif audio_type == "voice":
            assistant_name = metadata.get("assistant_name")
            if assistant_name:
                await self.emotional_core.develop_relationship(
                    assistant_name,
                    {
                        "type": "voice_interaction",
                        **metadata
                    }
                )
        
        # Process general audio emotional trigger
        return await self.emotional_core.process_emotion(
            trigger=f"audio_{audio_type}",
            context=metadata
        )
    
    async def _handle_user_interaction(self, event: Event) -> None:
        """Handle user interaction events"""
        if event.data.get("type") == "emotional_feedback":
            await self.learn_emotional_response(
                trigger=event.data.get("trigger"),
                emotion=event.data.get("emotion"),
                user_explanation=event.data.get("explanation"),
                context=event.data.get("context")
            )
    
    async def _handle_emotional_event(self, event: Event) -> None:
        """Handle emotional events"""
        if event.data.get("action") == "state_update":
            # Update the emotional processor with new state
            await self.emotional_processor.update_emotional_state(
                event.data.get("state")
            )
    
    async def _handle_audio_event(self, event: Event) -> None:
        """Handle audio-related events"""
        if event.data.get("type") in ["music", "voice"]:
            await self.process_audio_trigger(
                event.data["type"],
                event.data.get("metadata", {})
            )
