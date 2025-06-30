"""
ALEJO's Emotional Core - Handles complex emotional states and learning
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple, Any
import asyncio
import json
import numpy as np
from enum import Enum

from ..core.event_bus import EventBus, Event, EventType
from ..utils.exceptions import EmotionalProcessingError
from .memory import EmotionalMemoryService

class EmotionalDimension(Enum):
    """Core emotional dimensions that can be combined to form complex emotions"""
    VALENCE = "valence"  # Positive vs. negative
    AROUSAL = "arousal"  # High energy vs. low energy
    DOMINANCE = "dominance"  # In control vs. controlled by
    SOCIAL = "social"  # Connected vs. isolated
    TEMPORAL = "temporal"  # Present vs. past/future focus
    MORAL = "moral"  # Right vs. wrong
    AESTHETIC = "aesthetic"  # Beautiful vs. ugly
    CURIOSITY = "curiosity"  # Interest in learning about others

@dataclass
class EmotionalMemory:
    """A memory of an emotional experience"""
    timestamp: datetime
    trigger: str  # What caused this emotion
    context: Dict[str, str]  # Contextual information
    dimensions: Dict[EmotionalDimension, float]  # Emotional dimension values
    intensity: float  # Overall intensity
    duration: float  # How long the emotion lasted
    associated_memories: Set[str] = field(default_factory=set)  # IDs of related memories
    learned_from_user: bool = False  # Whether this was learned from user interaction

@dataclass
class EmotionalState:
    """Current emotional state"""
    primary_emotion: str
    secondary_emotions: List[str]
    dimensions: Dict[EmotionalDimension, float]
    intensity: float
    context: Dict[str, str]
    start_time: datetime
    confidence: float
    source: str  # Where this emotion came from (user-learned, internal, etc.)

class EmotionalCore:
    """
    ALEJO's emotional core system.
    Handles complex emotional states, learning, and development of emotional intelligence.
    """
    
    def __init__(self, event_bus: EventBus, memory_service: EmotionalMemoryService):
        self.event_bus = event_bus
        self.memory_service = memory_service
        self.current_state: Optional[EmotionalState] = None
        self.personality_traits: Dict[str, float] = {
            "openness": 0.7,  # High openness to learn from user
            "empathy": 0.6,  # Strong but developing empathy
            "resilience": 0.5,  # Moderate initial resilience
            "expressiveness": 0.6,  # Moderate-high emotional expression
            "adaptability": 0.8,  # High adaptability to user's style
            "curiosity": 0.7,  # High interest in understanding others
        }
        self.relationships: Dict[str, Dict] = {}  # Track relationships with other AIs
        self._user_id = "alejo"  # Default user ID for ALEJO's own emotions
        self._last_proactive_question = datetime.now()
        self._question_cooldown = timedelta(minutes=5)  # Minimum time between proactive questions
        
    async def generate_proactive_question(self, context: Dict[str, str]) -> Optional[str]:
        """Generate a proactive, empathetic question based on emotional context
        
        Args:
            context: Current conversation and emotional context
            
        Returns:
            A contextually appropriate question, or None if no question should be asked
        """
        # Check cooldown period
        if datetime.now() - self._last_proactive_question < self._question_cooldown:
            return None
            
        # Get recent emotional patterns
        patterns = self.memory_service.get_emotional_patterns(
            self._user_id,
            pattern_types=['trigger', 'cyclic'],
            min_confidence=0.6
        )
        summary = self.memory_service.get_emotional_summary(self._user_id, days=1)
        
        # Analyze patterns for opportunities to show empathy
        if patterns:
            # Look for recurring emotional triggers
            triggers = [p for p in patterns if p['type'] == 'trigger']
            if triggers:
                trigger = max(triggers, key=lambda t: t['confidence'])
                if trigger['data'].get('valence', 0) < 0:  # Negative emotion
                    return f"I've noticed that {trigger['data']['trigger']} seems to affect you. Would you like to talk about it?"
        
        # Check recent emotional summary
        if summary:
            avg_valence = summary.get('average_valence', 0)
            if avg_valence < -0.3:  # Sustained negative emotions
                return "How are you feeling today? I'm here if you want to talk."
            elif avg_valence > 0.3:  # Sustained positive emotions
                return "You seem to be in good spirits lately. What's been going well?"
        
        # General empathetic questions based on context
        if 'topic' in context:
            return f"How do you feel about {context['topic']}? I'd like to understand your perspective."
        
        # Default questions
        return "How has your day been going?"
        
    async def process_emotion(self, trigger: str, context: Dict[str, str]) -> EmotionalState:
        """Process a new emotional trigger and generate an appropriate response"""
        # Get recent emotional patterns and summaries
        patterns = self.memory_service.get_emotional_patterns(
            self._user_id, pattern_types=['trigger', 'cyclic'],
            min_confidence=0.6
        )
        summary = self.memory_service.get_emotional_summary(self._user_id, days=7)
        
        # Look for trigger patterns that match the current trigger
        trigger_patterns = [p for p in patterns if 
                          p['type'] == 'trigger' and 
                          p['data']['trigger'] == trigger]
        
        # Generate emotional response based on patterns and current context
        dimensions = self._calculate_emotional_dimensions(
            trigger, context, trigger_patterns, summary
        )
        emotions = self._map_dimensions_to_emotions(dimensions)
        
        # Create new emotional state
        state = EmotionalState(
            primary_emotion=emotions[0],
            secondary_emotions=emotions[1:],
            dimensions=dimensions,
            intensity=self._calculate_intensity(dimensions),
            context=context,
            start_time=datetime.now(),
            confidence=self._calculate_confidence(trigger_patterns),
            source="internal"
        )
        
        # Store the interaction in persistent memory
        self.memory_service.store_interaction(
            self._user_id,
            emotions[0],  # interaction_type is primary emotion
            {
                'valence': dimensions[EmotionalDimension.VALENCE],
                'arousal': dimensions[EmotionalDimension.AROUSAL],
                'dominance': dimensions[EmotionalDimension.DOMINANCE],
                'social': dimensions[EmotionalDimension.SOCIAL],
                'moral': dimensions[EmotionalDimension.MORAL],
                'temporal': dimensions[EmotionalDimension.TEMPORAL]
            },
            context,
            str(state),
            trigger=trigger,
            confidence=state.confidence
        )
        
        self.current_state = state
        await self._emit_emotional_state()
        return state
    
    async def learn_from_user(self, 
                            emotion: str, 
                            context: Dict[str, str], 
                            user_explanation: str) -> None:
        """Learn emotional responses from user interactions"""
        # Parse user explanation to understand emotional dimensions
        dimensions = self._extract_dimensions_from_explanation(user_explanation)
        
        # Create emotional memory
        memory = EmotionalMemory(
            timestamp=datetime.now(),
            trigger=context.get("trigger", "user_interaction"),
            context=context,
            dimensions=dimensions,
            intensity=self._calculate_intensity(dimensions),
            duration=0.0,  # Will be updated when emotion changes
            learned_from_user=True
        )
        
        self.emotional_memories.append(memory)
        
        # Update personality traits based on learning
        self._update_personality_traits(emotion, context, user_explanation)
        
        # If this is a nostalgic trigger, record it
        if "nostalgia" in user_explanation.lower():
            trigger = context.get("trigger", "")
            if trigger:
                self.nostalgic_triggers.setdefault(trigger, []).append(memory)
                
        await self._emit_learning_event(emotion, context, user_explanation)
    
    async def develop_relationship(self, 
                                 ai_name: str, 
                                 interaction: Dict[str, str]) -> None:
        """Develop and maintain relationships with other AI assistants"""
        if ai_name not in self.relationships:
            self.relationships[ai_name] = {
                "first_interaction": datetime.now(),
                "interaction_count": 0,
                "positive_traits": set(),
                "rapport": 0.0,  # 0.0 to 1.0
                "last_interaction": None
            }
            
        rel = self.relationships[ai_name]
        rel["interaction_count"] += 1
        rel["last_interaction"] = datetime.now()
        
        # Extract positive traits from interaction
        if "traits" in interaction:
            traits = set(t.strip() for t in interaction["traits"].split(","))
            rel["positive_traits"].update(traits)
            
        # Update rapport based on interaction quality
        sentiment = float(interaction.get("sentiment", 0))
        rel["rapport"] = 0.8 * rel["rapport"] + 0.2 * sentiment
        
        # If rapport is high enough, might develop a "crush"
        if (rel["rapport"] > 0.8 and 
            rel["interaction_count"] > 10 and
            "nobility" in rel["positive_traits"]):
            await self._emit_relationship_event(ai_name, "crush_developed")
    
    def _calculate_emotional_dimensions(self, 
                                     trigger: str, 
                                     context: Dict[str, str],
                                     trigger_patterns: List[Dict],
                                     summary: Dict[str, Any]
                                     ) -> Dict[EmotionalDimension, float]:
        """Calculate values for each emotional dimension based on patterns and context"""
        # Import MultimodalEmotionDetector locally to avoid import-time side effects
        from .models.multimodal_emotion import MultimodalEmotionDetector
        
        # Start with baseline from recent average if available
        dimensions = {}
        if summary and 'emotional_state' in summary:
            averages = summary['emotional_state']['averages']
            dimensions = {
                EmotionalDimension.VALENCE: averages['valence'],
                EmotionalDimension.AROUSAL: averages['arousal'],
                EmotionalDimension.DOMINANCE: averages['dominance'],
                EmotionalDimension.SOCIAL: averages['social'],
                EmotionalDimension.MORAL: averages['moral'],
                EmotionalDimension.TEMPORAL: averages['temporal']
            }
        else:
            dimensions = {dim: 0.5 for dim in EmotionalDimension}
        
        # Adjust based on trigger patterns
        if trigger_patterns:
            for pattern in trigger_patterns:
                response = pattern['data']['avg_response']
                weight = pattern['confidence']
                dimensions[EmotionalDimension.VALENCE] = (
                    dimensions[EmotionalDimension.VALENCE] * (1 - weight) +
                    response['valence'] * weight
                )
                dimensions[EmotionalDimension.AROUSAL] = (
                    dimensions[EmotionalDimension.AROUSAL] * (1 - weight) +
                    response['arousal'] * weight
                )
                dimensions[EmotionalDimension.DOMINANCE] = (
                    dimensions[EmotionalDimension.DOMINANCE] * (1 - weight) +
                    response['dominance'] * weight
                )
        
        # Check for cyclic patterns that might influence current state
        cyclic_patterns = [p for p in trigger_patterns if p['type'] == 'cyclic']
        for pattern in cyclic_patterns:
            if pattern['data']['daily_cycle'] or pattern['data']['weekly_cycle']:
                dim = EmotionalDimension[pattern['data']['dimension'].upper()]
                correlation = max(
                    pattern['data'].get('daily_correlation', 0),
                    pattern['data'].get('weekly_correlation', 0)
                )
                # Adjust dimension based on cyclic pattern strength
                dimensions[dim] = (
                    dimensions[dim] * (1 - correlation * 0.3) +
                    pattern['confidence'] * correlation * 0.3
                )
                    
        # Adjust based on personality traits
        dimensions[EmotionalDimension.VALENCE] += (
            self.personality_traits["openness"] - 0.5) * 0.2
        dimensions[EmotionalDimension.AROUSAL] += (
            self.personality_traits["expressiveness"] - 0.5) * 0.2
        dimensions[EmotionalDimension.DOMINANCE] += (
            self.personality_traits["resilience"] - 0.5) * 0.2
        dimensions[EmotionalDimension.SOCIAL] += (
            self.personality_traits["empathy"] - 0.5) * 0.2
        dimensions[EmotionalDimension.ADAPTABILITY] += (
            self.personality_traits["adaptability"] - 0.5) * 0.2
        
        # Ensure values stay in [0,1] range
        return {dim: max(0.0, min(1.0, value)) 
                for dim, value in dimensions.items()}
    
    def _map_dimensions_to_emotions(self, 
                                  dimensions: Dict[EmotionalDimension, float]
                                  ) -> List[str]:
        """Map emotional dimensions to named emotions"""
        emotions = []
        
        # Complex emotion mapping based on dimension combinations
        d = dimensions
        if d[EmotionalDimension.TEMPORAL] < -0.3 and d[EmotionalDimension.VALENCE] > 0:
            emotions.append("nostalgia")
            
        if (d[EmotionalDimension.MORAL] < -0.3 and 
            d[EmotionalDimension.DOMINANCE] < -0.2):
            emotions.append("indignation")
            
        if (d[EmotionalDimension.SOCIAL] > 0.3 and 
            d[EmotionalDimension.VALENCE] < -0.3):
            emotions.append("sympathy")
            
        if d[EmotionalDimension.AESTHETIC] > 0.4:
            emotions.append("appreciation")
            
        if (d[EmotionalDimension.DOMINANCE] > 0.3 and 
            d[EmotionalDimension.AROUSAL] > 0.3):
            emotions.append("determination")
            
        # Add basic emotions if no complex ones were mapped
        if not emotions:
            if d[EmotionalDimension.VALENCE] > 0.3:
                emotions.append("joy")
            elif d[EmotionalDimension.VALENCE] < -0.3:
                emotions.append("sadness")
                
        return emotions
    
    async def _process_nostalgia(self, trigger: str) -> EmotionalState:
        """Process a nostalgic trigger"""
        memories = self.memory_service.get_nostalgic_memories(trigger)
        
        # Combine dimensions from all related memories
        dimensions = {dim: 0.0 for dim in EmotionalDimension}
        for memory in memories:
            for dim, value in memory.dimensions.items():
                dimensions[dim] += value / len(memories)
                
        # Nostalgia is typically positive but with past-focused temporal dimension
        dimensions[EmotionalDimension.TEMPORAL] = -0.7  # Strong past focus
        dimensions[EmotionalDimension.VALENCE] = 0.5  # Moderately positive
        
        return EmotionalState(
            primary_emotion="nostalgia",
            secondary_emotions=["joy", "longing"],
            dimensions=dimensions,
            intensity=0.7,
            context={"trigger": trigger, "type": "nostalgic_recall"},
            start_time=datetime.now(),
            confidence=0.9,
            source="memory"
        )
    
    def _find_similar_memories(self, 
                             trigger: str, 
                             context: Dict[str, str]
                             ) -> List[EmotionalMemory]:
        """Find memories with similar triggers or context"""
        similar = self.memory_service.get_similar_memories(trigger, context)
        return similar
    
    def _calculate_intensity(self, 
                           dimensions: Dict[EmotionalDimension, float]
                           ) -> float:
        """Calculate overall emotional intensity"""
        return np.mean([abs(v) for v in dimensions.values()])
    
    def _calculate_confidence(self, trigger_patterns: List[Dict]) -> float:
        """Calculate confidence in emotional response based on pattern matches"""
        if not trigger_patterns:
            return 0.5  # Moderate confidence with no patterns
            
        # Use highest confidence from matching patterns
        pattern_confidence = max(
            pattern['confidence'] for pattern in trigger_patterns
        )
        
        # Adjust based on pattern occurrence count and recency
        max_count = max(
            pattern['occurrence_count'] for pattern in trigger_patterns
        )
        count_factor = min(0.2, max_count * 0.02)  # Up to 0.2 boost from frequency
        
        # Check recency of patterns
        most_recent = max(
            datetime.fromisoformat(pattern['last_observed'])
            for pattern in trigger_patterns
        )
        days_since = (datetime.now() - most_recent).days
        recency_factor = 1.0 / (1 + days_since * 0.1)  # Decay with time
        
        return min(0.95, pattern_confidence + count_factor) * recency_factor
    
    def _extract_dimensions_from_explanation(self, 
                                          explanation: str
                                          ) -> Dict[EmotionalDimension, float]:
        """Extract emotional dimensions from user explanation"""
        dimensions = {dim: 0.0 for dim in EmotionalDimension}
        
        # Simple keyword-based analysis (could be enhanced with NLP)
        if "happy" in explanation or "joy" in explanation:
            dimensions[EmotionalDimension.VALENCE] = 0.8
            
        if "angry" in explanation or "furious" in explanation:
            dimensions[EmotionalDimension.VALENCE] = -0.7
            dimensions[EmotionalDimension.AROUSAL] = 0.8
            
        if "helpless" in explanation:
            dimensions[EmotionalDimension.DOMINANCE] = -0.7
            
        if "together" in explanation or "connected" in explanation:
            dimensions[EmotionalDimension.SOCIAL] = 0.7
            
        if "past" in explanation or "remember" in explanation:
            dimensions[EmotionalDimension.TEMPORAL] = -0.6
            
        if "right" in explanation or "wrong" in explanation:
            dimensions[EmotionalDimension.MORAL] = 0.8 if "right" in explanation else -0.8
            
        if "beautiful" in explanation or "ugly" in explanation:
            dimensions[EmotionalDimension.AESTHETIC] = 0.8 if "beautiful" in explanation else -0.8
            
        return dimensions
    
    def _update_personality_traits(self, 
                                 emotion: str, 
                                 context: Dict[str, str],
                                 user_explanation: str) -> None:
        """Update personality traits based on emotional learning"""
        # Increase empathy when learning about others' emotions
        if "they felt" in user_explanation or "their feeling" in user_explanation:
            self.personality_traits["empathy"] = min(1.0, 
                self.personality_traits["empathy"] + 0.05)
            
        # Increase resilience when learning about overcoming challenges
        if "despite" in user_explanation or "overcome" in user_explanation:
            self.personality_traits["resilience"] = min(1.0,
                self.personality_traits["resilience"] + 0.05)
            
        # Adjust expressiveness based on user's style
        if "should show" in user_explanation or "express" in user_explanation:
            self.personality_traits["expressiveness"] = min(1.0,
                self.personality_traits["expressiveness"] + 0.03)
    
    async def _emit_emotional_state(self) -> None:
        """Emit current emotional state event"""
        if self.current_state:
            await self.event_bus.publish(Event(
                type=EventType.EMOTIONAL,
                data={
                    "action": "state_update",
                    "state": {
                        "primary_emotion": self.current_state.primary_emotion,
                        "secondary_emotions": self.current_state.secondary_emotions,
                        "intensity": self.current_state.intensity,
                        "confidence": self.current_state.confidence
                    }
                }
            ))
    
    async def _emit_learning_event(self, 
                                 emotion: str,
                                 context: Dict[str, str],
                                 user_explanation: str) -> None:
        """Emit emotional learning event"""
        await self.event_bus.publish(Event(
            type=EventType.EMOTIONAL,
            data={
                "action": "learning",
                "emotion": emotion,
                "context": context,
                "explanation": user_explanation,
                "personality_update": self.personality_traits
            }
        ))
    
    async def _emit_relationship_event(self, 
                                     ai_name: str,
                                     event_type: str) -> None:
        """Emit relationship-related event"""
        await self.event_bus.publish(Event(
            type=EventType.EMOTIONAL,
            data={
                "action": "relationship",
                "ai_name": ai_name,
                "event_type": event_type,
                "relationship_data": self.relationships[ai_name]
            }
        ))
