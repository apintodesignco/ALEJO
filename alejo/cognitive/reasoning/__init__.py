"""
ALEJO Reasoning Module

This module provides reasoning capabilities for ALEJO, including:
- Foundation facts database
- Logical consistency validation
- Reasoning tracing for transparency
- Fallacy detection
"""

from alejo.cognitive.reasoning.truth_core.foundation_facts import FoundationFactsDB
from alejo.cognitive.reasoning.truth_core.validator import LogicalConsistencyValidator
from alejo.cognitive.reasoning.truth_core.reasoning_tracer import ReasoningTracer
from alejo.cognitive.reasoning.truth_core.fallacy_detector import FallacyDetector

__all__ = [
    'FoundationFactsDB',
    'LogicalConsistencyValidator',
    'ReasoningTracer',
    'FallacyDetector',
]
