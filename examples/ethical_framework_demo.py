"""
ALEJO - Advanced Language and Execution Joint Operator
Ethical Framework Demo - Example usage of the ethical framework components
"""

import asyncio
import json
from datetime import datetime

from alejo.cognitive.ethical import (
    EthicalFramework,
    DecisionImpact,
    Alternative
)
from alejo.core.event_bus import EventBus


async def main():
    """Run the ethical framework demonstration."""
    print("ALEJO Ethical Framework Demo")
    print("=" * 50)
    
    # Create event bus and ethical framework
    event_bus = EventBus()
    framework = EthicalFramework(event_bus)
    await framework.initialize()
    
    print("\n1. Evaluating a single action")
    print("-" * 50)
    
    # Define an action to evaluate
    action = {
        "name": "share_anonymized_data",
        "description": "Share anonymized user data with research partners",
        "impacts": {
            "user_privacy": DecisionImpact.LOW_NEGATIVE,
            "transparency": DecisionImpact.MEDIUM_POSITIVE,
            "scientific_progress": DecisionImpact.HIGH_POSITIVE
        },
        "metadata": {
            "consent_obtained": True,
            "anonymization_level": "high",
            "purpose": "research"
        }
    }
    
    # Evaluate the action
    result = await framework.evaluate_action(action, {"domain": "healthcare"})
    
    print(f"Action: {action['name']}")
    print(f"Description: {action['description']}")
    print("\nEvaluation results:")
    for principle_id, score in result["evaluations"].items():
        print(f"  - Principle {principle_id}: {score:.2f}")
    
    # Check compliance
    compliance = await framework.check_ethical_compliance(action)
    print(f"\nCompliance check: {'Compliant' if compliance['compliant'] else 'Non-compliant'}")
    print(f"Score: {compliance['score']:.2f} (threshold: {compliance['threshold']:.2f})")
    
    print("\n2. Making an ethical decision between alternatives")
    print("-" * 50)
    
    # Define alternatives for a decision
    alternatives = [
        {
            "name": "collect_minimal_data",
            "description": "Collect only essential data with explicit consent",
            "impacts": {
                "user_privacy": DecisionImpact.NEUTRAL,
                "user_experience": DecisionImpact.LOW_NEGATIVE,
                "service_quality": DecisionImpact.LOW_NEGATIVE
            }
        },
        {
            "name": "collect_moderate_data",
            "description": "Collect moderate data with opt-in consent",
            "impacts": {
                "user_privacy": DecisionImpact.LOW_NEGATIVE,
                "user_experience": DecisionImpact.MEDIUM_POSITIVE,
                "service_quality": DecisionImpact.MEDIUM_POSITIVE
            }
        },
        {
            "name": "collect_comprehensive_data",
            "description": "Collect comprehensive data with default opt-in",
            "impacts": {
                "user_privacy": DecisionImpact.HIGH_NEGATIVE,
                "user_experience": DecisionImpact.HIGH_POSITIVE,
                "service_quality": DecisionImpact.HIGH_POSITIVE
            }
        }
    ]
    
    # Make a decision
    context = {
        "domain": "personal_assistant",
        "user_preferences": {
            "privacy_conscious": True
        },
        "regulatory_requirements": ["GDPR", "CCPA"]
    }
    
    decision = await framework.make_ethical_decision(context, alternatives)
    
    print("Decision context:")
    print(f"  Domain: {context['domain']}")
    print(f"  User preferences: {context['user_preferences']}")
    print(f"  Regulatory requirements: {', '.join(context['regulatory_requirements'])}")
    
    print("\nAlternatives considered:")
    for alt in alternatives:
        print(f"  - {alt['name']}: {alt['description']}")
    
    print(f"\nSelected alternative: {decision['selected_alternative']['name']}")
    print(f"Rationale: {decision['rationale']}")
    
    # Get explanation for the decision
    explanation = await framework.get_ethical_explanation(decision["decision_id"])
    
    print("\nPrinciples applied in decision:")
    for pid, pinfo in explanation["principles"].items():
        print(f"  - {pinfo['name']}: {pinfo['description']}")
    
    print("\n3. Detecting value conflicts")
    print("-" * 50)
    
    # Check for value conflicts
    conflict_context = {
        "concerns": ["privacy", "transparency", "autonomy", "welfare"]
    }
    
    conflicts = await framework.get_value_conflicts(conflict_context)
    
    print("Potential value conflicts detected:")
    for conflict in conflicts:
        print(f"  - {conflict['description']} (Severity: {conflict['severity']})")
        print("    Values involved:")
        for value in conflict["values"]:
            print(f"      * {value['name']}: {value['description']}")
    
    print("\nDemo completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())
