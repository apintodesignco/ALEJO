"""
ALEJO Ethical Framework Module

This module provides ethical decision making capabilities to ALEJO, including:
- Value-based decision making
- Ethical principles enforcement
- Learning from feedback
- Contextual ethics
"""

from ..emotional_intelligence.ethics import EthicalFramework, EthicalDecision
from .integration import EthicalIntegration

__all__ = [
    "EthicalFramework",
    "EthicalDecision",
    "EthicalIntegration",
]
