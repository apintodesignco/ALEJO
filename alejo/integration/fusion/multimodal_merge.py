"""
Multimodal Fusion Engine

This module implements ALEJO's multimodal fusion capabilities, integrating inputs from
various modalities (gesture, voice, text) to provide a unified understanding and
response generation capability.

The fusion engine uses a priority-based approach combined with temporal alignment
to merge inputs from different modalities, resolving conflicts and ambiguities
to produce a coherent interpretation of user intent.
"""

import asyncio
import json
import logging
from datetime import datetime
from enum import Enum
from typing import Dict, List, Any, Optional, Union, Tuple

from alejo.core.events import EventBus, Event
from alejo.cognitive.reasoning.orchestrator import ReasoningEngineOrchestrator, ReasoningRequest
from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class InputModality(Enum):
    """Supported input modalities"""
    TEXT = "text"
    VOICE = "voice"
    GESTURE = "gesture"
    FACIAL = "facial"


class ModalityPriority(Enum):
    """Priority levels for different modalities"""
    CRITICAL = 100  # Override everything
    HIGH = 75       # Strong signal
    MEDIUM = 50     # Normal priority
    LOW = 25        # Supplementary information
    BACKGROUND = 0  # Context only


class ModalityConfidence(Enum):
    """Confidence levels for modality interpretation"""
    CERTAIN = 1.0
    HIGH = 0.8
    MEDIUM = 0.5
    LOW = 0.3
    UNCERTAIN = 0.1


class ModalityInput:
    """
    Represents an input from a specific modality
    """
    def __init__(
        self,
        modality: InputModality,
        content: Any,
        timestamp: Optional[datetime] = None,
        priority: ModalityPriority = ModalityPriority.MEDIUM,
        confidence: float = 0.8,
        metadata: Dict[str, Any] = None
    ):
        """
        Initialize a modality input
        
        Args:
            modality: The input modality
            content: The content of the input
            timestamp: When the input was received
            priority: Priority of this input
            confidence: Confidence in the interpretation (0.0 to 1.0)
            metadata: Additional metadata for this input
        """
        self.input_id = f"{modality.value}_{datetime.now().timestamp()}"
        self.modality = modality
        self.content = content
        self.timestamp = timestamp or datetime.now()
        self.priority = priority
        self.confidence = min(max(confidence, 0.0), 1.0)  # Ensure between 0 and 1
        self.metadata = metadata or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert input to dictionary"""
        return {
            "input_id": self.input_id,
            "modality": self.modality.value,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "priority": self.priority.value,
            "confidence": self.confidence,
            "metadata": self.metadata
        }


class FusedIntent:
    """
    Represents the result of multimodal fusion
    """
    def __init__(
        self,
        intent: str,
        confidence: float,
        source_inputs: List[ModalityInput],
        context: Dict[str, Any] = None,
        metadata: Dict[str, Any] = None
    ):
        """
        Initialize a fused intent
        
        Args:
            intent: The interpreted user intent
            confidence: Confidence in the interpretation (0.0 to 1.0)
            source_inputs: List of inputs that contributed to this intent
            context: Contextual information for this intent
            metadata: Additional metadata
        """
        self.intent_id = f"intent_{datetime.now().timestamp()}"
        self.intent = intent
        self.confidence = min(max(confidence, 0.0), 1.0)  # Ensure between 0 and 1
        self.source_inputs = source_inputs
        self.context = context or {}
        self.metadata = metadata or {}
        self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert fused intent to dictionary"""
        return {
            "intent_id": self.intent_id,
            "intent": self.intent,
            "confidence": self.confidence,
            "source_inputs": [input.to_dict() for input in self.source_inputs],
            "context": self.context,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat()
        }


class MultimodalFusionEngine:
    """
    Engine for fusing inputs from multiple modalities
    
    This class integrates inputs from various modalities (gesture, voice, text)
    to provide a unified understanding of user intent.
    """
    def __init__(
        self,
        reasoning_engine: Optional[ReasoningEngineOrchestrator] = None,
        event_bus: Optional[EventBus] = None,
        temporal_alignment_window_ms: int = 500,
        confidence_threshold: float = 0.3
    ):
        """
        Initialize the multimodal fusion engine
        
        Args:
            reasoning_engine: Reasoning engine for intent validation
            event_bus: Event bus for publishing events
            temporal_alignment_window_ms: Window for temporal alignment in milliseconds
            confidence_threshold: Minimum confidence threshold for inputs
        """
        self.reasoning_engine = reasoning_engine
        self.event_bus = event_bus
        self.temporal_alignment_window_ms = temporal_alignment_window_ms
        self.confidence_threshold = confidence_threshold
        
        # Input buffers for each modality
        self.input_buffers: Dict[InputModality, List[ModalityInput]] = {
            modality: [] for modality in InputModality
        }
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        logger.info("Multimodal Fusion Engine initialized")
    
    async def add_input(self, input_data: ModalityInput) -> str:
        """
        Add an input from a specific modality
        
        Args:
            input_data: The modality input
            
        Returns:
            ID of the added input
        """
        async with self._lock:
            # Add to appropriate buffer
            self.input_buffers[input_data.modality].append(input_data)
            
            # Trim buffer if needed (keep last 20 inputs)
            if len(self.input_buffers[input_data.modality]) > 20:
                self.input_buffers[input_data.modality] = self.input_buffers[input_data.modality][-20:]
            
            # Publish event if event bus is available
            if self.event_bus:
                await self.event_bus.publish(
                    Event(
                        type="modality_input_received",
                        data=input_data.to_dict()
                    )
                )
            
            return input_data.input_id
    
    async def process_inputs(self) -> Optional[FusedIntent]:
        """
        Process all available inputs to generate a fused intent
        
        Returns:
            Fused intent if successful, None otherwise
        """
        async with self._lock:
            # Get all recent inputs within temporal alignment window
            recent_inputs = self._get_temporally_aligned_inputs()
            
            if not recent_inputs:
                return None
            
            # Filter by confidence threshold
            confident_inputs = [
                input_data for input_data in recent_inputs
                if input_data.confidence >= self.confidence_threshold
            ]
            
            if not confident_inputs:
                return None
            
            # Perform fusion based on modality priorities and confidence
            fused_intent = await self._fuse_inputs(confident_inputs)
            
            # Validate intent with reasoning engine if available
            if self.reasoning_engine and fused_intent:
                validated_intent = await self._validate_intent(fused_intent)
                
                # Publish event if event bus is available
                if self.event_bus:
                    await self.event_bus.publish(
                        Event(
                            type="intent_fused",
                            data=validated_intent.to_dict()
                        )
                    )
                
                return validated_intent
            
            # Publish event if event bus is available
            if self.event_bus and fused_intent:
                await self.event_bus.publish(
                    Event(
                        type="intent_fused",
                        data=fused_intent.to_dict()
                    )
                )
            
            return fused_intent
    
    def _get_temporally_aligned_inputs(self) -> List[ModalityInput]:
        """
        Get inputs that are temporally aligned
        
        Returns:
            List of temporally aligned inputs
        """
        now = datetime.now()
        aligned_inputs = []
        
        for modality, inputs in self.input_buffers.items():
            # Get recent inputs within temporal window
            recent = [
                input_data for input_data in inputs
                if (now - input_data.timestamp).total_seconds() * 1000 <= self.temporal_alignment_window_ms
            ]
            
            aligned_inputs.extend(recent)
        
        return aligned_inputs
    
    async def _fuse_inputs(self, inputs: List[ModalityInput]) -> Optional[FusedIntent]:
        """
        Fuse multiple inputs into a single intent
        
        Args:
            inputs: List of inputs to fuse
            
        Returns:
            Fused intent if successful, None otherwise
        """
        if not inputs:
            return None
        
        # Sort by priority and confidence
        sorted_inputs = sorted(
            inputs,
            key=lambda x: (x.priority.value, x.confidence),
            reverse=True
        )
        
        # Extract primary intent from highest priority input
        primary_input = sorted_inputs[0]
        
        # Initialize intent with primary input
        intent = self._extract_intent_from_input(primary_input)
        
        # Enrich with context from other inputs
        context = self._extract_context_from_inputs(sorted_inputs[1:])
        
        # Calculate overall confidence
        # Weighted average based on priority and individual confidence
        total_weight = sum(input_data.priority.value for input_data in inputs)
        weighted_confidence = sum(
            input_data.confidence * input_data.priority.value
            for input_data in inputs
        ) / total_weight if total_weight > 0 else 0.5
        
        return FusedIntent(
            intent=intent,
            confidence=weighted_confidence,
            source_inputs=inputs,
            context=context
        )
    
    def _extract_intent_from_input(self, input_data: ModalityInput) -> str:
        """
        Extract intent from a single input
        
        Args:
            input_data: Input to extract intent from
            
        Returns:
            Extracted intent
        """
        # Different extraction based on modality
        if input_data.modality == InputModality.TEXT:
            return str(input_data.content)
        
        elif input_data.modality == InputModality.VOICE:
            # Voice content should already be transcribed text
            return str(input_data.content)
        
        elif input_data.modality == InputModality.GESTURE:
            # Map gesture to intent
            gesture_map = {
                "swipe_right": "next",
                "swipe_left": "previous",
                "swipe_up": "scroll_up",
                "swipe_down": "scroll_down",
                "pinch_in": "zoom_out",
                "pinch_out": "zoom_in",
                "palm_open": "stop",
                "thumbs_up": "confirm",
                "thumbs_down": "reject",
                "point": "select"
            }
            
            gesture = str(input_data.content).lower()
            return gesture_map.get(gesture, f"gesture:{gesture}")
        
        elif input_data.modality == InputModality.FACIAL:
            # Map facial expression to emotional context
            expression_map = {
                "happy": "positive_sentiment",
                "sad": "negative_sentiment",
                "angry": "urgent_negative",
                "surprised": "unexpected_reaction",
                "neutral": "neutral_sentiment"
            }
            
            expression = str(input_data.content).lower()
            return expression_map.get(expression, f"expression:{expression}")
        
        return f"{input_data.modality.value}:{input_data.content}"
    
    def _extract_context_from_inputs(self, inputs: List[ModalityInput]) -> Dict[str, Any]:
        """
        Extract context from secondary inputs
        
        Args:
            inputs: Secondary inputs to extract context from
            
        Returns:
            Extracted context
        """
        context = {}
        
        for input_data in inputs:
            if input_data.modality == InputModality.FACIAL:
                context["emotional_state"] = str(input_data.content).lower()
                context["emotional_confidence"] = input_data.confidence
            
            elif input_data.modality == InputModality.GESTURE:
                context["gesture"] = str(input_data.content).lower()
                context["gesture_confidence"] = input_data.confidence
            
            # Add any metadata as context
            context.update(input_data.metadata)
        
        return context
    
    async def _validate_intent(self, intent: FusedIntent) -> FusedIntent:
        """
        Validate intent using reasoning engine
        
        Args:
            intent: Intent to validate
            
        Returns:
            Validated intent
        """
        if not self.reasoning_engine:
            return intent
        
        # Create reasoning request
        request = ReasoningRequest(
            query=f"Validate user intent: {intent.intent}",
            context=json.dumps(intent.context),
            metadata={"source": "multimodal_fusion"}
        )
        
        # Perform reasoning
        result = await self.reasoning_engine.reason(request)
        
        # Update confidence based on reasoning result
        if result.status.value == "success":
            # Reasoning confirms intent, boost confidence
            intent.confidence = min(intent.confidence * 1.2, 1.0)
        elif result.status.value == "contradiction":
            # Reasoning contradicts intent, reduce confidence
            intent.confidence = max(intent.confidence * 0.5, 0.1)
        elif result.status.value == "fallacy":
            # Reasoning detected fallacy, slightly reduce confidence
            intent.confidence = max(intent.confidence * 0.8, 0.2)
        
        # Add reasoning result to context
        intent.context["reasoning_result"] = {
            "status": result.status.value,
            "confidence": result.confidence,
            "explanation": result.explanation
        }
        
        return intent


# Example usage
async def main():
    # Initialize fusion engine
    fusion_engine = MultimodalFusionEngine()
    
    # Add inputs from different modalities
    await fusion_engine.add_input(
        ModalityInput(
            modality=InputModality.TEXT,
            content="Show me the weather forecast",
            priority=ModalityPriority.HIGH,
            confidence=0.9
        )
    )
    
    await fusion_engine.add_input(
        ModalityInput(
            modality=InputModality.GESTURE,
            content="swipe_up",
            priority=ModalityPriority.MEDIUM,
            confidence=0.7
        )
    )
    
    await fusion_engine.add_input(
        ModalityInput(
            modality=InputModality.FACIAL,
            content="curious",
            priority=ModalityPriority.LOW,
            confidence=0.6
        )
    )
    
    # Process inputs
    fused_intent = await fusion_engine.process_inputs()
    
    if fused_intent:
        print(f"Intent: {fused_intent.intent}")
        print(f"Confidence: {fused_intent.confidence}")
        print(f"Context: {fused_intent.context}")


if __name__ == "__main__":
    asyncio.run(main())
