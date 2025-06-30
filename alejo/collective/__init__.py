"""
ALEJO Collective Learning System
Enables secure data sharing and collaborative intelligence across multiple ALEJO instances
while maintaining user privacy and security.

The ALEJO codebase itself acts as the master brain, with the collective learning system
serving as the mechanism for users to securely contribute insights to improve the core system.
"""

from .collective_learner import CollectiveLearner
from .data_manager import CollectiveDataManager
from .privacy_controller import PrivacyController
from .consent_manager import ConsentManager
from .improvement_engine import ImprovementEngine

__all__ = [
    "CollectiveLearner",
    "CollectiveDataManager",
    "PrivacyController", 
    "ConsentManager",
    "ImprovementEngine"
]
