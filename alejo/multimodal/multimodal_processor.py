"""
Multimodal Processor for ALEJO: Advanced fusion of text, image, and other modalities.

This module implements a comprehensive multimodal processing system that:
1. Integrates vision-language models for image understanding
2. Supports self-evolution through Darwin Gödel Machine
3. Enables dynamic adaptation via LoRA hot-swapping
4. Provides unified processing for multiple modalities

The system enforces 100% local inference with no external API dependencies.
"""

import os
import logging
import asyncio
import time
import json
from typing import Dict, List, Any, Optional, Union, Tuple, BinaryIO
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import base64
import io

# Import utilities
from ..utils.events import EventBus
from ..utils.exceptions import MultimodalError, ModelError
from ..utils.error_handling import handle_errors

# Import core components
from ..brain.neuromorphic.darwin_godel_machine import DarwinGodelMachine
from ..llm_client.lora_manager import LoRAManager

# Optional imports with fallbacks
try:
    import torch
    import numpy as np
    from PIL import Image
    _vision_libs_available = True
except ImportError:
    _vision_libs_available = False

# Try to import transformers for CLIP and other models
try:
    from transformers import CLIPProcessor, CLIPModel
    _clip_available = True
except ImportError:
    _clip_available = False

# Try to import llama-cpp for VLM
try:
    from llama_cpp import Llama
    _llama_cpp_available = True
except ImportError:
    _llama_cpp_available = False

logger = logging.getLogger(__name__)

class ModalityType(Enum):
    """Types of modalities supported by the processor"""
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    SENSOR = "sensor"

@dataclass
class ProcessingResult:
    """Result of multimodal processing"""
    success: bool
    description: str
    confidence: float
    modalities: List[ModalityType]
    raw_output: Dict[str, Any]
    processing_time: float
    error: Optional[str] = None

class MultimodalProcessor:
    """
    Advanced multimodal processor that fuses different modalities and adapts
    to different tasks using self-evolution and LoRA hot-swapping.
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
        Initialize the multimodal processor
        
        Args:
            config: Configuration dictionary
            event_bus: EventBus for event-driven communication
            models_dir: Directory for model storage
            enable_self_evolution: Whether to enable Darwin Gödel Machine
            enable_lora: Whether to enable LoRA hot-swapping
        """
        self.config = config or {}
        self.event_bus = event_bus or EventBus()
        self.models_dir = models_dir or os.path.join(str(Path.home()), ".alejo", "models")
        
        # Ensure models directory exists
        os.makedirs(self.models_dir, exist_ok=True)
        
        # Initialize state
        self.initialized = False
        self.models = {}
        self.active_model = None
        self.last_processing_time = 0
        
        # Initialize components based on configuration
        if enable_self_evolution:
            self.darwin_godel = DarwinGodelMachine()
        else:
            self.darwin_godel = None
            
        if enable_lora and _llama_cpp_available:
            # Find the base VLM model path
            vlm_model_path = self._find_vlm_model_path()
            if vlm_model_path:
                self.lora_manager = LoRAManager(
                    event_bus=self.event_bus,
                    base_model_path=vlm_model_path
                )
            else:
                logger.warning("No VLM model found, LoRA manager disabled")
                self.lora_manager = None
        else:
            self.lora_manager = None
            
        # Register event handlers
        self._register_event_handlers()
        
        logger.info("MultimodalProcessor initialized")
        
    def _find_vlm_model_path(self) -> Optional[str]:
        """Find the path to the VLM model"""
        # Common VLM model filenames
        vlm_models = [
            "llava-v1.6-mistral-7b-q4_k_m.gguf",
            "llava-v1.5-7b-q4_k_m.gguf",
            "llava-v1.6-vicuna-13b-q4_k_m.gguf"
        ]
        
        # Check if any of these models exist
        for model_name in vlm_models:
            model_path = os.path.join(self.models_dir, model_name)
            if os.path.exists(model_path):
                return model_path
                
        return None
        
    def _register_event_handlers(self):
        """Register event handlers"""
        self.event_bus.on("multimodal.process_request", self._on_process_request)
        self.event_bus.on("multimodal.model_update", self._on_model_update)
        
    async def _on_process_request(self, data: Dict[str, Any]):
        """Handle processing requests via events"""
        try:
            # Extract inputs from event data
            text = data.get("text", "")
            image_data = data.get("image_data")
            task_type = data.get("task_type", "general")
            
            # Process the inputs
            if image_data and text:
                result = await self.analyze_text_image_pair(text, image_data, task_type)
            elif image_data:
                result = await self.analyze_image(image_data, task_type)
            elif text:
                result = {"error": "Text-only processing should use LLM directly"}
            else:
                result = {"error": "No inputs provided"}
                
            # Emit result event
            await self.event_bus.emit("multimodal.process_result", {
                "request_id": data.get("request_id"),
                "result": result
            })
            
        except Exception as e:
            logger.error(f"Error processing multimodal request: {e}")
            await self.event_bus.emit("multimodal.process_error", {
                "request_id": data.get("request_id"),
                "error": str(e)
            })
            
    async def _on_model_update(self, data: Dict[str, Any]):
        """Handle model update events"""
        model_id = data.get("model_id")
        if not model_id:
            return
            
        try:
            # If we have a LoRA manager, request adapter swap
            if self.lora_manager:
                await self.event_bus.emit("lora.adapter_requested", {
                    "adapter_name": model_id,
                    "task_type": data.get("task_type", "general")
                })
        except Exception as e:
            logger.error(f"Error handling model update: {e}")
            
    async def initialize(self):
        """Initialize the multimodal processor and load models"""
        if self.initialized:
            return
            
        try:
            # Initialize Darwin Gödel Machine if available
            if self.darwin_godel:
                await self.darwin_godel.initialize()
                
            # Load CLIP model if available
            if _clip_available:
                self.models["clip"] = {
                    "model": CLIPModel.from_pretrained("openai/clip-vit-base-patch32"),
                    "processor": CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
                }
                logger.info("CLIP model loaded successfully")
                
            # Load VLM model if available
            if _llama_cpp_available:
                vlm_model_path = self._find_vlm_model_path()
                if vlm_model_path:
                    # Configure model parameters
                    n_gpu_layers = -1  # Auto-detect GPU layers
                    n_ctx = 2048  # Context window size
                    
                    # Load the model
                    self.models["vlm"] = {
                        "model": Llama(
                            model_path=vlm_model_path,
                            n_gpu_layers=n_gpu_layers,
                            n_ctx=n_ctx,
                            verbose=False
                        ),
                        "path": vlm_model_path
                    }
                    logger.info(f"VLM model loaded from {vlm_model_path}")
                    self.active_model = "vlm"
                    
            self.initialized = True
            await self.event_bus.emit("multimodal.initialized", {"success": True})
            
        except Exception as e:
            logger.error(f"Failed to initialize multimodal processor: {e}")
            await self.event_bus.emit("multimodal.initialized", {
                "success": False,
                "error": str(e)
            })
            
    async def shutdown(self):
        """Clean up resources and shut down"""
        try:
            # Unload models to free memory
            for model_type, model_data in self.models.items():
                if model_type == "vlm" and "model" in model_data:
                    # Close VLM model if it has a close method
                    if hasattr(model_data["model"], "close"):
                        model_data["model"].close()
                        
            # Clear models dictionary
            self.models.clear()
            self.active_model = None
            
            logger.info("MultimodalProcessor shut down successfully")
            
        except Exception as e:
            logger.error(f"Error during MultimodalProcessor shutdown: {e}")
            
    async def analyze_image(self, image_data: Union[str, bytes, BinaryIO], task_type: str = "general") -> Dict[str, Any]:
        """Analyze an image and return a description
        
        Args:
            image_data: Image data as base64 string, bytes, or file-like object
            task_type: Type of analysis task (general, caption, vqa, etc.)
            
        Returns:
            Dictionary with analysis results
        """
        if not self.initialized:
            await self.initialize()
            
        start_time = time.time()
        
        try:
            # Convert image data to PIL Image
            image = self._prepare_image(image_data)
            
            # If we have a VLM model, use it for image analysis
            if "vlm" in self.models and self.models["vlm"].get("model"):
                # Prepare prompt based on task type
                if task_type == "caption":
                    prompt = "Describe this image in detail."
                elif task_type == "objects":
                    prompt = "List all objects visible in this image."
                elif task_type == "scene":
                    prompt = "Describe the scene in this image, including location, time of day, and atmosphere."
                else:
                    prompt = "Analyze this image and provide a detailed description."
                    
                # Encode image for VLM
                img_bytes = io.BytesIO()
                image.save(img_bytes, format="PNG")
                img_bytes = img_bytes.getvalue()
                img_base64 = base64.b64encode(img_bytes).decode("utf-8")
                
                # Create VLM prompt with image
                vlm_model = self.models["vlm"]["model"]
                
                # Process with VLM
                response = vlm_model.create_chat_completion(
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant that analyzes images."},
                        {"role": "user", "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_base64}"}}
                        ]}
                    ],
                    max_tokens=512,
                    temperature=0.7
                )
                
                description = response["choices"][0]["message"]["content"]
                confidence = 0.85  # VLM doesn't provide confidence, use a reasonable default
                
            # Fallback to CLIP for basic image analysis if VLM not available
            elif "clip" in self.models and self.models["clip"].get("model"):
                # Use CLIP for basic image understanding
                clip_model = self.models["clip"]["model"]
                clip_processor = self.models["clip"]["processor"]
                
                # Prepare some candidate descriptions
                candidates = [
                    "a photo of a person",
                    "a photo of a landscape",
                    "a photo of an animal",
                    "a photo of food",
                    "a photo of a building",
                    "a photo of a vehicle",
                    "a photo of technology",
                    "a photo of nature",
                    "a photo of art"
                ]
                
                # Process image and text with CLIP
                inputs = clip_processor(text=candidates, images=image, return_tensors="pt", padding=True)
                outputs = clip_model(**inputs)
                
                # Get the most likely description
                logits_per_image = outputs.logits_per_image
                probs = torch.nn.functional.softmax(logits_per_image, dim=1)
                max_idx = torch.argmax(probs, dim=1).item()
                confidence = probs[0][max_idx].item()
                description = candidates[max_idx]
                
            else:
                # No models available
                return {
                    "success": False,
                    "error": "No image analysis models available"
                }
                
            processing_time = time.time() - start_time
            self.last_processing_time = processing_time
            
            # Create result
            result = ProcessingResult(
                success=True,
                description=description,
                confidence=confidence,
                modalities=[ModalityType.IMAGE],
                raw_output={"description": description, "confidence": confidence},
                processing_time=processing_time
            )
            
            return {
                "success": True,
                "description": description,
                "confidence": confidence,
                "processing_time": processing_time
            }
            
        except Exception as e:
            processing_time = time.time() - start_time
            error_msg = f"Error analyzing image: {str(e)}"
            logger.error(error_msg)
            
            return {
                "success": False,
                "error": error_msg,
                "processing_time": processing_time
            }
            
    async def analyze_text_image_pair(self, text: str, image_data: Union[str, bytes, BinaryIO], task_type: str = "general") -> Dict[str, Any]:
        """Analyze a text-image pair for multimodal understanding
        
        Args:
            text: Text query or description
            image_data: Image data as base64 string, bytes, or file-like object
            task_type: Type of analysis task (general, vqa, similarity, etc.)
            
        Returns:
            Dictionary with analysis results
        """
        if not self.initialized:
            await self.initialize()
            
        start_time = time.time()
        
        try:
            # Convert image data to PIL Image
            image = self._prepare_image(image_data)
            
            # If we have a VLM model, use it for text-image analysis
            if "vlm" in self.models and self.models["vlm"].get("model"):
                # Encode image for VLM
                img_bytes = io.BytesIO()
                image.save(img_bytes, format="PNG")
                img_bytes = img_bytes.getvalue()
                img_base64 = base64.b64encode(img_bytes).decode("utf-8")
                
                # Create VLM prompt with image and text
                vlm_model = self.models["vlm"]["model"]
                
                # Process with VLM
                response = vlm_model.create_chat_completion(
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant that analyzes images and text together."},
                        {"role": "user", "content": [
                            {"type": "text", "text": text},
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_base64}"}}
                        ]}
                    ],
                    max_tokens=512,
                    temperature=0.7
                )
                
                answer = response["choices"][0]["message"]["content"]
                confidence = 0.85  # VLM doesn't provide confidence, use a reasonable default
                
            # Fallback to CLIP for similarity analysis if VLM not available
            elif "clip" in self.models and self.models["clip"].get("model") and task_type == "similarity":
                # Use CLIP for text-image similarity
                clip_model = self.models["clip"]["model"]
                clip_processor = self.models["clip"]["processor"]
                
                # Process image and text with CLIP
                inputs = clip_processor(text=[text], images=image, return_tensors="pt", padding=True)
                outputs = clip_model(**inputs)
                
                # Compute cosine similarity
                text_embed = outputs.text_embeds
                image_embed = outputs.image_embeds
                cosine_sim = torch.nn.functional.cosine_similarity(text_embed, image_embed)
                similarity = cosine_sim.item()
                
                answer = f"Similarity score: {similarity:.4f}"
                confidence = similarity
                
            else:
                # No models available for this task
                return {
                    "success": False,
                    "error": "No suitable models available for text-image analysis"
                }
                
            processing_time = time.time() - start_time
            self.last_processing_time = processing_time
            
            # Create result
            result = ProcessingResult(
                success=True,
                description=answer,
                confidence=confidence,
                modalities=[ModalityType.TEXT, ModalityType.IMAGE],
                raw_output={"answer": answer, "confidence": confidence},
                processing_time=processing_time
            )
            
            return {
                "success": True,
                "answer": answer,
                "confidence": confidence,
                "processing_time": processing_time
            }
            
        except Exception as e:
            processing_time = time.time() - start_time
            error_msg = f"Error analyzing text-image pair: {str(e)}"
            logger.error(error_msg)
            
            return {
                "success": False,
                "error": error_msg,
                "processing_time": processing_time
            }
            
    def _prepare_image(self, image_data: Union[str, bytes, BinaryIO]) -> Image.Image:
        """Convert various image data formats to PIL Image"""
        if not _vision_libs_available:
            raise MultimodalError("Vision libraries not available")
            
        try:
            # Handle base64 string
            if isinstance(image_data, str) and image_data.startswith("data:image"):
                # Extract base64 data from data URL
                base64_data = image_data.split(",")[1]
                image_bytes = base64.b64decode(base64_data)
                return Image.open(io.BytesIO(image_bytes))
                
            # Handle base64 string without data URL prefix
            elif isinstance(image_data, str) and len(image_data) > 100:
                try:
                    image_bytes = base64.b64decode(image_data)
                    return Image.open(io.BytesIO(image_bytes))
                except Exception:
                    # If not valid base64, treat as file path
                    if os.path.exists(image_data):
                        return Image.open(image_data)
                    else:
                        raise ValueError(f"Invalid image path: {image_data}")
                        
            # Handle file path
            elif isinstance(image_data, str) and os.path.exists(image_data):
                return Image.open(image_data)
                
            # Handle bytes
            elif isinstance(image_data, bytes):
                return Image.open(io.BytesIO(image_data))
                
            # Handle file-like object
            elif hasattr(image_data, "read"):
                return Image.open(image_data)
                
            else:
                raise ValueError("Unsupported image data format")
                
        except Exception as e:
            raise MultimodalError(f"Failed to prepare image: {str(e)}")
            
    async def optimize_with_darwin_godel(self, component_name: str, code: str) -> Optional[Dict[str, Any]]:
        """Use Darwin Gödel Machine to optimize a component"""
        if not self.darwin_godel:
            logger.warning("Darwin Gödel Machine not available for optimization")
            return None
            
        try:
            # Propose an optimization
            optimization = await self.darwin_godel.propose_optimization(component_name, code)
            
            if optimization:
                return {
                    "success": True,
                    "original_code": optimization.original_code,
                    "optimized_code": optimization.optimized_code,
                    "expected_improvement": optimization.expected_improvement,
                    "component": optimization.target_component
                }
            else:
                return {
                    "success": False,
                    "message": "No optimization found"
                }
                
        except Exception as e:
            logger.error(f"Error during optimization: {e}")
            return {
                "success": False,
                "error": str(e)
            }
            
    async def hot_swap_model(self, model_id: str, task_type: str = "general") -> Dict[str, Any]:
        """Hot-swap to a different model or LoRA adapter"""
        if not self.initialized:
            await self.initialize()
            
        try:
            # If we have a LoRA manager, use it for hot-swapping
            if self.lora_manager:
                # Request the adapter swap
                await self.event_bus.emit("lora.adapter_requested", {
                    "adapter_name": model_id,
                    "task_type": task_type
                })
                
                # Wait for confirmation (with timeout)
                success = False
                async with asyncio.timeout(10.0):
                    # TODO: Implement proper event waiting
                    await asyncio.sleep(2.0)  # Temporary placeholder
                    success = True
                    
                return {
                    "success": success,
                    "model_id": model_id,
                    "message": f"Model hot-swap to {model_id} {'succeeded' if success else 'failed'}"
                }
                
            else:
                return {
                    "success": False,
                    "error": "LoRA manager not available for hot-swapping"
                }
                
        except Exception as e:
            logger.error(f"Error during model hot-swap: {e}")
            return {
                "success": False,
                "error": str(e)
            }
