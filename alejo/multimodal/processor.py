"""
ALEJO Multimodal Processor

This module implements multimodal processing capabilities using frameworks like CLIP
for combined text and image understanding.
"""

import logging
from typing import Dict, Any, Optional, Union

try:
    import torch
    import clip
    CLIP_AVAILABLE = True
except ImportError:
    CLIP_AVAILABLE = False
    logging.warning("CLIP framework not available. Install with: pip install clip-by-openai")

from ..utils.error_handling import handle_errors

logger = logging.getLogger(__name__)

class MultimodalProcessor:
    """Processor for multimodal input (text and image) using CLIP or other frameworks"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the multimodal processor"""
        self.config = config or {}
        self.model = None
        self.preprocess = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        if CLIP_AVAILABLE:
            try:
                self._initialize_clip()
            except Exception as e:
                logger.error(f"Failed to initialize CLIP: {e}")
                CLIP_AVAILABLE = False
        else:
            logger.warning("Multimodal processing limited due to missing CLIP framework")
    
    def _initialize_clip(self):
        """Initialize the CLIP model and preprocessing"""
        if not CLIP_AVAILABLE:
            return
        
        model_name = self.config.get('clip_model', 'ViT-B/32')
        logger.info(f"Loading CLIP model: {model_name} on device: {self.device}")
        self.model, self.preprocess = clip.load(model_name, device=self.device)
        logger.info("CLIP model loaded successfully")
    
    @handle_errors(component="multimodal_processor", category="processing")
    def analyze_text_image_pair(self, text: str, image_data: Union[bytes, Any]) -> Dict[str, Any]:
        """Analyze a text and image pair for similarity or combined understanding"""
        if not CLIP_AVAILABLE or not self.model:
            return {"error": "CLIP framework not available", "similarity": 0.0, "description": "Unsupported operation"}
        
        try:
            from PIL import Image
            import io
            
            # Process image
            image = Image.open(io.BytesIO(image_data))
            image_input = self.preprocess(image).unsqueeze(0).to(self.device)
            
            # Process text
            text_tokens = clip.tokenize([text]).to(self.device)
            
            # Compute embeddings
            with torch.no_grad():
                image_features = self.model.encode_image(image_input)
                text_features = self.model.encode_text(text_tokens)
                
                # Compute similarity
                similarity = (100.0 * image_features @ text_features.T).softmax(dim=-1)
                similarity_score = similarity[0][0].item()
            
            return {
                "similarity": similarity_score,
                "description": f"Text and image similarity: {similarity_score:.2f}"
            }
        except Exception as e:
            logger.error(f"Error analyzing text-image pair: {e}", exc_info=True)
            raise
    
    @handle_errors(component="multimodal_processor", category="processing")
    def classify_image_with_text(self, image_data: Union[bytes, Any], text_options: list) -> Dict[str, Any]:
        """Classify an image against a list of text options"""
        if not CLIP_AVAILABLE or not self.model:
            return {"error": "CLIP framework not available", "best_match": None, "probabilities": {}}
        
        try:
            from PIL import Image
            import io
            
            # Process image
            image = Image.open(io.BytesIO(image_data))
            image_input = self.preprocess(image).unsqueeze(0).to(self.device)
            
            # Process text options
            text_tokens = clip.tokenize(text_options).to(self.device)
            
            # Compute embeddings and similarities
            with torch.no_grad():
                image_features = self.model.encode_image(image_input)
                text_features = self.model.encode_text(text_tokens)
                similarities = (100.0 * image_features @ text_features.T).softmax(dim=-1)[0]
            
            probabilities = {text: prob.item() for text, prob in zip(text_options, similarities)}
            best_match = max(probabilities.items(), key=lambda x: x[1])
            
            return {
                "best_match": best_match[0],
                "confidence": best_match[1],
                "probabilities": probabilities
            }
        except Exception as e:
            logger.error(f"Error classifying image with text options: {e}", exc_info=True)
            raise
