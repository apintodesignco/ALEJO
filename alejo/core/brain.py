"""
ALEJO Brain - Core decision making and processing unit.
Integrates memory, emotional, and ethical components.
"""

import asyncio
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass

from .events import Event, EventType
from ..cognitive.memory.working_memory import WorkingMemory
from ..cognitive.memory.episodic_memory import EpisodicMemory
from ..cognitive.memory.semantic_memory import SemanticMemory
from ..cognitive.memory.emotional_memory import EmotionalMemory
from ..cognitive.emotional.processor import EmotionalProcessor
from ..cognitive.ethical.framework import EthicalFramework
from ..utils.error_handling import handle_errors, ErrorTracker

@dataclass
class ProcessingContext:
    """Context for command processing."""
    command_id: str
    timestamp: float
    user_input: str
    emotional_state: Optional[Dict[str, float]] = None
    memory_context: Optional[Dict[str, Any]] = None
    ethical_context: Optional[Dict[str, Any]] = None

class ALEJOBrain:
    """
    Core processing unit for ALEJO.
    Integrates memory, emotional intelligence, and ethical decision making.
    """
    
    def __init__(self, event_bus=None, config: Dict[str, Any] = None):
        """Initialize ALEJO Brain with all components."""
        self.event_bus = event_bus
        self.config = config or {}
        self.error_tracker = ErrorTracker()
        
        # Initialize memory systems
        self.working_memory = WorkingMemory(event_bus)
        self.episodic_memory = EpisodicMemory(event_bus)
        self.semantic_memory = SemanticMemory(event_bus)
        self.emotional_memory = EmotionalMemory(event_bus)
        
        # Initialize emotional and ethical components
        self.emotional_processor = EmotionalProcessor(
            self.emotional_memory,
            event_bus,
            self.config.get('emotional_config')
        )
        self.ethical_framework = EthicalFramework(
            event_bus,
            self.config.get('ethical_config')
        )
        
        # Processing state
        self.is_processing = False
        self.current_context = None
        
    async def start(self):
        """Start all brain components."""
        # Start memory systems
        await self.working_memory.start()
        await self.episodic_memory.start()
        await self.semantic_memory.start()
        await self.emotional_memory.start()
        
        # Start emotional and ethical components
        await self.emotional_processor.start()
        await self.ethical_framework.start()
        
        # Subscribe to events
        if self.event_bus:
            await self.event_bus.subscribe(EventType.COMMAND, self._handle_command)
            await self.event_bus.subscribe(EventType.PERCEPTION, self._handle_perception)
            
    async def stop(self):
        """Stop all brain components."""
        # Stop memory systems
        await self.working_memory.stop()
        await self.episodic_memory.stop()
        await self.semantic_memory.stop()
        await self.emotional_memory.stop()
        
        # Stop emotional and ethical components
        await self.emotional_processor.stop()
        await self.ethical_framework.stop()
        
        # Unsubscribe from events
        if self.event_bus:
            await self.event_bus.unsubscribe(EventType.COMMAND, self._handle_command)
            await self.event_bus.unsubscribe(EventType.PERCEPTION, self._handle_perception)
            
    @handle_errors(component='alejo_brain')
    async def process_command(self, command: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Process a command with emotional and ethical considerations.
        
        Args:
            command: User command to process
            context: Additional context information
            
        Returns:
            Processing results including response and state
        """
        if self.is_processing:
            raise RuntimeError("Already processing a command")
            
        self.is_processing = True
        try:
            # Create processing context
            self.current_context = ProcessingContext(
                command_id=f"cmd_{id(command)}",
                timestamp=asyncio.get_event_loop().time(),
                user_input=command
            )
            
            # Analyze emotional content
            emotional_analysis = await self.emotional_processor.analyze_sentiment(command)
            self.current_context.emotional_state = emotional_analysis['emotional_state']
            
            # Update working memory
            await self.working_memory.focus({
                'command': command,
                'emotional_state': emotional_analysis['emotional_state'],
                'context': context or {}
            })
            
            # Generate response options
            response_options = await self._generate_response_options(command, context)
            
            # Make ethical decision
            decision = await self.ethical_framework.make_decision(
                response_options,
                {
                    'command': command,
                    'emotional_state': emotional_analysis['emotional_state'],
                    'memory_context': await self._get_memory_context()
                }
            )
            
            # Generate empathetic response
            response, emotional_state = await self.emotional_processor.generate_empathetic_response(
                command,
                {
                    'ethical_decision': decision,
                    'memory_context': await self._get_memory_context()
                }
            )
            
            # Store interaction in episodic memory
            await self.episodic_memory.store_episode({
                'command': command,
                'response': response,
                'emotional_state': emotional_state,
                'decision': decision,
                'context': context
            })
            
            return {
                'response': response,
                'emotional_state': emotional_state,
                'decision': decision,
                'success': True
            }
            
        finally:
            self.is_processing = False
            self.current_context = None
            
    async def _generate_response_options(self, command: str, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate possible response options for a command."""
        # Basic response options - would be expanded based on command analysis
        return [
            {
                'type': 'direct_response',
                'content': command,
                'emotional_impact': 'neutral'
            },
            {
                'type': 'empathetic_response',
                'content': command,
                'emotional_impact': 'positive'
            },
            {
                'type': 'clarifying_question',
                'content': f"Would you like me to explain more about {command}?",
                'emotional_impact': 'neutral'
            }
        ]
        
    async def _get_memory_context(self) -> Dict[str, Any]:
        """Get relevant context from memory systems."""
        return {
            'working_memory': await self.working_memory.get_current_focus(),
            'emotional_state': await self.emotional_memory.get_current_state(),
            'recent_episodes': await self.episodic_memory.get_recent_episodes(5)
        }
        
    async def _handle_command(self, event: Event):
        """Handle command events."""
        if 'command' in event.payload:
            result = await self.process_command(
                event.payload['command'],
                event.payload.get('context')
            )
            
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type=EventType.RESPONSE,
                        source='alejo_brain',
                        payload=result
                    )
                )
                
    async def _handle_perception(self, event: Event):
        """Handle perception events."""
        if self.current_context and 'perception' in event.payload:
            # Update current context with perception
            await self.working_memory.update_focus({
                'perception': event.payload['perception']
            })
