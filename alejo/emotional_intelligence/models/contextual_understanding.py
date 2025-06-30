"""
Contextual Understanding Models for ALEJO
Uses GPT and other transformer models for emotional context processing
"""

import torch
from torch import nn
from transformers import (
    GPT2LMHeadModel,
    GPT2Tokenizer,
    T5ForConditionalGeneration,
    T5Tokenizer,
    BartForConditionalGeneration,
    BartTokenizer
)
from typing import Dict, List, Optional, Tuple
import numpy as np
from dataclasses import dataclass
import logging
from collections import deque

logger = logging.getLogger(__name__)

@dataclass
class ContextualUnderstanding:
    """Result of contextual understanding analysis"""
    emotional_context: str
    key_topics: List[str]
    emotional_trajectory: List[Dict[str, float]]
    conversation_summary: str
    suggested_responses: List[str]
    emotional_triggers: List[str]
    confidence: float

class ConversationContext:
    """Maintains conversation history and context"""
    
    def __init__(self, max_history: int = 10):
        self.history = deque(maxlen=max_history)
        self.emotional_trajectory = deque(maxlen=max_history)
        self.topics = set()
        self.triggers = {}
        
    def add_interaction(self, text: str, emotion: Dict[str, float]):
        """Add new interaction to history"""
        self.history.append(text)
        self.emotional_trajectory.append(emotion)
        
        # Update topics and triggers
        self._update_topics(text)
        self._update_triggers(text, emotion)
        
    def _update_topics(self, text: str):
        """Extract and update conversation topics"""
        # Simple keyword-based topic extraction
        # In practice, you'd want to use more sophisticated NLP here
        words = text.lower().split()
        self.topics.update(words)
        
    def _update_triggers(self, text: str, emotion: Dict[str, float]):
        """Track potential emotional triggers"""
        # If strong emotion detected, track contextual elements
        primary_emotion = max(emotion.items(), key=lambda x: x[1])[0]
        if emotion[primary_emotion] > 0.7:
            words = text.lower().split()
            for word in words:
                if word not in self.triggers:
                    self.triggers[word] = []
                self.triggers[word].append((primary_emotion, emotion[primary_emotion]))

class GPTContextualUnderstanding:
    """
    Advanced contextual understanding using GPT models
    """
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load models
        self.gpt_model = GPT2LMHeadModel.from_pretrained("gpt2-medium")
        self.gpt_tokenizer = GPT2Tokenizer.from_pretrained("gpt2-medium")
        
        self.t5_model = T5ForConditionalGeneration.from_pretrained("t5-base")
        self.t5_tokenizer = T5Tokenizer.from_pretrained("t5-base")
        
        self.bart_model = BartForConditionalGeneration.from_pretrained("facebook/bart-large")
        self.bart_tokenizer = BartTokenizer.from_pretrained("facebook/bart-large")
        
        # Move models to device
        self.gpt_model.to(self.device)
        self.t5_model.to(self.device)
        self.bart_model.to(self.device)
        
        # Initialize conversation context
        self.context = ConversationContext()
        
    def analyze_context(self, current_text: str, 
                       emotion_data: Dict[str, float]) -> ContextualUnderstanding:
        """
        Analyze emotional context of the conversation
        """
        try:
            # Update context
            self.context.add_interaction(current_text, emotion_data)
            
            # Generate emotional context understanding
            emotional_context = self._understand_emotional_context()
            
            # Extract key topics
            key_topics = self._extract_key_topics()
            
            # Analyze emotional trajectory
            trajectory = list(self.context.emotional_trajectory)
            
            # Generate conversation summary
            summary = self._generate_summary()
            
            # Generate response suggestions
            responses = self._generate_response_suggestions(
                emotional_context,
                emotion_data
            )
            
            # Identify emotional triggers
            triggers = self._identify_emotional_triggers()
            
            return ContextualUnderstanding(
                emotional_context=emotional_context,
                key_topics=key_topics,
                emotional_trajectory=trajectory,
                conversation_summary=summary,
                suggested_responses=responses,
                emotional_triggers=triggers,
                confidence=self._calculate_confidence()
            )
            
        except Exception as e:
            logger.error(f"Error in contextual analysis: {e}")
            return self._get_fallback_understanding()
            
    def _understand_emotional_context(self) -> str:
        """Generate emotional context understanding using GPT"""
        try:
            # Prepare conversation history
            history_text = " ".join(self.context.history)
            prompt = f"Analyze the emotional context of this conversation:\n{history_text}\n\nEmotional context:"
            
            inputs = self.gpt_tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.gpt_model.generate(
                    **inputs,
                    max_length=150,
                    num_return_sequences=1,
                    temperature=0.7,
                    pad_token_id=self.gpt_tokenizer.eos_token_id
                )
                
            context = self.gpt_tokenizer.decode(outputs[0], skip_special_tokens=True)
            return context.split("Emotional context:")[1].strip()
            
        except Exception as e:
            logger.error(f"Error understanding emotional context: {e}")
            return "Neutral conversation context"
            
    def _extract_key_topics(self) -> List[str]:
        """Extract key conversation topics using T5"""
        try:
            history_text = " ".join(self.context.history)
            prompt = f"summarize key topics: {history_text}"
            
            inputs = self.t5_tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.t5_model.generate(
                    **inputs,
                    max_length=50,
                    num_return_sequences=1
                )
                
            topics_text = self.t5_tokenizer.decode(outputs[0], skip_special_tokens=True)
            return [topic.strip() for topic in topics_text.split(",")]
            
        except Exception as e:
            logger.error(f"Error extracting topics: {e}")
            return ["general conversation"]
            
    def _generate_summary(self) -> str:
        """Generate conversation summary using BART"""
        try:
            history_text = " ".join(self.context.history)
            inputs = self.bart_tokenizer(history_text, return_tensors="pt", max_length=1024, truncation=True)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.bart_model.generate(
                    **inputs,
                    max_length=150,
                    num_return_sequences=1,
                    length_penalty=2.0,
                    num_beams=4
                )
                
            return self.bart_tokenizer.decode(outputs[0], skip_special_tokens=True)
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return "Conversation summary unavailable"
            
    def _generate_response_suggestions(self, context: str, 
                                    emotion_data: Dict[str, float]) -> List[str]:
        """Generate contextually appropriate response suggestions"""
        try:
            # Prepare prompt with context and emotion
            primary_emotion = max(emotion_data.items(), key=lambda x: x[1])[0]
            prompt = f"Context: {context}\nEmotion: {primary_emotion}\nGenerate appropriate responses:"
            
            inputs = self.gpt_tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.gpt_model.generate(
                    **inputs,
                    max_length=100,
                    num_return_sequences=3,
                    temperature=0.8,
                    do_sample=True,
                    top_k=50,
                    top_p=0.95
                )
                
            responses = [
                self.gpt_tokenizer.decode(output, skip_special_tokens=True)
                for output in outputs
            ]
            
            return responses
            
        except Exception as e:
            logger.error(f"Error generating responses: {e}")
            return ["I understand.", "Tell me more.", "I'm here to listen."]
            
    def _identify_emotional_triggers(self) -> List[str]:
        """Identify potential emotional triggers from context"""
        triggers = []
        for word, emotions in self.context.triggers.items():
            # Calculate average emotion intensity for the trigger
            avg_intensity = sum(intensity for _, intensity in emotions) / len(emotions)
            if avg_intensity > 0.6:  # Only include strong triggers
                triggers.append(word)
        return triggers
        
    def _calculate_confidence(self) -> float:
        """Calculate confidence in contextual understanding"""
        # Factors affecting confidence:
        # 1. Amount of context available
        # 2. Consistency of emotional trajectory
        # 3. Clarity of topics
        
        context_factor = min(len(self.context.history) / 5, 1.0)  # Max confidence at 5+ interactions
        
        # Calculate emotional consistency
        if len(self.context.emotional_trajectory) > 1:
            variations = []
            for i in range(1, len(self.context.emotional_trajectory)):
                prev = self.context.emotional_trajectory[i-1]
                curr = self.context.emotional_trajectory[i]
                variation = sum((prev[k] - curr[k])**2 for k in prev.keys())
                variations.append(variation)
            consistency = 1.0 - min(sum(variations) / len(variations), 1.0)
        else:
            consistency = 0.5
            
        topic_clarity = min(len(self.context.topics) / 10, 1.0)  # Max confidence at 10+ topics
        
        return (context_factor * 0.4 + consistency * 0.4 + topic_clarity * 0.2)
        
    def _get_fallback_understanding(self) -> ContextualUnderstanding:
        """Return fallback understanding when analysis fails"""
        return ContextualUnderstanding(
            emotional_context="General conversation",
            key_topics=["conversation"],
            emotional_trajectory=[],
            conversation_summary="Recent conversation",
            suggested_responses=["I understand.", "Tell me more.", "I'm here to listen."],
            emotional_triggers=[],
            confidence=0.5
        )
