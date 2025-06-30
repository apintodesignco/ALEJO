"""
Emotional Response Generator Plugin for ALEJO
Generates personalized responses based on user emotional state
"""
import logging
from typing import Dict, Any, List, Optional
import random

# Plugin metadata
PLUGIN_NAME = "emotional_response_generator"
PLUGIN_VERSION = "1.0.0"
PLUGIN_DESCRIPTION = "Generates personalized responses based on emotional context"
PLUGIN_AUTHOR = "ALEJO Development Team"
PLUGIN_DEPENDENCIES = {
    "sentiment_analyzer": ">=1.0.0",
    "text_summarizer": ">=1.0.0"
}
PLUGIN_REQUIRES_ALEJO = "0.1.0"
PLUGIN_TAGS = ["nlp", "emotional_intelligence", "personalization", "response_generation"]

logger = logging.getLogger(__name__)

class EmotionalResponseGenerator:
    """
    Production-ready emotional response generator that creates personalized
    responses based on the user's emotional state and interaction history.
    Integrates with ALEJO's emotional intelligence components.
    """
    
    def __init__(self):
        """Initialize the emotional response generator"""
        self.response_templates = {
            # Joy responses
            "joy": [
                "I'm glad to hear you're feeling positive! {message}",
                "That's wonderful! {message}",
                "I'm happy that you're in good spirits. {message}",
                "It's great to share in your positive energy. {message}",
                "Your happiness is contagious! {message}"
            ],
            
            # Sadness responses
            "sadness": [
                "I understand this might be difficult. {message}",
                "I'm here for you during this challenging time. {message}",
                "It's okay to feel this way. {message}",
                "I appreciate you sharing these feelings with me. {message}",
                "Let me know how I can support you better. {message}"
            ],
            
            # Anger responses
            "anger": [
                "I understand this is frustrating. {message}",
                "I hear your concern. {message}",
                "Let's work through this together. {message}",
                "I appreciate you expressing how you feel. {message}",
                "Your feelings are valid. {message}"
            ],
            
            # Fear/anxiety responses
            "fear": [
                "It's okay to feel uncertain sometimes. {message}",
                "I'm here to help with any concerns. {message}",
                "We can take this one step at a time. {message}",
                "Let's explore this together. {message}",
                "I understand this might feel overwhelming. {message}"
            ],
            
            # Surprise responses
            "surprise": [
                "That's quite unexpected! {message}",
                "How interesting! {message}",
                "I didn't see that coming either. {message}",
                "That's certainly noteworthy. {message}",
                "What an interesting development! {message}"
            ],
            
            # Neutral/default responses
            "neutral": [
                "{message}",
                "I understand. {message}",
                "I see. {message}",
                "That makes sense. {message}",
                "I follow what you're saying. {message}"
            ]
        }
        
        # Relationship-based response modifiers
        self.relationship_modifiers = {
            "new": {
                "prefix": [""],
                "suffix": ["Is there anything else you'd like to know?", 
                          "I'm here to assist you.", 
                          "Please let me know if you need anything else."]
            },
            "familiar": {
                "prefix": ["As we've discussed before, ", "Building on our previous conversations, "],
                "suffix": ["I hope that helps.", "Let me know if you need more information."]
            },
            "established": {
                "prefix": ["As you know, ", "Given our history, "],
                "suffix": ["I thought you might appreciate this perspective.", 
                          "Based on what I know about your preferences."]
            }
        }
        
        # Initialize with default emotional intelligence components
        # These will be replaced with actual instances when generate_response is called
        self._emotional_memory = None
        self._emotional_processor = None
        self._ethical_framework = None
        
    async def generate_response(self, 
                               message: str, 
                               emotional_context: Optional[Dict[str, Any]] = None,
                               emotional_memory = None,
                               emotional_processor = None,
                               ethical_framework = None) -> Dict[str, Any]:
        """
        Generate an emotionally appropriate response based on the provided context.
        
        Args:
            message: The base message content to personalize
            emotional_context: Optional emotional context dictionary
            emotional_memory: Optional emotional memory component
            emotional_processor: Optional emotional processor component
            ethical_framework: Optional ethical framework component
            
        Returns:
            Dictionary containing the personalized response and metadata
        """
        # Store component references if provided
        if emotional_memory:
            self._emotional_memory = emotional_memory
        if emotional_processor:
            self._emotional_processor = emotional_processor
        if ethical_framework:
            self._ethical_framework = ethical_framework
            
        # Default context if none provided
        if not emotional_context:
            emotional_context = {
                "dominant_emotion": "neutral",
                "emotional_state": {"neutral": 1.0},
                "relationship_level": "new"
            }
            
        # Extract key information
        dominant_emotion = emotional_context.get("dominant_emotion", "neutral")
        relationship_level = emotional_context.get("relationship_level", "new")
        
        # Get appropriate templates
        emotion_templates = self.response_templates.get(dominant_emotion, self.response_templates["neutral"])
        relationship_data = self.relationship_modifiers.get(relationship_level, self.relationship_modifiers["new"])
        
        # Select templates
        response_template = random.choice(emotion_templates)
        prefix = random.choice(relationship_data["prefix"]) if relationship_data["prefix"] else ""
        suffix = random.choice(relationship_data["suffix"]) if random.random() < 0.3 else ""
        
        # Format the response
        formatted_message = message.strip()
        response = response_template.format(message=formatted_message)
        
        # Add prefix/suffix if they wouldn't create awkward phrasing
        if prefix and not response.lower().startswith(prefix.lower()):
            response = f"{prefix}{response[0].lower()}{response[1:]}"
            
        if suffix and not response.endswith((".", "!", "?")):
            response = f"{response}. {suffix}"
        elif suffix:
            response = f"{response} {suffix}"
            
        # Run ethical check if framework available
        ethical_note = ""
        if self._ethical_framework:
            try:
                ethical_decision = await self._ethical_framework.evaluate_response(response)
                if not ethical_decision.is_appropriate:
                    # Modify response if deemed inappropriate
                    response = "I'd like to help with that, but I need to consider the most appropriate way to respond."
                    ethical_note = ethical_decision.reasoning
            except Exception as e:
                logger.warning(f"Error during ethical evaluation: {str(e)}")
        
        # Update emotional memory if available
        if self._emotional_memory:
            try:
                await self._emotional_memory.record_interaction(
                    input_text="",  # We don't have the original input here
                    response_text=response,
                    emotional_state=emotional_context.get("emotional_state", {})
                )
            except Exception as e:
                logger.warning(f"Error updating emotional memory: {str(e)}")
                
        return {
            "response": response,
            "original_message": message,
            "dominant_emotion": dominant_emotion,
            "relationship_level": relationship_level,
            "ethical_note": ethical_note
        }
        
    async def process(self, message: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Process a message with emotional context.
        
        Args:
            message: The message to process
            context: Optional emotional context
            
        Returns:
            Dictionary containing the personalized response and metadata
        """
        return await self.generate_response(message, context)
        
    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the plugin with the given parameters.
        
        Args:
            params: Dictionary containing parameters, must include 'message'
            
        Returns:
            Dictionary containing the personalized response and metadata
        """
        if 'message' not in params:
            return {'error': 'Missing required parameter: message'}
            
        context = params.get('emotional_context')
        return await self.generate_response(params['message'], context)


# Plugin registration function
def register():
    """Return a plugin instance when the plugin is loaded"""
    return EmotionalResponseGenerator()
