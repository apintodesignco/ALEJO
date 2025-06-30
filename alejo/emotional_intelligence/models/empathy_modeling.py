"""
Advanced Empathy Modeling for ALEJO
Uses therapeutic conversation understanding and pattern recognition
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    AutoModelForCausalLM
)
from typing import Dict, List, Optional, Tuple
import numpy as np
from dataclasses import dataclass
import logging
from collections import deque

logger = logging.getLogger(__name__)

@dataclass
class EmpathyResponse:
    """Structured empathy response"""
    content: str
    empathy_level: float
    therapeutic_factors: Dict[str, float]
    emotional_recognition: Dict[str, float]
    confidence: float
    suggested_followup: Optional[str]

class TherapeuticPatternRecognizer:
    """Recognizes therapeutic conversation patterns"""
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load models
        self.tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-medium")
        self.model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-medium")
        self.model.to(self.device)
        
        # Therapeutic factors
        self.therapeutic_factors = {
            "validation": 0.0,
            "reflection": 0.0,
            "support": 0.0,
            "exploration": 0.0,
            "guidance": 0.0
        }
        
        # Pattern memory
        self.pattern_memory = deque(maxlen=1000)
        
    def analyze_pattern(self, conversation: List[str]) -> Dict[str, float]:
        """Analyze therapeutic patterns in conversation"""
        try:
            # Encode conversation
            inputs = self.tokenizer(
                " ".join(conversation[-5:]),  # Last 5 exchanges
                return_tensors="pt",
                truncation=True,
                max_length=512
            ).to(self.device)
            
            # Generate pattern analysis
            with torch.no_grad():
                outputs = self.model(**inputs)
                hidden_states = outputs.last_hidden_state
                
            # Analyze therapeutic factors
            factors = self._analyze_therapeutic_factors(hidden_states)
            
            # Update pattern memory
            self.pattern_memory.append({
                "conversation": conversation[-5:],
                "factors": factors
            })
            
            return factors
            
        except Exception as e:
            logger.error(f"Error analyzing pattern: {e}")
            return self.therapeutic_factors.copy()
            
    def _analyze_therapeutic_factors(self, hidden_states: torch.Tensor) -> Dict[str, float]:
        """Analyze therapeutic factors from model hidden states"""
        # Extract features from hidden states
        features = hidden_states.mean(dim=1)[0]
        
        # Project features to therapeutic factors
        factors = {
            "validation": float(torch.sigmoid(features[0].mean())),
            "reflection": float(torch.sigmoid(features[1].mean())),
            "support": float(torch.sigmoid(features[2].mean())),
            "exploration": float(torch.sigmoid(features[3].mean())),
            "guidance": float(torch.sigmoid(features[4].mean()))
        }
        
        return factors

class EmotionalTriggerDetector:
    """Detects and tracks emotional triggers"""
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load emotion classifier
        self.tokenizer = AutoTokenizer.from_pretrained("j-hartmann/emotion-english-distilroberta-base")
        self.model = AutoModelForSequenceClassification.from_pretrained("j-hartmann/emotion-english-distilroberta-base")
        self.model.to(self.device)
        
        # Trigger memory
        self.triggers = {}
        
    def detect_triggers(self, text: str, emotion_data: Dict[str, float]) -> List[Dict]:
        """Detect potential emotional triggers"""
        try:
            # Tokenize input
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=512
            ).to(self.device)
            
            # Get emotion predictions
            with torch.no_grad():
                outputs = self.model(**inputs)
                emotions = F.softmax(outputs.logits, dim=1)[0]
                
            # Extract potential triggers
            words = text.lower().split()
            triggers = []
            
            for word in words:
                if word not in self.triggers:
                    self.triggers[word] = {
                        "count": 0,
                        "emotions": {}
                    }
                    
                # Update trigger data
                self.triggers[word]["count"] += 1
                for emotion, score in emotion_data.items():
                    if emotion not in self.triggers[word]["emotions"]:
                        self.triggers[word]["emotions"][emotion] = []
                    self.triggers[word]["emotions"][emotion].append(score)
                    
                # Check if word is a significant trigger
                if self._is_trigger(word):
                    triggers.append({
                        "word": word,
                        "frequency": self.triggers[word]["count"],
                        "emotions": self._get_trigger_emotions(word)
                    })
                    
            return triggers
            
        except Exception as e:
            logger.error(f"Error detecting triggers: {e}")
            return []
            
    def _is_trigger(self, word: str) -> bool:
        """Determine if word is an emotional trigger"""
        if word not in self.triggers:
            return False
            
        trigger_data = self.triggers[word]
        
        # Check frequency
        if trigger_data["count"] < 3:
            return False
            
        # Check emotional intensity
        emotions = trigger_data["emotions"]
        if not emotions:
            return False
            
        # Calculate average emotion intensities
        avg_intensities = {
            emotion: sum(scores) / len(scores)
            for emotion, scores in emotions.items()
        }
        
        # Word is trigger if any emotion has high average intensity
        return any(intensity > 0.7 for intensity in avg_intensities.values())
        
    def _get_trigger_emotions(self, word: str) -> Dict[str, float]:
        """Get average emotions associated with trigger"""
        trigger_data = self.triggers[word]
        return {
            emotion: sum(scores) / len(scores)
            for emotion, scores in trigger_data["emotions"].items()
        }

class EmpathyModel:
    """
    Advanced empathy modeling system
    """
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Initialize components
        self.pattern_recognizer = TherapeuticPatternRecognizer()
        self.trigger_detector = EmotionalTriggerDetector()
        
        # Load response generation model
        self.response_tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-medium")
        self.response_model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-medium")
        self.response_model.to(self.device)
        
        # Conversation memory
        self.conversation_history = deque(maxlen=10)
        
    def generate_empathetic_response(self, text: str, emotion_data: Dict[str, float],
                                   context: Dict = None) -> EmpathyResponse:
        """Generate empathetic response"""
        try:
            # Update conversation history
            self.conversation_history.append(text)
            
            # Analyze therapeutic patterns
            therapeutic_factors = self.pattern_recognizer.analyze_pattern(
                list(self.conversation_history)
            )
            
            # Detect emotional triggers
            triggers = self.trigger_detector.detect_triggers(text, emotion_data)
            
            # Generate base response
            response = self._generate_base_response(text, therapeutic_factors)
            
            # Enhance response with trigger awareness
            if triggers:
                response = self._enhance_response_with_triggers(response, triggers)
                
            # Calculate empathy metrics
            empathy_level = self._calculate_empathy_level(
                response,
                therapeutic_factors,
                emotion_data
            )
            
            # Generate follow-up
            followup = self._generate_followup(response, therapeutic_factors)
            
            return EmpathyResponse(
                content=response,
                empathy_level=empathy_level,
                therapeutic_factors=therapeutic_factors,
                emotional_recognition=emotion_data,
                confidence=self._calculate_confidence(therapeutic_factors),
                suggested_followup=followup
            )
            
        except Exception as e:
            logger.error(f"Error generating empathetic response: {e}")
            return self._get_fallback_response()
            
    def _generate_base_response(self, text: str, 
                              therapeutic_factors: Dict[str, float]) -> str:
        """Generate base empathetic response"""
        try:
            # Prepare input with therapeutic guidance
            prompt = self._create_therapeutic_prompt(text, therapeutic_factors)
            
            inputs = self.response_tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=512
            ).to(self.device)
            
            # Generate response
            with torch.no_grad():
                outputs = self.response_model.generate(
                    **inputs,
                    max_length=150,
                    num_return_sequences=1,
                    temperature=0.7,
                    pad_token_id=self.response_tokenizer.eos_token_id
                )
                
            response = self.response_tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating base response: {e}")
            return "I understand and I'm here to support you."
            
    def _enhance_response_with_triggers(self, response: str,
                                      triggers: List[Dict]) -> str:
        """Enhance response with trigger awareness"""
        try:
            # Add trigger-aware content
            trigger_emotions = [t["emotions"] for t in triggers]
            if trigger_emotions:
                # Find most significant trigger
                main_trigger = max(
                    trigger_emotions,
                    key=lambda x: max(x.values())
                )
                
                # Add validation for trigger emotions
                validation = self._generate_validation(main_trigger)
                response = f"{response} {validation}"
                
            return response
            
        except Exception as e:
            logger.error(f"Error enhancing response: {e}")
            return response
            
    def _generate_validation(self, emotions: Dict[str, float]) -> str:
        """Generate emotional validation statement"""
        primary_emotion = max(emotions.items(), key=lambda x: x[1])[0]
        
        validations = {
            "joy": "It's wonderful to see you feeling this way.",
            "sadness": "It's completely natural to feel this way.",
            "anger": "I can understand why you'd feel frustrated.",
            "fear": "It's okay to feel uncertain or worried.",
            "surprise": "That must have been quite unexpected.",
            "trust": "It's good that you're feeling confident about this.",
            "anticipation": "It's natural to look forward with mixed feelings."
        }
        
        return validations.get(primary_emotion, "I acknowledge how you're feeling.")
        
    def _create_therapeutic_prompt(self, text: str,
                                 therapeutic_factors: Dict[str, float]) -> str:
        """Create prompt with therapeutic guidance"""
        # Determine primary therapeutic approach
        primary_factor = max(therapeutic_factors.items(), key=lambda x: x[1])[0]
        
        prompts = {
            "validation": f"Validate feelings: {text}",
            "reflection": f"Reflect meaning: {text}",
            "support": f"Show support: {text}",
            "exploration": f"Explore feelings: {text}",
            "guidance": f"Provide guidance: {text}"
        }
        
        return prompts.get(primary_factor, f"Respond empathetically: {text}")
        
    def _generate_followup(self, response: str,
                          therapeutic_factors: Dict[str, float]) -> Optional[str]:
        """Generate therapeutic follow-up question"""
        try:
            # Determine appropriate follow-up type
            if therapeutic_factors["exploration"] > 0.6:
                return "Could you tell me more about how that makes you feel?"
            elif therapeutic_factors["reflection"] > 0.6:
                return "What thoughts come to mind when you reflect on this?"
            elif therapeutic_factors["guidance"] > 0.6:
                return "What kind of support would be most helpful right now?"
            return None
            
        except Exception as e:
            logger.error(f"Error generating follow-up: {e}")
            return None
            
    def _calculate_empathy_level(self, response: str,
                               therapeutic_factors: Dict[str, float],
                               emotion_data: Dict[str, float]) -> float:
        """Calculate empathy level of response"""
        try:
            # Factors contributing to empathy
            validation_score = therapeutic_factors["validation"]
            reflection_score = therapeutic_factors["reflection"]
            support_score = therapeutic_factors["support"]
            
            # Emotional recognition factor
            emotion_recognition = max(emotion_data.values())
            
            # Calculate weighted average
            empathy_level = (
                validation_score * 0.3 +
                reflection_score * 0.3 +
                support_score * 0.2 +
                emotion_recognition * 0.2
            )
            
            return float(empathy_level)
            
        except Exception as e:
            logger.error(f"Error calculating empathy level: {e}")
            return 0.5
            
    def _calculate_confidence(self, therapeutic_factors: Dict[str, float]) -> float:
        """Calculate confidence in response"""
        try:
            # Average of therapeutic factors
            factor_confidence = sum(therapeutic_factors.values()) / len(therapeutic_factors)
            
            # Adjust based on conversation history
            history_factor = min(len(self.conversation_history) / 5, 1.0)
            
            return float(factor_confidence * 0.7 + history_factor * 0.3)
            
        except Exception as e:
            logger.error(f"Error calculating confidence: {e}")
            return 0.5
            
    def _get_fallback_response(self) -> EmpathyResponse:
        """Return fallback response when generation fails"""
        return EmpathyResponse(
            content="I'm here to listen and support you.",
            empathy_level=0.5,
            therapeutic_factors={
                "validation": 0.5,
                "reflection": 0.5,
                "support": 0.5,
                "exploration": 0.5,
                "guidance": 0.5
            },
            emotional_recognition={},
            confidence=0.5,
            suggested_followup="Would you like to tell me more?"
        )
