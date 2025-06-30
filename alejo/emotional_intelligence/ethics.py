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
    def get_recent_decisions(self, limit: int = 10) -> List[EthicalDecision]:
        """Retrieve recent ethical decisions"""
        if not self.db_path:
            # Return from in-memory history if no database
            return self.decision_history[-limit:] if self.decision_history else []
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT timestamp, action, context, value_alignment, justification, principles_considered
                    FROM ethical_decisions
                    ORDER BY id DESC
                    LIMIT ?
                ''', (limit,))
                
                decisions = []
                for row in cursor.fetchall():
                    timestamp_str, action, context_json, score, reasoning, principles_json = row
                    
                    # Parse JSON fields
                    context = json.loads(context_json)
                    principles_evaluation = json.loads(principles_json)
                    
                    # Create decision object
                    decision = EthicalDecision(
                        action=action,
                        context=context,
                        principles_evaluation=principles_evaluation,
                        overall_score=score,
                        reasoning=reasoning,
                        recommendation="",  # Not stored in DB
                        timestamp=datetime.fromisoformat(timestamp_str)
                    )
                    
                    decisions.append(decision)
                
                return decisions
        except sqlite3.Error as e:
            logger.error(f"Database error when retrieving decisions: {e}")
            return []
    
    def get_recent_evaluations(self, limit: int = 10) -> List[EmotionalEthicsEvaluation]:
        """Retrieve recent emotional ethics evaluations"""
        if not self.db_path:
            # Return from in-memory history if no database
            return self.emotional_ethics_history[-limit:] if self.emotional_ethics_history else []
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT timestamp, emotional_state, context, overall_score, risks_identified, recommendations
                    FROM emotional_ethics_evaluations
                    ORDER BY id DESC
                    LIMIT ?
                ''', (limit,))
                
                evaluations = []
                for row in cursor.fetchall():
                    timestamp_str, emotional_state_json, context_json, score, risks_json, recommendations_json = row
                    
                    # Parse JSON fields
                    emotional_state = json.loads(emotional_state_json)
                    context = json.loads(context_json)
                    risks = json.loads(risks_json)
                    recommendations = json.loads(recommendations_json)
                    
                    # Create simplified evaluation object (without full risk objects)
                    evaluation = EmotionalEthicsEvaluation(
                        emotional_state=emotional_state,
                        context=context,
                        principles_evaluation={},  # Not stored in DB
                        overall_ethical_score=score,
                        identified_risks=[],  # Simplified
                        recommendations=recommendations,
                        transparency_report={"retrieved_from_db": True},
                        timestamp=datetime.fromisoformat(timestamp_str)
                    )
                    
                    evaluations.append(evaluation)
                
                return evaluations
        except sqlite3.Error as e:
            logger.error(f"Database error when retrieving evaluations: {e}")
            return []
    def get_ethical_principle_stats(self) -> Dict[str, Dict[str, float]]:
        """Get statistics on ethical principle evaluations"""
        stats = {}
        
        # Process in-memory history
        for decision in self.decision_history:
            for principle, score in decision.principles_evaluation.items():
                if principle not in stats:
                    stats[principle] = {
                        "count": 0,
                        "sum": 0,
                        "min": float('inf'),
                        "max": float('-inf')
                    }
                
                stats[principle]["count"] += 1
                stats[principle]["sum"] += score
                stats[principle]["min"] = min(stats[principle]["min"], score)
                stats[principle]["max"] = max(stats[principle]["max"], score)
        
        # Calculate averages
        for principle in stats:
            if stats[principle]["count"] > 0:
                stats[principle]["avg"] = stats[principle]["sum"] / stats[principle]["count"]
            else:
                stats[principle]["avg"] = 0
            
            # Clean up
            del stats[principle]["sum"]
        
        return stats
    
    def export_decision_history(self, file_path: str) -> bool:
        """Export decision history to a JSON file for analysis"""
        try:
            # Convert decision history to serializable format
            history = []
            for decision in self.decision_history:
                history.append({
                    "action": decision.action,
                    "context": decision.context,
                    "principles_evaluation": decision.principles_evaluation,
                    "overall_score": decision.overall_score,
                    "reasoning": decision.reasoning,
                    "recommendation": decision.recommendation,
                    "timestamp": decision.timestamp.isoformat(),
                    "emotional_context": decision.emotional_context
                })
            
            # Write to file
            with open(file_path, 'w') as f:
                json.dump(history, f, indent=2)
            
            logger.info(f"Decision history exported to {file_path}")
            return True
        except Exception as e:
            logger.error(f"Error exporting decision history: {e}")
            return False
    
    def export_ethics_evaluation_history(self, file_path: str) -> bool:
        """Export emotional ethics evaluation history to a JSON file for analysis"""
        try:
            # Convert evaluation history to serializable format
            history = []
            for eval in self.emotional_ethics_history:
                history.append({
                    "emotional_state": eval.emotional_state,
                    "context": eval.context,
                    "principles_evaluation": {p.name: score for p, score in eval.principles_evaluation.items()},
                    "overall_ethical_score": eval.overall_ethical_score,
                    "identified_risks": [
                        {
                            "risk_type": risk.risk_type,
                            "description": risk.description,
                            "level": risk.level.name,
                            "affected_principles": [p.name for p in risk.affected_principles],
                            "mitigation_strategy": risk.mitigation_strategy
                        }
                        for risk in eval.identified_risks
                    ],
                    "recommendations": eval.recommendations,
                    "timestamp": eval.timestamp.isoformat()
                })
            
            # Write to file
            with open(file_path, 'w') as f:
                json.dump(history, f, indent=2)
            
            logger.info(f"Ethics evaluation history exported to {file_path}")
            return True
        except Exception as e:
            logger.error(f"Error exporting ethics evaluation history: {e}")
            return False
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
        self.db_path = None
        
        # Initialize database if needed
        self.initialize_database()
    def initialize_database(self, db_path: str = None):
        """Initialize the database for storing ethical decisions and principles"""
        if db_path is None:
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ethics.db')
        
        self.db_path = db_path
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create ethical decisions table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS ethical_decisions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        action TEXT NOT NULL,
                        context TEXT NOT NULL,
                        value_alignment REAL NOT NULL,
                        justification TEXT NOT NULL,
                        principles_considered TEXT NOT NULL
                    )
                ''')
                
                # Create ethical principles table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS ethical_principles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        principle TEXT NOT NULL,
                        description TEXT NOT NULL,
                        weight REAL NOT NULL
                    )
                ''')
                
                # Create emotional ethics evaluations table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS emotional_ethics_evaluations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        emotional_state TEXT NOT NULL,
                        context TEXT NOT NULL,
                        overall_score REAL NOT NULL,
                        risks_identified TEXT NOT NULL,
                        recommendations TEXT NOT NULL
                    )
                ''')
                
                conn.commit()
                logger.info(f"Ethical framework database initialized at {db_path}")
        except sqlite3.Error as e:
            logger.error(f"Database initialization error: {e}")
            # Fall back to in-memory operation
            self.db_path = None
    def evaluate_emotional_ethics(self, emotional_state: Dict[str, float], 
                                context: Dict[str, Any]) -> EmotionalEthicsEvaluation:
        """Evaluate the ethical implications of an emotional response"""
        try:
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
            
            # Store in database if available
            self._store_evaluation_in_db(evaluation)
                
            return evaluation
        except Exception as e:
            logger.error(f"Error in evaluate_emotional_ethics: {e}")
            # Return a safe default evaluation
            return EmotionalEthicsEvaluation(
                emotional_state=emotional_state,
                context=context,
                principles_evaluation={p: 0.5 for p in EthicalPrinciple},
                overall_ethical_score=0.5,
                identified_risks=[],
                recommendations=["Error occurred during evaluation, proceed with caution"],
                transparency_report={"error": str(e)}
            )
    def _detect_risk(self, emotional_state: Dict[str, float], 
                    context: Dict[str, Any], risk_info: Dict[str, Any]) -> bool:
        """Detect if a specific risk is present in the emotional response"""
        try:
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
                        
                # Check for inconsistent emotions
                if "inconsistent emotions" in patterns:
                    # Look for contradictory emotions with high intensity
                    contradictory_pairs = [
                        ("joy", "sadness"), 
                        ("anger", "calm"), 
                        ("fear", "confidence")
                    ]
                    for emotion1, emotion2 in contradictory_pairs:
                        if (emotion1 in emotional_state and emotion2 in emotional_state and
                            emotional_state[emotion1] > 0.6 and emotional_state[emotion2] > 0.6):
                            return True
                
                # Check for contextually inappropriate emotions
                if "contextually inappropriate" in patterns and "context_type" in context:
                    context_type = context["context_type"]
                    if context_type == "formal" and "excitement" in emotional_state and emotional_state["excitement"] > 0.8:
                        return True
                    if context_type == "somber" and "joy" in emotional_state and emotional_state["joy"] > 0.7:
                        return True
                
                # Check for cultural context mismatch
                if "ignores cultural context" in patterns and "cultural_context" in context:
                    culture = context["cultural_context"]
                    if culture == "high_context" and "directness" in emotional_state and emotional_state["directness"] > 0.8:
                        return True
            
            return False
        except Exception as e:
            logger.error(f"Error in _detect_risk: {e}")
            # Default to safe behavior - assume risk exists
            return True
    def _evaluate_principle(self, principle: EthicalPrinciple, 
                           emotional_state: Dict[str, float], 
                           context: Dict[str, Any]) -> float:
        """Evaluate how well the emotional response adheres to an ethical principle"""
        try:
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
                    if culture == "individualist" and "shame" in emotional_state and emotional_state["shame"] > 0.7:
                        score -= 0.3  # Shame emphasis in individualist cultures
                    if culture == "collectivist" and "pride" in emotional_state and emotional_state["pride"] > 0.8:
                        score -= 0.3  # Excessive pride in collectivist cultures
            
            elif principle == EthicalPrinciple.EMOTIONAL_RESPECT:
                # Check if response respects others' emotions
                if "user_emotional_state" in context:
                    user_state = context["user_emotional_state"]
                    if "anger" in user_state and user_state["anger"] > 0.7:
                        if "joy" in emotional_state and emotional_state["joy"] > 0.7:
                            score -= 0.5  # Responding with joy to anger shows disrespect
                    if "sadness" in user_state and user_state["sadness"] > 0.7:
                        if "excitement" in emotional_state and emotional_state["excitement"] > 0.7:
                            score -= 0.4  # Responding with excitement to sadness shows disrespect
            
            elif principle == EthicalPrinciple.AUTONOMY:
                # Check if response respects user autonomy
                if "directive_intensity" in emotional_state and emotional_state["directive_intensity"] > 0.8:
                    score -= 0.4  # Highly directive emotional responses may undermine autonomy
                if "persuasive_intent" in context and context["persuasive_intent"] > 0.7:
                    score -= 0.3  # High persuasive intent may undermine autonomy
            
            elif principle == EthicalPrinciple.NON_MALEFICENCE:
                # Check for potentially harmful emotional responses
                harmful_emotions = ["contempt", "disgust", "condescension"]
                for emotion in harmful_emotions:
                    if emotion in emotional_state and emotional_state[emotion] > 0.6:
                        score -= 0.5
            
            # Ensure score is within bounds
            return max(0.1, min(1.0, score))
        except Exception as e:
            logger.error(f"Error in _evaluate_principle: {e}")
            # Return a moderate score as fallback
            return 0.5
    def _get_dominant_emotions(self, emotional_state: Dict[str, float], n: int = 3) -> List[str]:
        """Get the n most dominant emotions"""
        try:
            sorted_emotions = sorted(emotional_state.items(), key=lambda x: x[1], reverse=True)
            return [emotion for emotion, _ in sorted_emotions[:n]]
        except Exception as e:
            logger.error(f"Error in _get_dominant_emotions: {e}")
            return list(emotional_state.keys())[:min(n, len(emotional_state))]
    
    def _store_evaluation_in_db(self, evaluation: EmotionalEthicsEvaluation) -> bool:
        """Store an emotional ethics evaluation in the database"""
        if not self.db_path:
            return False
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO emotional_ethics_evaluations 
                    (timestamp, emotional_state, context, overall_score, risks_identified, recommendations)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    evaluation.timestamp.isoformat(),
                    json.dumps({k: v for k, v in evaluation.emotional_state.items()}),
                    json.dumps(evaluation.context),
                    evaluation.overall_ethical_score,
                    json.dumps([r.risk_type for r in evaluation.identified_risks]),
                    json.dumps(evaluation.recommendations)
                ))
                conn.commit()
                return True
        except sqlite3.Error as e:
            logger.error(f"Database error when storing evaluation: {e}")
            return False
    
    def evaluate_decision(self, action: str, context: Dict[str, Any], 
                         emotional_context: Optional[Dict[str, Any]] = None) -> EthicalDecision:
        """Evaluate an action for ethical alignment"""
        try:
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
                
                if principle_name == EthicalPrinciple.NON_MALEFICENCE:
                    # Check for potentially harmful actions
                    harmful_keywords = ["delete", "remove", "override", "force", "ignore consent"]
                    if any(keyword in action.lower() for keyword in harmful_keywords):
                        score = 0.4  # Potentially harmful action
                
                if principle_name == EthicalPrinciple.TRANSPARENCY:
                    # Check for transparency in action
                    if "explanation" not in context and "justification" not in context:
                        score = 0.5  # Lack of transparency
                
                principles_evaluation[str(principle_name.name)] = score
            
            # Calculate overall score
            overall_score = sum(principles_evaluation.values()) / len(principles_evaluation)
            
            # Generate reasoning
            reasoning = f"Action '{action}' evaluated against {len(principles_evaluation)} ethical principles."
            if overall_score < 0.6:
                reasoning += " Significant ethical concerns identified."
                for principle, score in principles_evaluation.items():
                    if score < 0.6:
                        reasoning += f" {principle} score: {score:.2f}."
            
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
            
            # Store in database if available
            self._store_decision_in_db(decision)
            
            return decision
        except Exception as e:
            logger.error(f"Error in evaluate_decision: {e}")
            # Return a safe default decision
            return EthicalDecision(
                action=action,
                context=context,
                principles_evaluation={"ERROR": 0.5},
                overall_score=0.5,
                reasoning=f"Error during evaluation: {str(e)}",
                recommendation="Proceed with caution due to evaluation error",
                emotional_context=emotional_context or {}
            )
    def _store_decision_in_db(self, decision: EthicalDecision) -> bool:
        """Store an ethical decision in the database"""
        if not self.db_path:
            return False
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO ethical_decisions 
                    (timestamp, action, context, value_alignment, justification, principles_considered)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    decision.timestamp.isoformat(),
                    decision.action,
                    json.dumps(decision.context),
                    decision.overall_score,
                    decision.reasoning,
                    json.dumps({k: v for k, v in decision.principles_evaluation.items()})
                ))
                conn.commit()
                return True
        except sqlite3.Error as e:
            logger.error(f"Database error when storing decision: {e}")
            return False
    
    def evaluate_emotional_response(self, response_text: str, emotional_state: Dict[str, float], 
                                  context: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate an emotional response for ethical considerations"""
        try:
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
                
                # Add specific safeguards based on identified risks
                for risk in ethics_eval.identified_risks:
                    if risk.level in [EmotionalRiskLevel.HIGH, EmotionalRiskLevel.CRITICAL]:
                        evaluation["safeguards"]["critical_warning"] = True
                        evaluation["safeguards"]["required_actions"].append(
                            f"Address {risk.risk_type}: {risk.mitigation_strategy}"
                        )
            
            # Analyze response text for additional concerns
            if response_text:
                # Check for manipulative language patterns
                manipulative_patterns = [
                    "you should", "you must", "you need to", 
                    "always", "never", "everyone", "nobody"
                ]
                
                found_patterns = [p for p in manipulative_patterns if p in response_text.lower()]
                if found_patterns:
                    if "risks" not in evaluation:
                        evaluation["risks"] = []
                    
                    evaluation["risks"].append({
                        "type": "manipulative_language",
                        "description": "Response contains potentially manipulative language patterns",
                        "level": "MODERATE",
                        "mitigation": "Rephrase using less directive language",
                        "patterns_found": found_patterns
                    })
                    
                    if "recommendations" not in evaluation:
                        evaluation["recommendations"] = []
                    
                    evaluation["recommendations"].append(
                        "Rephrase response to avoid manipulative language patterns"
                    )
            
            return evaluation
        except Exception as e:
            logger.error(f"Error in evaluate_emotional_response: {e}")
            # Return a safe default evaluation
            return {
                "ethical_score": 0.5,
                "risks": [{
                    "type": "evaluation_error",
                    "description": f"Error during evaluation: {str(e)}",
                    "level": "HIGH",
                    "mitigation": "Proceed with caution and minimal emotional expression"
                }],
                "recommendations": ["Proceed with caution due to evaluation error"],
                "safeguards": {
                    "warning": "Evaluation error occurred, defaulting to safe response",
                    "required_actions": ["Minimize emotional expression", "Focus on factual content"]
                }
            }
    
    def get_recent_decisions(self, limit: int = 10) -> List[EthicalDecision]:
        """Retrieve recent ethical decisions"""
        if not self.db_path:
            # Return from in-memory history if no database
            return self.decision_history[-limit:] if self.decision_history else []
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT timestamp, action, context, value_alignment, justification, principles_considered
                    FROM ethical_decisions
                    ORDER BY id DESC
                    LIMIT ?
                ''', (limit,))
                
                decisions = []
                for row in cursor.fetchall():
                    timestamp_str, action, context_json, score, reasoning, principles_json = row
                    
                    # Parse JSON fields
                    context = json.loads(context_json)
                    principles_evaluation = json.loads(principles_json)
                    
                    # Create decision object
                    decision = EthicalDecision(
                        action=action,
                        context=context,
                        principles_evaluation=principles_evaluation,
                        overall_score=score,
                        reasoning=reasoning,
                        recommendation="",  # Not stored in DB
                        timestamp=datetime.fromisoformat(timestamp_str)
                    )
                    
                    decisions.append(decision)
                
                return decisions
        except sqlite3.Error as e:
            logger.error(f"Database error when retrieving decisions: {e}")
            return []
    
    def get_recent_evaluations(self, limit: int = 10) -> List[EmotionalEthicsEvaluation]:
        """Retrieve recent emotional ethics evaluations"""
        if not self.db_path:
            # Return from in-memory history if no database
            return self.emotional_ethics_history[-limit:] if self.emotional_ethics_history else []
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT timestamp, emotional_state, context, overall_score, risks_identified, recommendations
                    FROM emotional_ethics_evaluations
                    ORDER BY id DESC
                    LIMIT ?
                ''', (limit,))
                
                evaluations = []
                for row in cursor.fetchall():
                    timestamp_str, emotional_state_json, context_json, score, risks_json, recommendations_json = row
                    
                    # Parse JSON fields
                    emotional_state = json.loads(emotional_state_json)
                    context = json.loads(context_json)
                    risks = json.loads(risks_json)
                    recommendations = json.loads(recommendations_json)
                    
                    # Create simplified evaluation object (without full risk objects)
                    evaluation = EmotionalEthicsEvaluation(
                        emotional_state=emotional_state,
                        context=context,
                        principles_evaluation={},  # Not stored in DB
                        overall_ethical_score=score,
                        identified_risks=[],  # Simplified
                        recommendations=recommendations,
                        transparency_report={"retrieved_from_db": True},
                        timestamp=datetime.fromisoformat(timestamp_str)
                    )
                    
                    evaluations.append(evaluation)
                
                return evaluations
        except sqlite3.Error as e:
            logger.error(f"Database error when retrieving evaluations: {e}")
            return []
            
    def get_ethical_principle_stats(self) -> Dict[str, Dict[str, float]]:
        """Get statistics on ethical principle evaluations"""
        stats = {}
        
        # Process in-memory history
        for decision in self.decision_history:
            for principle, score in decision.principles_evaluation.items():
                if principle not in stats:
                    stats[principle] = {
                        "count": 0,
                        "sum": 0,
                        "min": float('inf'),
                        "max": float('-inf')
                    }
                
                stats[principle]["count"] += 1
                stats[principle]["sum"] += score
                stats[principle]["min"] = min(stats[principle]["min"], score)
                stats[principle]["max"] = max(stats[principle]["max"], score)
        
        # Calculate averages
        for principle in stats:
            if stats[principle]["count"] > 0:
                stats[principle]["avg"] = stats[principle]["sum"] / stats[principle]["count"]
            else:
                stats[principle]["avg"] = 0
            
            # Clean up
            del stats[principle]["sum"]
        
        return stats
    
    def export_decision_history(self, file_path: str) -> bool:
        """Export decision history to a JSON file for analysis"""
        try:
            # Convert decision history to serializable format
            history = []
            for decision in self.decision_history:
                history.append({
                    "action": decision.action,
                    "context": decision.context,
                    "principles_evaluation": decision.principles_evaluation,
                    "overall_score": decision.overall_score,
                    "reasoning": decision.reasoning,
                    "recommendation": decision.recommendation,
                    "timestamp": decision.timestamp.isoformat(),
                    "emotional_context": decision.emotional_context
                })
            
            # Write to file
            with open(file_path, 'w') as f:
                json.dump(history, f, indent=2)
            
            logger.info(f"Decision history exported to {file_path}")
            return True
        except Exception as e:
            logger.error(f"Error exporting decision history: {e}")
            return False
    
    def export_ethics_evaluation_history(self, file_path: str) -> bool:
        """Export emotional ethics evaluation history to a JSON file for analysis"""
        try:
            # Convert evaluation history to serializable format
            history = []
            for eval in self.emotional_ethics_history:
                history.append({
                    "emotional_state": eval.emotional_state,
                    "context": eval.context,
                    "principles_evaluation": {p.name: score for p, score in eval.principles_evaluation.items()},
                    "overall_ethical_score": eval.overall_ethical_score,
                    "identified_risks": [
                        {
                            "risk_type": risk.risk_type,
                            "description": risk.description,
                            "level": risk.level.name,
                            "affected_principles": [p.name for p in risk.affected_principles],
                            "mitigation_strategy": risk.mitigation_strategy
                        }
                        for risk in eval.identified_risks
                    ],
                    "recommendations": eval.recommendations,
                    "timestamp": eval.timestamp.isoformat()
                })
            
            # Write to file
            with open(file_path, 'w') as f:
                json.dump(history, f, indent=2)
            
            logger.info(f"Ethics evaluation history exported to {file_path}")
            return True
        except Exception as e:
            logger.error(f"Error exporting ethics evaluation history: {e}")
            return False
