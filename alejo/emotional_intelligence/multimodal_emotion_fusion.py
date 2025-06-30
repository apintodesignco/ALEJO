"""
Multimodal Emotion Fusion Module for ALEJO

This module implements advanced multimodal emotion fusion techniques inspired by
cutting-edge research from MIT Media Lab and Meta's ImageBind approach.
It combines multiple emotion detection modalities (text, audio, facial, gesture)
into a unified embedding space for more accurate and nuanced emotion understanding.
"""

import logging
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass
from enum import Enum

from ..core.resource_manager import ResourceType
from ..core.memory_event_bus import MemoryEventBus
from ..services.user_preferences import get_user_preferences

logger = logging.getLogger(__name__)

class ModalityType(Enum):
    """Types of modalities for emotion detection"""
    TEXT = "text"
    AUDIO = "audio"
    FACIAL = "facial"
    GESTURE = "gesture"
    PHYSIOLOGICAL = "physiological"  # For future expansion (e.g., heart rate, GSR)


@dataclass
class ModalityData:
    """Container for modality-specific emotion data"""
    modality_type: ModalityType
    emotion_scores: Dict[str, float]
    confidence: float
    raw_data: Optional[Any] = None
    timestamp: Optional[float] = None


@dataclass
class FusedEmotionResult:
    """Result of multimodal emotion fusion"""
    dominant_emotion: str
    emotion_scores: Dict[str, float]
    confidence: float
    contributing_modalities: Dict[ModalityType, float]  # Modality -> contribution weight
    timestamp: float


class MultimodalEmotionFusion:
    """
    Implements advanced multimodal emotion fusion using techniques inspired by
    ImageBind and MIT's affective computing research.
    
    This class combines emotions detected from different modalities (text, audio, facial, etc.)
    into a unified emotional understanding with higher accuracy and nuance.
    """
    
    def __init__(self, event_bus: Optional[MemoryEventBus] = None):
        """
        Initialize the multimodal emotion fusion system
        
        Args:
            event_bus: Optional event bus for publishing fusion results
        """
        self.event_bus = event_bus
        self.modality_weights = {
            ModalityType.TEXT: 0.25,
            ModalityType.AUDIO: 0.30,
            ModalityType.FACIAL: 0.35,
            ModalityType.GESTURE: 0.10,
            ModalityType.PHYSIOLOGICAL: 0.0,  # Not used yet
        }
        
        # Default emotion categories
        self.emotion_categories = [
            "joy", "sadness", "anger", "fear", "surprise", 
            "disgust", "neutral", "confusion", "frustration",
            "excitement", "contentment", "disappointment"
        ]
        
        # Initialize fusion model parameters
        self._initialize_fusion_model()
        
        # Context window for temporal fusion
        self.context_window = []
        self.max_context_size = 5  # Remember last 5 emotion readings
        
        # User calibration data
        self.user_calibration = {}
        
        logger.info("Multimodal emotion fusion system initialized")
    
    def _initialize_fusion_model(self):
        """Initialize the fusion model parameters"""
        # Cross-modal attention weights
        self.cross_modal_weights = nn.Parameter(
            torch.ones(len(ModalityType), len(ModalityType)) / len(ModalityType)
        )
        
        # Emotion embedding dimensions
        self.embedding_dim = 128
        
        # Create embedding layers for each modality
        self.embedding_layers = {}
        for modality in ModalityType:
            self.embedding_layers[modality] = nn.Linear(
                len(self.emotion_categories), self.embedding_dim
            )
        
        # Cross-modal fusion layer
        self.fusion_layer = nn.Linear(
            self.embedding_dim * len(ModalityType), 
            len(self.emotion_categories)
        )
    
    def update_modality_weights(self, weights: Dict[ModalityType, float]):
        """
        Update the weights for different modalities
        
        Args:
            weights: Dictionary mapping modality types to weights
        """
        # Validate weights
        total = sum(weights.values())
        if abs(total - 1.0) > 0.001:
            # Normalize weights
            weights = {k: v / total for k, v in weights.items()}
        
        # Update weights
        for modality, weight in weights.items():
            if modality in self.modality_weights:
                self.modality_weights[modality] = weight
        
        logger.info(f"Updated modality weights: {self.modality_weights}")
    
    def calibrate_for_user(self, user_id: str, baseline_emotions: Dict[str, float]):
        """
        Calibrate the fusion system for a specific user
        
        Args:
            user_id: User identifier
            baseline_emotions: Baseline emotion levels for this user
        """
        self.user_calibration[user_id] = baseline_emotions
        logger.info(f"Calibrated emotion fusion for user {user_id}")
    
    def _embed_modality(self, modality_data: ModalityData) -> torch.Tensor:
        """
        Convert modality-specific emotion data into embedding space
        
        Args:
            modality_data: Emotion data for a specific modality
            
        Returns:
            Tensor embedding of the emotion data
        """
        # Convert emotion scores to tensor
        emotion_tensor = torch.zeros(len(self.emotion_categories))
        for i, emotion in enumerate(self.emotion_categories):
            emotion_tensor[i] = modality_data.emotion_scores.get(emotion, 0.0)
        
        # Apply embedding layer
        modality_type = modality_data.modality_type
        embedded = self.embedding_layers[modality_type](emotion_tensor)
        
        # Apply confidence weighting
        embedded = embedded * modality_data.confidence
        
        return embedded
    
    def _apply_cross_modal_attention(self, embeddings: Dict[ModalityType, torch.Tensor]) -> Dict[ModalityType, torch.Tensor]:
        """
        Apply cross-modal attention to enhance embeddings
        
        Args:
            embeddings: Dictionary of embeddings for each modality
            
        Returns:
            Enhanced embeddings with cross-modal attention
        """
        enhanced_embeddings = {}
        
        # For each modality
        for target_modality in embeddings:
            target_idx = list(ModalityType).index(target_modality)
            enhanced = embeddings[target_modality].clone()
            
            # Apply attention from other modalities
            for source_modality in embeddings:
                if source_modality != target_modality:
                    source_idx = list(ModalityType).index(source_modality)
                    attention_weight = self.cross_modal_weights[target_idx, source_idx].item()
                    enhanced += attention_weight * embeddings[source_modality]
            
            enhanced_embeddings[target_modality] = enhanced
        
        return enhanced_embeddings
    
    def _fuse_embeddings(self, embeddings: Dict[ModalityType, torch.Tensor]) -> torch.Tensor:
        """
        Fuse embeddings from different modalities
        
        Args:
            embeddings: Dictionary of embeddings for each modality
            
        Returns:
            Fused emotion embedding
        """
        # Concatenate embeddings
        concat_embeddings = []
        for modality in ModalityType:
            if modality in embeddings:
                # Weight by modality importance
                weighted_embedding = embeddings[modality] * self.modality_weights[modality]
                concat_embeddings.append(weighted_embedding)
            else:
                # Use zeros for missing modalities
                concat_embeddings.append(torch.zeros(self.embedding_dim))
        
        fused = torch.cat(concat_embeddings)
        
        # Apply fusion layer
        emotion_logits = self.fusion_layer(fused)
        
        # Apply softmax to get probabilities
        emotion_probs = F.softmax(emotion_logits, dim=0)
        
        return emotion_probs
    
    def _apply_temporal_smoothing(self, current_emotions: Dict[str, float]) -> Dict[str, float]:
        """
        Apply temporal smoothing to emotion predictions
        
        Args:
            current_emotions: Current emotion predictions
            
        Returns:
            Smoothed emotion predictions
        """
        # Add current emotions to context window
        self.context_window.append(current_emotions)
        
        # Keep context window at max size
        if len(self.context_window) > self.max_context_size:
            self.context_window.pop(0)
        
        # Apply exponential decay weights (more recent = higher weight)
        weights = [0.6 ** i for i in range(len(self.context_window))]
        weights.reverse()  # Most recent has highest weight
        
        # Normalize weights
        total_weight = sum(weights)
        weights = [w / total_weight for w in weights]
        
        # Compute weighted average
        smoothed_emotions = {}
        for emotion in self.emotion_categories:
            weighted_sum = 0.0
            for i, emotions in enumerate(self.context_window):
                weighted_sum += emotions.get(emotion, 0.0) * weights[i]
            smoothed_emotions[emotion] = weighted_sum
        
        return smoothed_emotions
    
    def _compute_modality_contributions(
        self, 
        modality_data_list: List[ModalityData],
        fused_emotions: Dict[str, float]
    ) -> Dict[ModalityType, float]:
        """
        Compute how much each modality contributed to the final fusion
        
        Args:
            modality_data_list: List of modality data
            fused_emotions: Final fused emotion scores
            
        Returns:
            Dictionary mapping modalities to their contribution scores
        """
        contributions = {}
        
        # Find dominant emotion
        dominant_emotion = max(fused_emotions.items(), key=lambda x: x[1])[0]
        
        # Compute contribution for each modality
        for modality_data in modality_data_list:
            modality = modality_data.modality_type
            
            # How strongly did this modality predict the dominant emotion?
            modality_score = modality_data.emotion_scores.get(dominant_emotion, 0.0)
            
            # Weight by modality confidence and importance
            contribution = (
                modality_score * 
                modality_data.confidence * 
                self.modality_weights[modality]
            )
            
            contributions[modality] = contribution
        
        # Normalize contributions
        total = sum(contributions.values())
        if total > 0:
            contributions = {k: v / total for k, v in contributions.items()}
        
        return contributions
    
    def fuse_emotions(
        self, 
        modality_data_list: List[ModalityData],
        user_id: Optional[str] = None,
        timestamp: Optional[float] = None
    ) -> FusedEmotionResult:
        """
        Fuse emotions from multiple modalities
        
        Args:
            modality_data_list: List of emotion data from different modalities
            user_id: Optional user ID for personalized calibration
            timestamp: Optional timestamp for the emotion data
            
        Returns:
            Fused emotion result
        """
        if not modality_data_list:
            raise ValueError("No modality data provided for fusion")
        
        # Use provided timestamp or get current time
        if timestamp is None:
            import time
            timestamp = time.time()
        
        # Convert modality data to embeddings
        embeddings = {}
        for modality_data in modality_data_list:
            modality = modality_data.modality_type
            embeddings[modality] = self._embed_modality(modality_data)
        
        # Apply cross-modal attention
        enhanced_embeddings = self._apply_cross_modal_attention(embeddings)
        
        # Fuse embeddings
        emotion_probs = self._fuse_embeddings(enhanced_embeddings)
        
        # Convert to dictionary
        emotion_scores = {}
        for i, emotion in enumerate(self.emotion_categories):
            emotion_scores[emotion] = emotion_probs[i].item()
        
        # Apply temporal smoothing
        smoothed_emotions = self._apply_temporal_smoothing(emotion_scores)
        
        # Apply user calibration if available
        if user_id and user_id in self.user_calibration:
            baseline = self.user_calibration[user_id]
            for emotion in smoothed_emotions:
                if emotion in baseline:
                    # Adjust based on user's baseline
                    smoothed_emotions[emotion] -= baseline[emotion]
            
            # Ensure values are positive
            min_val = min(smoothed_emotions.values())
            if min_val < 0:
                for emotion in smoothed_emotions:
                    smoothed_emotions[emotion] -= min_val
            
            # Normalize
            total = sum(smoothed_emotions.values())
            if total > 0:
                smoothed_emotions = {k: v / total for k, v in smoothed_emotions.items()}
        
        # Find dominant emotion
        dominant_emotion = max(smoothed_emotions.items(), key=lambda x: x[1])[0]
        
        # Compute overall confidence
        confidence = sum(data.confidence * self.modality_weights[data.modality_type] 
                        for data in modality_data_list)
        
        # Compute modality contributions
        contributions = self._compute_modality_contributions(
            modality_data_list, smoothed_emotions
        )
        
        # Create result
        result = FusedEmotionResult(
            dominant_emotion=dominant_emotion,
            emotion_scores=smoothed_emotions,
            confidence=confidence,
            contributing_modalities=contributions,
            timestamp=timestamp
        )
        
        # Publish result to event bus if available
        if self.event_bus:
            from ..core.event_bus import Event, EventType
            event = Event(
                type=EventType.USER_EMOTION,
                source="multimodal_fusion",
                payload={
                    "emotion_data": {
                        "dominant_emotion": result.dominant_emotion,
                        "combined_emotions": result.emotion_scores,
                        "confidence": result.confidence,
                        "contributing_modalities": {
                            m.name: w for m, w in result.contributing_modalities.items()
                        }
                    },
                    "timestamp": result.timestamp
                }
            )
            # Use asyncio.create_task to avoid blocking
            import asyncio
            asyncio.create_task(self.event_bus.publish(event))
            logger.debug(f"Published fused emotion event: {result.dominant_emotion}")
        
        return result


# Singleton instance
_fusion_manager = None

def get_fusion_manager(event_bus: Optional[MemoryEventBus] = None) -> MultimodalEmotionFusion:
    """Get the singleton fusion manager instance"""
    global _fusion_manager
    if _fusion_manager is None:
        _fusion_manager = MultimodalEmotionFusion(event_bus)
    return _fusion_manager
