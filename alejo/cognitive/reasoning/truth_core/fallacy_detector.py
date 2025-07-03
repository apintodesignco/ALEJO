"""
Fallacy Detector

This module provides functionality to detect logical fallacies in reasoning processes.
It helps ensure that ALEJO's reasoning remains sound by identifying common logical errors.

Features:
- Detection of common logical fallacies
- Explanation of detected fallacies
- Suggestions for fallacy remediation
- Integration with reasoning tracer
"""

import re
import logging
from enum import Enum
from typing import Dict, List, Set, Any, Optional, Tuple, Union

from alejo.utils.error_handling import handle_exceptions

# Configure logger
logger = logging.getLogger(__name__)


class FallacyCategory(Enum):
    """Categories of logical fallacies"""
    FORMAL = "formal"                 # Errors in logical structure
    INFORMAL = "informal"             # Errors in content/context
    RELEVANCE = "relevance"           # Irrelevant arguments
    PRESUMPTION = "presumption"       # Unwarranted assumptions
    AMBIGUITY = "ambiguity"           # Unclear language
    STATISTICAL = "statistical"       # Errors in statistical reasoning


class FallacyType(Enum):
    """Common types of logical fallacies"""
    # Formal fallacies
    AFFIRMING_CONSEQUENT = "affirming_consequent"
    DENYING_ANTECEDENT = "denying_antecedent"
    SYLLOGISTIC_ERROR = "syllogistic_error"
    
    # Informal fallacies
    AD_HOMINEM = "ad_hominem"
    APPEAL_TO_AUTHORITY = "appeal_to_authority"
    APPEAL_TO_EMOTION = "appeal_to_emotion"
    APPEAL_TO_NATURE = "appeal_to_nature"
    APPEAL_TO_POPULARITY = "appeal_to_popularity"
    APPEAL_TO_TRADITION = "appeal_to_tradition"
    CIRCULAR_REASONING = "circular_reasoning"
    FALSE_DILEMMA = "false_dilemma"
    HASTY_GENERALIZATION = "hasty_generalization"
    POST_HOC = "post_hoc"
    SLIPPERY_SLOPE = "slippery_slope"
    STRAW_MAN = "straw_man"
    
    # Statistical fallacies
    GAMBLER_FALLACY = "gambler_fallacy"
    CORRELATION_CAUSATION = "correlation_causation"
    SAMPLING_BIAS = "sampling_bias"
    REGRESSION_TO_MEAN = "regression_to_mean"


class FallacyDetection:
    """
    Represents a detected fallacy
    """
    def __init__(
        self,
        fallacy_type: FallacyType,
        description: str,
        evidence: str,
        confidence: float,
        remediation: str = None
    ):
        """
        Initialize a fallacy detection
        
        Args:
            fallacy_type: Type of fallacy detected
            description: Description of the fallacy instance
            evidence: Evidence supporting the detection
            confidence: Confidence in the detection (0.0 to 1.0)
            remediation: Suggested remediation for the fallacy
        """
        self.fallacy_type = fallacy_type
        self.description = description
        self.evidence = evidence
        self.confidence = min(max(confidence, 0.0), 1.0)  # Ensure between 0 and 1
        self.remediation = remediation
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert detection to dictionary"""
        return {
            "fallacy_type": self.fallacy_type.value,
            "description": self.description,
            "evidence": self.evidence,
            "confidence": self.confidence,
            "remediation": self.remediation
        }


class FallacyDetector:
    """
    Detects logical fallacies in reasoning
    """
    def __init__(self):
        """Initialize the fallacy detector"""
        # Initialize fallacy patterns
        self._init_fallacy_patterns()
        logger.info("Fallacy Detector initialized")
    
    def _init_fallacy_patterns(self):
        """Initialize patterns for detecting fallacies"""
        # These are simplified patterns for demonstration
        # A more sophisticated implementation would use NLP techniques
        
        self.patterns = {
            # Formal fallacies
            FallacyType.AFFIRMING_CONSEQUENT: [
                r"if\s+(.+?)\s+then\s+(.+?)[\.,;].*\2.*therefore\s+\1",
                r"(.+?)\s+implies\s+(.+?)[\.,;].*\2.*therefore\s+\1"
            ],
            
            FallacyType.DENYING_ANTECEDENT: [
                r"if\s+(.+?)\s+then\s+(.+?)[\.,;].*not\s+\1.*therefore\s+not\s+\2",
                r"(.+?)\s+implies\s+(.+?)[\.,;].*not\s+\1.*therefore\s+not\s+\2"
            ],
            
            # Informal fallacies
            FallacyType.AD_HOMINEM: [
                r"(.+?)\s+is\s+(stupid|ignorant|foolish|dishonest|corrupt|biased)",
                r"(you|they|he|she)\s+(don't|doesn't)\s+know\s+what\s+(you're|they're|he's|she's)\s+talking\s+about"
            ],
            
            FallacyType.APPEAL_TO_AUTHORITY: [
                r"(expert|authority|professor|doctor|scientist)s?\s+say",
                r"according\s+to\s+(experts|authorities|scientists)",
                r"(studies|research)\s+shows?"
            ],
            
            FallacyType.CIRCULAR_REASONING: [
                r"(.+?)\s+is\s+true\s+because\s+(.+?)[\.,;].*\2.*because\s+\1",
                r"(.+?)\s+because\s+(.+?)[\.,;].*\2.*because\s+\1"
            ],
            
            FallacyType.FALSE_DILEMMA: [
                r"(either|either\s+you|you\s+either)\s+(.+?)\s+or\s+(.+?)[,\.]",
                r"(there\s+are\s+only\s+two|there\s+are\s+just\s+two)\s+options"
            ],
            
            FallacyType.HASTY_GENERALIZATION: [
                r"(all|every|always|never)\s+(.+?)\s+(are|is|do|does)",
                r"(.+?)\s+are\s+always\s+(.+?)"
            ],
            
            FallacyType.SLIPPERY_SLOPE: [
                r"if\s+(.+?)\s+then\s+next\s+(.+?)\s+and\s+then\s+(.+?)",
                r"(.+?)\s+will\s+lead\s+to\s+(.+?)\s+and\s+eventually\s+(.+?)"
            ],
            
            FallacyType.STRAW_MAN: [
                r"(you|they|he|she)\s+(say|claim|argue|believe)s?\s+that\s+(.+?),\s+but\s+that's\s+not\s+what",
                r"(you're|they're|he's|she's)\s+arguing\s+that\s+(.+?),\s+which\s+is\s+absurd"
            ],
            
            # Statistical fallacies
            FallacyType.CORRELATION_CAUSATION: [
                r"(.+?)\s+causes\s+(.+?)\s+because\s+they\s+are\s+correlated",
                r"(.+?)\s+is\s+correlated\s+with\s+(.+?),\s+so\s+(.+?)\s+causes\s+(.+?)"
            ],
            
            FallacyType.GAMBLER_FALLACY: [
                r"(it's|it\s+is)\s+due\s+to\s+happen",
                r"(it's|it\s+is)\s+bound\s+to\s+occur\s+soon",
                r"the\s+odds\s+are\s+in\s+(my|our|your|their)\s+favor\s+now"
            ]
        }
        
        # Fallacy remediations
        self.remediations = {
            FallacyType.AFFIRMING_CONSEQUENT: 
                "Avoid assuming that if A implies B, and B is true, then A must be true. Consider other causes for B.",
                
            FallacyType.DENYING_ANTECEDENT:
                "Avoid assuming that if A implies B, and A is false, then B must be false. B could still be true for other reasons.",
                
            FallacyType.AD_HOMINEM:
                "Focus on the argument itself rather than attacking the person making it.",
                
            FallacyType.APPEAL_TO_AUTHORITY:
                "Evaluate the evidence and reasoning rather than relying solely on authority figures.",
                
            FallacyType.CIRCULAR_REASONING:
                "Avoid using the conclusion as a premise in your argument.",
                
            FallacyType.FALSE_DILEMMA:
                "Consider whether there are more than just two options in this situation.",
                
            FallacyType.HASTY_GENERALIZATION:
                "Ensure you have sufficient evidence before making broad generalizations.",
                
            FallacyType.SLIPPERY_SLOPE:
                "Evaluate each step in the causal chain and consider whether each necessarily leads to the next.",
                
            FallacyType.STRAW_MAN:
                "Ensure you are addressing the actual argument rather than a misrepresented version.",
                
            FallacyType.CORRELATION_CAUSATION:
                "Remember that correlation does not imply causation. Consider alternative explanations.",
                
            FallacyType.GAMBLER_FALLACY:
                "Remember that random events are independent; past outcomes don't influence future probabilities."
        }
    
    @handle_exceptions
    def detect_fallacies(self, text: str) -> List[FallacyDetection]:
        """
        Detect fallacies in text
        
        Args:
            text: Text to analyze for fallacies
            
        Returns:
            List of detected fallacies
        """
        # Normalize text for pattern matching
        normalized_text = self._normalize_text(text)
        
        # Detect fallacies
        detections = []
        
        for fallacy_type, patterns in self.patterns.items():
            for pattern in patterns:
                matches = re.finditer(pattern, normalized_text, re.IGNORECASE)
                
                for match in matches:
                    # Extract the matched text as evidence
                    evidence = match.group(0)
                    
                    # Create fallacy detection
                    detection = FallacyDetection(
                        fallacy_type=fallacy_type,
                        description=self._get_fallacy_description(fallacy_type),
                        evidence=evidence,
                        confidence=self._calculate_confidence(fallacy_type, evidence),
                        remediation=self.remediations.get(fallacy_type, "")
                    )
                    
                    detections.append(detection)
        
        return detections
    
    @handle_exceptions
    def analyze_reasoning_chain(self, premises: List[str], conclusion: str) -> List[FallacyDetection]:
        """
        Analyze a reasoning chain for fallacies
        
        Args:
            premises: List of premise statements
            conclusion: Conclusion statement
            
        Returns:
            List of detected fallacies
        """
        detections = []
        
        # Check each premise individually
        for i, premise in enumerate(premises):
            premise_detections = self.detect_fallacies(premise)
            for detection in premise_detections:
                detections.append(detection)
        
        # Check conclusion
        conclusion_detections = self.detect_fallacies(conclusion)
        for detection in conclusion_detections:
            detections.append(detection)
        
        # Check relationships between premises and conclusion
        chain_detections = self._analyze_premise_conclusion_relationship(premises, conclusion)
        for detection in chain_detections:
            detections.append(detection)
        
        return detections
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for pattern matching"""
        # Convert to lowercase
        text = text.lower()
        
        # Replace common contractions
        contractions = {
            "isn't": "is not",
            "aren't": "are not",
            "can't": "cannot",
            "won't": "will not",
            "don't": "do not",
            "doesn't": "does not",
            "hasn't": "has not",
            "haven't": "have not",
            "shouldn't": "should not",
            "wouldn't": "would not",
            "couldn't": "could not",
        }
        
        for contraction, expansion in contractions.items():
            text = text.replace(contraction, expansion)
        
        return text
    
    def _get_fallacy_description(self, fallacy_type: FallacyType) -> str:
        """Get description for a fallacy type"""
        descriptions = {
            # Formal fallacies
            FallacyType.AFFIRMING_CONSEQUENT: 
                "Affirming the Consequent: Incorrectly concluding that if A implies B, and B is true, then A must be true.",
                
            FallacyType.DENYING_ANTECEDENT:
                "Denying the Antecedent: Incorrectly concluding that if A implies B, and A is false, then B must be false.",
                
            FallacyType.SYLLOGISTIC_ERROR:
                "Syllogistic Error: Invalid logical structure in a syllogism.",
            
            # Informal fallacies
            FallacyType.AD_HOMINEM:
                "Ad Hominem: Attacking the person instead of addressing their argument.",
                
            FallacyType.APPEAL_TO_AUTHORITY:
                "Appeal to Authority: Using an authority's opinion as evidence without evaluating the argument itself.",
                
            FallacyType.APPEAL_TO_EMOTION:
                "Appeal to Emotion: Using emotional manipulation instead of valid reasoning.",
                
            FallacyType.APPEAL_TO_NATURE:
                "Appeal to Nature: Arguing that something is good because it's 'natural'.",
                
            FallacyType.APPEAL_TO_POPULARITY:
                "Appeal to Popularity: Arguing that something is true because many people believe it.",
                
            FallacyType.APPEAL_TO_TRADITION:
                "Appeal to Tradition: Arguing that something is good because it's traditional.",
                
            FallacyType.CIRCULAR_REASONING:
                "Circular Reasoning: Using the conclusion as a premise in the argument.",
                
            FallacyType.FALSE_DILEMMA:
                "False Dilemma: Presenting only two options when more exist.",
                
            FallacyType.HASTY_GENERALIZATION:
                "Hasty Generalization: Drawing a general conclusion from insufficient evidence.",
                
            FallacyType.POST_HOC:
                "Post Hoc: Assuming that because B followed A, A caused B.",
                
            FallacyType.SLIPPERY_SLOPE:
                "Slippery Slope: Arguing that one small step will inevitably lead to extreme consequences.",
                
            FallacyType.STRAW_MAN:
                "Straw Man: Misrepresenting an opponent's argument to make it easier to attack.",
            
            # Statistical fallacies
            FallacyType.GAMBLER_FALLACY:
                "Gambler's Fallacy: Believing that past random events affect future random events.",
                
            FallacyType.CORRELATION_CAUSATION:
                "Correlation-Causation Fallacy: Assuming that correlation implies causation.",
                
            FallacyType.SAMPLING_BIAS:
                "Sampling Bias: Drawing conclusions from a non-representative sample.",
                
            FallacyType.REGRESSION_TO_MEAN:
                "Regression to the Mean: Failing to account for natural statistical variation."
        }
        
        return descriptions.get(fallacy_type, "Unknown fallacy type")
    
    def _calculate_confidence(self, fallacy_type: FallacyType, evidence: str) -> float:
        """Calculate confidence for a fallacy detection"""
        # This is a simplified implementation
        # A more sophisticated implementation would use more advanced NLP techniques
        
        # Base confidence
        base_confidence = 0.7
        
        # Adjust based on evidence length (longer evidence might be more reliable)
        length_factor = min(len(evidence) / 100, 0.2)
        
        # Adjust based on fallacy type (some fallacies are harder to detect reliably)
        type_factors = {
            FallacyType.AFFIRMING_CONSEQUENT: 0.1,
            FallacyType.DENYING_ANTECEDENT: 0.1,
            FallacyType.AD_HOMINEM: 0.05,
            FallacyType.APPEAL_TO_AUTHORITY: -0.1,
            FallacyType.CIRCULAR_REASONING: 0.05,
            FallacyType.FALSE_DILEMMA: -0.05,
            FallacyType.HASTY_GENERALIZATION: -0.1,
            FallacyType.SLIPPERY_SLOPE: 0.0,
            FallacyType.STRAW_MAN: -0.15,
            FallacyType.CORRELATION_CAUSATION: 0.05,
            FallacyType.GAMBLER_FALLACY: 0.1
        }
        
        type_factor = type_factors.get(fallacy_type, 0.0)
        
        # Calculate final confidence
        confidence = base_confidence + length_factor + type_factor
        
        # Ensure confidence is between 0 and 1
        return min(max(confidence, 0.0), 1.0)
    
    def _analyze_premise_conclusion_relationship(
        self,
        premises: List[str],
        conclusion: str
    ) -> List[FallacyDetection]:
        """Analyze the relationship between premises and conclusion"""
        detections = []
        
        # Check for non sequitur (conclusion doesn't follow from premises)
        # This is a simplified implementation
        
        # Join premises and check if any keywords from premises appear in conclusion
        all_premises = " ".join(premises).lower()
        conclusion_lower = conclusion.lower()
        
        premise_keywords = set(re.findall(r'\b\w{4,}\b', all_premises))
        conclusion_keywords = set(re.findall(r'\b\w{4,}\b', conclusion_lower))
        
        # If there's minimal overlap between premise and conclusion keywords,
        # it might be a non sequitur
        overlap = premise_keywords.intersection(conclusion_keywords)
        if len(overlap) < 2 and len(conclusion_keywords) > 3:
            detection = FallacyDetection(
                fallacy_type=FallacyType.SYLLOGISTIC_ERROR,
                description="Non Sequitur: The conclusion does not follow from the premises.",
                evidence=f"Premises: {'; '.join(premises)}. Conclusion: {conclusion}",
                confidence=0.6,
                remediation="Ensure that your conclusion logically follows from your premises."
            )
            detections.append(detection)
        
        return detections
