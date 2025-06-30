"""
Core memory models for ALEJO's cognitive system.
"""

from dataclasses import dataclass, field
from typing import Dict, Any
import time
import math

from ...models.memory_models import (
    Episode,
    Concept,
    Relationship,
    WorkingMemoryItem,
    EmotionalState
)

# Re-export models for backward compatibility
__all__ = [
    'Episode',
    'Concept',
    'Relationship',
    'WorkingMemoryItem',
    'EmotionalState',
    'EmotionalMemoryItem'
]

# EmotionalState is imported from memory_models

@dataclass
class EmotionalMemoryItem:
    """Represents an emotional memory entry."""
    id: str = None
    valence: float = 0.0
    arousal: float = 0.0
    dominance: float = 0.0
    source: str = ''
    context: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = 0.0
    intensity: float = 0.0
    
    def __post_init__(self):
        """Initialize default values."""
        if self.timestamp == 0.0:
            self.timestamp = time.time()
    
    def update_intensity(self):
        """Calculate emotional intensity using VAD values."""
        self.intensity = math.sqrt(self.valence**2 + self.arousal**2 + self.dominance**2) / math.sqrt(3)
