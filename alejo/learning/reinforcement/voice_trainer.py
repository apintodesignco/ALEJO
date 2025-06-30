"""
Voice-based Reinforcement Learning Module for ALEJO

Implements a human-in-the-loop reinforcement learning system that uses
voice feedback to improve ALEJO's responses and behavior.
"""

import logging
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import asyncio
import speech_recognition as sr
import numpy as np
from datetime import datetime

from ...emotional_intelligence.processor import EmotionalProcessor
from ...emotional_intelligence.memory import EmotionalMemory
from ...llm_client import LLMClientFactory, LLMResponse

logger = logging.getLogger(__name__)

@dataclass
class FeedbackSignal:
    """Represents a feedback signal from voice input"""
    timestamp: str
    response_id: str
    feedback_type: str  # positive, negative, neutral
    feedback_text: str
    context: Dict[str, Any]
    emotional_valence: float
    confidence: float

class VoiceTrainer:
    """Handles voice-based reinforcement learning for ALEJO"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize voice trainer"""
        self.config = config or {}
        self.feedback_dir = Path(self.config.get('feedback_dir', 'training_data/feedback'))
        self.feedback_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize components
        self.recognizer = sr.Recognizer()
        self.emotional_processor = EmotionalProcessor(config)
        self.emotional_memory = EmotionalMemory(config)
        self.llm_client = LLMClientFactory.create_client(config)
        
        # Load feedback patterns
        self.feedback_patterns = {
            'positive': [
                'good', 'correct', 'right', 'yes', 'nice', 'well done',
                'perfect', 'excellent', 'great', 'awesome'
            ],
            'negative': [
                'bad', 'wrong', 'incorrect', 'no', 'mean', 'inappropriate',
                'stop', 'terrible', 'poor', 'unacceptable'
            ],
            'neutral': [
                'okay', 'maybe', 'perhaps', 'not sure', 'uncertain',
                'possibly', 'somewhat'
            ]
        }
        
    async def start_listening(self):
        """Start listening for voice feedback"""
        logger.info("Starting voice feedback listener...")
        
        with sr.Microphone() as source:
            # Adjust for ambient noise
            self.recognizer.adjust_for_ambient_noise(source)
            
            while True:
                try:
                    audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=10)
                    text = self.recognizer.recognize_google(audio)
                    
                    if text:
                        await self.process_feedback(text)
                        
                except sr.WaitTimeoutError:
                    continue
                except sr.UnknownValueError:
                    logger.debug("Could not understand audio")
                except sr.RequestError as e:
                    logger.error(f"Error with speech recognition service: {e}")
                except Exception as e:
                    logger.error(f"Unexpected error in voice listener: {e}")
                    
    async def process_feedback(self, feedback_text: str) -> Optional[FeedbackSignal]:
        """Process voice feedback and generate a feedback signal"""
        try:
            # Analyze feedback type
            feedback_type = self._classify_feedback(feedback_text.lower())
            if not feedback_type:
                return None
                
            # Get emotional valence from processor
            emotional_response = await self.emotional_processor.process_input(feedback_text)
            
            # Create feedback signal
            signal = FeedbackSignal(
                timestamp=datetime.now().isoformat(),
                response_id=self.config.get('current_response_id'),
                feedback_type=feedback_type,
                feedback_text=feedback_text,
                context=self.config.get('current_context', {}),
                emotional_valence=emotional_response.valence,
                confidence=emotional_response.confidence
            )
            
            # Save feedback
            await self._save_feedback(signal)
            
            # Update emotional memory
            await self._update_emotional_memory(signal)
            
            return signal
            
        except Exception as e:
            logger.error(f"Error processing feedback: {e}")
            return None
            
    def _classify_feedback(self, text: str) -> Optional[str]:
        """Classify feedback text into positive, negative, or neutral"""
        # Check each category
        for feedback_type, patterns in self.feedback_patterns.items():
            if any(pattern in text for pattern in patterns):
                return feedback_type
                
        return None
        
    async def _save_feedback(self, signal: FeedbackSignal):
        """Save feedback signal to disk"""
        file_path = self.feedback_dir / f"feedback_{signal.timestamp}.json"
        with open(file_path, 'w') as f:
            json.dump(signal.__dict__, f, indent=2)
            
    async def _update_emotional_memory(self, signal: FeedbackSignal):
        """Update emotional memory based on feedback"""
        memory_entry = {
            'context': signal.context,
            'feedback': signal.feedback_text,
            'emotional_impact': signal.emotional_valence,
            'feedback_type': signal.feedback_type
        }
        
        await self.emotional_memory.store_memory(memory_entry)
        
    async def apply_feedback(self, signal: FeedbackSignal):
        """Apply feedback to improve future responses"""
        # Create a learning prompt
        prompt = [
            {
                'role': 'system',
                'content': 'You are helping ALEJO learn from human feedback.'
            },
            {
                'role': 'user',
                'content': f"""
                Context: {json.dumps(signal.context)}
                Human feedback: {signal.feedback_text}
                Feedback type: {signal.feedback_type}
                Emotional valence: {signal.emotional_valence}
                
                Based on this feedback, what should ALEJO learn? How should future responses
                be adjusted? Provide specific actionable guidance.
                """
            }
        ]
        
        # Get learning guidance from LLM
        response = await self.llm_client.generate_chat_response(prompt)
        
        # Parse learning guidance
        learning_guidance = response.content
        
        # Update response templates and behavior patterns
        template_updates = await self._update_response_templates(signal, learning_guidance)
        
        # Adjust emotional weights based on feedback
        emotion_updates = await self._adjust_emotional_weights(signal)
        
        # Update ethical guidelines if needed
        ethics_updates = await self._update_ethical_guidelines(signal, learning_guidance)
        
        # Store the learning outcome
        learning_outcome = {
            'timestamp': datetime.now().isoformat(),
            'feedback_id': signal.response_id,
            'template_updates': template_updates,
            'emotion_updates': emotion_updates,
            'ethics_updates': ethics_updates,
            'guidance': learning_guidance
        }
        
        # Save learning outcome
        outcome_path = self.feedback_dir / f"learning_{signal.timestamp}.json"
        with open(outcome_path, 'w') as f:
            json.dump(learning_outcome, f, indent=2)
        
        logger.info(f"Applied feedback: {signal.feedback_text}")
        return learning_guidance
        
    async def _update_response_templates(self, signal: FeedbackSignal, guidance: str) -> Dict[str, Any]:
        """Update response templates based on feedback"""
        context = signal.context
        feedback_type = signal.feedback_type
        
        # Extract relevant context features
        context_type = context.get('type', 'general')
        interaction_mode = context.get('interaction_mode', 'normal')
        
        # Define template adjustments based on feedback
        template_updates = {
            'context_type': context_type,
            'interaction_mode': interaction_mode,
            'adjustments': []
        }
        
        if feedback_type == 'positive':
            # Reinforce successful patterns
            template_updates['adjustments'].append({
                'type': 'reinforce',
                'pattern': context.get('response_pattern'),
                'weight': 1.2
            })
        elif feedback_type == 'negative':
            # Reduce likelihood of problematic patterns
            template_updates['adjustments'].append({
                'type': 'suppress',
                'pattern': context.get('response_pattern'),
                'weight': 0.8
            })
        
        return template_updates
        
    async def _adjust_emotional_weights(self, signal: FeedbackSignal) -> Dict[str, float]:
        """Adjust emotional response weights based on feedback"""
        # Get current emotional state
        current_state = await self.emotional_processor.get_emotional_state()
        
        # Calculate adjustment factors
        base_adjustment = 0.1
        valence_factor = signal.emotional_valence
        confidence_factor = signal.confidence
        
        # Compute adjustments for each emotion dimension
        adjustments = {
            'valence': current_state.get('valence', 0.0) + (base_adjustment * valence_factor),
            'arousal': current_state.get('arousal', 0.0),
            'dominance': current_state.get('dominance', 0.0)
        }
        
        # Apply confidence weighting
        adjustments = {k: v * confidence_factor for k, v in adjustments.items()}
        
        # Ensure values stay within valid range [-1, 1]
        adjustments = {k: max(-1.0, min(1.0, v)) for k, v in adjustments.items()}
        
        # Update emotional processor
        await self.emotional_processor.update_emotional_state(adjustments)
        
        return adjustments
        
    async def _update_ethical_guidelines(self, signal: FeedbackSignal, guidance: str) -> Dict[str, Any]:
        """Update ethical guidelines based on feedback"""
        # Initialize updates
        updates = {
            'modified_rules': [],
            'new_rules': [],
            'priority_adjustments': []
        }
        
        # Extract ethical implications from feedback
        if signal.feedback_type == 'negative':
            # Analyze context for potential ethical issues
            ethical_analysis = await self.llm_client.generate_chat_response([
                {
                    'role': 'system',
                    'content': 'Analyze the ethical implications of this feedback.'
                },
                {
                    'role': 'user',
                    'content': f"""
                    Context: {json.dumps(signal.context)}
                    Feedback: {signal.feedback_text}
                    Guidance: {guidance}
                    
                    What ethical principles or guidelines should be updated based on this feedback?
                    Provide specific recommendations.
                    """
                }
            ])
            
            # Parse recommendations and update guidelines
            if ethical_analysis.content:
                updates['new_rules'].append({
                    'source': 'feedback',
                    'context': signal.context,
                    'rule': ethical_analysis.content,
                    'priority': 'high' if signal.confidence > 0.8 else 'medium'
                })
        
        return updates
        
    async def generate_learning_report(self) -> Dict[str, Any]:
        """Generate a report of learning progress"""
        # Load all feedback signals
        signals = []
        for file in self.feedback_dir.glob('feedback_*.json'):
            with open(file, 'r') as f:
                data = json.load(f)
                signals.append(FeedbackSignal(**data))
                
        # Analyze feedback patterns
        total = len(signals)
        if total == 0:
            return {'status': 'No feedback data available'}
            
        positive = len([s for s in signals if s.feedback_type == 'positive'])
        negative = len([s for s in signals if s.feedback_type == 'negative'])
        neutral = len([s for s in signals if s.feedback_type == 'neutral'])
        
        avg_confidence = np.mean([s.confidence for s in signals])
        avg_valence = np.mean([s.emotional_valence for s in signals])
        
        return {
            'total_feedback': total,
            'positive_ratio': positive / total,
            'negative_ratio': negative / total,
            'neutral_ratio': neutral / total,
            'average_confidence': avg_confidence,
            'average_emotional_valence': avg_valence,
            'timestamp': datetime.now().isoformat()
        }
