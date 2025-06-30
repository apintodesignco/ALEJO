"""
Multimodal Processor for ALEJO
Integrates vision processing with language understanding for comprehensive multimodal reasoning
"""

import os
import logging
import asyncio
import time
from typing import Dict, Any, List, Optional, Union, Tuple
from pathlib import Path
import base64
from PIL import Image
import numpy as np

from ...core.event_bus import EventBus, Event
from ...llm_client.factory import LLMClientFactory
from ...llm_client.vlm_client import VLMClient, VLMConfig
from ...vision.processor import VisionProcessor
from ...vision.scene_analyzer import SceneContext
from ...database.memory_store import MemoryStore
from ...utils.error_handling import handle_errors, ErrorTracker
from ...utils.exceptions import MultimodalError
from ...config import ConfigManager

logger = logging.getLogger("alejo.cognitive.multimodal.processor")

class MultimodalProcessor:
    """
    Multimodal Processor for integrating vision and language understanding
    
    Features:
    - Unified processing of text and visual inputs
    - Scene understanding with language-based reasoning
    - Visual question answering and image captioning
    - Memory integration for contextual understanding
    - Event-driven architecture for system-wide integration
    """
    
    def __init__(
        self, 
        config_path: Optional[str] = None,
        event_bus: Optional[EventBus] = None,
        memory_store: Optional[MemoryStore] = None,
        vision_processor: Optional[VisionProcessor] = None
    ):
        """
        Initialize the multimodal processor
        
        Args:
            config_path: Path to configuration file
            event_bus: EventBus instance for system-wide communication
            memory_store: Memory store for persistent storage
            vision_processor: Vision processor instance
        """
        self.config_manager = ConfigManager(config_path)
        self.config = self.config_manager.get_config("multimodal", {
            "vlm_model": "llava-v1.6-mistral-7b-q4_k_m",
            "cache_dir": str(Path.home() / ".alejo" / "cache" / "multimodal"),
            "max_image_size": 1024,
            "enable_memory_integration": True,
            "default_reasoning_depth": "medium",  # low, medium, high
            "default_response_length": "medium",  # short, medium, long
            "enable_streaming": True
        })
        
        # Initialize components
        self.event_bus = event_bus
        self.memory_store = memory_store
        self.vision_processor = vision_processor or VisionProcessor(event_bus=event_bus)
        self.error_tracker = ErrorTracker("multimodal_processor")
        
        # Initialize VLM client
        self._initialize_vlm_client()
        
        # Register event handlers if event bus is provided
        if self.event_bus:
            self._register_event_handlers()
        
        # Ensure cache directory exists
        os.makedirs(self.config["cache_dir"], exist_ok=True)
        
        logger.info("Multimodal processor initialized")
    
    def _initialize_vlm_client(self):
        """Initialize the VLM client"""
        try:
            # Create VLM config
            vlm_config = VLMConfig(
                model_name=self.config["vlm_model"],
                model_path=None,  # Use default path
                temperature=0.7,
                max_tokens=1024,
                top_p=0.9,
                streaming=self.config["enable_streaming"]
            )
            
            # Create VLM client
            self.vlm_client = LLMClientFactory.create_client(client_type="vlm", config=vlm_config)
            logger.info(f"VLM client initialized with model: {self.config['vlm_model']}")
        except Exception as e:
            logger.error(f"Failed to initialize VLM client: {e}")
            self.error_tracker.track_error("vlm_init", str(e))
            # Create a placeholder that will attempt to initialize later
            self.vlm_client = None
    
    def _register_event_handlers(self):
        """Register event handlers with the event bus"""
        self.event_bus.subscribe("multimodal.process_image", self._handle_process_image)
        self.event_bus.subscribe("multimodal.analyze_scene", self._handle_analyze_scene)
        self.event_bus.subscribe("multimodal.visual_qa", self._handle_visual_qa)
        self.event_bus.subscribe("multimodal.caption_image", self._handle_caption_image)
    
    @handle_errors(MultimodalError)
    async def process_image_with_text(
        self, 
        image_path: str, 
        prompt: str,
        reasoning_depth: Optional[str] = None,
        response_length: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process an image with accompanying text prompt
        
        Args:
            image_path: Path to the image file
            prompt: Text prompt to guide the processing
            reasoning_depth: Depth of reasoning (low, medium, high)
            response_length: Length of response (short, medium, long)
            
        Returns:
            Dictionary with processing results
        """
        start_time = time.time()
        
        # Ensure VLM client is initialized
        if not self.vlm_client:
            try:
                self._initialize_vlm_client()
                if not self.vlm_client:
                    return {"error": "VLM client initialization failed"}
            except Exception as e:
                logger.error(f"Failed to initialize VLM client: {e}")
                return {"error": f"VLM client initialization failed: {str(e)}"}
        
        # Apply reasoning and response length modifiers to prompt
        enhanced_prompt = self._enhance_prompt(
            prompt, 
            reasoning_depth or self.config["default_reasoning_depth"],
            response_length or self.config["default_response_length"]
        )
        
        try:
            # Process image with VLM
            response = await self.vlm_client.process_image_and_text(
                image_path=image_path,
                prompt=enhanced_prompt
            )
            
            # Calculate processing time
            elapsed_time = time.time() - start_time
            
            # Create result
            result = {
                "content": response.content,
                "model": response.model,
                "processing_time": elapsed_time,
                "image_path": image_path,
                "prompt": prompt,
                "enhanced_prompt": enhanced_prompt
            }
            
            # Store in memory if enabled
            if self.config["enable_memory_integration"] and self.memory_store:
                await self._store_in_memory(image_path, prompt, response.content)
            
            return result
        except Exception as e:
            logger.error(f"Failed to process image with text: {e}")
            self.error_tracker.track_error("process_image", str(e))
            return {"error": f"Failed to process image with text: {str(e)}"}
    
    @handle_errors(MultimodalError)
    async def analyze_scene(self, image_path: str, analysis_type: str = "comprehensive") -> Dict[str, Any]:
        """
        Analyze a scene using both vision processor and VLM
        
        Args:
            image_path: Path to the image file
            analysis_type: Type of analysis (basic, comprehensive, detailed)
            
        Returns:
            Dictionary with scene analysis results
        """
        start_time = time.time()
        
        try:
            # First use vision processor for object detection and scene context
            scene_context = await self.vision_processor.analyze_scene(image_path)
            
            # Construct prompt based on scene context
            objects_text = ", ".join([obj.label for obj in scene_context.objects])
            prompt = f"Analyze this image in {analysis_type} detail. I can see these objects: {objects_text}. "
            prompt += "Describe the scene, relationships between objects, and any notable elements."
            
            # Process with VLM for deeper understanding
            vlm_response = await self.process_image_with_text(
                image_path=image_path,
                prompt=prompt,
                reasoning_depth="high"
            )
            
            # Combine results
            result = {
                "scene_context": {
                    "objects": [obj.__dict__ for obj in scene_context.objects],
                    "environment": scene_context.environment.__dict__ if scene_context.environment else {},
                    "scene_type": scene_context.scene_type,
                    "confidence": scene_context.confidence
                },
                "vlm_analysis": vlm_response.get("content", ""),
                "processing_time": time.time() - start_time,
                "image_path": image_path
            }
            
            return result
        except Exception as e:
            logger.error(f"Failed to analyze scene: {e}")
            self.error_tracker.track_error("analyze_scene", str(e))
            return {"error": f"Failed to analyze scene: {str(e)}"}
    
    @handle_errors(MultimodalError)
    async def visual_qa(self, image_path: str, question: str) -> Dict[str, Any]:
        """
        Answer questions about an image
        
        Args:
            image_path: Path to the image file
            question: Question about the image
            
        Returns:
            Dictionary with answer and confidence
        """
        # Construct a VQA-specific prompt
        prompt = f"Question about this image: {question}\nPlease answer the question accurately based only on what you can see in the image."
        
        # Process with VLM
        response = await self.process_image_with_text(
            image_path=image_path,
            prompt=prompt,
            reasoning_depth="medium"
        )
        
        # Return result
        return {
            "question": question,
            "answer": response.get("content", ""),
            "image_path": image_path,
            "processing_time": response.get("processing_time", 0)
        }
    
    @handle_errors(MultimodalError)
    async def caption_image(self, image_path: str, style: str = "descriptive") -> Dict[str, Any]:
        """
        Generate a caption for an image
        
        Args:
            image_path: Path to the image file
            style: Caption style (descriptive, concise, detailed, creative)
            
        Returns:
            Dictionary with caption and metadata
        """
        # Construct a captioning prompt based on style
        style_prompts = {
            "descriptive": "Describe this image in detail.",
            "concise": "Provide a brief, concise caption for this image.",
            "detailed": "Describe this image with extensive details about all elements visible.",
            "creative": "Create an imaginative, creative caption for this image."
        }
        
        prompt = style_prompts.get(style, style_prompts["descriptive"])
        
        # Process with VLM
        response = await self.process_image_with_text(
            image_path=image_path,
            prompt=prompt,
            reasoning_depth="low",
            response_length="medium" if style == "concise" else "long"
        )
        
        # Return result
        return {
            "caption": response.get("content", ""),
            "style": style,
            "image_path": image_path,
            "processing_time": response.get("processing_time", 0)
        }
    
    def _enhance_prompt(self, prompt: str, reasoning_depth: str, response_length: str) -> str:
        """
        Enhance the prompt with reasoning depth and response length guidance
        
        Args:
            prompt: Original prompt
            reasoning_depth: Depth of reasoning (low, medium, high)
            response_length: Length of response (short, medium, long)
            
        Returns:
            Enhanced prompt
        """
        # Reasoning depth modifiers
        depth_modifiers = {
            "low": "Provide a straightforward analysis. ",
            "medium": "Analyze with moderate depth, considering key aspects. ",
            "high": "Perform a deep, thorough analysis with careful reasoning about all aspects. "
        }
        
        # Response length modifiers
        length_modifiers = {
            "short": "Be concise and to the point. ",
            "medium": "Provide a balanced response with adequate detail. ",
            "long": "Provide a comprehensive response with extensive details. "
        }
        
        # Add modifiers to prompt
        enhanced_prompt = prompt
        if reasoning_depth in depth_modifiers:
            enhanced_prompt = depth_modifiers[reasoning_depth] + enhanced_prompt
        if response_length in length_modifiers:
            enhanced_prompt += " " + length_modifiers[response_length]
            
        return enhanced_prompt
    
    async def _store_in_memory(self, image_path: str, prompt: str, response: str) -> bool:
        """
        Store multimodal interaction in memory
        
        Args:
            image_path: Path to the image file
            prompt: Original prompt
            response: Generated response
            
        Returns:
            Success status
        """
        if not self.memory_store:
            return False
            
        try:
            # Create memory entry
            memory_data = {
                "content": f"Image: {os.path.basename(image_path)}\nPrompt: {prompt}\nResponse: {response}",
                "memory_type": "multimodal",
                "source": "multimodal_processor",
                "metadata": {
                    "image_path": image_path,
                    "prompt": prompt,
                    "timestamp": time.time()
                }
            }
            
            # Store in memory
            await self.memory_store.store_memory(memory_data)
            return True
        except Exception as e:
            logger.error(f"Failed to store in memory: {e}")
            return False
    
    async def _handle_process_image(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle process_image event"""
        image_path = data.get("image_path")
        prompt = data.get("prompt")
        reasoning_depth = data.get("reasoning_depth")
        response_length = data.get("response_length")
        
        if not image_path or not prompt:
            return {"error": "Missing required parameters: image_path and prompt"}
            
        return await self.process_image_with_text(
            image_path=image_path,
            prompt=prompt,
            reasoning_depth=reasoning_depth,
            response_length=response_length
        )
    
    async def _handle_analyze_scene(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle analyze_scene event"""
        image_path = data.get("image_path")
        analysis_type = data.get("analysis_type", "comprehensive")
        
        if not image_path:
            return {"error": "Missing required parameter: image_path"}
            
        return await self.analyze_scene(
            image_path=image_path,
            analysis_type=analysis_type
        )
    
    async def _handle_visual_qa(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle visual_qa event"""
        image_path = data.get("image_path")
        question = data.get("question")
        
        if not image_path or not question:
            return {"error": "Missing required parameters: image_path and question"}
            
        return await self.visual_qa(
            image_path=image_path,
            question=question
        )
    
    async def _handle_caption_image(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle caption_image event"""
        image_path = data.get("image_path")
        style = data.get("style", "descriptive")
        
        if not image_path:
            return {"error": "Missing required parameter: image_path"}
            
        return await self.caption_image(
            image_path=image_path,
            style=style
        )
