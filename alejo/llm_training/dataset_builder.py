"""
Dataset Builder for ALEJO LLM Fine-tuning

Extracts personality traits, ethical principles, and behavioral patterns
from ALEJO's codebase to create training datasets for LLM fine-tuning.
"""

import os
import json
import logging
from typing import Dict, List, Any, Tuple
from pathlib import Path
import sqlite3

from ..emotional_intelligence.ethics import EthicalFramework
from ..emotional_intelligence.memory import EmotionalMemory
from ..emotional_intelligence.processor import EmotionalProcessor

logger = logging.getLogger(__name__)

class DatasetBuilder:
    """Builds training datasets for fine-tuning LLMs to match ALEJO's personality"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize dataset builder"""
        self.config = config or {}
        self.output_dir = Path(self.config.get('output_dir', 'training_data'))
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize components to extract data from
        self.ethical_framework = EthicalFramework(config)
        self.emotional_memory = EmotionalMemory(config)
        self.emotional_processor = EmotionalProcessor(config)
        
    def extract_ethical_principles(self) -> List[Dict[str, Any]]:
        """Extract ethical principles and their descriptions"""
        principles = []
        
        # Get principles from ethical framework
        for name, data in self.ethical_framework.principles.items():
            principles.append({
                'principle': name,
                'description': data['description'],
                'weight': data['weight'],
                'type': 'ethical_principle'
            })
            
        return principles
        
    def extract_emotional_patterns(self) -> List[Dict[str, Any]]:
        """Extract emotional response patterns and relationship data"""
        patterns = []
        
        # Get emotional memories and patterns
        memories = self.emotional_memory.get_all_memories()
        for memory in memories:
            patterns.append({
                'context': memory.context,
                'emotion': memory.emotion,
                'response': memory.response,
                'relationship_impact': memory.relationship_impact,
                'type': 'emotional_pattern'
            })
            
        return patterns
        
    def extract_decision_history(self) -> List[Dict[str, Any]]:
        """Extract historical ethical decisions and reasoning"""
        decisions = []
        
        # Connect to database
        with sqlite3.connect(self.ethical_framework.db_path) as conn:
            cursor = conn.cursor()
            
            # Get all ethical decisions
            cursor.execute('''
                SELECT action, context, value_alignment, justification, 
                       principles_considered, timestamp 
                FROM ethical_decisions
            ''')
            
            for row in cursor.fetchall():
                decisions.append({
                    'action': row[0],
                    'context': json.loads(row[1]),
                    'value_alignment': row[2],
                    'justification': row[3],
                    'principles_considered': json.loads(row[4]),
                    'timestamp': row[5],
                    'type': 'ethical_decision'
                })
                
        return decisions
        
    def build_training_dataset(self) -> None:
        """Build complete training dataset combining all sources"""
        dataset = {
            'ethical_principles': self.extract_ethical_principles(),
            'emotional_patterns': self.extract_emotional_patterns(),
            'decision_history': self.extract_decision_history()
        }
        
        # Save dataset
        output_file = self.output_dir / 'alejo_personality_dataset.json'
        with open(output_file, 'w') as f:
            json.dump(dataset, f, indent=2)
            
        logger.info(f"Training dataset saved to {output_file}")
        
    def generate_training_examples(self) -> List[Dict[str, str]]:
        """Generate training examples in instruction format"""
        examples = []
        
        # Generate examples from ethical principles
        principles = self.extract_ethical_principles()
        for principle in principles:
            examples.append({
                'instruction': f"How would you handle a situation where {principle['principle']} is important?",
                'response': f"I would consider that {principle['description']}. This principle has a weight of {principle['weight']} in my ethical framework."
            })
        
        # Generate examples from emotional patterns
        patterns = self.extract_emotional_patterns()
        for pattern in patterns:
            examples.append({
                'instruction': f"How do you feel about this situation: {pattern['context']}",
                'response': f"In this context, I feel {pattern['emotion']} and would respond with {pattern['response']}. This has a relationship impact of {pattern['relationship_impact']}."
            })
        
        # Save training examples
        output_file = self.output_dir / 'training_examples.json'
        with open(output_file, 'w') as f:
            json.dump(examples, f, indent=2)
            
        return examples
