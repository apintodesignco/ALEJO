"""
ALEJO Reasoning Correction System

This module provides components to correct and refine reasoning processes:
- Feedback loop for incorporating user corrections
- Source validation to evaluate information reliability
- Conflict resolution to handle contradictions in knowledge
"""

from alejo.cognitive.reasoning.correction.feedback_loop import FeedbackLoop
from alejo.cognitive.reasoning.correction.source_validator import SourceValidator
from alejo.cognitive.reasoning.correction.conflict_resolver import ConflictResolver

__all__ = [
    'FeedbackLoop',
    'SourceValidator',
    'ConflictResolver'
]
