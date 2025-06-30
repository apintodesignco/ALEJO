"""
Comfort Response Module for ALEJO

This module provides functionality to detect negative emotional states
and respond with appropriate comfort measures like playing music,
showing images, or offering other personalized comfort options.
"""

import os
import logging
import random
import webbrowser
import requests
from typing import Dict, List, Optional, Union, Tuple
from dataclasses import dataclass
import json
import platform
import subprocess
import threading
import time
from pathlib import Path

from .models.emotion_recognition import EmotionPrediction
from .models.multimodal_emotion import MultimodalEmotionResult
from ..core.event_bus import Event, EventType
from ..core.memory_event_bus import MemoryEventBus
from ..services.user_preferences import UserPreferences, get_user_preferences

logger = logging.getLogger(__name__)

@dataclass
class ComfortSuggestion:
    """A suggestion for comforting the user"""
    type: str  # "music", "image", "video", "activity", "message"
    content: str  # URL, file path, or message content
    title: str  # Display title
    description: str  # Brief description
    source: str  # Where this suggestion comes from
    confidence: float  # How confident we are this will help (0-1)


class ComfortResponseManager:
    """
    Manages comfort responses based on detected emotional states
    """
    
    def __init__(self, event_bus: Optional[MemoryEventBus] = None):
        """Initialize the comfort response manager"""
        self.event_bus = event_bus
        self.user_preferences = get_user_preferences()
        self.comfort_threshold = 0.65  # Threshold for negative emotions to trigger comfort
        self.last_comfort_time = 0
        self.comfort_cooldown = 300  # 5 minutes between comfort suggestions
        
        # Load comfort resources
        self._load_comfort_resources()
        
        # Register for emotion events if event bus is provided
        if self.event_bus:
            self.event_bus.subscribe(EventType.USER_EMOTION, self._handle_emotion_event)
            logger.info("ComfortResponseManager subscribed to emotion events")
    
    def _load_comfort_resources(self):
        """Load comfort resources from configuration"""
        # Default comfort resources
        self.comfort_resources = {
            "music": [
                {"title": "Relaxing Piano", "url": "https://www.youtube.com/watch?v=XULUBg_ZcAU", "tags": ["calm", "relaxing"]},
                {"title": "Nature Sounds", "url": "https://www.youtube.com/watch?v=eKFTSSKCzWA", "tags": ["nature", "peaceful"]},
                {"title": "Upbeat Pop", "url": "https://www.youtube.com/watch?v=kJQP7kiw5Fk", "tags": ["upbeat", "energetic"]}
            ],
            "images": [
                {"title": "Peaceful Beach", "url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e", "tags": ["nature", "peaceful"]},
                {"title": "Cute Animals", "url": "https://images.unsplash.com/photo-1583337130417-3346a1be7dee", "tags": ["animals", "cute"]},
                {"title": "Beautiful Sunset", "url": "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869", "tags": ["nature", "sunset"]}
            ],
            "activities": [
                {"title": "Deep Breathing", "description": "Take 5 deep breaths, inhaling for 4 seconds and exhaling for 6", "tags": ["relaxation", "stress"]},
                {"title": "Mindfulness Moment", "description": "Focus on 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste", "tags": ["mindfulness", "anxiety"]},
                {"title": "Quick Stretch", "description": "Stand up and stretch your arms, legs, and back for 30 seconds", "tags": ["physical", "energy"]}
            ],
            "messages": [
                {"content": "Remember that challenges are temporary. You've overcome difficult situations before.", "tags": ["encouragement", "perspective"]},
                {"content": "It's okay to take a break when you need one. Self-care is important.", "tags": ["self-care", "permission"]},
                {"content": "You're doing great, even when it doesn't feel like it.", "tags": ["encouragement", "validation"]}
            ]
        }
        
        # Try to load user-specific comfort resources if available
        try:
            user_comfort_path = Path(os.path.expanduser("~")) / ".alejo" / "comfort_resources.json"
            if user_comfort_path.exists():
                with open(user_comfort_path, "r") as f:
                    user_resources = json.load(f)
                    # Merge with defaults, prioritizing user preferences
                    for category, items in user_resources.items():
                        if category in self.comfort_resources:
                            self.comfort_resources[category].extend(items)
                        else:
                            self.comfort_resources[category] = items
                logger.info(f"Loaded user comfort resources from {user_comfort_path}")
        except Exception as e:
            logger.warning(f"Failed to load user comfort resources: {e}")
    
    async def _handle_emotion_event(self, event: Event):
        """Handle emotion detection events"""
        if not event.payload or "emotion_data" not in event.payload:
            return
        
        emotion_data = event.payload["emotion_data"]
        if isinstance(emotion_data, dict) and "dominant_emotion" in emotion_data:
            await self.process_emotion(
                emotion_data["dominant_emotion"],
                emotion_data.get("combined_emotions", {}),
                event.source
            )
    
    async def process_emotion(self, dominant_emotion: str, emotion_details: Dict[str, float], source: str):
        """
        Process detected emotions and respond with comfort if needed
        
        Args:
            dominant_emotion: The primary detected emotion
            emotion_details: Dictionary of all detected emotions and their scores
            source: Source of the emotion detection
        """
        # Check if we need to offer comfort based on negative emotions
        negative_emotions = ["anger", "sad", "sadness", "fear", "fearful", "disgust", "frustrated", "stress", "anxiety"]
        
        # Calculate negative emotion score
        negative_score = sum(emotion_details.get(emotion, 0) for emotion in negative_emotions)
        
        # Check if we should offer comfort
        current_time = time.time()
        if (negative_score > self.comfort_threshold and 
            current_time - self.last_comfort_time > self.comfort_cooldown):
            
            logger.info(f"Detected negative emotions ({negative_score:.2f}), offering comfort")
            self.last_comfort_time = current_time
            
            # Get comfort suggestions
            suggestions = self.get_comfort_suggestions(dominant_emotion, emotion_details)
            
            # Publish comfort suggestion event
            if self.event_bus and suggestions:
                await self.event_bus.publish(Event(
                    type=EventType.SYSTEM,
                    source="comfort_response_manager",
                    payload={
                        "type": "comfort_suggestion",
                        "suggestions": [vars(suggestion) for suggestion in suggestions]
                    }
                ))
                
                # Also return the suggestions for direct use
                return suggestions
        
        return []
    
    def get_comfort_suggestions(self, dominant_emotion: str, emotion_details: Dict[str, float]) -> List[ComfortSuggestion]:
        """
        Get personalized comfort suggestions based on emotional state
        
        Args:
            dominant_emotion: The primary detected emotion
            emotion_details: Dictionary of all detected emotions and their scores
            
        Returns:
            List of comfort suggestions
        """
        suggestions = []
        
        # Determine appropriate comfort categories based on emotion
        if dominant_emotion in ["anger", "frustrated"]:
            categories = ["music", "activities", "messages"]
            tags = ["calm", "relaxing", "perspective"]
        elif dominant_emotion in ["sad", "sadness"]:
            categories = ["music", "images", "messages"]
            tags = ["upbeat", "cute", "encouragement"]
        elif dominant_emotion in ["fear", "fearful", "anxiety"]:
            categories = ["activities", "music", "messages"]
            tags = ["relaxation", "mindfulness", "peaceful"]
        elif dominant_emotion in ["stress", "tense"]:
            categories = ["music", "activities", "images"]
            tags = ["relaxation", "nature", "peaceful"]
        else:
            categories = ["music", "images", "activities", "messages"]
            tags = ["upbeat", "cute", "relaxation", "encouragement"]
        
        # Get user's favorite music if available
        favorite_music = self.user_preferences.get("favorite_music")
        if favorite_music and "music" in categories:
            suggestions.append(ComfortSuggestion(
                type="music",
                content=f"https://www.youtube.com/results?search_query={favorite_music.replace(' ', '+')}",
                title=f"Listen to {favorite_music}",
                description=f"Would you like to listen to your favorite music ({favorite_music})?",
                source="user_preference",
                confidence=0.9
            ))
        
        # Get user's favorite image category if available
        favorite_images = self.user_preferences.get("favorite_images")
        if favorite_images and "images" in categories:
            suggestions.append(ComfortSuggestion(
                type="image",
                content=f"https://unsplash.com/s/photos/{favorite_images.replace(' ', '-')}",
                title=f"View {favorite_images} images",
                description=f"Would you like to see some {favorite_images} images?",
                source="user_preference",
                confidence=0.85
            ))
        
        # Add suggestions from our comfort resources
        for category in categories[:2]:  # Limit to top 2 categories
            if category in self.comfort_resources:
                # Filter by relevant tags if possible
                relevant_items = [
                    item for item in self.comfort_resources[category]
                    if any(tag in tags for tag in item.get("tags", []))
                ]
                
                # If no relevant items, use any from the category
                if not relevant_items and self.comfort_resources[category]:
                    relevant_items = self.comfort_resources[category]
                
                # Add a random item from the filtered list
                if relevant_items:
                    item = random.choice(relevant_items)
                    suggestions.append(ComfortSuggestion(
                        type=category,
                        content=item.get("url", item.get("content", "")),
                        title=item.get("title", ""),
                        description=f"Would you like to {self._get_action_verb(category)} this {category[:-1]}?",
                        source="comfort_resources",
                        confidence=0.75
                    ))
        
        return suggestions
    
    def _get_action_verb(self, category: str) -> str:
        """Get the appropriate action verb for a category"""
        if category == "music":
            return "listen to"
        elif category == "images":
            return "look at"
        elif category == "videos":
            return "watch"
        elif category == "activities":
            return "try"
        elif category == "messages":
            return "read"
        else:
            return "experience"
    
    def play_music(self, url: str) -> bool:
        """
        Play music from a URL
        
        Args:
            url: URL to the music resource
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Open in default browser
            webbrowser.open(url)
            return True
        except Exception as e:
            logger.error(f"Failed to play music: {e}")
            return False
    
    def show_image(self, url: str) -> bool:
        """
        Show an image from a URL
        
        Args:
            url: URL to the image
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Open in default browser
            webbrowser.open(url)
            return True
        except Exception as e:
            logger.error(f"Failed to show image: {e}")
            return False
    
    def save_user_preference(self, preference_type: str, value: str):
        """
        Save a user preference for comfort responses
        
        Args:
            preference_type: Type of preference (e.g., "favorite_music")
            value: Value of the preference
        """
        try:
            self.user_preferences.set(preference_type, value)
            logger.info(f"Saved user preference: {preference_type}={value}")
        except Exception as e:
            logger.error(f"Failed to save user preference: {e}")


# Singleton instance
_comfort_manager = None

def get_comfort_manager(event_bus: Optional[MemoryEventBus] = None) -> ComfortResponseManager:
    """Get the singleton comfort manager instance"""
    global _comfort_manager
    if _comfort_manager is None:
        _comfort_manager = ComfortResponseManager(event_bus)
    return _comfort_manager
