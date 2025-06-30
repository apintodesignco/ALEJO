"""
Advanced AI Features for ALEJO's Emotional Intelligence
Includes personality modeling, emotional learning, adaptive responses,
emotional memory decay, contextual emotion blending, and cultural adaptations
"""

import torch
import numpy as np
from typing import Dict, List, Optional, Tuple, Union, Any
from dataclasses import dataclass, field
from transformers import pipeline
from textblob import TextBlob
import json
import logging
import math
from datetime import datetime, timedelta
from enum import Enum
import asyncio
from collections import defaultdict

logger = logging.getLogger(__name__)

class EmotionalDecayModel(Enum):
    """Models for emotional memory decay"""
    LINEAR = "linear"
    EXPONENTIAL = "exponential"
    EBBINGHAUS = "ebbinghaus"
    POWER_LAW = "power_law"
    ADAPTIVE = "adaptive"


@dataclass
class EmotionalMemoryItem:
    """Individual emotional memory item with metadata"""
    id: str
    emotion: Dict[str, float]  # Emotion name to intensity mapping
    context: Dict[str, Any]
    timestamp: datetime
    importance: float = 0.5  # 0.0 to 1.0, higher = more important
    retrieval_count: int = 0  # How many times this memory has been accessed
    last_accessed: Optional[datetime] = None
    decay_rate: float = 0.1  # Custom decay rate for this memory
    tags: List[str] = field(default_factory=list)
    
    def calculate_current_strength(self, decay_model: EmotionalDecayModel = EmotionalDecayModel.ADAPTIVE) -> float:
        """Calculate current memory strength based on decay model"""
        if not self.last_accessed:
            self.last_accessed = self.timestamp
            
        time_diff = (datetime.now() - self.timestamp).total_seconds() / 86400.0  # Convert to days
        retrieval_factor = math.log(self.retrieval_count + 1) * 0.2  # Retrieval strengthens memory
        
        if decay_model == EmotionalDecayModel.LINEAR:
            # Simple linear decay
            decay = max(0, 1.0 - (time_diff * self.decay_rate))
            
        elif decay_model == EmotionalDecayModel.EXPONENTIAL:
            # Exponential decay
            decay = math.exp(-self.decay_rate * time_diff)
            
        elif decay_model == EmotionalDecayModel.EBBINGHAUS:
            # Ebbinghaus forgetting curve
            decay = math.exp(-self.decay_rate * time_diff / math.sqrt(self.retrieval_count + 1))
            
        elif decay_model == EmotionalDecayModel.POWER_LAW:
            # Power law of forgetting
            decay = (1 + time_diff) ** (-self.decay_rate)
            
        else:  # ADAPTIVE
            # Combines importance, recency, and retrieval effects
            recency_factor = math.exp(-0.1 * (datetime.now() - self.last_accessed).total_seconds() / 86400.0)
            decay = (self.importance * 0.5 + 0.5) * math.exp(-self.decay_rate * time_diff / (1 + retrieval_factor))
            decay = decay * (0.7 + 0.3 * recency_factor)
            
        return max(0.0, min(1.0, decay))


class AdaptiveEmotionalMemory:
    """Advanced emotional memory system with decay functions and memory consolidation"""
    
    def __init__(self, default_decay_model: EmotionalDecayModel = EmotionalDecayModel.ADAPTIVE):
        self.short_term_memory: List[EmotionalMemoryItem] = []
        self.long_term_memory: List[EmotionalMemoryItem] = []
        self.default_decay_model = default_decay_model
        self.stm_capacity = 50  # Short-term memory capacity
        self.ltm_capacity = 1000  # Long-term memory capacity
        self.consolidation_threshold = 0.7  # Importance threshold for direct LTM storage
        self.last_consolidation = datetime.now()
        self.consolidation_interval = timedelta(hours=6)
        
    async def store_memory(self, emotion: Dict[str, float], context: Dict[str, Any], 
                          importance: float = None, tags: List[str] = None) -> str:
        """Store a new emotional memory"""
        # Generate unique ID
        memory_id = f"em_{datetime.now().strftime('%Y%m%d%H%M%S')}_{hash(str(emotion)) % 10000}"
        
        # Calculate importance if not provided
        if importance is None:
            # Base importance on emotion intensity and context richness
            max_intensity = max(emotion.values()) if emotion else 0.5
            context_factor = min(1.0, len(context) / 10) if context else 0.3
            importance = (max_intensity * 0.7) + (context_factor * 0.3)
        
        # Create memory item
        memory_item = EmotionalMemoryItem(
            id=memory_id,
            emotion=emotion,
            context=context,
            timestamp=datetime.now(),
            importance=importance,
            tags=tags or []
        )
        
        # Store based on importance
        if importance >= self.consolidation_threshold:
            # Important memories go directly to long-term memory
            self.long_term_memory.append(memory_item)
            if len(self.long_term_memory) > self.ltm_capacity:
                self._prune_long_term_memory()
        else:
            # Less important memories go to short-term memory
            self.short_term_memory.append(memory_item)
            if len(self.short_term_memory) > self.stm_capacity:
                self._prune_short_term_memory()
        
        # Check if consolidation is needed
        if datetime.now() - self.last_consolidation > self.consolidation_interval:
            await self._consolidate_memories()
            
        return memory_id
    
    async def retrieve_memories(self, query: Dict[str, Any], limit: int = 5, 
                              tags: List[str] = None, min_strength: float = 0.2) -> List[EmotionalMemoryItem]:
        """Retrieve relevant memories based on query and tags"""
        # Combine STM and LTM for search
        all_memories = self.short_term_memory + self.long_term_memory
        
        # Filter by tags if provided
        if tags:
            all_memories = [m for m in all_memories if any(tag in m.tags for tag in tags)]
        
        # Calculate relevance scores
        scored_memories = []
        for memory in all_memories:
            # Calculate current strength based on decay
            strength = memory.calculate_current_strength(self.default_decay_model)
            
            if strength < min_strength:
                continue
                
            # Calculate relevance based on query match
            relevance = self._calculate_relevance(memory, query)
            
            # Combined score: strength * relevance
            score = strength * relevance
            scored_memories.append((memory, score))
        
        # Sort by score and take top results
        scored_memories.sort(key=lambda x: x[1], reverse=True)
        top_memories = [m for m, _ in scored_memories[:limit]]
        
        # Update retrieval stats
        for memory in top_memories:
            memory.retrieval_count += 1
            memory.last_accessed = datetime.now()
        
        return top_memories
    
    def _calculate_relevance(self, memory: EmotionalMemoryItem, query: Dict[str, Any]) -> float:
        """Calculate relevance of memory to query"""
        relevance = 0.0
        
        # Match emotions
        if 'emotion' in query and memory.emotion:
            for emotion, intensity in query['emotion'].items():
                if emotion in memory.emotion:
                    relevance += 0.3 * min(intensity, memory.emotion[emotion])
        
        # Match context elements
        if 'context' in query and memory.context:
            context_matches = 0
            for key, value in query['context'].items():
                if key in memory.context and memory.context[key] == value:
                    context_matches += 1
            relevance += 0.5 * min(1.0, context_matches / max(1, len(query['context'])))
        
        # Consider importance
        relevance += 0.2 * memory.importance
        
        return min(1.0, relevance)
    
    async def _consolidate_memories(self):
        """Consolidate short-term memories into long-term memory"""
        # Sort STM by importance * strength
        scored_stm = []
        for memory in self.short_term_memory:
            strength = memory.calculate_current_strength(self.default_decay_model)
            score = memory.importance * strength
            scored_stm.append((memory, score))
        
        scored_stm.sort(key=lambda x: x[1], reverse=True)
        
        # Move top memories to LTM
        transfer_count = min(len(scored_stm) // 3, self.ltm_capacity - len(self.long_term_memory))
        if transfer_count > 0:
            for memory, _ in scored_stm[:transfer_count]:
                self.long_term_memory.append(memory)
                self.short_term_memory.remove(memory)
        
        # Update consolidation timestamp
        self.last_consolidation = datetime.now()
    
    def _prune_short_term_memory(self):
        """Remove weakest memories from short-term memory"""
        # Calculate strength for each memory
        scored_memories = []
        for memory in self.short_term_memory:
            strength = memory.calculate_current_strength(self.default_decay_model)
            scored_memories.append((memory, strength))
        
        # Sort by strength and remove weakest
        scored_memories.sort(key=lambda x: x[1])
        to_remove = max(1, len(self.short_term_memory) - self.stm_capacity)
        
        for memory, _ in scored_memories[:to_remove]:
            self.short_term_memory.remove(memory)
    
    def _prune_long_term_memory(self):
        """Remove weakest memories from long-term memory"""
        # Calculate combined score: importance * strength
        scored_memories = []
        for memory in self.long_term_memory:
            strength = memory.calculate_current_strength(self.default_decay_model)
            score = memory.importance * strength
            scored_memories.append((memory, score))
        
        # Sort by score and remove weakest
        scored_memories.sort(key=lambda x: x[1])
        to_remove = max(1, len(self.long_term_memory) - self.ltm_capacity)
        
        for memory, _ in scored_memories[:to_remove]:
            self.long_term_memory.remove(memory)


@dataclass
class EmotionTransition:
    """Represents a transition between emotional states"""
    from_emotion: Dict[str, float]
    to_emotion: Dict[str, float]
    duration: float  # seconds
    context: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    
    def calculate_progress(self, current_time: Optional[datetime] = None) -> float:
        """Calculate progress through transition (0.0 to 1.0)"""
        if current_time is None:
            current_time = datetime.now()
            
        elapsed = (current_time - self.timestamp).total_seconds()
        return min(1.0, max(0.0, elapsed / self.duration))
    
    def get_current_emotion(self, current_time: Optional[datetime] = None) -> Dict[str, float]:
        """Get the current emotion state during transition"""
        progress = self.calculate_progress(current_time)
        
        # Interpolate between from_emotion and to_emotion
        current_emotion = {}
        all_emotions = set(list(self.from_emotion.keys()) + list(self.to_emotion.keys()))
        
        for emotion in all_emotions:
            from_value = self.from_emotion.get(emotion, 0.0)
            to_value = self.to_emotion.get(emotion, 0.0)
            current_emotion[emotion] = from_value + (to_value - from_value) * progress
            
        return current_emotion


class ContextualEmotionBlender:
    """Advanced system for blending and transitioning between emotional states"""
    
    def __init__(self):
        self.current_emotions: Dict[str, float] = {}
        self.active_transitions: List[EmotionTransition] = []
        self.emotion_history: List[Dict[str, float]] = []
        self.history_capacity = 100
        self.emotion_compatibility = {
            # Compatible emotions that can be blended
            "joy": ["trust", "anticipation", "surprise"],
            "trust": ["joy", "acceptance", "anticipation"],
            "fear": ["surprise", "anticipation", "anxiety"],
            "surprise": ["joy", "fear", "anticipation"],
            "sadness": ["disappointment", "grief", "pensiveness"],
            "disgust": ["anger", "contempt", "disapproval"],
            "anger": ["frustration", "disgust", "contempt"],
            "anticipation": ["joy", "trust", "interest"],
            "acceptance": ["trust", "serenity", "interest"],
            "anxiety": ["fear", "worry", "nervousness"],
            "pensiveness": ["sadness", "reflection", "melancholy"]
        }
        
        # Emotion transition parameters
        self.transition_params = {
            # How quickly emotions can transition (seconds)
            "joy_to_sadness": 30.0,
            "sadness_to_joy": 60.0,
            "anger_to_calm": 45.0,
            "calm_to_anger": 15.0,
            "fear_to_trust": 90.0,
            "trust_to_fear": 10.0,
            "default": 20.0  # Default transition time
        }
    
    def update_current_emotions(self, emotions: Dict[str, float], 
                               transition_time: Optional[float] = None,
                               context: Optional[Dict[str, Any]] = None) -> Dict[str, float]:
        """Update current emotional state with new emotions"""
        if not self.current_emotions:
            # First update, just set directly
            self.current_emotions = emotions.copy()
            self.emotion_history.append(self.current_emotions.copy())
            return self.current_emotions
        
        # Determine transition time
        if transition_time is None:
            # Find dominant emotions for from and to states
            from_dominant = max(self.current_emotions.items(), key=lambda x: x[1])[0] if self.current_emotions else "neutral"
            to_dominant = max(emotions.items(), key=lambda x: x[1])[0] if emotions else "neutral"
            
            # Get transition time from parameters
            transition_key = f"{from_dominant}_to_{to_dominant}"
            transition_time = self.transition_params.get(transition_key, self.transition_params["default"])
        
        # Create transition
        transition = EmotionTransition(
            from_emotion=self.current_emotions.copy(),
            to_emotion=emotions.copy(),
            duration=transition_time,
            context=context or {}
        )
        
        self.active_transitions.append(transition)
        
        # Clean up completed transitions
        self._clean_transitions()
        
        # Calculate current blended state
        return self.get_current_emotional_state()
    
    def get_current_emotional_state(self) -> Dict[str, float]:
        """Get current emotional state considering all active transitions"""
        # Clean up completed transitions
        self._clean_transitions()
        
        if not self.active_transitions:
            return self.current_emotions.copy()
        
        # Calculate weighted blend of all active transitions
        blended_emotions = defaultdict(float)
        total_weight = 0.0
        
        for transition in self.active_transitions:
            progress = transition.calculate_progress()
            weight = 1.0 - abs(progress - 0.5) * 2  # Weight peaks at progress=0.5
            current = transition.get_current_emotion()
            
            for emotion, intensity in current.items():
                blended_emotions[emotion] += intensity * weight
            
            total_weight += weight
        
        # Normalize
        if total_weight > 0:
            for emotion in blended_emotions:
                blended_emotions[emotion] /= total_weight
        
        # Update current emotions and history
        self.current_emotions = dict(blended_emotions)
        self.emotion_history.append(self.current_emotions.copy())
        
        # Trim history if needed
        if len(self.emotion_history) > self.history_capacity:
            self.emotion_history = self.emotion_history[-self.history_capacity:]
        
        return self.current_emotions.copy()
    
    def blend_emotions(self, emotions: Dict[str, Dict[str, float]], 
                      weights: Optional[Dict[str, float]] = None) -> Dict[str, float]:
        """Blend multiple emotional states with optional weights"""
        if not emotions:
            return {}
            
        # Default to equal weights if not provided
        if weights is None:
            weights = {source: 1.0 / len(emotions) for source in emotions}
        
        # Normalize weights
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {k: v / total_weight for k, v in weights.items()}
        
        # Blend emotions
        blended = defaultdict(float)
        for source, emotion_dict in emotions.items():
            source_weight = weights.get(source, 0.0)
            for emotion, intensity in emotion_dict.items():
                blended[emotion] += intensity * source_weight
        
        # Apply compatibility rules for more natural blending
        self._apply_compatibility_rules(blended)
        
        return dict(blended)
    
    def _apply_compatibility_rules(self, emotions: Dict[str, float]):
        """Apply compatibility rules to make emotion blends more natural"""
        # Find dominant emotion
        if not emotions:
            return
            
        dominant_emotion = max(emotions.items(), key=lambda x: x[1])[0]
        
        # Get compatible emotions
        compatible = self.emotion_compatibility.get(dominant_emotion, [])
        
        # Reduce intensity of incompatible emotions
        for emotion in list(emotions.keys()):
            if emotion != dominant_emotion and emotion not in compatible:
                # Reduce incompatible emotions
                emotions[emotion] *= 0.5
    
    def _clean_transitions(self):
        """Remove completed transitions"""
        now = datetime.now()
        self.active_transitions = [t for t in self.active_transitions 
                                 if (now - t.timestamp).total_seconds() < t.duration]


@dataclass
class CulturalEmotionProfile:
    """Profile for cultural variations in emotional expression and interpretation"""
    culture_id: str  # e.g., "western", "east_asian", "middle_eastern", etc.
    display_rules: Dict[str, Dict[str, float]]  # emotion -> context -> display intensity
    interpretation_biases: Dict[str, Dict[str, float]]  # expressed emotion -> interpreted emotion -> bias
    emotional_vocabulary: Dict[str, List[str]]  # emotion category -> culture-specific terms
    context_importance: float  # How much context matters (0.0-1.0)
    collectivism_score: float  # Individualist (0.0) to collectivist (1.0)
    high_context_communication: float  # Low (0.0) to high (1.0) context
    uncertainty_avoidance: float  # Tolerance (0.0) to avoidance (1.0) of uncertainty
    
    @classmethod
    def western(cls):
        """Create a general Western cultural profile"""
        return cls(
            culture_id="western",
            display_rules={
                "anger": {"professional": 0.3, "personal": 0.7, "intimate": 0.9},
                "joy": {"professional": 0.7, "personal": 0.9, "intimate": 1.0},
                "sadness": {"professional": 0.3, "personal": 0.7, "intimate": 0.9},
                "fear": {"professional": 0.2, "personal": 0.6, "intimate": 0.8}
            },
            interpretation_biases={
                "neutral": {"neutral": 0.8, "negative": 0.2},
                "subtle_joy": {"joy": 0.7, "neutral": 0.3}
            },
            emotional_vocabulary={
                "joy": ["happy", "excited", "pleased", "delighted"],
                "sadness": ["sad", "down", "blue", "depressed", "unhappy"],
                "anger": ["angry", "mad", "furious", "irritated", "annoyed"]
            },
            context_importance=0.5,
            collectivism_score=0.3,
            high_context_communication=0.4,
            uncertainty_avoidance=0.5
        )
    
    @classmethod
    def east_asian(cls):
        """Create a general East Asian cultural profile"""
        return cls(
            culture_id="east_asian",
            display_rules={
                "anger": {"professional": 0.1, "personal": 0.4, "intimate": 0.7},
                "joy": {"professional": 0.5, "personal": 0.7, "intimate": 0.9},
                "sadness": {"professional": 0.2, "personal": 0.5, "intimate": 0.8},
                "fear": {"professional": 0.1, "personal": 0.4, "intimate": 0.7}
            },
            interpretation_biases={
                "neutral": {"neutral": 0.6, "positive": 0.2, "negative": 0.2},
                "subtle_anger": {"anger": 0.9, "neutral": 0.1}
            },
            emotional_vocabulary={
                "joy": ["happy", "content", "harmonious", "pleased"],
                "sadness": ["sad", "disappointed", "regretful", "sorrowful"],
                "anger": ["displeased", "upset", "frustrated", "angry"]
            },
            context_importance=0.8,
            collectivism_score=0.8,
            high_context_communication=0.9,
            uncertainty_avoidance=0.7
        )


class CulturalEmotionalIntelligence:
    """System for culturally-aware emotional intelligence"""
    
    def __init__(self):
        self.cultural_profiles: Dict[str, CulturalEmotionProfile] = {
            "western": CulturalEmotionProfile.western(),
            "east_asian": CulturalEmotionProfile.east_asian(),
        }
        self.default_culture = "western"
        self.user_cultural_profiles: Dict[str, str] = {}  # user_id -> culture_id
        
        # Add more detailed cultural profiles
        self._initialize_cultural_profiles()
    
    def _initialize_cultural_profiles(self):
        """Initialize detailed cultural profiles"""
        # North American
        self.cultural_profiles["north_american"] = CulturalEmotionProfile(
            culture_id="north_american",
            display_rules={
                "anger": {"professional": 0.3, "personal": 0.8, "intimate": 0.9},
                "joy": {"professional": 0.8, "personal": 0.9, "intimate": 1.0},
                "sadness": {"professional": 0.3, "personal": 0.7, "intimate": 0.9},
                "fear": {"professional": 0.2, "personal": 0.6, "intimate": 0.8}
            },
            interpretation_biases={
                "neutral": {"neutral": 0.7, "negative": 0.3},
                "subtle_joy": {"joy": 0.8, "neutral": 0.2}
            },
            emotional_vocabulary={
                "joy": ["happy", "excited", "thrilled", "stoked", "pumped"],
                "sadness": ["sad", "down", "blue", "depressed", "bummed"],
                "anger": ["angry", "mad", "pissed", "irritated", "ticked off"]
            },
            context_importance=0.4,
            collectivism_score=0.2,
            high_context_communication=0.3,
            uncertainty_avoidance=0.4
        )
        
        # Japanese
        self.cultural_profiles["japanese"] = CulturalEmotionProfile(
            culture_id="japanese",
            display_rules={
                "anger": {"professional": 0.05, "personal": 0.3, "intimate": 0.6},
                "joy": {"professional": 0.4, "personal": 0.6, "intimate": 0.8},
                "sadness": {"professional": 0.1, "personal": 0.4, "intimate": 0.7},
                "fear": {"professional": 0.05, "personal": 0.3, "intimate": 0.6}
            },
            interpretation_biases={
                "neutral": {"neutral": 0.5, "positive": 0.3, "negative": 0.2},
                "subtle_anger": {"anger": 0.95, "neutral": 0.05}
            },
            emotional_vocabulary={
                "joy": ["ureshii", "tanoshii", "yorokobi", "shiawase"],
                "sadness": ["kanashii", "sabishii", "setsunai", "yuuutsu"],
                "anger": ["ikari", "hara ga tatsu", "mukatsuku", "fungai"]
            },
            context_importance=0.9,
            collectivism_score=0.9,
            high_context_communication=0.95,
            uncertainty_avoidance=0.9
        )
    
    def set_user_culture(self, user_id: str, culture_id: str) -> bool:
        """Set a user's cultural profile"""
        if culture_id in self.cultural_profiles:
            self.user_cultural_profiles[user_id] = culture_id
            return True
        return False
    
    def get_user_culture(self, user_id: str) -> str:
        """Get a user's cultural profile ID"""
        return self.user_cultural_profiles.get(user_id, self.default_culture)
    
    def interpret_emotion(self, expressed_emotion: Dict[str, float], 
                         user_id: str, context: Dict[str, Any]) -> Dict[str, float]:
        """Interpret emotions through cultural lens"""
        culture_id = self.get_user_culture(user_id)
        profile = self.cultural_profiles.get(culture_id, self.cultural_profiles[self.default_culture])
        
        # Apply cultural interpretation biases
        interpreted_emotion = expressed_emotion.copy()
        
        # Determine context type
        context_type = context.get("relationship_type", "personal")
        
        # Apply display rules based on context
        for emotion, intensity in list(interpreted_emotion.items()):
            # Adjust based on display rules
            if emotion in profile.display_rules and context_type in profile.display_rules[emotion]:
                display_factor = profile.display_rules[emotion][context_type]
                interpreted_emotion[emotion] = intensity * display_factor
            
            # Apply interpretation biases
            emotion_key = emotion
            if intensity < 0.3:
                emotion_key = f"subtle_{emotion}"
                
            if emotion_key in profile.interpretation_biases:
                for target_emotion, bias in profile.interpretation_biases[emotion_key].items():
                    if target_emotion != emotion:
                        # Add or enhance the biased interpretation
                        interpreted_emotion[target_emotion] = interpreted_emotion.get(target_emotion, 0.0) + (intensity * bias)
        
        # Normalize to ensure sum doesn't exceed reasonable bounds
        total = sum(interpreted_emotion.values())
        if total > 1.5:  # Allow some increase but not excessive
            interpreted_emotion = {k: v / (total / 1.5) for k, v in interpreted_emotion.items()}
        
        return interpreted_emotion
    
    def adapt_expression(self, emotion: Dict[str, float], target_culture_id: str, 
                        context: Dict[str, Any]) -> Dict[str, float]:
        """Adapt emotional expression for a specific cultural context"""
        if target_culture_id not in self.cultural_profiles:
            target_culture_id = self.default_culture
            
        profile = self.cultural_profiles[target_culture_id]
        adapted_emotion = emotion.copy()
        
        # Determine context type
        context_type = context.get("relationship_type", "personal")
        
        # Apply cultural display rules
        for emotion_name, intensity in list(adapted_emotion.items()):
            if emotion_name in profile.display_rules and context_type in profile.display_rules[emotion_name]:
                display_factor = profile.display_rules[emotion_name][context_type]
                adapted_emotion[emotion_name] = intensity * display_factor
        
        return adapted_emotion
    
    def translate_emotional_terms(self, emotion_terms: List[str], 
                                 source_culture: str, target_culture: str) -> List[str]:
        """Translate emotional terms between cultures"""
        if source_culture not in self.cultural_profiles or target_culture not in self.cultural_profiles:
            return emotion_terms
            
        source_profile = self.cultural_profiles[source_culture]
        target_profile = self.cultural_profiles[target_culture]
        
        translated_terms = []
        for term in emotion_terms:
            # Find which emotion category this term belongs to in source culture
            category = None
            for emotion_cat, terms in source_profile.emotional_vocabulary.items():
                if term.lower() in [t.lower() for t in terms]:
                    category = emotion_cat
                    break
            
            if category and category in target_profile.emotional_vocabulary:
                # Use the first term from the target culture's vocabulary for this category
                target_terms = target_profile.emotional_vocabulary[category]
                if target_terms:
                    translated_terms.append(target_terms[0])
                else:
                    translated_terms.append(term)  # Keep original if no translation
            else:
                translated_terms.append(term)  # Keep original if no category match
        
        return translated_terms
    
    def get_cultural_context_importance(self, culture_id: str) -> float:
        """Get how important context is in a culture (0.0-1.0)"""
        if culture_id in self.cultural_profiles:
            return self.cultural_profiles[culture_id].context_importance
        return self.cultural_profiles[self.default_culture].context_importance
    
    def detect_cultural_context(self, text: str, user_history: List[Dict[str, Any]]) -> str:
        """Attempt to detect cultural context from text and interaction history"""
        # This would use more sophisticated NLP in a real implementation
        # For now, use a simple keyword approach
        
        # Combine current text with recent history
        all_text = text.lower()
        if user_history:
            recent_texts = [h.get("text", "").lower() for h in user_history[-5:] if "text" in h]
            all_text += " " + " ".join(recent_texts)
        
        # Simple keyword matching for cultural indicators
        culture_scores = {culture_id: 0 for culture_id in self.cultural_profiles}
        
        # Check for cultural vocabulary matches
        for culture_id, profile in self.cultural_profiles.items():
            for emotion_terms in profile.emotional_vocabulary.values():
                for term in emotion_terms:
                    if term.lower() in all_text:
                        culture_scores[culture_id] += 1
        
        # Return the highest scoring culture, or default if none
        if culture_scores:
            max_culture = max(culture_scores.items(), key=lambda x: x[1])
            if max_culture[1] > 0:
                return max_culture[0]
        
        return self.default_culture

@dataclass
class PersonalityProfile:
    """Model for ALEJO's adaptive personality"""
    openness: float
    conscientiousness: float
    extraversion: float
    agreeableness: float
    neuroticism: float
    
    @classmethod
    def default(cls):
        """Create default balanced personality"""
        return cls(
            openness=0.7,        # Curious and open to new experiences
            conscientiousness=0.8,# Responsible and thorough
            extraversion=0.6,    # Moderately outgoing
            agreeableness=0.75,  # Kind and cooperative
            neuroticism=0.3      # Emotionally stable
        )
        
    def adapt(self, interaction_history: List[dict]):
        """Adapt personality based on interaction history"""
        # Calculate adaptation weights
        recent_interactions = interaction_history[-50:]  # Last 50 interactions
        if not recent_interactions:
            return
            
        # Analyze interaction patterns
        positive_ratio = sum(1 for i in recent_interactions 
                           if i.get("sentiment", {}).get("polarity", 0) > 0) / len(recent_interactions)
        
        # Adapt personality traits
        if positive_ratio > 0.7:
            # More positive interactions -> increase extraversion and agreeableness
            self.extraversion = min(1.0, self.extraversion + 0.1)
            self.agreeableness = min(1.0, self.agreeableness + 0.1)
        elif positive_ratio < 0.3:
            # More negative interactions -> increase conscientiousness and decrease neuroticism
            self.conscientiousness = min(1.0, self.conscientiousness + 0.1)
            self.neuroticism = max(0.0, self.neuroticism - 0.1)

class EmotionalLearning:
    """Advanced emotional learning system"""
    
    def __init__(self):
        self.sentiment_analyzer = pipeline("sentiment-analysis")
        self.response_patterns = {}
        self.emotional_memory = []
        
    def learn_from_interaction(self, interaction: dict):
        """Learn from an interaction"""
        text = interaction.get("text", "")
        response = interaction.get("response", "")
        feedback = interaction.get("feedback", {})
        
        if not text or not response:
            return
            
        # Analyze sentiment patterns
        sentiment = TextBlob(text).sentiment
        response_sentiment = TextBlob(response).sentiment
        
        # Store interaction pattern
        pattern_key = self._get_pattern_key(sentiment.polarity, sentiment.subjectivity)
        if pattern_key not in self.response_patterns:
            self.response_patterns[pattern_key] = []
            
        self.response_patterns[pattern_key].append({
            "response": response,
            "effectiveness": feedback.get("effectiveness", 0.5),
            "sentiment_match": abs(sentiment.polarity - response_sentiment.polarity)
        })
        
        # Prune old patterns
        if len(self.response_patterns[pattern_key]) > 100:
            # Keep most effective responses
            self.response_patterns[pattern_key].sort(key=lambda x: x["effectiveness"], reverse=True)
            self.response_patterns[pattern_key] = self.response_patterns[pattern_key][:50]
            
    def get_learned_response(self, text: str, context: dict = None) -> Optional[str]:
        """Get a learned response based on past patterns"""
        sentiment = TextBlob(text).sentiment
        pattern_key = self._get_pattern_key(sentiment.polarity, sentiment.subjectivity)
        
        if pattern_key in self.response_patterns:
            patterns = self.response_patterns[pattern_key]
            if patterns:
                # Select response based on effectiveness and context similarity
                patterns.sort(key=lambda x: x["effectiveness"], reverse=True)
                return patterns[0]["response"]
                
        return None
        
    def _get_pattern_key(self, polarity: float, subjectivity: float) -> str:
        """Convert sentiment values to pattern key"""
        # Discretize sentiment values
        pol_key = "pos" if polarity > 0 else "neg" if polarity < 0 else "neu"
        subj_key = "high" if subjectivity > 0.5 else "low"
        return f"{pol_key}_{subj_key}"

class MultimodalEmotionDetector:
    """Detect emotions from multiple input modalities"""
    
    def __init__(self):
        self.text_classifier = pipeline("text-classification", 
                                      model="j-hartmann/emotion-english-distilroberta-base")
        
    def analyze_text(self, text: str) -> dict:
        """Analyze emotions in text"""
        try:
            result = self.text_classifier(text)[0]
            return {
                "emotion": result["label"],
                "confidence": result["score"]
            }
        except Exception as e:
            logger.error(f"Error analyzing text emotion: {e}")
            return {"emotion": "neutral", "confidence": 0.5}
            
    def combine_modalities(self, text_emotion: dict, context: dict = None) -> dict:
        """Combine emotions from different modalities"""
        # For now, just use text emotion, but could be extended for voice, etc.
        return {
            "dominant_emotion": text_emotion["emotion"],
            "confidence": text_emotion["confidence"],
            "modalities": ["text"]
        }

class AdaptiveResponseGenerator:
    """Generate contextually appropriate emotional responses"""
    
    def __init__(self, personality: PersonalityProfile):
        self.personality = personality
        self.emotional_learning = EmotionalLearning()
        self.emotion_detector = MultimodalEmotionDetector()
        
    def generate_response(self, input_text: str, emotional_state: dict,
                         context: dict = None) -> Tuple[str, dict]:
        """Generate an emotionally appropriate response"""
        # Detect emotions
        emotions = self.emotion_detector.analyze_text(input_text)
        
        # Check for learned responses
        learned_response = self.emotional_learning.get_learned_response(
            input_text,
            context
        )
        
        if learned_response:
            return learned_response, {
                "type": "learned",
                "emotions": emotions,
                "confidence": 0.8
            }
            
        # Generate new response based on personality and emotional state
        response = self._generate_personality_based_response(
            input_text,
            emotions,
            emotional_state
        )
        
        return response, {
            "type": "generated",
            "emotions": emotions,
            "personality_influence": self._get_personality_influence()
        }
        
    def _generate_personality_based_response(self, text: str, emotions: dict,
                                           emotional_state: dict) -> str:
        """Generate response influenced by personality"""
        # Implement sophisticated response generation based on:
        # - Personality traits
        # - Current emotional state
        # - Detected emotions
        # For now, return a template response
        return f"I understand you're feeling {emotions['emotion']}. " + \
               self._get_personality_colored_response(emotions['emotion'])
               
    def _get_personality_influence(self) -> dict:
        """Calculate personality influence on response"""
        return {
            "warmth": self.personality.agreeableness * 0.6 + self.personality.extraversion * 0.4,
            "depth": self.personality.openness * 0.7 + self.personality.conscientiousness * 0.3,
            "stability": (1 - self.personality.neuroticism) * 0.8
        }
        
    def _get_personality_colored_response(self, emotion: str) -> str:
        """Get personality-influenced response template"""
        if self.personality.agreeableness > 0.7:
            return f"I'm here to support you through these {emotion} feelings."
        elif self.personality.openness > 0.7:
            return f"Let's explore why you're feeling {emotion} together."
        elif self.personality.conscientiousness > 0.7:
            return f"Would you like to discuss practical ways to address these {emotion} feelings?"
        else:
            return f"I acknowledge your {emotion} feelings."
