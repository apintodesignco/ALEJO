"""
Base data models for ALEJO's memory systems
These models are used by both the database and cognitive components
"""

from typing import Dict, List, Any
from dataclasses import dataclass
import numpy as np
from datetime import datetime
import uuid

@dataclass
class Episode:
    """Represents a single episodic memory"""
    content: Any
    context: Dict[str, Any]
    emotions: Dict[str, float]
    timestamp: float
    importance: float
    tags: List[str]
    connections: List[str]  # IDs of related memories

@dataclass
class Concept:
    """Represents a semantic concept"""
    name: str
    attributes: Dict[str, Any]
    relationships: Dict[str, List[str]]  # type: relationship -> related concept names
    confidence: float
    source: str  # Where this knowledge came from
    last_updated: float
    embedding: np.ndarray  # Vector representation for similarity comparison

@dataclass
class Relationship:
    """Represents a relationship between concepts"""
    type: str
    source_concept: str
    target_concept: str
    attributes: Dict[str, Any]
    confidence: float
    bidirectional: bool = False

@dataclass
class WorkingMemoryItem:
    """Represents an item in working memory"""
    content: Any
    source: str  # 'episodic', 'semantic', or 'sensory'
    activation: float  # How active/important this item is
    timestamp: float = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().timestamp()

@dataclass
class EmotionalState:
    """Represents the current emotional state using the VAD model"""
    valence: float = 0.0  # Pleasure-displeasure
    arousal: float = 0.0  # Energy level
    dominance: float = 0.0  # Control-submission
    
    def update(self, item: 'EmotionalMemoryItem', weight: float = 1.0):
        """Update state with new emotional input using weighted average"""
        total_weight = 1.0 + weight
        self.valence = (self.valence + item.valence * weight) / total_weight
        self.arousal = (self.arousal + item.arousal * weight) / total_weight
        self.dominance = (self.dominance + item.dominance * weight) / total_weight
    
    def get_intensity(self) -> float:
        """Calculate overall emotional intensity"""
        return np.sqrt(self.valence**2 + self.arousal**2 + self.dominance**2)

@dataclass
class EmotionalMemoryItem:
    """Represents an emotional memory entry"""
    id: str = None
    valence: float = 0.0
    arousal: float = 0.0
    dominance: float = 0.0
    source: str = ''
    context: Dict[str, Any] = None
    timestamp: float = 0.0
    intensity: float = 0.0
    
    def __post_init__(self):
        if self.id is None:
            self.id = str(uuid.uuid4())
        if self.context is None:
            self.context = {}
        if self.timestamp == 0.0:
            self.timestamp = datetime.now().timestamp()
        self.intensity = np.sqrt(self.valence**2 + self.arousal**2 + self.dominance**2)
