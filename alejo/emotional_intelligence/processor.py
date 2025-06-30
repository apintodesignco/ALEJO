"""Emotional Processor Module for ALEJO

Handles emotional analysis, sentiment processing, and emotional response generation
using advanced NLP and machine learning techniques. Enhanced with humor detection,
personality adaptation, and nuanced emotional understanding for more lifelike interactions.
"""

from typing import Dict, List, Any, Optional, Tuple
import logging
from datetime import datetime
import numpy as np
import torch
try:
    from textblob import TextBlob  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    class TextBlob:  # type: ignore
        """Minimal stub so tests can run without textblob installed."""
        def __init__(self, text):
            self.text = text
        @property
        def sentiment(self):
            return type("Sent", (), {"polarity": 0.0, "subjectivity": 0.0})()
from dataclasses import dataclass
from enum import Enum, auto

logger = logging.getLogger(__name__)

class PersonalityTrait(Enum):
    """Core personality traits that can be dynamically adjusted"""
    OPENNESS = auto()        # Curiosity and creativity
    CONSCIENTIOUSNESS = auto() # Organization and responsibility
    EXTRAVERSION = auto()     # Sociability and energy
    AGREEABLENESS = auto()    # Compassion and cooperation
    NEUROTICISM = auto()      # Emotional sensitivity
    HUMOR = auto()            # Wit and playfulness
    EMPATHY = auto()          # Emotional understanding
    ASSERTIVENESS = auto()    # Confidence and directness

@dataclass
class EmotionalState:
    """Comprehensive emotional state representation"""
    valence: float           # Positive/negative (-1 to 1)
    arousal: float          # Intensity/energy (0 to 1)
    dominance: float        # Control/influence (0 to 1)
    primary_emotion: str    # Main emotion detected
    emotion_scores: Dict[str, float]  # All emotion probabilities
    confidence: float       # Confidence in assessment
    context_relevance: float # How well emotion fits context
    
@dataclass
class InteractionStyle:
    """Defines how ALEJO should interact based on context"""
    formality_level: float  # 0=casual to 1=formal
    humor_level: float      # 0=serious to 1=playful
    complexity_level: float # 0=simple to 1=sophisticated
    empathy_level: float   # 0=neutral to 1=highly empathetic
    response_speed: float  # 0=thoughtful to 1=quick

class EmotionalProcessor:
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the emotional processor with necessary models and state"""
        self.config = config or {}
        self._init_models()
        
        # Initialize personality and interaction state
        self.personality_state = {trait: 0.5 for trait in PersonalityTrait}
        self.current_interaction = InteractionStyle(
            formality_level=0.5,
            humor_level=0.5,
            complexity_level=0.5,
            empathy_level=0.7,  # Default to slightly more empathetic
            response_speed=0.5
        )
        
        # Initialize context tracking
        self.conversation_history = []
        self.emotional_memory = {}
        self.humor_patterns = self._load_humor_patterns()
        
        logger.info("Enhanced Emotional Processor initialized")

    def _init_models(self):
        """Initialize required NLP models"""
        try:
            from transformers import pipeline  # Local import to avoid startup errors

            # Core emotion models
            self.sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                device=0 if torch.cuda.is_available() else -1
            )
            self.emotion_classifier = pipeline(
                "text-classification",
                model="j-hartmann/emotion-english-distilroberta-base",
                device=0 if torch.cuda.is_available() else -1
            )
            
            # Enhanced understanding models
            self.humor_classifier = pipeline(
                "text-classification",
                model="facebook/bart-large-mnli",  # Zero-shot classification
                device=0 if torch.cuda.is_available() else -1
            )
            self.sarcasm_detector = pipeline(
                "text-classification",
                model="microsoft/deberta-v3-base",  # Fine-tuned for sarcasm
                device=0 if torch.cuda.is_available() else -1
            )
            self.personality_analyzer = pipeline(
                "text-classification",
                model="facebook/bart-large-mnli",  # Zero-shot for personality traits
                device=0 if torch.cuda.is_available() else -1
            )
            
            logger.info("All NLP models initialized successfully")
        except (ImportError, RuntimeError) as e:
            logger.error(f"Failed to load transformers pipeline: {e}. Using fallback.", exc_info=True)
            self._init_fallback_models()

    def analyze_sentiment(self, text: str, context: Optional[Dict[str, Any]] = None) -> EmotionalState:
        """
        Analyze the sentiment of text using multiple metrics and context awareness
        Returns a comprehensive EmotionalState including humor and personality insights
        
        Args:
            text: The text to analyze
            context: Optional context about the conversation or situation
        """
        # Get basic sentiment
        sentiment_result = self.sentiment_analyzer(text)[0]
        base_score = sentiment_result['score']
        is_positive = sentiment_result['label'] == 'POSITIVE'
        
        # Get detailed sentiment
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity
        subjectivity = blob.sentiment.subjectivity
        
        # Calculate emotional dimensions
        valence = (base_score if is_positive else -base_score + 1) * 0.5
        arousal = abs(polarity) * subjectivity
        dominance = self._calculate_dominance(text)
        
        # Get comprehensive emotion analysis
        emotions = self._classify_emotions(text)
        primary_emotion = max(emotions.items(), key=lambda x: x[1])[0]
        
        # Analyze humor and context
        humor_score = self._detect_humor(text)
        sarcasm_score = self._detect_sarcasm(text)
        context_relevance = self._evaluate_context_relevance(text, context)
        
        # Update interaction style based on analysis
        self._update_interaction_style(
            emotions, humor_score, sarcasm_score, context
        )
        
        # Create comprehensive emotional state
        state = EmotionalState(
            valence=valence,
            arousal=arousal,
            dominance=dominance,
            primary_emotion=primary_emotion,
            emotion_scores=emotions,
            confidence=base_score,
            context_relevance=context_relevance
        )
        
        # Update emotional memory
        self._update_emotional_memory(state, context)
        
        return state

    def _load_humor_patterns(self) -> Dict[str, List[str]]:
        """Load patterns and indicators for humor detection"""
        return {
            "wordplay": ["pun", "play on words", "double meaning"],
            "irony": ["ironic", "irony", "contrary to"],
            "sarcasm": ["obviously", "clearly", "surely", "right"],
            "exaggeration": ["always", "never", "totally", "absolutely"],
            "self_deprecation": ["im so good at", "im the best at", "watch me fail"],
            "cultural_reference": ["like that time", "reminds me of", "just like in"],
            "absurdity": ["imagine if", "what if", "picture this"],
            "misdirection": ["speaking of", "that reminds me", "by the way"],
            "callback": ["earlier", "remember when", "as mentioned"],
            "timing": ["pause", "...", "wait for it"]
        }

    def _detect_humor(self, text: str) -> float:
        """Detect presence and type of humor in text"""
        try:
            # Check for humor patterns
            pattern_scores = []
            for category, patterns in self.humor_patterns.items():
                matches = sum(1 for p in patterns if p.lower() in text.lower())
                if matches:
                    pattern_scores.append(matches / len(patterns))

            # Use zero-shot classification for humor types
            humor_types = [
                "joke", "wordplay", "sarcasm", "irony",
                "exaggeration", "self-deprecation"
            ]
            classifier_result = self.humor_classifier(
                text,
                candidate_labels=humor_types,
                hypothesis_template="This text contains {}"
            )
            
            # Combine pattern matching and classification scores
            base_score = max(classifier_result["scores"])
            pattern_score = max(pattern_scores) if pattern_scores else 0.0
            
            return (base_score + pattern_score) / 2
        except Exception as e:
            logger.warning(f"Error in humor detection: {e}")
            return 0.0

    def _detect_sarcasm(self, text: str) -> float:
        """Detect presence and intensity of sarcasm"""
        try:
            result = self.sarcasm_detector(text)[0]
            return result["score"] if result["label"] == "SARCASM" else 0.0
        except Exception as e:
            logger.warning(f"Error in sarcasm detection: {e}")
            return 0.0

    def _evaluate_context_relevance(self, text: str, context: Optional[Dict[str, Any]] = None) -> float:
        """Evaluate how well the emotional content fits the conversation context"""
        if not context:
            return 1.0  # No context to evaluate against
            
        relevance_score = 1.0
        
        # Check topic consistency
        if "current_topic" in context:
            topic_words = set(context["current_topic"].lower().split())
            text_words = set(text.lower().split())
            topic_overlap = len(topic_words & text_words) / len(topic_words)
            relevance_score *= (0.5 + topic_overlap/2)  # Scale to 0.5-1.0
        
        # Check emotional consistency
        if "previous_emotion" in context:
            prev_emotion = context["previous_emotion"]
            curr_emotions = self._classify_emotions(text)
            emotion_consistency = curr_emotions.get(prev_emotion, 0.1)
            relevance_score *= (0.7 + emotion_consistency * 0.3)  # Scale to 0.7-1.0
        
        # Check conversation flow
        if "conversation_history" in context:
            # Simple check for thematic continuity
            history = context["conversation_history"][-3:]  # Last 3 exchanges
            continuity_score = self._calculate_thematic_continuity(text, history)
            relevance_score *= (0.8 + continuity_score * 0.2)  # Scale to 0.8-1.0
        
        return relevance_score

    def _update_interaction_style(self, emotions: Dict[str, float], humor_score: float,
                                sarcasm_score: float, context: Optional[Dict[str, Any]] = None) -> None:
        """Update the interaction style based on emotional analysis"""
        # Base adjustments on emotional content
        if emotions["joy"] > 0.6:
            self.current_interaction.humor_level = min(1.0, self.current_interaction.humor_level + 0.1)
            self.current_interaction.formality_level = max(0.2, self.current_interaction.formality_level - 0.1)
        elif emotions["sadness"] > 0.6 or emotions["fear"] > 0.6:
            self.current_interaction.empathy_level = min(1.0, self.current_interaction.empathy_level + 0.2)
            self.current_interaction.humor_level = max(0.2, self.current_interaction.humor_level - 0.1)
        
        # Adjust based on humor and sarcasm
        if humor_score > 0.7:
            self.current_interaction.humor_level = min(1.0, self.current_interaction.humor_level + 0.15)
        if sarcasm_score > 0.7:
            self.current_interaction.complexity_level = min(1.0, self.current_interaction.complexity_level + 0.1)
        
        # Consider context for adjustments
        if context and "user_preferences" in context:
            prefs = context["user_preferences"]
            if "preferred_formality" in prefs:
                target = float(prefs["preferred_formality"])
                self.current_interaction.formality_level = (
                    self.current_interaction.formality_level * 0.7 + target * 0.3
                )

    def _update_emotional_memory(self, state: EmotionalState, context: Optional[Dict[str, Any]] = None) -> None:
        """Update emotional memory with new state and context"""
        timestamp = datetime.now().isoformat()
        
        # Create memory entry
        memory_entry = {
            "timestamp": timestamp,
            "emotional_state": state,
            "interaction_style": self.current_interaction,
            "context": context
        }
        
        # Store in memory with recency-based pruning
        self.conversation_history.append(memory_entry)
        if len(self.conversation_history) > 100:  # Keep last 100 interactions
            self.conversation_history.pop(0)
        
        # Update emotional patterns
        if context and "user_id" in context:
            user_id = context["user_id"]
            if user_id not in self.emotional_memory:
                self.emotional_memory[user_id] = []
            self.emotional_memory[user_id].append({
                "timestamp": timestamp,
                "primary_emotion": state.primary_emotion,
                "valence": state.valence,
                "context_type": context.get("type", "general")
            })

    def _calculate_thematic_continuity(self, text: str, history: List[str]) -> float:
        """Calculate thematic continuity between current text and conversation history"""
        if not history:
            return 1.0
            
        # Use TextBlob for simple keyword extraction
        current_blob = TextBlob(text)
        current_words = set(word.lower() for word in current_blob.words)
        
        # Calculate overlap with history
        total_overlap = 0.0
        for i, prev_text in enumerate(history, 1):
            prev_blob = TextBlob(prev_text)
            prev_words = set(word.lower() for word in prev_blob.words)
            overlap = len(current_words & prev_words) / len(current_words | prev_words)
            total_overlap += overlap * (i / len(history))  # Weight recent messages more
            
        return min(1.0, total_overlap)

    def _classify_emotions(self, text: str) -> Dict[str, float]:
        """Classify emotions present in the text with enhanced granularity"""
        try:
            # Get base emotion classification
            emotion_result = self.emotion_classifier(text)[0]
            emotion_label = emotion_result["label"]
            confidence = emotion_result["score"]
            
            # Initialize with more nuanced emotions
            emotions = {
                "joy": 0.1,
                "contentment": 0.1,
                "excitement": 0.1,
                "sadness": 0.1,
                "melancholy": 0.1,
                "anger": 0.1,
                "frustration": 0.1,
                "fear": 0.1,
                "anxiety": 0.1,
                "surprise": 0.1,
                "wonder": 0.1,
                "confusion": 0.1,
                "trust": 0.1,
                "anticipation": 0.1
            }
            
            # Update primary emotion
            if emotion_label in emotions:
                emotions[emotion_label] = confidence
            
            # Infer related emotions
            self._infer_related_emotions(emotions, text)
            
            return emotions
        except Exception as e:
            logger.error(f"Error in emotion classification: {e}")
            return {k: 0.1 for k in ["joy", "sadness", "anger", "fear", "surprise"]}
    
    def _infer_related_emotions(self, emotions: Dict[str, float], text: str) -> None:
        """Infer related emotions based on primary emotion and context"""
        # Update contentment based on joy and absence of high arousal
        if emotions["joy"] > 0.6 and emotions["excitement"] < 0.4:
            emotions["contentment"] = (emotions["joy"] + (1 - emotions["excitement"])) / 2
        
        # Update melancholy based on sadness quality
        if emotions["sadness"] > 0.4:
            blob = TextBlob(text)
            if blob.sentiment.subjectivity < 0.5:  # More objective/reflective
                emotions["melancholy"] = emotions["sadness"] * 0.8
        
        # Update frustration based on anger and context
        if emotions["anger"] > 0.4:
            if "cant" in text.lower() or "cannot" in text.lower() or "impossible" in text.lower():
                emotions["frustration"] = emotions["anger"] * 0.9
        
        # Update anxiety based on fear and uncertainty markers
        if emotions["fear"] > 0.3:
            uncertainty_markers = ["maybe", "perhaps", "might", "could", "what if"]
            if any(marker in text.lower() for marker in uncertainty_markers):
                emotions["anxiety"] = max(emotions["fear"] * 0.8, emotions.get("anxiety", 0))
        
        # Update wonder based on surprise and positive sentiment
        if emotions["surprise"] > 0.4:
            blob = TextBlob(text)
            if blob.sentiment.polarity > 0:
                emotions["wonder"] = emotions["surprise"] * blob.sentiment.polarity
    
    def _init_fallback_models(self) -> None:
        """Initialize basic fallback models when enhanced models fail"""
        try:
            # Only initialize basic sentiment analysis
            self.sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                device=0 if torch.cuda.is_available() else -1
            )
            logger.info("Initialized fallback sentiment analyzer")
            
            # Set other models to None and use rule-based fallbacks
            self.emotion_classifier = None
            self.humor_classifier = None
            self.sarcasm_detector = None
            self.personality_analyzer = None
            
        except Exception as e:
            logger.error(f"Failed to initialize even fallback models: {e}")
            raise
    
    def get_interaction_recommendation(self, state: EmotionalState,
                                     context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate recommendations for how ALEJO should interact based on emotional state"""
        recommendation = {
            "tone": self._determine_tone(state),
            "complexity": self._determine_complexity(state, context),
            "response_type": self._determine_response_type(state),
            "empathy_level": self._calculate_empathy_need(state),
            "suggested_features": self._suggest_features(state, context)
        }
        
        if context and "user_history" in context:
            recommendation["personalization"] = self._get_personalization_hints(context["user_history"])
        
        return recommendation
    
    def _determine_tone(self, state: EmotionalState) -> str:
        """Determine appropriate tone for response"""
        if state.valence < 0.3:  # Negative emotional state
            if state.arousal > 0.7:  # High intensity
                return "calming"
            return "supportive"
        elif state.valence > 0.7:  # Very positive
            if state.arousal > 0.7:
                return "enthusiastic"
            return "warm"
        return "neutral"
    
    def _determine_complexity(self, state: EmotionalState,
                            context: Optional[Dict[str, Any]] = None) -> float:
        """Determine appropriate complexity level for responses"""
        base_complexity = 0.5
        
        # Reduce complexity for high emotional states
        if state.arousal > 0.8:
            base_complexity *= 0.7
        
        # Consider user preferences if available
        if context and "user_preferences" in context:
            prefs = context["user_preferences"]
            if "preferred_complexity" in prefs:
                target = float(prefs["preferred_complexity"])
                base_complexity = base_complexity * 0.3 + target * 0.7
        
        return min(1.0, max(0.2, base_complexity))
    
    def _determine_response_type(self, state: EmotionalState) -> str:
        """Determine appropriate type of response"""
        if state.primary_emotion == "confusion":
            return "clarifying"
        elif state.primary_emotion in ["sadness", "fear", "anxiety"]:
            return "supportive"
        elif state.primary_emotion in ["joy", "excitement"]:
            return "encouraging"
        elif state.primary_emotion == "anger":
            return "deescalating"
        return "informative"
    
    def _calculate_empathy_need(self, state: EmotionalState) -> float:
        """Calculate how much empathy should be expressed in response"""
        # Higher empathy for negative emotions and high arousal
        base_empathy = 0.5
        
        if state.valence < 0.4:  # Negative emotions
            base_empathy += (0.4 - state.valence)
        
        if state.arousal > 0.6:  # High intensity emotions
            base_empathy += (state.arousal - 0.6) * 0.5
        
        return min(1.0, base_empathy)
    
    def _suggest_features(self, state: EmotionalState,
                         context: Optional[Dict[str, Any]] = None) -> List[str]:
        """Suggest ALEJO features that might be helpful in current state"""
        suggestions = []
        
        if state.primary_emotion == "confusion":
            suggestions.extend(["detailed_explanations", "step_by_step_guidance"])
        
        if state.arousal > 0.7:
            suggestions.append("calming_visualization")
        
        if state.primary_emotion in ["sadness", "fear"]:
            suggestions.extend(["emotional_support", "positive_memory_recall"])
        
        if state.primary_emotion == "joy":
            suggestions.extend(["celebration_animation", "positive_reinforcement"])
        
        return suggestions
    
    def _get_personalization_hints(self, user_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate personalization hints based on user history"""
        if not user_history:
            return {}
            
        # Analyze emotional patterns
        emotion_frequencies = {}
        total_interactions = len(user_history)
        
        for interaction in user_history:
            if "primary_emotion" in interaction:
                emotion = interaction["primary_emotion"]
                emotion_frequencies[emotion] = emotion_frequencies.get(emotion, 0) + 1
        
        # Calculate dominant emotional patterns
        dominant_emotions = sorted(
            emotion_frequencies.items(),
            key=lambda x: x[1],
            reverse=True
        )[:2]
        
        return {
            "dominant_emotions": [e[0] for e in dominant_emotions],
            "emotional_volatility": self._calculate_volatility(user_history),
            "preferred_interaction_style": self._infer_preferred_style(user_history)
        }
    
    def _calculate_volatility(self, history: List[Dict[str, Any]]) -> float:
        """Calculate emotional volatility from history"""
        if len(history) < 2:
            return 0.0
            
        changes = []
        for i in range(1, len(history)):
            if "valence" in history[i] and "valence" in history[i-1]:
                change = abs(history[i]["valence"] - history[i-1]["valence"])
                changes.append(change)
        
        return sum(changes) / len(changes) if changes else 0.0
    
    def _infer_preferred_style(self, history: List[Dict[str, Any]]) -> str:
        """Infer user's preferred interaction style"""
        # Count positive responses to different styles
        style_responses = {
            "formal": 0,
            "casual": 0,
            "humorous": 0,
            "direct": 0
        }
        
        for interaction in history:
            if "user_response" in interaction and "style_used" in interaction:
                if interaction["user_response"] == "positive":
                    style = interaction["style_used"]
                    if style in style_responses:
                        style_responses[style] += 1
        
        # Return most successful style
        return max(style_responses.items(), key=lambda x: x[1])[0] if style_responses else "casual"

    def _classify_emotions(self, text: str) -> Dict[str, float]:
        """Classify emotions present in the text with enhanced granularity."""
        try:
            emotions = {}
            # Use transformer model for emotion classification
            if hasattr(self, 'emotion_classifier'):
                emotions = self.emotion_classifier(text)
            else:
                # Fallback to basic sentiment analysis
                polarity = TextBlob(text).sentiment.polarity
                emotions = {
                    "joy": max(0, polarity),
                    "sadness": max(0, -polarity)
                }
            return emotions
        except Exception as e:
            logger.error(f"Error in emotion classification: {e}")
            return {
                "joy": 0.1,
                "sadness": 0.1,
                "anger": 0.1,
                "fear": 0.1,
                "surprise": 0.1
            }

    def _calculate_dominance(self, text: str) -> float:
        """Calculate dominance score based on linguistic features"""
        # Initialize base dominance score
        dominance_score = 0.5
        
        # Analyze sentence structure
        blob = TextBlob(text)
        
        # Check for command/imperative sentences
        imperative_indicators = ["must", "should", "need to", "have to", "will"]
        command_count = sum(1 for word in blob.words if word.lower() in imperative_indicators)
        
        # Check for confidence indicators
        confidence_indicators = ["certainly", "definitely", "absolutely", "surely", "confident"]
        confidence_count = sum(1 for word in blob.words if word.lower() in confidence_indicators)
        
        # Check for uncertainty indicators (reduce dominance)
        uncertainty_indicators = ["maybe", "perhaps", "possibly", "might", "could"]
        uncertainty_count = sum(1 for word in blob.words if word.lower() in uncertainty_indicators)
        
        # Adjust score based on indicators
        dominance_score += (command_count * 0.1)  # More commands = more dominant
        dominance_score += (confidence_count * 0.1)  # More confidence = more dominant
        dominance_score -= (uncertainty_count * 0.1)  # More uncertainty = less dominant
        
        # Consider sentence length and complexity
        avg_sentence_length = np.mean([len(sentence.words) for sentence in blob.sentences])
        if avg_sentence_length > 15:  # Longer, more complex sentences
            dominance_score += 0.1
        
        # Ensure score stays within bounds
        return max(0.0, min(1.0, dominance_score))

    def generate_emotional_response(self, input_text: str,
                                 context: Dict[str, Any],
                                 target_emotion: Optional[Dict[str, float]] = None) -> str:
        """Generate an emotionally appropriate response based on input and context"""
        # Analyze input emotion
        input_state = self.analyze_sentiment(input_text, context)
        
        # Get interaction recommendations
        interaction_style = self.get_interaction_recommendation(input_state, context)
        
        # Determine target emotional state if not provided
        if not target_emotion:
            target_emotion = self._determine_response_emotion(
                input_state.emotion_scores,
                context
            )
        
        # Generate response considering all factors
        response = self._generate_response(
            input_text=input_text,
            input_emotion=input_state.emotion_scores,
            target_emotion=target_emotion,
            interaction_style=interaction_style
        )
        
        return response

    def _calculate_dominance(self, text: str) -> float:
        """Calculate dominance score based on linguistic features"""
        # List of dominant language indicators
        dominant_words = {
            'must', 'should', 'will', 'going to', 'need to',
            'require', 'demand', 'order', 'command', 'direct'
        }
        
        # List of submissive language indicators
        submissive_words = {
            'maybe', 'perhaps', 'possibly', 'might', 'could',
            'would like', 'please', 'if possible', 'wonder'
        }
        
        text_lower = text.lower()
        
        # Count dominant and submissive indicators
        dominant_count = sum(1 for word in dominant_words if word in text_lower)
        submissive_count = sum(1 for word in submissive_words if word in text_lower)
        
        # Calculate base dominance score
        total_indicators = dominant_count + submissive_count
        if total_indicators == 0:
            base_dominance = 0.5
        else:
            base_dominance = dominant_count / total_indicators
        
        # Adjust for sentence structure and punctuation
        if '!' in text:
            base_dominance += 0.1
        if '?' in text:
            base_dominance -= 0.1
            
        return base_dominance
        # Analyze input emotion
        input_emotion = self.analyze_sentiment(input_text)
        
        # Get relationship context
        trust_level = context.get('trust_level', 0.5)
        rapport_level = context.get('rapport_level', 0.5)
        
        # Determine response emotion
        if target_emotion is None:
            target_emotion = self._determine_response_emotion(input_emotion, context)
        
        # Generate response using emotional context
        response = self._generate_response(input_text, input_emotion, 
                                        target_emotion, trust_level, rapport_level)
        
        return response

    def _determine_response_emotion(self, 
                                 input_emotion: Dict[str, float],
                                 context: Dict[str, Any]) -> Dict[str, float]:
        """Determine appropriate emotional response based on input and context"""
        # Start with neutral emotions
        response_emotion = {
            'valence': 0.5,
            'arousal': 0.5,
            'dominance': 0.5
        }
        
        # Adjust for input emotion (emotional mirroring with dampening)
        response_emotion['valence'] = (input_emotion['valence'] + 0.5) / 2
        response_emotion['arousal'] = input_emotion['arousal'] * 0.8
        
        # Adjust for relationship context
        trust_level = context.get('trust_level', 0.5)
        rapport_level = context.get('rapport_level', 0.5)
        
        # Higher trust/rapport leads to more emotional alignment
        emotional_alignment = (trust_level + rapport_level) / 2
        response_emotion['valence'] = (response_emotion['valence'] * emotional_alignment +
                                     0.5 * (1 - emotional_alignment))
        
        # Ensure values are within bounds
        for key in response_emotion:
            response_emotion[key] = max(0.0, min(1.0, response_emotion[key]))
        
        return response_emotion

    def _generate_response(self,
                         input_text: str,
                         input_emotion: Dict[str, float],
                         target_emotion: Dict[str, float],
                         trust_level: float,
                         rapport_level: float) -> str:
        """
        Generate an emotionally appropriate response
        This is a placeholder for more sophisticated response generation
        """
        # In a full implementation, this would use a language model
        # For now, we'll return a simple template-based response
        if target_emotion['valence'] > 0.7:
            response = "I'm very happy to hear that! "
        elif target_emotion['valence'] > 0.5:
            response = "That's good to know. "
        elif target_emotion['valence'] < 0.3:
            response = "I'm sorry to hear that. "
        else:
            response = "I understand. "
            
        if trust_level > 0.7 and rapport_level > 0.7:
            response += "I really appreciate you sharing that with me."
        elif trust_level > 0.5 and rapport_level > 0.5:
            response += "Thank you for telling me."
            
        return response

    def update_emotional_state(self,
                             current_state: Dict[str, float],
                             new_input: Dict[str, float],
                             learning_rate: float = 0.1) -> Dict[str, float]:
        """Update emotional state based on new input"""
        updated_state = {}
        for key in current_state:
            if key in new_input:
                updated_state[key] = current_state[key] + \
                                   learning_rate * (new_input[key] - current_state[key])
                updated_state[key] = max(0.0, min(1.0, updated_state[key]))
            else:
                updated_state[key] = current_state[key]
        return updated_state
