"""
ALEJO Microservices Module

This module provides the structure for microservices in ALEJO, enabling:
- Independent scaling and deployment of different components
- Inter-service communication for a distributed architecture
"""

# Import service components for easy access
from .brain_service import BrainService
from .emotional_intelligence_service import EmotionalIntelligenceService
from .communication import ServiceCommunicator

__all__ = ['BrainService', 'EmotionalIntelligenceService', 'ServiceCommunicator']
