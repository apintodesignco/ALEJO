"""
ALEJO - Advanced Language and Execution Joint Operator
Ethical subsystem package initialization
"""

from alejo.cognitive.ethical.value_system import (
    ValueSystem,
    Value,
    ValueCategory,
    ValuePriority,
    ValueConflict
)

from alejo.cognitive.ethical.principles import (
    EthicalPrinciple,
    PrincipleCategory,
    UtilitarianPrinciple,
    DeontologicalPrinciple,
    VirtueEthicsPrinciple,
    CareEthicsPrinciple,
    JusticePrinciple,
    CustomPrinciple,
    PrincipleRegistry
)

from alejo.cognitive.ethical.decisions import (
    EthicalDecision,
    Alternative,
    DecisionImpact,
    DecisionRegistry
)

from alejo.cognitive.ethical.framework import EthicalFramework

__all__ = [
    # Value System
    'ValueSystem', 'Value', 'ValueCategory', 'ValuePriority', 'ValueConflict',
    
    # Principles
    'EthicalPrinciple', 'PrincipleCategory', 'UtilitarianPrinciple',
    'DeontologicalPrinciple', 'VirtueEthicsPrinciple', 'CareEthicsPrinciple',
    'JusticePrinciple', 'CustomPrinciple', 'PrincipleRegistry',
    
    # Decisions
    'EthicalDecision', 'Alternative', 'DecisionImpact', 'DecisionRegistry',
    
    # Framework
    'EthicalFramework'
]
