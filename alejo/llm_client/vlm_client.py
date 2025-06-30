"""
Vision-Language Model (VLM) Client Implementation
Provides integration with multimodal models while conforming to our base interface
"""

import os
import asyncio
import logging
from typing import Dict, Any, List, Union, Optional, Tuple, Generator, AsyncGenerator
from pathlib import Path
import base64
import time
from PIL import Image
import numpy as np

try:
    import torch
    HAS_TORCH = torch.cuda.is_available()
except ImportError:
    HAS_TORCH = False

from .base import (
    BaseLLMClient,
    LLMConfig,
    LLMResponse,
    LLMError,
    ModelCapability
)
from .model_manager import ModelManager

logger = logging.getLogger(__name__)

class VLMConfig(LLMConfig):
    """Vision-Language Model specific configuration"""
    def __init__(
        self,
        model_name: str = "llava-v1.6-mistral-7b-q4_k_m",
        model_path: Optional[str] = None,
        image_processor: str = "clip",
        n_ctx: int = 4096,
        n_gpu_layers: int = 35,  # Will be auto-adjusted based on hardware
        model_tier: str = "standard",
        **kwargs
    ):
        super().__init__(model_name=model_name, **kwargs)
        self.model_path = model_path or str(Path.home() / '.alejo' / 'models' / f"{model_name}.gguf")
        self.image_processor = image_processor
        self.n_ctx = n_ctx
        self.n_gpu_layers = n_gpu_layers
        self.model_tier = model_tier
        
        # Set VLM-specific capabilities
        self.capabilities = [
            ModelCapability.TEXT_GENERATION,
            ModelCapability.CHAT,
            ModelCapability.CODE,
            ModelCapability.VISION,
            ModelCapability.STREAMING
        ]

class VLMClient(BaseLLMClient):
    """Client for Vision-Language Models using llama.cpp"""
    
    def __init__(self, config: Optional[VLMConfig] = None):
        super().__init__(config or VLMConfig())
        self._ensure_config_type()
        self._llm = None
        self._model_manager = ModelManager()
        
    def _ensure_config_type(self):
        """Ensure config is VLMConfig"""
        if not isinstance(self.config, VLMConfig):
            self.config = VLMConfig(**self.config.__dict__)
    
    async def _initialize_model(self):
        """Initialize the VLM model lazily"""
        if self._llm is not None:
            return
            
        try:
            from llama_cpp import Llama
            
            # Ensure model exists
            if not os.path.exists(self.config.model_path):
                logger.info(f"Model not found at {self.config.model_path}, attempting to download")
                await self._model_manager.download_model(
                    self.config.model_name,
                    self.config.model_path,
                    model_type="vlm"
                )
            
            # Adjust GPU layers based on hardware
            n_gpu_layers = self.config.n_gpu_layers
            if HAS_TORCH:
                # Use GPU if available
                logger.info("CUDA is available, using GPU acceleration")
                # Adjust based on VRAM
                vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                if vram_gb < 6:
                    n_gpu_layers = min(10, n_gpu_layers)
                elif vram_gb < 12:
                    n_gpu_layers = min(25, n_gpu_layers)
            else:
                # No GPU, use CPU only
                logger.info("CUDA not available, using CPU only")
                n_gpu_layers = 0
            
            # Initialize model
            self._llm = Llama(
                model_path=self.config.model_path,
                n_ctx=self.config.n_ctx,
                n_gpu_layers=n_gpu_layers,
                verbose=False
            )
            
            logger.info(f"Initialized VLM: {self.config.model_name} with {n_gpu_layers} GPU layers")
            
        except ImportError as e:
            raise LLMError(f"Failed to import llama_cpp: {e}. Please install with 'pip install llama-cpp-python[cuda]'")
        except Exception as e:
            raise LLMError(f"Failed to initialize VLM: {e}")
    
    async def _encode_image(self, image_path: str) -> str:
        """Encode image to base64"""
        try:
            with open(image_path, "rb") as img_file:
                return base64.b64encode(img_file.read()).decode("utf-8")
        except Exception as e:
            raise LLMError(f"Failed to encode image: {e}")
    
    async def process_image_and_text(
        self,
        image_path: str,
        prompt: str,
        **kwargs
    ) -> LLMResponse:
        """Process both image and text inputs"""
        await self._initialize_model()
        start_time = time.time()
        
        try:
            # Encode image to base64
            image_base64 = await self._encode_image(image_path)
            
            # Create multimodal message
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                        }
                    ]
                }
            ]
            
            # Generate response
            response = await self._handle_retry(
                self._generate_with_image,
                messages=messages,
                temperature=kwargs.get("temperature", self.config.temperature),
                max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
                top_p=kwargs.get("top_p", self.config.top_p)
            )
            
            # Calculate time
            elapsed_time = time.time() - start_time
            
            # Create response object
            return LLMResponse(
                content=response["content"],
                model=self.config.model_name,
                usage={
                    "prompt_tokens": response.get("prompt_tokens", 0),
                    "completion_tokens": response.get("completion_tokens", 0),
                    "total_tokens": response.get("total_tokens", 0)
                },
                elapsed_time=elapsed_time,
                metadata={
                    "image_processed": True,
                    "image_path": image_path,
                    "local_inference": True
                }
            )
            
        except Exception as e:
            raise LLMError(f"Failed to process image and text: {e}")
    
    async def _generate_with_image(
        self,
        messages: List[Dict],
        temperature: float,
        max_tokens: int,
        top_p: float
    ) -> Dict[str, Any]:
        """Generate response with image input"""
        try:
            # Extract prompt and image from messages
            prompt = ""
            image_base64 = None
            
            for message in messages:
                if message["role"] == "user":
                    for content in message["content"]:
                        if content["type"] == "text":
                            prompt += content["text"]
                        elif content["type"] == "image_url":
                            image_base64 = content["image_url"]["url"].split(",")[1]
            
            # Format prompt for VLM
            formatted_prompt = f"USER: <image>\n{prompt}\nASSISTANT:"
            
            # Create image data
            image_data = base64.b64decode(image_base64)
            
            # Call model with image
            response = self._llm.create_chat_completion(
                messages=[
                    {"role": "user", "content": formatted_prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                stream=False,
                image_data=image_data
            )
            
            # Extract response
            content = response["choices"][0]["message"]["content"]
            
            return {
                "content": content,
                "prompt_tokens": response["usage"]["prompt_tokens"],
                "completion_tokens": response["usage"]["completion_tokens"],
                "total_tokens": response["usage"]["total_tokens"]
            }
            
        except Exception as e:
            raise LLMError(f"Failed to generate with image: {e}")
    
    async def generate_text(self, prompt: str, **kwargs) -> LLMResponse:
        """Generate text using the VLM (without image)"""
        messages = [{"role": "user", "content": prompt}]
        return await self.generate_chat_response(messages, **kwargs)
    
    async def generate_chat_response(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> LLMResponse:
        """Generate chat response using the VLM (without image)"""
        await self._initialize_model()
        start_time = time.time()
        
        try:
            # Generate response
            response = await self._handle_retry(
                self._generate_chat_response,
                messages=messages,
                temperature=kwargs.get("temperature", self.config.temperature),
                max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
                top_p=kwargs.get("top_p", self.config.top_p)
            )
            
            # Calculate time
            elapsed_time = time.time() - start_time
            
            # Create response object
            return LLMResponse(
                content=response["content"],
                model=self.config.model_name,
                usage={
                    "prompt_tokens": response.get("prompt_tokens", 0),
                    "completion_tokens": response.get("completion_tokens", 0),
                    "total_tokens": response.get("total_tokens", 0)
                },
                elapsed_time=elapsed_time,
                metadata={
                    "local_inference": True
                }
            )
            
        except Exception as e:
            raise LLMError(f"Failed to generate chat response: {e}")
    
    async def _generate_chat_response(
        self,
        messages: List[Dict],
        temperature: float,
        max_tokens: int,
        top_p: float
    ) -> Dict[str, Any]:
        """Generate chat response without image"""
        try:
            # Call model
            response = self._llm.create_chat_completion(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                stream=False
            )
            
            # Extract response
            content = response["choices"][0]["message"]["content"]
            
            return {
                "content": content,
                "prompt_tokens": response["usage"]["prompt_tokens"],
                "completion_tokens": response["usage"]["completion_tokens"],
                "total_tokens": response["usage"]["total_tokens"]
            }
            
        except Exception as e:
            raise LLMError(f"Failed to generate chat response: {e}")
    
    async def generate_embeddings(self, texts: List[str], **kwargs) -> List[List[float]]:
        """Generate embeddings for texts"""
        # Not all VLMs support embeddings directly
        raise NotImplementedError("Embeddings not supported by this VLM")
    
    async def stream_chat_response(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> Generator[str, None, None]:
        """Stream chat response"""
        await self._initialize_model()
        
        try:
            # Format messages for streaming
            response_stream = self._llm.create_chat_completion(
                messages=messages,
                temperature=kwargs.get("temperature", self.config.temperature),
                max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
                top_p=kwargs.get("top_p", self.config.top_p),
                stream=True
            )
            
            # Yield tokens as they are generated
            for chunk in response_stream:
                if chunk["choices"][0]["delta"].get("content"):
                    yield chunk["choices"][0]["delta"]["content"]
                    
        except Exception as e:
            raise LLMError(f"Failed to stream chat response: {e}")
