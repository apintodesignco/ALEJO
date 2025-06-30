"""
ALEJO Self-Evolution Package

This package enables ALEJO to autonomously improve itself over time,
learn from errors, expand its knowledge, and enhance its capabilities.
It is a cornerstone of ALEJO's advanced intelligence and adaptability.
"""

from .evolution_manager import SelfEvolutionManager, get_evolution_manager
from .knowledge_expansion import KnowledgeExpansionEngine
from .capability_enhancement import CapabilityEnhancementSystem
from .error_correction import ErrorCorrectionSystem

__all__ = [
    'SelfEvolutionManager',
    'get_evolution_manager',
    'KnowledgeExpansionEngine',
    'CapabilityEnhancementSystem',
    'ErrorCorrectionSystem'
]
