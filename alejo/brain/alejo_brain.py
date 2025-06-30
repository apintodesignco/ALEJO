"""ALEJO Brain Module - Core AI functionality
Enhanced with improved command processing and extensibility
"""
import logging
import os
import re
import json
import time
import sys
import tempfile
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable, Union, AsyncGenerator

from ..llm_client import (
    LLMClientFactory,
    LLMConfig,
    LLMResponse,
    LLMError,
    BaseLLMClient
)

from ..core.event_bus import EventBus, Event, EventType
from ..config import ConfigManager
from ..cognitive.learning_orchestrator import LearningOrchestrator, AdaptiveResponse
from ..utils.error_handling import handle_errors, get_error_tracker, ErrorTracker
from ..utils.metrics import get_metrics
from ..utils.monitoring import get_monitor
from ..utils.exceptions import LLMServiceError, CommandError, VoiceRecognitionError, VisionError
from .streaming import BrainStreamingMixin
try:
    from ..vision.processor import VisionProcessor
except Exception as _vision_err:  # pragma: no cover
    logger = logging.getLogger(__name__)
    logger.warning("VisionProcessor unavailable (%s); falling back to stub.", _vision_err)
    class VisionProcessor:  # type: ignore
        def __init__(self, *_, **__):
            logger.info("Stub VisionProcessor initialized (no-op)")
        async def analyze(self, *_, **__):
            return {}

from ..vision.scene_description import SceneDescriptionEngine
from ..emotional_intelligence import EmotionalMemory, EmotionalProcessor, EthicalFramework, EthicalDecision
from ..emotional_intelligence.emotional_core import EmotionalCore
from ..emotional_intelligence.adaptive_processor import AdaptiveEmotionalProcessor
from ..cognitive.adaptive_interaction import AdaptiveInteractionEngine
from ..cognitive.curiosity_layer import CuriosityEngine
from ..cognitive.empathy_layer import EmpathyEngine
from ..commands import get_command_processor, CommandProcessor
from ..multimodal import MultimodalProcessor
from ..multimodal.integration import MultimodalIntegration
from ..database import DatabaseManager
from ..utils.error_handling import handle_errors

# Import our custom utilities if available
try:
    from ..utils.logging_utils import get_logger
    from ..utils.api_utils import retry_with_exponential_backoff, rate_limited_api_call
    ENHANCED_API_UTILS_AVAILABLE = True
    logger = get_logger('alejo.brain.alejo_brain')
except ImportError:
    ENHANCED_API_UTILS_AVAILABLE = False
    logger = logging.getLogger(__name__)

class ALEJOBrain(BrainStreamingMixin):
    """Core brain of ALEJO including LLM integration and emotional intelligence."""

    def __init__(self, config: Optional[Dict[str, Any]] = None, event_bus: Optional[EventBus] = None, config_manager: Optional[ConfigManager] = None):
        """Initialize ALEJOBrain
        
        Args:
            config: Optional configuration dictionary
            event_bus: Optional event bus for pub/sub
            config_manager: Optional configuration manager
        """
        self.config = config or {}
        self.event_bus = event_bus or EventBus()
        self.config_manager = config_manager or ConfigManager()
        self.initialized = False
        self.error_tracker = get_error_tracker()
        self._last_command_time = time.time()
        
        # Initialize core components
        self.llm_client = self._create_llm_client()
        
        # Initialize command processor
        self.command_processor = get_command_processor()
        
        # Initialize learning orchestrator
        self.learning_orchestrator = LearningOrchestrator()
        
        # Initialize emotional intelligence components
        self.emotional_memory = EmotionalMemory(config=self.config.get("emotional_intelligence", {}), event_bus=self.event_bus)
        self.emotional_processor = EmotionalProcessor()
        self.ethical_framework = EthicalFramework()
        
        # Initialize adaptive components
        self.adaptive_processor = AdaptiveEmotionalProcessor()
        self._last_proactive_check = datetime.now()
        
        # Initialize multimodal components
        self.multimodal_integration = None  # Will be initialized in _setup_multimodal
        
        # Subscribe to events
        self.event_bus.subscribe("llm.response", self._process_llm_response)
        self.event_bus.subscribe("emotional.update", self._update_emotional_state)
        self.event_bus.subscribe("brain.multimodal_result", self._process_multimodal_result)
        
        # Initialization flag
        self.initialized = False

    def _create_llm_client(self) -> BaseLLMClient:
        """Create LLM client based on configuration
        
        Always enforces local inference by default in accordance with Phase 0 requirements.
        Uses AutoModelManager to select, download and manage the best model for the system.
        """
        try:
            from alejo.llm_client.factory import LLMClientFactory
            
            llm_config = self.config.get("llm", {})
            
            # Enforce local provider by default
            provider = llm_config.get("provider", "local")
            
            # Enforce local inference unless explicitly overridden and allowed
            # This follows the principle of 100% local inference by default
            if provider != "local" and os.environ.get("ALEJO_ALLOW_EXTERNAL_API", "0") != "1":
                logger.info(f"Enforcing local provider instead of {provider} due to local inference requirement")
                provider = "local"
                llm_config["provider"] = "local"
            
            # If using local provider, ensure model tier is set
            # and auto_model_management is enabled for best user experience
            if provider == "local":
                # Enable automatic model management for seamless user experience
                if "auto_model_management" not in llm_config:
                    llm_config["auto_model_management"] = True
                    
                # Let AutoModelManager handle model selection if no specific tier set
                if "model_tier" not in llm_config:
                    logger.info("No model tier specified, AutoModelManager will select best model for system")
                
            # Create client with the updated config
            client = LLMClientFactory.create_client(provider=provider, config_override=llm_config, force_local=True)
            logger.info(f"Created LLM client with provider: {provider}")
            
            return client
                
        except Exception as e:
            logger.error(f"Failed to set up brain components: {str(e)}")
            raise
        
    async def initialize(self):
        """Initialize all brain components asynchronously
        
        This method must be called before using the brain to ensure all components
        are properly initialized, especially those requiring async initialization.
        """
        try:
            logger.info("Initializing ALEJO Brain components...")
            
            # Initialize emotional memory
            await self.emotional_memory.initialize()
            logger.info("Emotional memory initialized")
            
            # Initialize vision components
            await self._setup_vision()
            logger.info("Vision components initialized")
            
            # Initialize multimodal components if enabled
            if self.config.get("multimodal", {}).get("enabled", True):
                await self._setup_multimodal()
                logger.info("Multimodal components initialized")
            
            self.initialized = True
            logger.info("ALEJO Brain initialization complete")
            
            # Emit initialization event
            await self.event_bus.emit("brain.initialized", {
                "timestamp": datetime.now().isoformat(),
                "components": ["emotional_memory", "vision", "multimodal"]
            })
            
        except Exception as e:
            logger.error(f"Failed to initialize ALEJO Brain: {str(e)}")
            raise
    
    async def _setup_vision(self):
        """Initialize vision components"""
        # Initialize vision processor
        self.vision_processor = VisionProcessor(self.config)
        
        # Initialize scene engine
        self.scene_engine = SceneDescriptionEngine(self.config)
        
    async def _process_llm_response(self, event_data: Dict[str, Any]):
        """Process LLM response and update emotional state"""
        response = event_data.get("response", "")
        self.emotional_processor.process_text(response)
        
    async def _update_emotional_state(self, event_data: Dict[str, Any]):
        """Update emotional state based on new data"""
        await self.emotional_memory._handle_emotional_update(event_data)
        self.ethical_framework.evaluate(event_data)
        
    async def process_input(self, text: str) -> str:
        """Process user input through LLM and emotional components
        
        Args:
            text: User input text
            
        Returns:
            Processed response
        """
        # Check if brain is initialized
        if not self.initialized:
            logger.warning("Brain not initialized, initializing now...")
            await self.initialize()
            
        # Process emotional context of input
        emotional_analysis = self.emotional_processor.analyze_text(text)
        
        # Get current emotional state and relationship context
        current_state = await self.emotional_memory.get_current_emotional_state()
        relationship = await self.emotional_memory.get_relationship_context()
        
        # Create context-aware prompt with emotional intelligence
        context = {
            "emotional_state": current_state,
            "relationship": relationship,
            "user_query": text
        }
        
        # Process through LLM with emotional context
        response = await self.llm_client.generate(text, context=context)
        
        # Process response through emotional components
        enhanced_response = self.emotional_processor.enhance_response(response)
        validated_response = self.ethical_framework.validate_response(enhanced_response)
        
        # Store the interaction with emotional data
        await self.emotional_memory.store_interaction(
            interaction_type=emotional_analysis.get("primary_emotion", "neutral"),
            emotional_data=emotional_analysis,
            context=context,
            response=validated_response,
            trigger=text[:50] if text else None,  # Use first 50 chars as trigger
            confidence=emotional_analysis.get("confidence", 1.0)
        )
        
        # Update relationship metrics based on interaction
        valence = emotional_analysis.get("valence", 0.0)
        trust_delta = valence * 0.05  # Small adjustment based on emotional valence
        rapport_delta = valence * 0.03
        await self.emotional_memory.update_relationship(trust_delta=trust_delta, rapport_delta=rapport_delta)
        
        return validated_response
    
    async def generate_text(self, prompt: str, **kwargs) -> LLMResponse:
        """Generate a text response using the LLM and adjust it using emotional intelligence.
        
        Args:
            prompt: Text prompt to generate from
            **kwargs: Additional parameters for the LLM
            
        Returns:
            LLMResponse containing the generated text and metadata
            
        Raises:
            LLMServiceError: If text generation fails
        """
        try:
            # Check if brain is initialized
            if not self.initialized:
                logger.warning("Brain not initialized, initializing now...")
                await self.initialize()
            
            # Process emotional context of input
            emotional_analysis = self.emotional_processor.analyze_text(prompt)
            
            # Get emotional context from memory
            current_state = await self.emotional_memory.get_current_emotional_state()
            relationship = await self.emotional_memory.get_relationship_context()
            emotional_patterns = await self.emotional_memory.get_emotional_patterns(limit=3)
            
            # Get relevant nostalgic memories if available
            nostalgic_memories = await self.emotional_memory.get_nostalgic_memories(
                emotion=emotional_analysis.get("primary_emotion", "neutral"),
                limit=2
            )
            
            # Create context-aware prompt with emotional intelligence
            context = {
                "emotional_state": current_state,
                "relationship": relationship,
                "emotional_patterns": emotional_patterns,
                "nostalgic_memories": nostalgic_memories,
                "user_query": prompt
            }
            
            # Add context to kwargs if not already present
            if "context" not in kwargs:
                kwargs["context"] = context
            else:
                kwargs["context"].update(context)
            
            # Generate response from the LLM client with emotional context
            response = await self.llm_client.generate_text(prompt, **kwargs)
            
            # Process the response through the emotional processor
            emotional_response = self.emotional_processor.analyze_text(response.content)
            enhanced_content = self.emotional_processor.enhance_response(response.content)
            
            # Validate through ethical framework
            if not self.ethical_framework.evaluate_decision(enhanced_content):
                logger.warning("Response modified due to ethical constraints")
                enhanced_content = self.ethical_framework.modify_response(enhanced_content)
            
            # Store the interaction with emotional data
            await self.emotional_memory.store_interaction(
                interaction_type="text_generation",
                emotional_data=emotional_analysis,
                context=context,
                response=enhanced_content,
                trigger=prompt[:50] if prompt else None,
                confidence=emotional_analysis.get("confidence", 1.0)
            )
            
            # Update relationship metrics based on interaction
            valence = emotional_response.get("valence", 0.0)
            trust_delta = valence * 0.05  # Small adjustment based on emotional valence
            rapport_delta = valence * 0.03
            await self.emotional_memory.update_relationship(trust_delta=trust_delta, rapport_delta=rapport_delta)
            
            # Update response content with enhanced version
            response.content = enhanced_content
            response.metadata["emotional_context"] = {
                "primary_emotion": emotional_response.get("primary_emotion", "neutral"),
                "valence": emotional_response.get("valence", 0.0),
                "arousal": emotional_response.get("arousal", 0.0)
            }
            
            return response
            
        except Exception as e:
            error_msg = f"Text generation failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            if hasattr(self, 'error_tracker'):
                self.error_tracker.track_error("text_generation_error", error_msg)
            raise LLMServiceError(error_msg) from e
    
    async def generate_chat_response(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> LLMResponse:
        """Generate a response in a chat context
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            **kwargs: Additional parameters for the LLM
            
        Returns:
            LLMResponse containing the chat response and metadata
            
        Raises:
            LLMServiceError: If chat generation fails
        """
        try:
            # Check if brain is initialized
            if not self.initialized:
                logger.warning("Brain not initialized, initializing now...")
                await self.initialize()
            
            # Extract the last user message for emotional analysis
            user_messages = [msg["content"] for msg in messages if msg.get("role") == "user"]
            last_user_message = user_messages[-1] if user_messages else ""
            
            # Process emotional context of input
            emotional_analysis = self.emotional_processor.analyze_text(last_user_message)
            
            # Get emotional context from memory
            current_state = await self.emotional_memory.get_current_emotional_state()
            relationship = await self.emotional_memory.get_relationship_context()
            emotional_patterns = await self.emotional_memory.get_emotional_patterns(limit=2)
            
            # Get similar emotional memories if available
            similar_memories = await self.emotional_memory.get_similar_memories(
                query=last_user_message,
                limit=2
            )
            
            # Create context-aware prompt with emotional intelligence
            context = {
                "emotional_state": current_state,
                "relationship": relationship,
                "emotional_patterns": emotional_patterns,
                "similar_memories": similar_memories,
                "conversation_history": messages
            }
            
            # Add context to kwargs if not already present
            if "context" not in kwargs:
                kwargs["context"] = context
            else:
                kwargs["context"].update(context)
            
            # Generate response from the LLM client with emotional context
            response = await self.llm_client.generate_chat_response(messages, **kwargs)
            
            # Process the response through the emotional processor
            emotional_response = self.emotional_processor.analyze_text(response.content)
            enhanced_content = self.emotional_processor.enhance_response(response.content)
            
            # Validate through ethical framework
            if not self.ethical_framework.evaluate_decision(enhanced_content):
                logger.warning("Response modified due to ethical constraints")
                enhanced_content = self.ethical_framework.modify_response(enhanced_content)
            
            # Store the interaction with emotional data
            await self.emotional_memory.store_interaction(
                interaction_type="chat",
                emotional_data=emotional_analysis,
                context={"messages": messages},
                response=enhanced_content,
                trigger=last_user_message[:50] if last_user_message else None,
                confidence=emotional_analysis.get("confidence", 1.0)
            )
            
            # Update relationship metrics based on interaction
            valence = emotional_response.get("valence", 0.0)
            trust_delta = valence * 0.05  # Small adjustment based on emotional valence
            rapport_delta = valence * 0.03
            await self.emotional_memory.update_relationship(trust_delta=trust_delta, rapport_delta=rapport_delta)
            
            # Update response content with enhanced version
            response.content = enhanced_content
            response.metadata["emotional_context"] = {
                "primary_emotion": emotional_response.get("primary_emotion", "neutral"),
                "valence": emotional_response.get("valence", 0.0),
                "arousal": emotional_response.get("arousal", 0.0)
            }
            
            return response
            
        except Exception as e:
            error_msg = f"Chat response generation failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
                user_messages = [msg["content"] for msg in prompt if msg.get("role") == "user"]
                last_user_message = user_messages[-1] if user_messages else ""
                emotional_analysis = self.emotional_processor.analyze_text(last_user_message)
                user_input = last_user_message
            
{{ ... }}
            # Get emotional context from memory
            current_state = await self.emotional_memory.get_current_emotional_state()
            relationship = await self.emotional_memory.get_relationship_context()
            
            # Create context-aware prompt with emotional intelligence
            context = {
                "emotional_state": current_state,
                "relationship": relationship,
                "user_query": user_input
            }
            
            # Add context to kwargs if not already present
            if "context" not in kwargs:
                kwargs["context"] = context
            else:
                kwargs["context"].update(context)
            
            # Collect the full response for post-processing
            full_response = ""
            
            # Stream response from LLM
            async for chunk in self.llm_client.generate_stream(prompt, **kwargs):
                full_response += chunk
                yield chunk
            
            # After streaming completes, process the full response for emotional memory
            emotional_response = self.emotional_processor.analyze_text(full_response)
            
            # Store the interaction with emotional data (don't await to avoid blocking)
            asyncio.create_task(self.emotional_memory.store_interaction(
                interaction_type="stream",
                emotional_data=emotional_analysis,
                context=context,
                response=full_response,
                trigger=user_input[:50] if user_input else None,
                confidence=emotional_analysis.get("confidence", 1.0)
            ))
            
            # Update relationship metrics based on interaction (don't await to avoid blocking)
            valence = emotional_response.get("valence", 0.0)
            trust_delta = valence * 0.05
            rapport_delta = valence * 0.03
            asyncio.create_task(self.emotional_memory.update_relationship(
                trust_delta=trust_delta, 
                rapport_delta=rapport_delta
            ))
            
        except Exception as e:
            error_msg = f"Stream generation failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self.error_tracker.track_error("stream_generation_error", error_msg)
            raise LLMServiceError(error_msg) from e
    
    async def process_command(self, command: str) -> Optional[str]:
        """Process a command and return response"""
        try:
            # Use LLM to interpret command
            interpretation = await self._interpret_command(command)
            
            # Process interpreted command
            response = None
            if interpretation:
                response = await self._execute_command(interpretation)
            
            # Process interaction for learning and adaptation
            interaction_data = {
                "interaction_id": str(uuid.uuid4()),
                "detected_emotion": interpretation.get("emotion", "neutral") if interpretation else "neutral",
                "emotion_intensity": interpretation.get("emotion_intensity", 0.5) if interpretation else 0.5,
                "interaction_context": {
                    "command_type": interpretation.get("type") if interpretation else "unknown",
                    "command_content": command,
                    "response_content": response,
                    "timestamp": datetime.now().isoformat()
                },
                "user_feedback": {
                    "response_time": time.time() - self._last_command_time if hasattr(self, '_last_command_time') else 0,
                    "message_length": len(command),
                    "response_length": len(response) if response else 0
                }
            }
            
            # Update last command time
            self._last_command_time = time.time()
            
            # Process through learning orchestrator
            adaptive_response = await self.learning_orchestrator.process_interaction(interaction_data)
            
            # Adapt response based on learning
            adapted_response = self._adapt_response(response, adaptive_response)
            
            return adapted_response
            
        except Exception as e:
            logger.error(f"Error processing command: {e}")
            return None

    async def _execute_command(self, command: Dict[str, Any]) -> Optional[str]:
        """Execute an interpreted command"""
        if not self.command_processor:
            return None
            
        try:
            response = await self.command_processor.execute(command)
            
            # Emit command execution event
            if self.event_bus:
                await self.event_bus.emit(Event(
                    type=EventType.COMMAND_EXECUTED,
                    data={
                        "command": command,
                        "response": response,
                        "timestamp": datetime.now().isoformat()
                    }
                ))
            
            return response
            
        except Exception as e:
            logger.error(f"Error executing command: {e}")
            return None

    async def _interpret_command(self, command: str) -> Optional[Dict[str, Any]]:
        """Use LLM to interpret command with emotional context"""
        try:
            # Get current adaptation status
            adaptation_status = self.learning_orchestrator.get_adaptation_status()
            
            # Include emotional and learning context in interpretation
            interpretation_context = {
                "user_style": adaptation_status.get("current_style"),
                "personality_traits": adaptation_status.get("personality_traits"),
                "recent_emotions": adaptation_status.get("recent_emotions"),
                "learning_summary": adaptation_status.get("learning_summary")
            }
            
            # TODO: Use LLM to interpret command with context
            # For now, return a basic interpretation
            return {
                "type": "text_command",
                "content": command,
                "emotion": "neutral",
                "emotion_intensity": 0.5
            }
            
        except Exception as e:
            logger.error(f"Error interpreting command: {e}")
            return None

    def _adapt_response(self, response: str, adaptive_response: AdaptiveResponse) -> str:
        """Adapt response based on learning"""
        try:
            # Adapt response based on learning
            adapted_response = response
            
            # Apply adaptations from learning orchestrator
            if adaptive_response:
                adaptations = adaptive_response.get("adaptations")
                if adaptations:
                    for adaptation in adaptations:
                        if adaptation.get("type") == "tone":
                            adapted_response = adaptation.get("content")
            
            return adapted_response
            
        except Exception as e:
            logger.error(f"Error adapting response: {e}")
            return response

    async def _check_proactive_dialogue(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Check if a proactive question should be asked
        
        Args:
            context: Current conversation context
            
        Returns:
            Dictionary containing the proactive question and metadata if appropriate, None otherwise
        """
        if not self.adaptive_processor:
            return None
            
        # Check if enough time has passed since last proactive question
        now = datetime.now()
        time_since_last = (now - self._last_proactive_check).total_seconds()
        if time_since_last < self.config.get('proactive_dialogue', {}).get('min_interval_seconds', 300):
            return None
            
        # Get proactive question from adaptive processor
        question = await self.adaptive_processor.get_proactive_question(context)
        if not question:
            return None
            
        # Update last check time
        self._last_proactive_check = now
        
        # Return question with metadata
        return {
            'text': question,
            'type': 'proactive_question',
            'timestamp': now.isoformat(),
            'context': context
        }
    
    async def process_response(self, text: str, is_proactive_response: bool = False, context: Optional[Dict[str, Any]] = None):
        """Process user's response, particularly to proactive questions
        
        Args:
            text: User's response text
            is_proactive_response: Whether this is a response to a proactive question
            context: Optional context dictionary
        """
        if not text:
            return
            
        if is_proactive_response and self.adaptive_processor:
            # Process response to proactive question
            await self.adaptive_processor.process_question_response(text, context or {})
            
            # Update emotional state
            emotional_context = await self._get_emotional_context(text)
            full_context = {**(context or {}), **emotional_context}
            await self._update_emotional_state(text, "", full_context)
            
    async def process_text(self, text: str, context: Optional[Dict[str, Any]] = None) -> AsyncGenerator[str, None]:
        """Process text input and generate a response
        
        Args:
            text: Input text to process
            context: Optional context dictionary
            
        Yields:
            Generated response text and any proactive questions
        """
        if not text:
            yield {"text": "", "command_error": "No text found"}
            return
            
        # Record user turn for curiosity & empathy engines
        self.curiosity_engine.record_turn("user", text)
        self.empathy_engine.record_turn("user", text)
        # Try to process the text as a command
        if text.startswith('/'): 
            response = await self._process_command(text)
            yield response
            return
            
        # Get emotional context
        emotional_context = await self._get_emotional_context(text)
        
        # Combine with provided context
        full_context = {**(context or {}), **emotional_context}
        
        # Get adaptive response
        response = await self._get_adaptive_response(text, full_context)
        
        # Update emotional state
        await self._update_emotional_state(text, response, full_context)
        
        # First yield the direct response
        yield {
            'text': response,
            'type': 'direct_response',
            'context': full_context
        }
        
        # Record assistant turn for curiosity engine
        self.curiosity_engine.record_turn("assistant", response)
        # Possibly generate empathy-driven reflection
        empathy_prompt = self.empathy_engine.get_empathy_prompt()
        if empathy_prompt:
            if self.event_bus:
                await self.event_bus.emit_proactive_prompt(
                    text=empathy_prompt.text,
                    prompt_type='empathy',
                    rationale=empathy_prompt.rationale
                )
            yield {
                'text': empathy_prompt.text,
                'type': 'empathy_prompt',
                'rationale': empathy_prompt.rationale,
                'timestamp': empathy_prompt.created_at.timestamp()
            }
        # Possibly generate curiosity-driven follow-up
        curiosity_prompt = self.curiosity_engine.get_proactive_prompt()
        if curiosity_prompt:
            if self.event_bus:
                await self.event_bus.emit_proactive_prompt(
                    text=curiosity_prompt.text,
                    prompt_type='curiosity',
                    rationale=curiosity_prompt.rationale
                )
            yield {
                'text': curiosity_prompt.text,
                'type': 'curiosity_prompt',
                'rationale': curiosity_prompt.rationale,
                'timestamp': curiosity_prompt.created_at.timestamp()
            }
        # Check if we should ask a proactive question
        proactive_question = await self._check_proactive_dialogue(full_context)
        if proactive_question:
            # Track that we're in a proactive dialogue
            self.current_user_state['awaiting_proactive_response'] = True
            self.current_user_state['last_proactive_question'] = proactive_question
            
            # Yield the proactive question
            yield proactive_question
        
    async def _get_emotional_context(self, text: str) -> Dict[str, Any]:
        """Get emotional context from text"""
        try:
            # Use emotional processor to get emotional context
            emotional_context = await self.emotional_processor.process(text)
            return emotional_context
            
        except Exception as e:
            logger.error(f"Error getting emotional context: {e}")
            return {}
        
    async def _get_adaptive_response(self, text: str, context: Dict[str, Any]) -> str:
        """Get adaptive response based on context"""
        try:
            # Use adaptive engine to get adaptive response
            response = await self.adaptive_engine.get_adaptive_response(text, context)
            return response
            
        except Exception as e:
            logger.error(f"Error getting adaptive response: {e}")
            return ""
        
    async def _update_emotional_state(self, text: str, response: str, context: Dict[str, Any]) -> None:
        """Update emotional state based on interaction"""
        try:
            # Use emotional processor to update emotional state
            await self.emotional_processor.update_emotional_state(text, response, context)
            
        except Exception as e:
            logger.error(f"Error updating emotional state: {e}")
            
    async def process_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process input and generate appropriate response"""
        if not self.initialized:
            raise RuntimeError("ALEJO Brain not initialized")
        
        try:
            # Update user state
            self.current_user_state = await self.adaptive_engine.analyze_user_state()
            
            # Process emotional context if available
            emotional_context = None
            if 'emotional_data' in input_data:
                emotional_context = await self.emotional_processor.process(
                    input_data['emotional_data']
                )
            
            # Process vision input and scene understanding if available
            vision_context = None
            scene_context = None
            if 'vision_data' in input_data and self.vision_processor:
                # Process raw vision data
                vision_context = await self.vision_processor.process_frame(
                    input_data['vision_data']
                )
                
                # Generate scene understanding
                if self.scene_engine:
                    scene_context = await self.scene_engine.analyze_scene(
                        input_data['vision_data']
                    )
            
            # Determine appropriate interaction style
            self.interaction_style = self.adaptive_engine.get_interaction_style(
                self.current_user_state,
                {
                    'vision_context': vision_context,
                    'scene_context': scene_context,
                    'emotional_context': emotional_context
                }
            )
            
            # Combine all context
            context = {
                'emotional': emotional_context,
                'vision': vision_context,
                'scene': scene_context,
                'user_state': self.current_user_state,
                'interaction_style': self.interaction_style,
                'timestamp': time.time()
            }
            
            # Generate response using LLM
            response = await self._generate_response(input_data, context)
            
            # Adapt response based on user state
            adapted_response = await self.adaptive_engine.adapt_response(
                response['text'] if isinstance(response, dict) else response,
                self.interaction_style
            )
            
            # Update cognitive profile with interaction results
            await self.adaptive_engine.update_cognitive_profile({
                **self.current_user_state,
                'interaction_success': adapted_response.get('success', True)
            })
            
            return adapted_response
            
        except Exception as e:
            logger.error(f"Error processing input: {str(e)}")
            raise Exception(f"Error processing input: {str(e)}") from e

    async def process_multimodal_input(self, text: str, image_data: Union[str, bytes]) -> Dict[str, Any]:
        """Process combined text and image input using the enhanced MultimodalProcessor fusion
        
        Args:
            text: Text query or description
            image_data: Image data as base64 string, bytes, or file path
            
        Returns:
            Dictionary with processing results including response text and metadata
        """
        try:
            # Ensure multimodal components are initialized
            if not self.multimodal_integration:
                await self._setup_multimodal()
                
            # Process the text-image pair
            result = await self.multimodal_integration.process_text_image(text, image_data)
            
            if not result.get("success", False):
                error_msg = result.get("error", "Unknown error")
                logger.error(f"Multimodal processing failed: {error_msg}")
                return {
                    "success": False,
                    "response": f"I'm sorry, I couldn't process the combined input: {error_msg}",
                    "error": error_msg
                }
                
            # Extract the answer or description from the result
            response_text = result.get("result", {}).get("answer", result.get("result", {}).get("description", ""))
            
            # Apply emotional intelligence to the response
            emotional_context = await self._get_emotional_context(text)
            enhanced_response = await self.emotional_processor.enhance_response(
                response_text,
                emotional_context
            )
            
            return {
                "success": True,
                "response": enhanced_response,
                "raw_result": result.get("result", {}),
                "processing_time": result.get("result", {}).get("processing_time", 0)
            }
            
        except Exception as e:
            logger.error(f"Error processing multimodal input: {e}", exc_info=True)
            return {
                "success": False,
                "response": f"I'm sorry, I couldn't process the combined input: {str(e)}",
                "error": str(e)
            }
            
    async def _setup_multimodal(self):
        """Set up multimodal processing components"""
        try:
            # Get models directory from config or use default
            models_dir = self.config.get("models_dir", os.path.join(str(Path.home()), ".alejo", "models"))
            
            # Get multimodal config
            multimodal_config = self.config.get("multimodal", {})
            
            # Create multimodal integration
            self.multimodal_integration = MultimodalIntegration(
                config=multimodal_config,
                event_bus=self.event_bus,
                models_dir=models_dir,
                enable_self_evolution=multimodal_config.get("enable_self_evolution", True),
                enable_lora=multimodal_config.get("enable_lora", True)
            )
            
            # Initialize the integration
            await self.multimodal_integration.initialize()
            logger.info("Multimodal processing components initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize multimodal components: {e}", exc_info=True)
            self.multimodal_integration = None
            
    async def _process_multimodal_result(self, event_data: Dict[str, Any]):
        """Process multimodal result events"""
        try:
            # Extract result data
            query_id = event_data.get("query_id")
            success = event_data.get("success", False)
            result = event_data.get("result", {})
            
            # Log the result
            if success:
                logger.info(f"Multimodal processing succeeded for query {query_id}")
            else:
                logger.warning(f"Multimodal processing failed for query {query_id}: {result.get('error', 'Unknown error')}")
                
            # Emit an event for any listeners
            await self.event_bus.emit("brain.processing_result", {
                "type": "multimodal",
                "query_id": query_id,
                "success": success,
                "result": result
            })
            
        except Exception as e:
            logger.error(f"Error processing multimodal result: {e}", exc_info=True)
            
    async def optimize_component(self, component_name: str, code: str) -> Dict[str, Any]:
        """Use Darwin Gödel Machine to optimize a component
        
        Args:
            component_name: Name of the component to optimize
            code: Current code of the component
            
        Returns:
            Dictionary with optimization results
        """
        try:
            # Ensure multimodal components are initialized
            if not self.multimodal_integration:
                await self._setup_multimodal()
                
            # Use the multimodal integration to optimize the component
            if self.multimodal_integration:
                return await self.multimodal_integration.optimize_component(component_name, code)
            else:
                return {
                    "success": False,
                    "error": "Multimodal components not available"
                }
                
        except Exception as e:
            logger.error(f"Error optimizing component: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
            
    async def hot_swap_model(self, model_id: str, task_type: str = "general") -> Dict[str, Any]:
        """Hot-swap to a different model or LoRA adapter
        
        Args:
            model_id: ID of the model or adapter to swap to
            task_type: Type of task for adapter selection
            
        Returns:
            Dictionary with hot-swap results
        """
        try:
            # Ensure multimodal components are initialized
            if not self.multimodal_integration:
                await self._setup_multimodal()
                
            # Use the multimodal integration to hot-swap the model
            if self.multimodal_integration:
                return await self.multimodal_integration.hot_swap_model(model_id, task_type)
            else:
                return {
                    "success": False,
                    "error": "Multimodal components not available"
                }
                
        except Exception as e:
            logger.error(f"Error hot-swapping model: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
            
    async def shutdown(self):
        """Gracefully shut down the brain and release all resources"""
        logger.info("Shutting down ALEJO Brain...")
        
        # Update final emotional state and relationship metrics before shutdown
        if self.emotional_memory and self.initialized:
            try:
                # Update relationship metrics to persist final state
                await self.emotional_memory.update_relationship()
                logger.info("Final emotional state and relationship metrics saved")
                
                # Store shutdown context
                await self.emotional_memory.store_emotional_context(
                    context_type="system_event",
                    context_data={
                        "event": "shutdown",
                        "timestamp": datetime.now().isoformat(),
                        "emotional_state": await self.emotional_memory.get_current_emotional_state()
                    }
                )
                logger.info("Emotional memory context saved for shutdown event")
            except Exception as e:
                logger.error(f"Error saving final emotional state: {e}", exc_info=True)
        
        # Shut down multimodal components if initialized
        if self.multimodal_integration:
            try:
                await self.multimodal_integration.shutdown()
                logger.info("Multimodal components shut down successfully")
            except Exception as e:
                logger.error(f"Error shutting down multimodal components: {e}", exc_info=True)
        
        # Emit shutdown event before releasing event bus
        if self.event_bus:
            try:
                await self.event_bus.emit("brain.shutdown", {
                    "timestamp": datetime.now().isoformat(),
                    "graceful": True
                })
            except Exception as e:
                logger.error(f"Error emitting shutdown event: {e}", exc_info=True)
        
        # Release core components
        self.llm_client = None
        self.vision_processor = None
        self.scene_engine = None
        self.emotional_processor = None
        self.emotional_memory = None
        self.ethical_framework = None
        self.adaptive_processor = None
        self.multimodal_integration = None
        
        # Event and memory systems
        self.event_bus = None
        
        # State tracking
        self.initialized = False
        self.interaction_style = None
        
        logger.info("ALEJO Brain shutdown complete")

    async def _setup_vision(self):
        """Set up vision processing components"""
        try:
            # Initialize vision processor
            vision_config = self.config.get("vision", {})
            self.vision_processor = VisionProcessor(config=vision_config)
            await self.vision_processor.initialize()
            
            # Initialize scene description engine
            self.scene_engine = SceneDescriptionEngine(
                event_bus=self.event_bus,
                working_memory=self.working_memory,
                config=self.config.get('scene_description', {})
            )
            logger.info("Vision processing components initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize vision components: {str(e)}")
            self.vision_processor = None
            self.scene_engine = None
            raise

    @handle_errors(component='vision_processor', category='validation')
    def process_image(self, image_data: bytes, analysis_type: str = 'basic') -> str:
        """Process an image for understanding.
        
        Args:
            image_data: Raw image data
            analysis_type: Type of analysis to perform ("basic", "detailed", "object_detection")
            
        Returns:
            Natural language description of the image
            
        Raises:
            VisionError: If image processing fails or vision processor not initialized
        """
        try:
            if not image_data:
                raise VisionError("No image data provided")
            
            # Support for different types of analysis
            if analysis_type == 'detailed':
                prompt = "Analyze this image in detail, focusing on objects, people, emotions, and context."
            elif analysis_type == 'object_detection':
                prompt = "Identify and list all objects in this image."
            else:
                prompt = "Describe this image briefly."
            
            description = self.vision_processor.analyze_image(image_data, prompt)
            if not description:
                raise VisionError("Failed to generate image description")
            
            return description
        except Exception as e:
            logger.error(f"Error processing image: {e}", exc_info=True)
            raise VisionError(f"Failed to process image: {str(e)}") from e

    @handle_errors(component='vision_processor', category='validation')
    def detect_objects(self, image_data: Union[bytes, str]) -> List[Dict[str, Any]]:
        """Detect and locate objects in an image.
        
        Args:
            image_data: Image data as bytes or base64 string
            
        Returns:
            List of detected objects with their locations and confidence scores
            
        Raises:
            VisionError: If there is an error processing the image
        """
        if not image_data:
            raise VisionError("No image data provided")
            
        if not isinstance(image_data, (bytes, str)):
            raise VisionError("Invalid image data type")
            
        if not self.vision_processor:
            self.error_tracker.track_error(
                'vision_processor',
                'initialization',
                VisionError("Vision processor not initialized")
            )
            raise VisionError("Vision processor not initialized")
            
        try:
            return self.vision_processor.detect_objects(image_data)
        except Exception as e:
            logger.error(f"Error detecting objects: {e}", exc_info=True)
            raise VisionError(f"Failed to detect objects: {str(e)}") from e
        

            
    @handle_errors(component='vision_processor', category='validation')
    def analyze_scene(self, image_data: Union[bytes, str]) -> Dict[str, Any]:
        """Analyze and understand the scene in an image.
        
        Args:
            image_data: Image data as bytes or base64 string
            
        Returns:
            Dictionary containing scene analysis results
        """
        if not image_data:
            raise VisionError("No image data provided")
        if not isinstance(image_data, (bytes, str)):
            raise VisionError("Invalid image data type")
        if not self.vision_processor:
            self.error_tracker.track_error('vision_processor', 'initialization', VisionError("Vision processor not initialized"))
            raise VisionError("Vision processor not initialized")
            
        return self.vision_processor.understand_scene(image_data)
        
    @handle_errors(component='vision_processor', category='validation')
    def _process_vision_results(self, analysis_type: str, results: Dict[str, Any]) -> str:
        """Process vision analysis results into a natural language response
        
        Args:
            analysis_type: Type of analysis performed (text or objects)
            results: Analysis results
            
        Returns:
            Natural language response
        """
        try:
            if analysis_type == "text" and results.get("text"):
                return f"I found the following text: {results['text']}"
                
            if analysis_type == "objects" and results.get("objects"):
                objects = results["objects"]
                if not objects:
                    return "I don't see any recognizable objects in the image."
                    
                obj_list = ", ".join([f"{obj['label']} ({obj['confidence']:.0%})" 
                                     for obj in objects[:3]])
                return f"I see: {obj_list}"
                
            return "I wasn't able to analyze the image successfully."
            
        except Exception as e:
            logger.error(f"Error processing vision results: {e}", exc_info=True)
            raise VisionError(f"Failed to process vision results: {str(e)}") from e
