"""
Advanced Emotion Recognition Models for ALEJO
Uses RoBERTa and other transformer models for sophisticated emotion detection
"""

import torch
from torch import nn
import torch.nn.functional as F
from transformers import (
    RobertaTokenizer, 
    RobertaModel,
    RobertaForSequenceClassification,
    AutoTokenizer,
    AutoModelForSequenceClassification
)
from typing import Dict, List, Tuple, Optional
import numpy as np
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class EmotionPrediction:
    """Structured emotion prediction result"""
    primary_emotion: str
    primary_confidence: float
    secondary_emotion: Optional[str]
    secondary_confidence: Optional[float]
    emotion_distribution: Dict[str, float]
    valence: float  # Positive/negative sentiment
    arousal: float  # Energy/intensity level
    dominance: float  # Control/power level

class RoBERTaEmotionClassifier:
    """
    Advanced emotion classifier using RoBERTa with fine-tuning capabilities
    """
    
    def __init__(self, model_name: str = "j-hartmann/emotion-english-distilroberta-base"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load base models
        self.tokenizer = RobertaTokenizer.from_pretrained(model_name)
        self.model = RobertaForSequenceClassification.from_pretrained(model_name)
        self.model.to(self.device)
        
        # Load GoEmotions model for fine-grained emotion detection
        self.goemotions_tokenizer = AutoTokenizer.from_pretrained("monologg/bert-base-goemotions")
        self.goemotions_model = AutoModelForSequenceClassification.from_pretrained("monologg/bert-base-goemotions")
        self.goemotions_model.to(self.device)
        
        # Emotion mappings
        self.emotion_plutchik = {
            "joy": {"valence": 0.8, "arousal": 0.6, "dominance": 0.7},
            "trust": {"valence": 0.6, "arousal": 0.3, "dominance": 0.5},
            "fear": {"valence": -0.7, "arousal": 0.7, "dominance": -0.6},
            "surprise": {"valence": 0.4, "arousal": 0.8, "dominance": 0.0},
            "sadness": {"valence": -0.7, "arousal": -0.4, "dominance": -0.4},
            "disgust": {"valence": -0.6, "arousal": 0.2, "dominance": 0.3},
            "anger": {"valence": -0.8, "arousal": 0.8, "dominance": 0.7},
            "anticipation": {"valence": 0.4, "arousal": 0.5, "dominance": 0.4}
        }
        
    def predict_emotions(self, text: str) -> EmotionPrediction:
        """
        Predict emotions using multiple models and combine results
        """
        try:
            # Get base emotion predictions
            base_emotions = self._get_base_emotions(text)
            
            # Get fine-grained emotions
            detailed_emotions = self._get_detailed_emotions(text)
            
            # Combine predictions
            combined = self._combine_predictions(base_emotions, detailed_emotions)
            
            # Calculate VAD (Valence, Arousal, Dominance) dimensions
            vad = self._calculate_vad_dimensions(combined)
            
            return EmotionPrediction(
                primary_emotion=combined["primary"],
                primary_confidence=combined["primary_conf"],
                secondary_emotion=combined.get("secondary"),
                secondary_confidence=combined.get("secondary_conf"),
                emotion_distribution=combined["distribution"],
                valence=vad["valence"],
                arousal=vad["arousal"],
                dominance=vad["dominance"]
            )
            
        except Exception as e:
            logger.error(f"Error predicting emotions: {e}")
            return self._get_neutral_prediction()
            
    def _get_base_emotions(self, text: str) -> Dict:
        """Get predictions from base RoBERTa model"""
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = F.softmax(outputs.logits, dim=1)[0]
            
        predictions = []
        for i, p in enumerate(probs):
            label = self.model.config.id2label[i]
            predictions.append((label, p.item()))
            
        return dict(sorted(predictions, key=lambda x: x[1], reverse=True))
        
    def _get_detailed_emotions(self, text: str) -> Dict:
        """Get fine-grained emotions from GoEmotions model"""
        inputs = self.goemotions_tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = self.goemotions_model(**inputs)
            probs = torch.sigmoid(outputs.logits)[0]  # Multi-label classification
            
        predictions = []
        for i, p in enumerate(probs):
            label = self.goemotions_model.config.id2label[i]
            if p.item() > 0.3:  # Threshold for multi-label
                predictions.append((label, p.item()))
                
        return dict(sorted(predictions, key=lambda x: x[1], reverse=True))
        
    def _combine_predictions(self, base: Dict, detailed: Dict) -> Dict:
        """Combine predictions from different models"""
        combined = {}
        
        # Get primary emotion
        primary = list(base.items())[0]
        combined["primary"] = primary[0]
        combined["primary_conf"] = primary[1]
        
        # Get secondary emotion if confidence is high enough
        if len(base) > 1 and list(base.items())[1][1] > 0.2:
            secondary = list(base.items())[1]
            combined["secondary"] = secondary[0]
            combined["secondary_conf"] = secondary[1]
            
        # Create emotion distribution
        distribution = {}
        for emotion, score in base.items():
            distribution[emotion] = score
            
        # Add detailed emotions with lower weights
        for emotion, score in detailed.items():
            if emotion not in distribution:
                distribution[emotion] = score * 0.5
                
        combined["distribution"] = distribution
        
        return combined
        
    def _calculate_vad_dimensions(self, combined: Dict) -> Dict:
        """Calculate VAD dimensions from emotion predictions"""
        distribution = combined["distribution"]
        total_weight = sum(distribution.values())
        
        vad = {"valence": 0.0, "arousal": 0.0, "dominance": 0.0}
        
        for emotion, weight in distribution.items():
            # Map emotion to closest Plutchik emotion
            plutchik_emotion = self._map_to_plutchik(emotion)
            if plutchik_emotion in self.emotion_plutchik:
                for dim, value in self.emotion_plutchik[plutchik_emotion].items():
                    vad[dim] += value * (weight / total_weight)
                    
        return vad
        
    def _map_to_plutchik(self, emotion: str) -> str:
        """Map any emotion to closest Plutchik emotion"""
        # Simple mapping for common emotions
        mapping = {
            "happy": "joy",
            "sad": "sadness",
            "angry": "anger",
            "scared": "fear",
            "disgusted": "disgust",
            "surprised": "surprise",
            "excited": "joy",
            "anxious": "fear",
            "grateful": "trust",
            "proud": "joy",
            "hopeful": "anticipation",
            "disappointed": "sadness",
            "confident": "trust",
            "caring": "trust",
            "confused": "surprise"
        }
        
        return mapping.get(emotion.lower(), "neutral")
        
    def _get_neutral_prediction(self) -> EmotionPrediction:
        """Return neutral prediction for fallback"""
        return EmotionPrediction(
            primary_emotion="neutral",
            primary_confidence=1.0,
            secondary_emotion=None,
            secondary_confidence=None,
            emotion_distribution={"neutral": 1.0},
            valence=0.0,
            arousal=0.0,
            dominance=0.0
        )
        
    def fine_tune(self, texts: List[str], labels: List[str],
                 epochs: int = 3, batch_size: int = 16):
        """Fine-tune the model on custom data"""
        # Prepare dataset
        dataset = self._prepare_fine_tuning_data(texts, labels)
        
        # Training setup
        optimizer = torch.optim.AdamW(self.model.parameters(), lr=2e-5)
        
        self.model.train()
        for epoch in range(epochs):
            total_loss = 0
            for i in range(0, len(dataset), batch_size):
                batch = dataset[i:i + batch_size]
                inputs = self.tokenizer.batch_encode_plus(
                    batch["texts"],
                    padding=True,
                    truncation=True,
                    max_length=512,
                    return_tensors="pt"
                )
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
                labels = torch.tensor(batch["labels"]).to(self.device)
                
                outputs = self.model(**inputs, labels=labels)
                loss = outputs.loss
                
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
                
            avg_loss = total_loss / (len(dataset) / batch_size)
            logger.info(f"Epoch {epoch + 1}/{epochs}, Average Loss: {avg_loss:.4f}")
            
        self.model.eval()
        
    def _prepare_fine_tuning_data(self, texts: List[str], 
                                labels: List[str]) -> Dict:
        """Prepare data for fine-tuning"""
        # Convert labels to indices
        label2id = {label: i for i, label in enumerate(set(labels))}
        label_ids = [label2id[label] for label in labels]
        
        return {
            "texts": texts,
            "labels": label_ids,
            "label2id": label2id,
            "id2label": {i: label for label, i in label2id.items()}
        }
