"""
ALEJO Autonomous Improvement Framework

This package implements a comprehensive autonomous self-improvement framework
that builds upon the Darwin Gödel Machine capabilities to provide periodic
review, enhancement, and upgrade of all ALEJO modules with minimal user intervention.
"""

from alejo.core.autonomous_improvement.engine import AutonomousImprovementEngine
from alejo.core.autonomous_improvement.config import ImprovementConfig
from alejo.core.autonomous_improvement.scheduler import ModuleReviewScheduler

# Singleton instance
_autonomous_improvement_engine = None

def get_autonomous_improvement_engine(brain=None, config=None):
    """
    Get the singleton instance of the autonomous improvement engine
    
    Args:
        brain: ALEJO Brain instance (required on first call)
        config: Optional configuration dictionary
        
    Returns:
        AutonomousImprovementEngine instance
    """
    global _autonomous_improvement_engine
    
    if _autonomous_improvement_engine is None:
        if brain is None:
            raise ValueError("Brain instance is required for first initialization")
        _autonomous_improvement_engine = AutonomousImprovementEngine(brain, config)
    
    return _autonomous_improvement_engine
