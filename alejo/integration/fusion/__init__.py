"""
ALEJO Multimodal Fusion Package

This package provides the backend implementation of ALEJO's multimodal fusion system,
which integrates inputs from various modalities (gesture, voice, text) to provide
a unified understanding and response generation capability.
"""

from alejo.integration.fusion.multimodal_merge import MultimodalFusionEngine
from alejo.integration.fusion.context_engine import ContextEngine

__all__ = ['MultimodalFusionEngine', 'ContextEngine']
