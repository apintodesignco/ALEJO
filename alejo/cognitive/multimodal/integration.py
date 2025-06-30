"""
Integration module for connecting the Multimodal Processor to ALEJO Brain
"""

import os
import asyncio
import logging
from typing import Dict, Any, List, Optional, Union
from pathlib import Path
import time
import json

from ...core.event_bus import EventBus
from ...core.brain import ALEJOBrain
from ...database.memory_store import MemoryStore
from ...llm_client.factory import LLMClientFactory
from ...vision.processor import VisionProcessor
from .processor import MultimodalProcessor
from ...utils.error_handling import handle_errors
from ...utils.exceptions import MultimodalError

logger = logging.getLogger("alejo.cognitive.multimodal.integration")

class MultimodalIntegration:
    """
    Integration class for connecting the Multimodal Processor to ALEJO Brain
    
    This class serves as the main interface for the brain to leverage
    multimodal capabilities through a unified API.
    """
    
    def __init__(
        self,
        brain: Optional[ALEJOBrain] = None,
        event_bus: Optional[EventBus] = None,
        memory_store: Optional[MemoryStore] = None,
        vision_processor: Optional[VisionProcessor] = None,
        multimodal_processor: Optional[MultimodalProcessor] = None,
        config_path: Optional[str] = None
    ):
        """
        Initialize the multimodal integration
        
        Args:
            brain: ALEJOBrain instance
            event_bus: EventBus instance for system-wide communication
            memory_store: Memory store for persistent storage
            vision_processor: Vision processor instance
            multimodal_processor: Multimodal processor instance
            config_path: Path to configuration file
        """
        self.brain = brain
        self.event_bus = event_bus or (brain.event_bus if brain else None)
        self.memory_store = memory_store or (brain.memory_store if brain else None)
        
        # Initialize processors
        self.vision_processor = vision_processor
        self.multimodal_processor = multimodal_processor or MultimodalProcessor(
            config_path=config_path,
            event_bus=self.event_bus,
            memory_store=self.memory_store,
            vision_processor=self.vision_processor
        )
        
        # Register event handlers
        if self.event_bus:
            self._register_event_handlers()
            
        logger.info("Multimodal integration initialized")
    
    def _register_event_handlers(self):
        """Register event handlers with the event bus"""
        self.event_bus.subscribe("brain.process_image", self._handle_brain_process_image)
        self.event_bus.subscribe("brain.visual_qa", self._handle_brain_visual_qa)
        self.event_bus.subscribe("brain.analyze_scene", self._handle_brain_analyze_scene)
        self.event_bus.subscribe("brain.caption_image", self._handle_brain_caption_image)
    
    @handle_errors(MultimodalError)
    async def process_image_for_brain(
        self,
        image_path: str,
        query: str,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process an image with a query for the brain
        
        Args:
            image_path: Path to the image file
            query: User query about the image
            user_id: Optional user ID for personalization
            context: Optional additional context
            
        Returns:
            Dictionary with processing results
        """
        start_time = time.time()
        
        try:
            # Determine the type of processing needed
            if self._is_question(query):
                # This is a visual QA
                result = await self.multimodal_processor.visual_qa(
                    image_path=image_path,
                    question=query
                )
                processing_type = "visual_qa"
            elif self._is_description_request(query):
                # This is a captioning request
                style = self._determine_caption_style(query)
                result = await self.multimodal_processor.caption_image(
                    image_path=image_path,
                    style=style
                )
                processing_type = "caption"
            else:
                # General image processing with the query as prompt
                result = await self.multimodal_processor.process_image_with_text(
                    image_path=image_path,
                    prompt=query
                )
                processing_type = "general"
            
            # Add metadata
            result.update({
                "processing_type": processing_type,
                "user_id": user_id,
                "total_processing_time": time.time() - start_time
            })
            
            # If we have a brain instance, update its context
            if self.brain:
                await self._update_brain_context(image_path, query, result, user_id)
            
            return result
        except Exception as e:
            logger.error(f"Failed to process image for brain: {e}")
            return {
                "error": f"Failed to process image: {str(e)}",
                "processing_time": time.time() - start_time
            }
    
    async def _update_brain_context(
        self,
        image_path: str,
        query: str,
        result: Dict[str, Any],
        user_id: Optional[str]
    ):
        """
        Update brain context with multimodal processing results
        
        Args:
            image_path: Path to the image file
            query: User query
            result: Processing result
            user_id: User ID
        """
        try:
            # Create a context entry
            context_entry = {
                "type": "multimodal_interaction",
                "timestamp": time.time(),
                "image_path": image_path,
                "query": query,
                "response": result.get("content") or result.get("answer") or result.get("caption", ""),
                "processing_type": result.get("processing_type", "general")
            }
            
            # Add to brain's short-term memory
            if hasattr(self.brain, "add_to_short_term_memory"):
                await self.brain.add_to_short_term_memory(context_entry)
            
            # Also add to conversation history if available
            if hasattr(self.brain, "conversation_history"):
                await self.brain.add_to_conversation_history(
                    user_id=user_id or "default",
                    message={
                        "role": "user",
                        "content": f"[Image: {os.path.basename(image_path)}] {query}"
                    }
                )
                await self.brain.add_to_conversation_history(
                    user_id=user_id or "default",
                    message={
                        "role": "assistant",
                        "content": context_entry["response"]
                    }
                )
        except Exception as e:
            logger.error(f"Failed to update brain context: {e}")
    
    def _is_question(self, text: str) -> bool:
        """
        Determine if the text is a question
        
        Args:
            text: Text to analyze
            
        Returns:
            True if the text is a question, False otherwise
        """
        # Simple heuristic for question detection
        text = text.strip().lower()
        
        # Check for question marks
        if text.endswith("?"):
            return True
        
        # Check for question words
        question_starters = ["what", "who", "where", "when", "why", "how", "can", "could", "would", "is", "are", "do", "does"]
        for starter in question_starters:
            if text.startswith(starter + " "):
                return True
        
        return False
    
    def _is_description_request(self, text: str) -> bool:
        """
        Determine if the text is requesting a description/caption
        
        Args:
            text: Text to analyze
            
        Returns:
            True if the text is requesting a description, False otherwise
        """
        text = text.strip().lower()
        
        # Check for description keywords
        description_keywords = ["describe", "caption", "summarize", "explain", "tell me about", "what's in", "what is in"]
        for keyword in description_keywords:
            if keyword in text:
                return True
        
        return False
    
    def _determine_caption_style(self, text: str) -> str:
        """
        Determine the caption style based on the request
        
        Args:
            text: Text to analyze
            
        Returns:
            Caption style (descriptive, concise, detailed, creative)
        """
        text = text.strip().lower()
        
        if "brief" in text or "short" in text or "concise" in text:
            return "concise"
        elif "detailed" in text or "comprehensive" in text or "thorough" in text:
            return "detailed"
        elif "creative" in text or "imaginative" in text or "artistic" in text:
            return "creative"
        else:
            return "descriptive"
    
    async def _handle_brain_process_image(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.process_image event"""
        image_path = data.get("image_path")
        query = data.get("query")
        user_id = data.get("user_id")
        context = data.get("context")
        
        if not image_path or not query:
            return {"error": "Missing required parameters: image_path and query"}
        
        return await self.process_image_for_brain(
            image_path=image_path,
            query=query,
            user_id=user_id,
            context=context
        )
    
    async def _handle_brain_visual_qa(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.visual_qa event"""
        image_path = data.get("image_path")
        question = data.get("question")
        
        if not image_path or not question:
            return {"error": "Missing required parameters: image_path and question"}
        
        return await self.multimodal_processor.visual_qa(
            image_path=image_path,
            question=question
        )
    
    async def _handle_brain_analyze_scene(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.analyze_scene event"""
        image_path = data.get("image_path")
        analysis_type = data.get("analysis_type", "comprehensive")
        
        if not image_path:
            return {"error": "Missing required parameter: image_path"}
        
        return await self.multimodal_processor.analyze_scene(
            image_path=image_path,
            analysis_type=analysis_type
        )
    
    async def _handle_brain_caption_image(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.caption_image event"""
        image_path = data.get("image_path")
        style = data.get("style", "descriptive")
        
        if not image_path:
            return {"error": "Missing required parameter: image_path"}
        
        return await self.multimodal_processor.caption_image(
            image_path=image_path,
            style=style
        )
