"""
ALEJO Emotional Processor
Handles emotional understanding, empathy modeling, and context-aware responses.
"""

import asyncio
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import asdict
import numpy as np
from transformers import pipeline

from ...core.events import Event, EventType
from ...utils.error_handling import handle_errors
from ..memory.models import EmotionalState, EmotionalMemoryItem
from ..memory.emotional_memory import EmotionalMemory

class EmotionalProcessor:
    """
    Processes emotional content and generates empathetic responses.
    
    Features:
    - Sentiment analysis
    - Emotion detection
    - Empathy modeling
    - Context-aware response generation
    """
    
    def __init__(self, emotional_memory: EmotionalMemory, event_bus=None, config: Dict[str, Any] = None):
        """
        Initialize emotional processor.
        
        Args:
            emotional_memory: Reference to emotional memory system
            event_bus: Event bus for system communication
            config: Configuration options
        """
        self.emotional_memory = emotional_memory
        self.event_bus = event_bus
        self.config = config or {}
        
        # Initialize sentiment analysis pipeline
        self.sentiment_analyzer = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
            device=-1  # CPU
        )
        
        # Configure empathy parameters
        self.empathy_threshold = self.config.get('empathy_threshold', 0.6)
        self.context_weight = self.config.get('context_weight', 0.4)
        self.response_temperature = self.config.get('response_temperature', 0.7)
        
        # Initialize response templates
        self.response_templates = {
            'joy': [
                "I'm happy to hear that!",
                "That's wonderful news!",
                "I share your joy!"
            ],
            'sadness': [
                "I'm sorry you're feeling this way.",
                "That must be difficult.",
                "I understand this is hard."
            ],
            'anger': [
                "I understand your frustration.",
                "That would make me angry too.",
                "Let's work through this together."
            ],
            'fear': [
                "It's okay to feel scared.",
                "I'm here to help.",
                "Let's face this together."
            ],
            'surprise': [
                "That's unexpected!",
                "I didn't see that coming either!",
                "What an interesting turn of events!"
            ]
        }
        
    async def start(self):
        """Start emotional processor and subscribe to events."""
        if self.event_bus:
            await self.event_bus.subscribe(EventType.PERCEPTION, self._handle_perception)
            await self.event_bus.subscribe(EventType.INTERACTION, self._handle_interaction)
            
    async def stop(self):
        """Stop emotional processor and cleanup."""
        if self.event_bus:
            await self.event_bus.unsubscribe(EventType.PERCEPTION, self._handle_perception)
            await self.event_bus.unsubscribe(EventType.INTERACTION, self._handle_interaction)
            
    @handle_errors(component='emotional_processor')
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """
        Analyze sentiment of text input.
        
        Args:
            text: Input text to analyze
            
        Returns:
            Dictionary with sentiment analysis results
        """
        # Get base sentiment
        sentiment = self.sentiment_analyzer(text)[0]
        
        # Map to emotional dimensions
        valence = self._map_sentiment_to_valence(sentiment['score'], sentiment['label'])
        arousal = self._estimate_arousal(text)
        dominance = self._estimate_dominance(text)
        
        return {
            'sentiment': sentiment,
            'emotional_state': {
                'valence': valence,
                'arousal': arousal,
                'dominance': dominance
            }
        }
        
    @handle_errors(component='emotional_processor')
    async def generate_empathetic_response(self, 
                                         input_text: str,
                                         context: Dict[str, Any] = None) -> Tuple[str, Dict[str, float]]:
        """
        Generate an empathetic response based on input and context.
        
        Args:
            input_text: User input text
            context: Additional context information
            
        Returns:
            Tuple of (response text, emotional values)
        """
        # Analyze input sentiment
        analysis = await self.analyze_sentiment(input_text)
        emotional_state = analysis['emotional_state']
        
        # Get current system emotional state
        system_state = await self.emotional_memory.get_current_state()
        
        # Generate response considering both states
        response = await self._generate_response(
            input_text,
            emotional_state,
            system_state,
            context
        )
        
        return response, emotional_state
        
    @handle_errors(component='emotional_processor')
    async def update_empathy_model(self, interaction_data: Dict[str, Any]):
        """
        Update empathy model based on interaction feedback.
        
        Args:
            interaction_data: Data about the interaction and its success
        """
        if 'success_rating' in interaction_data:
            # Adjust empathy parameters based on success
            success = interaction_data['success_rating']
            self.empathy_threshold = self._adjust_parameter(
                self.empathy_threshold,
                success,
                min_val=0.4,
                max_val=0.8
            )
            self.context_weight = self._adjust_parameter(
                self.context_weight,
                success,
                min_val=0.2,
                max_val=0.6
            )
            
    def _map_sentiment_to_valence(self, score: float, label: str) -> float:
        """Map sentiment score to valence value (-1 to 1)."""
        if label == 'POSITIVE':
            return score
        return -score
        
    def _estimate_arousal(self, text: str) -> float:
        """Estimate arousal level from text (-1 to 1)."""
        # Simple heuristic based on punctuation and capitalization
        excitement = sum(c in '!?' for c in text) / len(text)
        emphasis = sum(c.isupper() for c in text) / len(text)
        return min(1.0, (excitement + emphasis) * 2 - 0.5)
        
    def _estimate_dominance(self, text: str) -> float:
        """Estimate dominance level from text (-1 to 1)."""
        # Simple heuristic based on command words and certainty
        command_words = {'must', 'should', 'will', 'definitely', 'certainly'}
        uncertainty_words = {'maybe', 'perhaps', 'might', 'could', 'unsure'}
        
        words = text.lower().split()
        command_count = sum(word in command_words for word in words)
        uncertainty_count = sum(word in uncertainty_words for word in words)
        
        return min(1.0, (command_count - uncertainty_count) / len(words) * 2)
        
    async def _generate_response(self,
                               input_text: str,
                               emotional_state: Dict[str, float],
                               system_state: EmotionalState,
                               context: Optional[Dict[str, Any]] = None) -> str:
        """Generate appropriate emotional response."""
        # Determine dominant emotion
        emotions = {
            'joy': max(0, emotional_state['valence']),
            'sadness': max(0, -emotional_state['valence']),
            'anger': max(0, emotional_state['arousal'] * -emotional_state['valence']),
            'fear': max(0, -emotional_state['dominance']),
            'surprise': max(0, abs(emotional_state['arousal']))
        }
        dominant_emotion = max(emotions.items(), key=lambda x: x[1])[0]
        
        # Select response template
        templates = self.response_templates[dominant_emotion]
        
        # Consider context for template selection
        if context and 'previous_responses' in context:
            # Avoid repeating recent responses
            recent = context['previous_responses']
            templates = [t for t in templates if t not in recent]
            
        if not templates:  # If all templates were recently used
            templates = self.response_templates[dominant_emotion]
            
        return np.random.choice(templates)
        
    def _adjust_parameter(self,
                         current: float,
                         success: float,
                         min_val: float,
                         max_val: float,
                         learning_rate: float = 0.1) -> float:
        """Adjust a parameter based on interaction success."""
        adjustment = (success - 0.5) * learning_rate
        return min(max_val, max(min_val, current + adjustment))
        
    async def _handle_perception(self, event: Event):
        """Handle perception events."""
        if 'text' in event.payload:
            analysis = await self.analyze_sentiment(event.payload['text'])
            
            # Update emotional memory
            await self.emotional_memory.update_emotional_state(
                valence=analysis['emotional_state']['valence'],
                arousal=analysis['emotional_state']['arousal'],
                dominance=analysis['emotional_state']['dominance'],
                source='perception',
                context=event.payload.get('context', {})
            )
            
    async def _handle_interaction(self, event: Event):
        """Handle interaction events."""
        if event.payload.get('action') == 'user_feedback':
            await self.update_empathy_model(event.payload)
