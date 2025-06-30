"""
ALEJO Emotional Intelligence Module

This module provides emotional intelligence capabilities to ALEJO, including:
- Emotional memory and state tracking
- Emotional processing and sentiment analysis
- Ethical decision making and value alignment
- Relationship context management
"""

from .processor import EmotionalProcessor
from .adaptive_processor import (
    EmotionalState,
    InteractionStyle,
    PersonalityTrait,
    AdaptiveEmotionalProcessor,
)
from .emotional_core import (
    EmotionalCore,
    EmotionalDimension,
    EmotionalMemory
)
from .memory import EmotionalMemoryService
from .ethics import EthicalFramework, EthicalDecision
from .integration import EmotionalIntelligenceIntegration

__all__ = [
    "EmotionalProcessor",
    "AdaptiveEmotionalProcessor",
    "EmotionalState",
    "InteractionStyle",
    "PersonalityTrait",
    "EmotionalCore",
    "EmotionalDimension",
    "EmotionalMemory",
    "EmotionalMemoryService",
    "EthicalFramework",
    "EthicalDecision",
    "EmotionalIntelligenceIntegration",
]
