"""ALEJO Brain Streaming Module
Provides streaming response capabilities with emotional intelligence integration
"""
import asyncio
import logging
from typing import Dict, Any, Optional, List, AsyncGenerator, Union
import time

from ..utils.error_handling import handle_errors
from ..utils.exceptions import LLMServiceError

logger = logging.getLogger(__name__)

class BrainStreamingMixin:
    """Mixin class for ALEJOBrain to handle streaming responses with emotional intelligence."""
    
    @handle_errors(LLMServiceError)
    async def generate_stream(
        self,
        prompt: Union[str, List[Dict[str, str]]],
        user_id: Optional[str] = None,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate a streaming text response using the LLM with emotional intelligence integration.
        
        Args:
            prompt: Text prompt or list of chat messages
            user_id: Optional user ID for personalization
            **kwargs: Additional parameters for the LLM
            
        Yields:
            Dictionary containing chunk of generated text and emotional metadata
            
        Raises:
            LLMServiceError: If text generation fails
        """
        try:
            # Check if brain is initialized
            if not self.initialized:
                logger.warning("Brain not initialized, initializing now...")
                await self.initialize()
            
            # Process emotional context based on prompt type
            if isinstance(prompt, str):
                # Text prompt
                emotional_analysis = self.emotional_processor.analyze_text(prompt)
                user_input = prompt
            else:
                # Chat messages
                user_messages = [msg["content"] for msg in prompt if msg.get("role") == "user"]
                last_user_message = user_messages[-1] if user_messages else ""
                emotional_analysis = self.emotional_processor.analyze_text(last_user_message)
                user_input = last_user_message
            
            # Get emotional context from memory asynchronously
            current_state_task = asyncio.create_task(
                self.emotional_memory.get_current_emotional_state(user_id=user_id)
            )
            relationship_task = asyncio.create_task(
                self.emotional_memory.get_relationship_context(user_id=user_id)
            )
            
            # Wait for emotional context to be ready
            current_state = await current_state_task
            relationship = await relationship_task
            
            # Create context-aware prompt with emotional intelligence
            context = {
                "emotional_state": current_state,
                "relationship": relationship,
                "user_query": user_input,
                "emotional_analysis": emotional_analysis
            }
            
            # Generate base streaming response
            if isinstance(prompt, str):
                stream = self.llm_client.generate_stream(prompt, **kwargs)
            else:
                stream = self.llm_client.generate_chat_stream(prompt, **kwargs)
            
            # Process each chunk with emotional context
            accumulated_response = ""
            async for chunk in stream:
                # Accumulate response for context
                accumulated_response += chunk
                
                # Enhance chunk with emotional context (non-blocking)
                enhanced_chunk = self.emotional_processor.enhance_text(
                    text=chunk,
                    context={
                        "input_emotion": emotional_analysis,
                        "emotional_context": current_state,
                        "relationship": relationship,
                        "accumulated_response": accumulated_response
                    }
                )
                
                # Yield enhanced chunk with metadata
                yield {
                    "text": enhanced_chunk,
                    "emotional_metadata": {
                        "input_valence": emotional_analysis.get("valence", 0),
                        "input_arousal": emotional_analysis.get("arousal", 0),
                        "input_primary_emotion": emotional_analysis.get("primary_emotion", "neutral"),
                        "relationship_rapport": relationship.get("rapport", 0),
                        "relationship_trust": relationship.get("trust", 0)
                    }
                }
            
            # After streaming completes, store interaction and update relationship asynchronously
            asyncio.create_task(
                self.emotional_memory.store_interaction(
                    user_id=user_id,
                    interaction_type="streaming_response",
                    content=accumulated_response,
                    emotional_data=emotional_analysis,
                    context=context
                )
            )
            
            # Update relationship metrics based on emotional valence
            asyncio.create_task(
                self.emotional_memory.update_relationship(
                    user_id=user_id,
                    metrics={
                        "rapport": 0.05 if emotional_analysis.get("valence", 0) > 0.5 else -0.02,
                        "trust": 0.03 if emotional_analysis.get("valence", 0) > 0.6 else 0
                    }
                )
            )
                
        except Exception as e:
            logger.error(f"Error generating streaming response: {e}")
            raise LLMServiceError(f"Failed to generate streaming response: {e}") from e
    
    @handle_errors(LLMServiceError)
    async def process_streaming_response_with_emotion(
        self,
        input_text: str,
        response_stream: AsyncGenerator[str, None],
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Process a streaming response with emotional context
        
        Args:
            input_text: Original input text
            response_stream: Stream of response chunks
            user_id: Optional user ID for personalization
            context: Optional context dictionary
            
        Yields:
            Dictionary containing enhanced response chunk and emotional metadata
        """
        # Process emotional context of input
        emotional_analysis = self.emotional_processor.analyze_text(input_text)
        
        # Get emotional context from memory
        current_state = await self.emotional_memory.get_current_emotional_state(user_id=user_id)
        relationship = await self.emotional_memory.get_relationship_context(user_id=user_id)
        
        # Create context dictionary if not provided
        if context is None:
            context = {}
        
        # Add emotional context
        context.update({
            "emotional_state": current_state,
            "relationship": relationship,
            "input_emotion": emotional_analysis
        })
        
        # Process each chunk with emotional context
        accumulated_response = ""
        async for chunk in response_stream:
            # Accumulate response for context
            accumulated_response += chunk
            
            # Enhance chunk with emotional context
            enhanced_chunk = self.emotional_processor.enhance_text(
                text=chunk,
                context={
                    "input_emotion": emotional_analysis,
                    "emotional_context": current_state,
                    "relationship": relationship,
                    "accumulated_response": accumulated_response
                }
            )
            
            # Yield enhanced chunk with metadata
            yield {
                "text": enhanced_chunk,
                "emotional_metadata": {
                    "input_valence": emotional_analysis.get("valence", 0),
                    "input_arousal": emotional_analysis.get("arousal", 0),
                    "input_primary_emotion": emotional_analysis.get("primary_emotion", "neutral"),
                    "relationship_rapport": relationship.get("rapport", 0),
                    "relationship_trust": relationship.get("trust", 0)
                }
            }
        
        # After streaming completes, store interaction and update relationship
        await self.emotional_memory.store_interaction(
            user_id=user_id,
            interaction_type="streaming_response",
            content=accumulated_response,
            emotional_data=emotional_analysis,
            context=context
        )
        
        # Update relationship metrics based on emotional valence
        await self.emotional_memory.update_relationship(
            user_id=user_id,
            metrics={
                "rapport": 0.05 if emotional_analysis.get("valence", 0) > 0.5 else -0.02,
                "trust": 0.03 if emotional_analysis.get("valence", 0) > 0.6 else 0
            }
        )
