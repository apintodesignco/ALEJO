"""
ALEJO Neuromorphic Brain Architecture
====================================

A sophisticated, SpiNNaker-inspired neuromorphic computing architecture
that forms the foundation of ALEJO's advanced cognitive capabilities.

This package implements a comprehensive neural processing system with
hemispheric specialization, spiking neural networks, and biologically-inspired
learning mechanisms.
"""

from alejo.brain.neuromorphic.core import NeuromorphicCore
from alejo.brain.neuromorphic.hemispheres import LeftHemisphere, RightHemisphere
from alejo.brain.neuromorphic.corpus_callosum import CorpusCallosum
from alejo.brain.neuromorphic.consciousness import ConsciousnessOrchestrator

__all__ = [
    'NeuromorphicCore',
    'LeftHemisphere',
    'RightHemisphere',
    'CorpusCallosum',
    'ConsciousnessOrchestrator',
]
