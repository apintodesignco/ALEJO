"""
Multimodal Integration Module for ALEJO

This module provides integration between the MultimodalProcessor and the ALEJO brain,
enabling seamless access to multimodal capabilities through an event-driven architecture.
"""

import os
import logging
import asyncio
from typing import Dict, List, Any, Optional, Union, Tuple
from pathlib import Path
import time

from ..utils.events import EventBus
from ..utils.exceptions import MultimodalError, IntegrationError
from ..utils.error_handling import handle_errors

from .multimodal_processor import MultimodalProcessor, ProcessingResult, ModalityType

logger = logging.getLogger(__name__)

class MultimodalIntegration:
    """
    Integration layer between ALEJO brain and multimodal processing capabilities.
    
    This class provides:
    1. A clean interface for the brain to access multimodal capabilities
    2. Event-based communication with the MultimodalProcessor
    3. Memory integration for contextual awareness
    4. Task classification and routing
    """
    
    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        event_bus: Optional[EventBus] = None,
        models_dir: Optional[str] = None,
        enable_self_evolution: bool = True,
        enable_lora: bool = True
    ):
        """
        Initialize the multimodal integration
        
        Args:
            config: Configuration dictionary
            event_bus: EventBus for event-driven communication
            models_dir: Directory for model storage
            enable_self_evolution: Whether to enable Darwin Gödel Machine
            enable_lora: Whether to enable LoRA hot-swapping
        """
        self.config = config or {}
        self.event_bus = event_bus or EventBus()
        
        # Create the multimodal processor
        self.processor = MultimodalProcessor(
            config=config,
            event_bus=self.event_bus,
            models_dir=models_dir,
            enable_self_evolution=enable_self_evolution,
            enable_lora=enable_lora
        )
        
        # Initialize state
        self.initialized = False
        self.last_query = None
        self.last_result = None
        self.processing_history = []
        
        # Register event handlers
        self._register_event_handlers()
        
        logger.info("MultimodalIntegration initialized")
        
    def _register_event_handlers(self):
        """Register event handlers"""
        self.event_bus.on("brain.multimodal_query", self._on_multimodal_query)
        self.event_bus.on("multimodal.process_result", self._on_process_result)
        self.event_bus.on("multimodal.process_error", self._on_process_error)
        
    async def initialize(self):
        """Initialize the multimodal integration and processor"""
        if self.initialized:
            return
            
        try:
            # Initialize the processor
            await self.processor.initialize()
            self.initialized = True
            logger.info("MultimodalIntegration initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize multimodal integration: {e}")
            
    async def shutdown(self):
        """Clean up resources and shut down"""
        try:
            # Shut down the processor
            await self.processor.shutdown()
            logger.info("MultimodalIntegration shut down successfully")
            
        except Exception as e:
            logger.error(f"Error during MultimodalIntegration shutdown: {e}")
            
    async def _on_multimodal_query(self, data: Dict[str, Any]):
        """Handle multimodal query events from the brain"""
        try:
            # Extract query data
            query_id = data.get("query_id", str(time.time()))
            text = data.get("text", "")
            image_data = data.get("image_data")
            task_type = data.get("task_type", self._classify_task(text))
            
            # Store the query
            self.last_query = {
                "query_id": query_id,
                "text": text,
                "has_image": image_data is not None,
                "task_type": task_type,
                "timestamp": time.time()
            }
            
            # Forward the query to the processor
            await self.event_bus.emit("multimodal.process_request", {
                "request_id": query_id,
                "text": text,
                "image_data": image_data,
                "task_type": task_type
            })
            
        except Exception as e:
            logger.error(f"Error handling multimodal query: {e}")
            await self.event_bus.emit("brain.multimodal_result", {
                "query_id": data.get("query_id", "unknown"),
                "success": False,
                "error": str(e)
            })
            
    async def _on_process_result(self, data: Dict[str, Any]):
        """Handle processing result events from the processor"""
        try:
            # Extract result data
            request_id = data.get("request_id")
            result = data.get("result", {})
            
            # Store the result
            self.last_result = result
            
            # Add to processing history (keep last 10)
            self.processing_history.append({
                "query": self.last_query,
                "result": result,
                "timestamp": time.time()
            })
            if len(self.processing_history) > 10:
                self.processing_history.pop(0)
                
            # Forward the result to the brain
            await self.event_bus.emit("brain.multimodal_result", {
                "query_id": request_id,
                "success": result.get("success", False),
                "result": result
            })
            
        except Exception as e:
            logger.error(f"Error handling process result: {e}")
            
    async def _on_process_error(self, data: Dict[str, Any]):
        """Handle processing error events from the processor"""
        try:
            # Extract error data
            request_id = data.get("request_id")
            error = data.get("error", "Unknown error")
            
            # Forward the error to the brain
            await self.event_bus.emit("brain.multimodal_result", {
                "query_id": request_id,
                "success": False,
                "error": error
            })
            
        except Exception as e:
            logger.error(f"Error handling process error: {e}")
            
    def _classify_task(self, text: str) -> str:
        """Classify the task type based on the query text"""
        text = text.lower()
        
        # Visual Question Answering
        if any(q in text for q in ["what is", "what's", "what are", "who is", "where is", "when", "how many"]):
            return "vqa"
            
        # Image captioning
        elif any(word in text for word in ["describe", "caption", "summarize", "explain", "tell me about"]):
            return "caption"
            
        # Object detection
        elif any(word in text for word in ["find", "detect", "locate", "identify", "objects", "people"]):
            return "objects"
            
        # Scene analysis
        elif any(word in text for word in ["scene", "setting", "environment", "location", "place"]):
            return "scene"
            
        # Similarity analysis
        elif any(word in text for word in ["similar", "similarity", "compare", "match", "related"]):
            return "similarity"
            
        # Default to general analysis
        return "general"
        
    async def process_text_image(self, text: str, image_data: Union[str, bytes], task_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Process a text-image pair
        
        Args:
            text: Text query or description
            image_data: Image data as base64 string, bytes, or file path
            task_type: Type of analysis task (general, vqa, caption, etc.)
            
        Returns:
            Dictionary with processing results
        """
        if not self.initialized:
            await self.initialize()
            
        # Classify task if not provided
        if task_type is None:
            task_type = self._classify_task(text)
            
        # Generate a query ID
        query_id = f"query_{time.time()}"
        
        # Create a future to wait for the result
        result_future = asyncio.Future()
        
        # Define result handler
        async def handle_result(data):
            if data.get("query_id") == query_id:
                result_future.set_result(data)
                # Remove the handler after receiving the result
                self.event_bus.off("brain.multimodal_result", handle_result)
                
        # Register temporary handler
        self.event_bus.on("brain.multimodal_result", handle_result)
        
        # Send the query
        await self.event_bus.emit("brain.multimodal_query", {
            "query_id": query_id,
            "text": text,
            "image_data": image_data,
            "task_type": task_type
        })
        
        try:
            # Wait for the result with timeout
            result = await asyncio.wait_for(result_future, timeout=30.0)
            return result
            
        except asyncio.TimeoutError:
            logger.error(f"Timeout waiting for multimodal processing result")
            return {
                "success": False,
                "error": "Timeout waiting for processing result"
            }
        finally:
            # Ensure handler is removed in case of exception
            self.event_bus.off("brain.multimodal_result", handle_result)
            
    async def analyze_image(self, image_data: Union[str, bytes], task_type: str = "caption") -> Dict[str, Any]:
        """
        Analyze an image without text query
        
        Args:
            image_data: Image data as base64 string, bytes, or file path
            task_type: Type of analysis task (caption, objects, scene, etc.)
            
        Returns:
            Dictionary with analysis results
        """
        if not self.initialized:
            await self.initialize()
            
        # Use empty text for image-only analysis
        return await self.process_text_image("", image_data, task_type)
        
    async def hot_swap_model(self, model_id: str, task_type: str = "general") -> Dict[str, Any]:
        """
        Hot-swap to a different model or LoRA adapter
        
        Args:
            model_id: ID of the model or adapter to swap to
            task_type: Type of task for adapter selection
            
        Returns:
            Dictionary with hot-swap results
        """
        if not self.initialized:
            await self.initialize()
            
        return await self.processor.hot_swap_model(model_id, task_type)
        
    async def optimize_component(self, component_name: str, code: str) -> Dict[str, Any]:
        """
        Use Darwin Gödel Machine to optimize a component
        
        Args:
            component_name: Name of the component to optimize
            code: Current code of the component
            
        Returns:
            Dictionary with optimization results
        """
        if not self.initialized:
            await self.initialize()
            
        result = await self.processor.optimize_with_darwin_godel(component_name, code)
        if result:
            return result
        else:
            return {
                "success": False,
                "error": "Optimization not available or failed"
            }
