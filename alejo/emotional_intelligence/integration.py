"""
Integration module for connecting Emotional Intelligence components to ALEJO Brain

This module provides a unified interface for the brain to access emotional intelligence
capabilities including emotional processing, ethical decision making, and adaptive responses.
"""

import os
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union, AsyncGenerator
from datetime import datetime
import time
import json

from ..core.event_bus import EventBus
from ..core.brain import ALEJOBrain
from ..database.memory_store import MemoryStore
from .processor import EmotionalProcessor, EmotionalState
from .ethics import EthicalFramework, EthicalDecision, EmotionalEthicsEvaluation
from .memory import EmotionalMemory
from .ethical_integration import EthicalIntegration
from ..utils.error_handling import handle_errors
from ..utils.exceptions import EmotionalIntelligenceError, EthicalEvaluationError

logger = logging.getLogger("alejo.emotional_intelligence.integration")

class EmotionalIntelligenceIntegration:
    """
    Integration class for connecting Emotional Intelligence components to ALEJO Brain
    
    This class serves as the main interface for the brain to leverage
    emotional intelligence capabilities through a unified API.
    """
    
    def __init__(
        self,
        brain: Optional[ALEJOBrain] = None,
        event_bus: Optional[EventBus] = None,
        memory_store: Optional[MemoryStore] = None,
        emotional_processor: Optional[EmotionalProcessor] = None,
        ethical_framework: Optional[EthicalFramework] = None,
        emotional_memory: Optional[EmotionalMemory] = None,
        config_path: Optional[str] = None
    ):
        """
        Initialize the emotional intelligence integration
        
        Args:
            brain: ALEJOBrain instance
            event_bus: EventBus instance for system-wide communication
            memory_store: Memory store for persistent storage
            emotional_processor: EmotionalProcessor instance
            ethical_framework: EthicalFramework instance
            emotional_memory: EmotionalMemory instance
            config_path: Path to configuration file
        """
        self.brain = brain
        self.event_bus = event_bus or (brain.event_bus if brain else None)
        self.memory_store = memory_store or (brain.memory_store if brain else None)
        
        # Initialize components
        self.emotional_processor = emotional_processor or EmotionalProcessor()
        self.ethical_framework = ethical_framework or EthicalFramework()
        self.emotional_memory = emotional_memory or EmotionalMemory(
            memory_store=self.memory_store
        )
        
        # Initialize ethical integration
        self.ethical_integration = EthicalIntegration(
            brain=self.brain,
            event_bus=self.event_bus,
            memory_store=self.memory_store,
            ethical_framework=self.ethical_framework,
            config_path=config_path
        )
        
        # Configuration
        self.config = self._load_config(config_path)
        
        # Register event handlers
        if self.event_bus:
            self._register_event_handlers()
            
        logger.info("Emotional Intelligence integration initialized")
    
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        config = {
            "empathy_threshold": 0.7,  # Threshold for triggering empathetic responses
            "ethical_evaluation_threshold": 0.8,  # Threshold for ethical evaluations
            "emotion_tracking_enabled": True,  # Whether to track emotions over time
            "adaptive_personality_enabled": True,  # Whether to adapt personality over time
            "ethical_logging_enabled": True,  # Whether to log ethical decisions
            "default_interaction_style": {
                "formality": 0.5,
                "humor": 0.5,
                "complexity": 0.5,
                "empathy": 0.7,
                "response_speed": 0.5
            }
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    loaded_config = json.load(f)
                    config.update(loaded_config)
            except Exception as e:
                logger.error(f"Failed to load config from {config_path}: {e}")
        
        return config
    
    def _register_event_handlers(self):
        """Register event handlers with the event bus"""
        self.event_bus.subscribe("brain.analyze_emotion", self._handle_analyze_emotion)
        self.event_bus.subscribe("brain.evaluate_ethics", self._handle_evaluate_ethics)
        self.event_bus.subscribe("brain.evaluate_decision", self._handle_evaluate_decision)
        self.event_bus.subscribe("brain.evaluate_emotional_response", self._handle_evaluate_emotional_response)
        self.event_bus.subscribe("brain.get_ethical_stats", self._handle_get_ethical_stats)
        self.event_bus.subscribe("brain.get_emotional_response", self._handle_get_emotional_response)
        self.event_bus.subscribe("brain.update_emotional_memory", self._handle_update_emotional_memory)
        self.event_bus.subscribe("brain.get_interaction_recommendation", self._handle_get_interaction_recommendation)
    
    async def initialize(self) -> None:
        """Initialize all emotional intelligence components asynchronously"""
        logger.info("Initializing emotional intelligence components...")
        
        # Initialize components asynchronously
        await self.emotional_memory.initialize()
        await self.ethical_integration.initialize()
        
        # Set up event listeners
        if self.event_bus:
            self._register_event_handlers()
            
        logger.info("Emotional intelligence components initialized successfully")
    
    @handle_errors(EmotionalIntelligenceError)
    async def analyze_emotion(
        self,
        text: str,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze the emotional content of text
        
        Args:
            text: Text to analyze
            user_id: Optional user ID for personalization
            context: Optional additional context
            
        Returns:
            Dictionary with emotional analysis results
        """
        start_time = time.time()
        context = context or {}
        
        # Add user context if available
        if user_id:
            user_context = await self._get_user_context(user_id)
            if user_context:
                context.update(user_context)
        
        # Perform emotional analysis
        emotional_state = self.emotional_processor.analyze_sentiment(text, context)
        
        # Update emotional memory if enabled
        if self.config["emotion_tracking_enabled"] and user_id:
            await self.emotional_memory.store_emotional_state(
                user_id=user_id,
                state=emotional_state,
                text=text,
                context=context
            )
        
        # Convert to serializable format
        result = {
            "valence": emotional_state.valence,
            "arousal": emotional_state.arousal,
            "dominance": emotional_state.dominance,
            "primary_emotion": emotional_state.primary_emotion,
            "emotion_scores": emotional_state.emotion_scores,
            "confidence": emotional_state.confidence,
            "context_relevance": emotional_state.context_relevance,
            "processing_time": time.time() - start_time
        }
        
        return result
    
    @handle_errors(EmotionalIntelligenceError)
    async def evaluate_ethics(
        self,
        emotional_state: Dict[str, float],
        context: Dict[str, Any]
    ) -> EmotionalEthicsEvaluation:
        """Evaluate the ethical implications of an emotional state"""
        return await self.ethical_integration.evaluate_ethics(emotional_state, context)
    
    @handle_errors(EmotionalIntelligenceError)
    async def get_emotional_response(
        self,
        input_text: str,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        target_emotion: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Generate an emotionally appropriate response
        
        Args:
            input_text: Input text to respond to
            user_id: Optional user ID for personalization
            context: Optional additional context
            target_emotion: Optional target emotion for the response
            
        Returns:
            Dictionary with response and emotional metadata
        """
        start_time = time.time()
        context = context or {}
        
        # Add user context if available
        if user_id:
            user_context = await self._get_user_context(user_id)
            if user_context:
                context.update(user_context)
        
        # Generate emotional response
        response = self.emotional_processor.generate_emotional_response(
            input_text=input_text,
            context=context,
            target_emotion=target_emotion
        )
        
        # Add metadata
        result = {
            "response": response,
            "processing_time": time.time() - start_time
        }
        
        return result
    
    @handle_errors(EmotionalIntelligenceError)
    async def get_interaction_recommendation(
        self,
        user_id: str,
        current_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get recommendations for how to interact with the user
        
        Args:
            user_id: User ID for personalization
            current_context: Current interaction context
            
        Returns:
            Dictionary with interaction recommendations
        """
        start_time = time.time()
        
        # Get user's emotional history
        emotional_history = await self.emotional_memory.get_emotional_history(
            user_id=user_id,
            limit=10
        )
        
        # If no history, use defaults
        if not emotional_history:
            return {
                "interaction_style": self.config["default_interaction_style"],
                "processing_time": time.time() - start_time
            }
        
        # Get the most recent emotional state
        recent_state = emotional_history[0]["state"]
        
        # Get interaction recommendation
        recommendation = self.emotional_processor.get_interaction_recommendation(
            state=recent_state,
            context=current_context
        )
        
        # Add processing time
        recommendation["processing_time"] = time.time() - start_time
        
        return recommendation
    
    async def _get_user_context(self, user_id: str) -> Dict[str, Any]:
        """
        Get context information for a specific user
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with user context
        """
        context = {}
        
        # Get emotional history if available
        try:
            emotional_history = await self.emotional_memory.get_emotional_history(
                user_id=user_id,
                limit=5
            )
            
            if emotional_history:
                context["emotional_history"] = emotional_history
                
                # Calculate emotional trend
                valence_trend = [entry["state"].valence for entry in emotional_history]
                arousal_trend = [entry["state"].arousal for entry in emotional_history]
                
                context["emotional_trend"] = {
                    "valence": sum(valence_trend) / len(valence_trend),
                    "arousal": sum(arousal_trend) / len(arousal_trend),
                    "volatility": self._calculate_volatility(valence_trend, arousal_trend)
                }
        except Exception as e:
            logger.error(f"Failed to get emotional history for user {user_id}: {e}")
        
        return context
    
    def _calculate_volatility(self, valence_trend: List[float], arousal_trend: List[float]) -> float:
        """
        Calculate emotional volatility from trends
        
        Args:
            valence_trend: List of valence values
            arousal_trend: List of arousal values
            
        Returns:
            Volatility score (0-1)
        """
        if len(valence_trend) < 2 or len(arousal_trend) < 2:
            return 0.0
        
        # Calculate changes between consecutive values
        valence_changes = [abs(valence_trend[i] - valence_trend[i-1]) for i in range(1, len(valence_trend))]
        arousal_changes = [abs(arousal_trend[i] - arousal_trend[i-1]) for i in range(1, len(arousal_trend))]
        
        # Average the changes
        avg_valence_change = sum(valence_changes) / len(valence_changes)
        avg_arousal_change = sum(arousal_changes) / len(arousal_changes)
        
        # Combine into volatility score (0-1)
        volatility = (avg_valence_change + avg_arousal_change) / 2
        return min(1.0, volatility)
    
    async def _handle_analyze_emotion(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.analyze_emotion event"""
        text = data.get("text")
        user_id = data.get("user_id")
        context = data.get("context")
        
        if not text:
            return {"error": "Missing required parameter: text"}
        
        return await self.analyze_emotion(
            text=text,
            user_id=user_id,
            context=context
        )
    
    async def _handle_evaluate_ethics(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle ethical evaluation events by delegating to the ethical integration component"""
        return await self.ethical_integration._handle_evaluate_ethics(event_data)
    
    async def _handle_get_emotional_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.get_emotional_response event"""
        input_text = data.get("input_text")
        user_id = data.get("user_id")
        context = data.get("context")
        target_emotion = data.get("target_emotion")
        
        if not input_text:
            return {"error": "Missing required parameter: input_text"}
        
        return await self.get_emotional_response(
            input_text=input_text,
            user_id=user_id,
            context=context,
            target_emotion=target_emotion
        )
    
    async def _handle_update_emotional_memory(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.update_emotional_memory event"""
        user_id = data.get("user_id")
        emotional_state = data.get("emotional_state")
        text = data.get("text")
        context = data.get("context", {})
        
        if not user_id or not emotional_state:
            return {"error": "Missing required parameters: user_id and emotional_state"}
        
        try:
            # Convert dict to EmotionalState
            state = EmotionalState(
                valence=emotional_state.get("valence", 0.0),
                arousal=emotional_state.get("arousal", 0.0),
                dominance=emotional_state.get("dominance", 0.0),
                primary_emotion=emotional_state.get("primary_emotion", "neutral"),
                emotion_scores=emotional_state.get("emotion_scores", {}),
                confidence=emotional_state.get("confidence", 0.5),
                context_relevance=emotional_state.get("context_relevance", 0.5)
            )
            
            # Store in emotional memory
            await self.emotional_memory.store_emotional_state(
                user_id=user_id,
                state=state,
                text=text,
                context=context
            )
            
            return {"success": True}
        except Exception as e:
            logger.error(f"Failed to update emotional memory: {e}")
            return {"error": f"Failed to update emotional memory: {str(e)}"}
    
    async def _handle_get_interaction_recommendation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.get_interaction_recommendation event"""
        user_id = data.get("user_id")
        current_context = data.get("current_context", {})
        
        if not user_id:
            return {"error": "Missing required parameter: user_id"}
        
        return await self.get_interaction_recommendation(
            user_id=user_id,
            current_context=current_context
        )
