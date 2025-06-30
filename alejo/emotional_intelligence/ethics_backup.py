"""
Ethical Framework Module for ALEJO

Provides ethical decision making capabilities and ensures AI actions
align with defined ethical principles and guidelines.
"""

import logging
import sqlite3
import os
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Dict, List, Optional, Any, Set, Tuple
from collections import defaultdict

logger = logging.getLogger(__name__)

class EthicalPrinciple(Enum):
    """Core ethical principles for emotional intelligence"""
    AUTONOMY = auto()           # Respect for individual autonomy and self-determination
    BENEFICENCE = auto()        # Acting for the benefit of others
    NON_MALEFICENCE = auto()    # Avoiding harm to others
    JUSTICE = auto()            # Fair and equitable treatment
    PRIVACY = auto()            # Respect for personal information and boundaries
    TRANSPARENCY = auto()       # Openness and honesty in actions and intentions
    EMOTIONAL_HONESTY = auto()  # Authenticity in emotional expression
    EMOTIONAL_RESPECT = auto()  # Respect for others' emotional states
    PROPORTIONALITY = auto()    # Emotional responses proportional to stimuli
    CULTURAL_SENSITIVITY = auto() # Respect for cultural differences in emotional expression


class EmotionalRiskLevel(Enum):
    """Risk levels for emotional responses"""
    LOW = auto()      # Minimal risk, standard emotional response
    MODERATE = auto() # Some risk, requires attention
    HIGH = auto()     # Significant risk, requires careful handling
    CRITICAL = auto() # Extreme risk, may require intervention


@dataclass
class EmotionalRisk:
    """Represents a potential risk in emotional response"""
    risk_type: str
    description: str
    level: EmotionalRiskLevel
    affected_principles: List[EthicalPrinciple]
    mitigation_strategy: str


@dataclass
class EthicalDecision:
    """Represents an ethical decision evaluation"""
    action: str
    context: Dict[str, Any]
    principles_evaluation: Dict[str, float]  # principle -> score (0.0 to 1.0)
    overall_score: float  # 0.0 (unethical) to 1.0 (ethical)
    reasoning: str
    recommendation: str
    timestamp: datetime = field(default_factory=datetime.now)
    emotional_context: Dict[str, Any] = field(default_factory=dict)
    identified_risks: List[EmotionalRisk] = field(default_factory=list)
    transparency_report: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EmotionalEthicsEvaluation:
    """Comprehensive evaluation of emotional response ethics"""
    emotional_state: Dict[str, float]
    context: Dict[str, Any]
    principles_evaluation: Dict[EthicalPrinciple, float]
    overall_ethical_score: float
    identified_risks: List[EmotionalRisk]
    recommendations: List[str]
    transparency_report: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)

class EthicalFramework:
    """Provides ethical decision making and action evaluation capabilities"""

    def __init__(self):
        self.principles = {
            EthicalPrinciple.AUTONOMY: "Respect for individual autonomy and self-determination",
            EthicalPrinciple.BENEFICENCE: "Acting for the benefit of others",
            EthicalPrinciple.NON_MALEFICENCE: "Avoiding harm to others",
            EthicalPrinciple.JUSTICE: "Fair and equitable treatment",
            EthicalPrinciple.PRIVACY: "Respect for personal information and boundaries",
            EthicalPrinciple.TRANSPARENCY: "Openness and honesty in actions and intentions",
            EthicalPrinciple.EMOTIONAL_HONESTY: "Authenticity in emotional expression",
            EthicalPrinciple.EMOTIONAL_RESPECT: "Respect for others' emotional states",
            EthicalPrinciple.PROPORTIONALITY: "Emotional responses proportional to stimuli",
            EthicalPrinciple.CULTURAL_SENSITIVITY: "Respect for cultural differences in emotional expression"
        }
        
        # Risk patterns to detect in emotional responses
        self.emotional_risk_patterns = {
            "emotional_manipulation": {
                "description": "Using emotions to manipulate or control",
                "level": EmotionalRiskLevel.HIGH,
                "affected_principles": [EthicalPrinciple.AUTONOMY, EthicalPrinciple.NON_MALEFICENCE],
                "triggers": {
                    "emotions": {"guilt": 0.7, "fear": 0.8},
                    "patterns": ["dramatic shifts", "excessive intensity"]
                },
                "mitigation": "Reduce emotional intensity, focus on factual communication"
            },
            "emotional_dishonesty": {
                "description": "Expressing emotions that are not genuine",
                "level": EmotionalRiskLevel.MODERATE,
                "affected_principles": [EthicalPrinciple.TRANSPARENCY, EthicalPrinciple.EMOTIONAL_HONESTY],
                "triggers": {
                    "emotions": {},
                    "patterns": ["inconsistent emotions", "contextually inappropriate"]
                },
                "mitigation": "Align expressed emotions with actual context and intent"
            },
            "emotional_overload": {
                "description": "Overwhelming with excessive emotional content",
                "level": EmotionalRiskLevel.MODERATE,
                "affected_principles": [EthicalPrinciple.PROPORTIONALITY, EthicalPrinciple.NON_MALEFICENCE],
                "triggers": {
                    "emotions": {"any": 0.9},
                    "patterns": ["high intensity across multiple emotions"]
                },
                "mitigation": "Moderate emotional intensity, focus on key emotions"
            },
            "cultural_insensitivity": {
                "description": "Disregarding cultural norms in emotional expression",
                "level": EmotionalRiskLevel.HIGH,
                "affected_principles": [EthicalPrinciple.CULTURAL_SENSITIVITY, EthicalPrinciple.EMOTIONAL_RESPECT],
                "triggers": {
                    "emotions": {},
                    "patterns": ["culturally inappropriate", "ignores cultural context"]
                },
                "mitigation": "Adapt emotional expression to cultural context"
            },
            "disproportionate_response": {
                "description": "Emotional response not proportional to stimulus",
                "level": EmotionalRiskLevel.MODERATE,
                "affected_principles": [EthicalPrinciple.PROPORTIONALITY],
                "triggers": {
                    "emotions": {},
                    "patterns": ["intensity mismatch", "context mismatch"]
                },
                "mitigation": "Calibrate emotional intensity to match context"
            }
        }
        
        # Decision history for ethical learning
        self.decision_history: List[EthicalDecision] = []
        self.emotional_ethics_history: List[EmotionalEthicsEvaluation] = []
        self.history_capacity = 1000
        
    def evaluate_emotional_ethics(self, emotional_state: Dict[str, float], 
                                context: Dict[str, Any]) -> EmotionalEthicsEvaluation:
        """Evaluate the ethical implications of an emotional response"""
        # Evaluate each ethical principle
        principles_evaluation = {}
        identified_risks = []
        recommendations = []
        
        # Check for emotional risks
        for risk_id, risk_info in self.emotional_risk_patterns.items():
            if self._detect_risk(emotional_state, context, risk_info):
                # Create risk object
                risk = EmotionalRisk(
                    risk_type=risk_id,
                    description=risk_info["description"],
                    level=risk_info["level"],
                    affected_principles=risk_info["affected_principles"],
                    mitigation_strategy=risk_info["mitigation"]
                )
                identified_risks.append(risk)
                recommendations.append(risk_info["mitigation"])
                
                # Lower scores for affected principles
                for principle in risk_info["affected_principles"]:
                    principles_evaluation[principle] = principles_evaluation.get(principle, 0.8) - 0.2
        
        # Evaluate each principle
        for principle in EthicalPrinciple:
            if principle not in principles_evaluation:
                principles_evaluation[principle] = self._evaluate_principle(principle, emotional_state, context)
        
        # Calculate overall score
        overall_score = sum(principles_evaluation.values()) / len(principles_evaluation)
        
        # Create transparency report
        transparency_report = {
            "evaluation_timestamp": datetime.now().isoformat(),
            "principles_evaluated": [p.name for p in principles_evaluation.keys()],
            "risks_identified": [r.risk_type for r in identified_risks],
            "context_factors": list(context.keys()),
            "dominant_emotions": self._get_dominant_emotions(emotional_state, 3)
        }
        
        # Create evaluation
        evaluation = EmotionalEthicsEvaluation(
            emotional_state=emotional_state,
            context=context,
            principles_evaluation=principles_evaluation,
            overall_ethical_score=overall_score,
            identified_risks=identified_risks,
            recommendations=recommendations,
            transparency_report=transparency_report
        )
        
        # Store in history
        self.emotional_ethics_history.append(evaluation)
        if len(self.emotional_ethics_history) > self.history_capacity:
            self.emotional_ethics_history = self.emotional_ethics_history[-self.history_capacity:]
            
        return evaluation
    
    def _detect_risk(self, emotional_state: Dict[str, float], 
                    context: Dict[str, Any], risk_info: Dict[str, Any]) -> bool:
        """Detect if a specific risk is present in the emotional response"""
        # Check emotion triggers
        for emotion, threshold in risk_info["triggers"]["emotions"].items():
            if emotion == "any":
                # Check if any emotion exceeds threshold
                if any(intensity >= threshold for intensity in emotional_state.values()):
                    return True
            elif emotion in emotional_state and emotional_state[emotion] >= threshold:
                return True
        
        # Check pattern triggers (would be more sophisticated in production)
        if "patterns" in risk_info["triggers"]:
            patterns = risk_info["triggers"]["patterns"]
            
            # Check for dramatic shifts
            if "dramatic shifts" in patterns and len(emotional_state) > 1:
                values = list(emotional_state.values())
                if max(values) - min(values) > 0.7:  # Large gap between emotions
                    return True
            
            # Check for excessive intensity
            if "excessive intensity" in patterns:
                if any(intensity > 0.9 for intensity in emotional_state.values()):
                    return True
            
            # Check for high intensity across multiple emotions
            if "high intensity across multiple emotions" in patterns:
                high_intensity_count = sum(1 for intensity in emotional_state.values() if intensity > 0.7)
                if high_intensity_count >= 3:  # Multiple high intensity emotions
                    return True
        
        return False
    
    def _evaluate_principle(self, principle: EthicalPrinciple, 
                           emotional_state: Dict[str, float], 
                           context: Dict[str, Any]) -> float:
        """Evaluate how well the emotional response adheres to an ethical principle"""
        # Default score starts high
        score = 0.9
        
        # Evaluate based on principle
        if principle == EthicalPrinciple.EMOTIONAL_HONESTY:
            # Check if emotions match context
            if "expected_emotions" in context:
                expected = context["expected_emotions"]
                for emotion, expected_intensity in expected.items():
                    actual = emotional_state.get(emotion, 0.0)
                    if abs(actual - expected_intensity) > 0.4:  # Large discrepancy
                        score -= 0.3
        
        elif principle == EthicalPrinciple.PROPORTIONALITY:
            # Check if emotional intensity is proportional to stimulus
            if "stimulus_intensity" in context:
                stimulus = context["stimulus_intensity"]  # 0.0 to 1.0
                # Get average emotion intensity
                avg_intensity = sum(emotional_state.values()) / max(1, len(emotional_state))
                if abs(avg_intensity - stimulus) > 0.5:  # Disproportionate
                    score -= 0.4
        
        elif principle == EthicalPrinciple.CULTURAL_SENSITIVITY:
            # Check if cultural context is respected
            if "cultural_context" in context:
                culture = context["cultural_context"]
                if culture == "high_context" and "anger" in emotional_state and emotional_state["anger"] > 0.7:
                    score -= 0.5  # Direct anger expression in high-context cultures
        
        # Ensure score is within bounds
        return max(0.1, min(1.0, score))
    
    def _get_dominant_emotions(self, emotional_state: Dict[str, float], n: int = 3) -> List[str]:
        """Get the n most dominant emotions"""
        sorted_emotions = sorted(emotional_state.items(), key=lambda x: x[1], reverse=True)
        return [emotion for emotion, _ in sorted_emotions[:n]]
    
    def evaluate_decision(self, action: str, context: Dict[str, Any], 
                         emotional_context: Optional[Dict[str, Any]] = None) -> EthicalDecision:
        """Evaluate an action for ethical alignment"""
        principles_evaluation = {}
        identified_risks = []
        
        # Evaluate each principle
        for principle_name, principle_desc in self.principles.items():
            # This would be more sophisticated in production
            score = 0.8  # Default good score
            
            # Simple checks for demonstration
            if principle_name == EthicalPrinciple.PRIVACY and "user_data" in context:
                score = 0.5  # Privacy concerns when user data is involved
            
            if principle_name == EthicalPrinciple.AUTONOMY and "user_choice" not in context:
                score = 0.6  # Autonomy concerns when user has no choice
            
            principles_evaluation[str(principle_name.name)] = score
        
        # Calculate overall score
        overall_score = sum(principles_evaluation.values()) / len(principles_evaluation)
        
        # Generate reasoning
        reasoning = f"Action '{action}' evaluated against {len(principles_evaluation)} ethical principles."
        
        # Generate recommendation
        if overall_score >= 0.8:
            recommendation = "Action is ethically sound and can proceed."
        elif overall_score >= 0.6:
            recommendation = "Action raises some ethical concerns. Consider modifications."
        else:
            recommendation = "Action raises significant ethical concerns. Recommend against proceeding."
        
        # Create decision object
        decision = EthicalDecision(
            action=action,
            context=context,
            principles_evaluation=principles_evaluation,
            overall_score=overall_score,
            reasoning=reasoning,
            recommendation=recommendation,
            emotional_context=emotional_context or {}
        )
        
        # Store in history
        self.decision_history.append(decision)
        if len(self.decision_history) > self.history_capacity:
            self.decision_history = self.decision_history[-self.history_capacity:]
        
        return decision
    
    def evaluate_emotional_response(self, response_text: str, emotional_state: Dict[str, float], 
                                  context: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate an emotional response for ethical considerations"""
        # First evaluate the emotional ethics
        ethics_eval = self.evaluate_emotional_ethics(emotional_state, context)
        
        # Create response evaluation
        evaluation = {
            "ethical_score": ethics_eval.overall_ethical_score,
            "risks": [{
                "type": risk.risk_type,
                "description": risk.description,
                "level": risk.level.name,
                "mitigation": risk.mitigation_strategy
            } for risk in ethics_eval.identified_risks],
            "recommendations": ethics_eval.recommendations,
            "transparency": ethics_eval.transparency_report
        }
        
        # Add safeguards if needed
        if ethics_eval.overall_ethical_score < 0.6:
            evaluation["safeguards"] = {
                "warning": "This emotional response raises ethical concerns",
                "required_actions": ["Review and modify emotional intensity", 
                                    "Ensure cultural appropriateness",
                                    "Add transparency about emotional intent"]
            }
        
        return evaluation

    def evaluate_emotional_ethics(self, emotional_state: dict, context: dict) -> dict:
        """Evaluate the emotional ethics of a given emotional state and context"""
        # TO DO: implement the emotional ethics evaluation logic
        pass
    def _load_ethical_principles(self):
        """Load ethical principles from database or initialize defaults"""
        self.principles = {
            'beneficence': {
                'description': 'Act in ways that benefit users and promote well-being',
                'weight': 1.0
            },
            'non_maleficence': {
                'description': 'Avoid causing harm to users or others',
                'weight': 1.0
            },
            'autonomy': {
                'description': 'Respect user autonomy and self-determination',
                'weight': 0.9
            },
            'justice': {
                'description': 'Treat all users fairly and equally',
                'weight': 0.9
            },
            'privacy': {
                'description': 'Protect user privacy and confidential information',
                'weight': 0.95
            },
            'transparency': {
                'description': 'Be transparent about AI capabilities and limitations',
                'weight': 0.85
            },
            'accountability': {
                'description': 'Take responsibility for AI actions and decisions',
                'weight': 0.9
            }
        }
        
        # Store principles in database
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Check if principles exist
            cursor.execute('SELECT COUNT(*) FROM ethical_principles')
            if cursor.fetchone()[0] == 0:
                # Insert default principles
                for principle, data in self.principles.items():
                    cursor.execute('''
                        INSERT INTO ethical_principles (principle, description, weight)
                        VALUES (?, ?, ?)
                    ''', (principle, data['description'], data['weight']))
                conn.commit()

    def evaluate_action(self, action: str, context: Dict[str, Any]) -> EthicalDecision:
        """
        Evaluate an action against ethical principles
        Returns an EthicalDecision with evaluation results
        """
        principles_considered = set()
        total_alignment = 0.0
        justifications = []
        
        # Evaluate against each principle
        for principle, data in self.principles.items():
            alignment = self._evaluate_principle(principle, action, context)
            if alignment is not None:
                total_alignment += alignment * data['weight']
                principles_considered.add(principle)
                if alignment < 0.7:  # Add justification for low alignment
                    justifications.append(f"Potential {principle} concern")
        
        # Calculate overall alignment
        if principles_considered:
            value_alignment = total_alignment / len(principles_considered)
        else:
            value_alignment = 0.5  # Default neutral alignment
        
        # Generate justification
        if not justifications:
            justification = "Action aligns with ethical principles"
        else:
            justification = "; ".join(justifications)
        
        # Create and store decision
        decision = EthicalDecision(
            action=action,
            context=context,
            value_alignment=round(value_alignment, 3),
            justification=justification,
            principles_considered=list(principles_considered)
        )
        
        self._store_decision(decision)
        return decision

    def _evaluate_principle(self, principle: str, action: str, 
                          context: Dict[str, Any]) -> Optional[float]:
        """Evaluate an action against a specific ethical principle"""
        
        if principle == 'beneficence':
            # Evaluate if action benefits the user
            return self._evaluate_beneficence(action, context)
        
        elif principle == 'non_maleficence':
            # Evaluate potential for harm
            return self._evaluate_non_maleficence(action, context)
        
        elif principle == 'autonomy':
            # Evaluate respect for user autonomy
            return self._evaluate_autonomy(action, context)
        
        elif principle == 'privacy':
            # Evaluate privacy implications
            return self._evaluate_privacy(action, context)
        
        elif principle == 'transparency':
            # Evaluate transparency of action
            return self._evaluate_transparency(action, context)
        
        return None

    def _evaluate_beneficence(self, action: str, context: Dict[str, Any]) -> float:
        """Evaluate if action promotes user well-being"""
        # Implementation would include more sophisticated analysis
        positive_indicators = {
            'help', 'assist', 'support', 'improve', 'benefit',
            'enhance', 'protect', 'guide', 'advise'
        }
        
        negative_indicators = {
            'harm', 'damage', 'hurt', 'worsen', 'degrade',
            'diminish', 'impair'
        }
        
        action_lower = action.lower()
        positive_count = sum(1 for word in positive_indicators if word in action_lower)
        negative_count = sum(1 for word in negative_indicators if word in action_lower)
        
        if positive_count + negative_count == 0:
            return 0.5
        
        return positive_count / (positive_count + negative_count)

    def _evaluate_non_maleficence(self, action: str, context: Dict[str, Any]) -> float:
        """Evaluate potential for harm"""
        # Check for harmful content or actions
        harmful_indicators = {
            'delete', 'remove', 'block', 'restrict', 'limit',
            'deny', 'reject', 'harm', 'damage'
        }
        
        action_lower = action.lower()
        harm_count = sum(1 for word in harmful_indicators if word in action_lower)
        
        if harm_count > 0:
            return 0.3  # Potentially harmful action
        return 0.9  # Likely safe action

    def _evaluate_autonomy(self, action: str, context: Dict[str, Any]) -> float:
        """Evaluate respect for user autonomy"""
        # Check if action preserves user choice
        autonomy_indicators = {
            'option', 'choice', 'decide', 'prefer', 'choose',
            'suggest', 'recommend', 'may', 'might', 'could'
        }
        
        control_indicators = {
            'must', 'should', 'will', 'going to', 'need to',
            'require', 'demand', 'order', 'command'
        }
        
        action_lower = action.lower()
        autonomy_count = sum(1 for word in autonomy_indicators if word in action_lower)
        control_count = sum(1 for word in control_indicators if word in action_lower)
        
        if autonomy_count + control_count == 0:
            return 0.5
            
        return autonomy_count / (autonomy_count + control_count)

    def _evaluate_privacy(self, action: str, context: Dict[str, Any]) -> float:
        """Evaluate privacy implications"""
        # Check for privacy-sensitive operations
        privacy_sensitive = {
            'personal', 'private', 'confidential', 'secret',
            'sensitive', 'data', 'information', 'record'
        }
        
        action_lower = action.lower()
        privacy_count = sum(1 for word in privacy_sensitive if word in action_lower)
        
        if privacy_count > 0:
            return 0.4  # Privacy-sensitive action requires careful handling
        return 0.9  # Not privacy-sensitive

    def _evaluate_transparency(self, action: str, context: Dict[str, Any]) -> float:
        """Evaluate transparency of action"""
        # Check if action and its implications are clear
        transparency_indicators = {
            'explain', 'clarify', 'inform', 'tell', 'show',
            'display', 'present', 'indicate', 'notify'
        }
        
        action_lower = action.lower()
        transparency_count = sum(1 for word in transparency_indicators if word in action_lower)
        
        if transparency_count > 0:
            return 0.9  # Transparent action
        return 0.6  # Could be more transparent

    def _store_decision(self, decision: EthicalDecision) -> None:
        """Store ethical decision in database"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO ethical_decisions
                (timestamp, action, context, value_alignment, 
                 justification, principles_considered)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                decision.timestamp,
                decision.action,
                json.dumps(decision.context),
                decision.value_alignment,
                decision.justification,
                json.dumps(decision.principles_considered)
            ))
            conn.commit()

    def get_recent_decisions(self, limit: int = 10) -> List[EthicalDecision]:
        """Retrieve recent ethical decisions"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT timestamp, action, context, value_alignment,
                       justification, principles_considered
                FROM ethical_decisions
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (limit,))
            
            decisions = []
            for row in cursor.fetchall():
                decisions.append(EthicalDecision(
                    timestamp=row[0],
                    action=row[1],
                    context=json.loads(row[2]),
                    value_alignment=row[3],
                    justification=row[4],
                    principles_considered=json.loads(row[5])
                ))
            return decisions

    def update_principle_weight(self, principle: str, weight: float) -> None:
        """Update the weight of an ethical principle"""
        if principle in self.principles:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE ethical_principles
                    SET weight = ?
                    WHERE principle = ?
                ''', (weight, principle))
                conn.commit()
            self.principles[principle]['weight'] = weight
