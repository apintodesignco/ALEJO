"""
Advanced learning features for ALEJO's cognitive system
Including meta-learning, curriculum learning, and transfer learning
"""

import asyncio
import numpy as np
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path

@dataclass
class TaskDifficulty:
    complexity: float
    required_skills: List[str]
    prerequisites: List[str]
    estimated_success_rate: float

class CurriculumManager:
    """Manages progressive learning through increasingly complex tasks"""
    
    def __init__(self, min_success_rate: float = 0.7):
        self.min_success_rate = min_success_rate
        self.task_history: List[Dict[str, Any]] = []
        self.skill_levels: Dict[str, float] = {}
        self.current_curriculum_stage = 0
        
    def evaluate_task_readiness(self, task: Dict[str, Any]) -> bool:
        """Determine if system is ready for a task"""
        difficulty = self._calculate_task_difficulty(task)
        
        # Check prerequisites
        for skill in difficulty.prerequisites:
            if self.skill_levels.get(skill, 0.0) < self.min_success_rate:
                return False
        
        # Check estimated success probability
        if difficulty.estimated_success_rate < self.min_success_rate:
            return False
            
        return True
    
    def update_skill_levels(self, task: Dict[str, Any], success: bool, performance: float):
        """Update skill levels based on task performance"""
        difficulty = self._calculate_task_difficulty(task)
        
        for skill in difficulty.required_skills:
            current_level = self.skill_levels.get(skill, 0.5)
            
            # Update using Bayesian-inspired approach
            confidence = min(len(self.task_history) / 100, 0.9)
            new_level = (
                current_level * confidence +
                performance * (1 - confidence)
            )
            
            self.skill_levels[skill] = max(0.0, min(1.0, new_level))
        
        self.task_history.append({
            'task': task,
            'success': success,
            'performance': performance,
            'timestamp': datetime.now().isoformat()
        })
    
    def _calculate_task_difficulty(self, task: Dict[str, Any]) -> TaskDifficulty:
        """Calculate task difficulty and requirements"""
        # Extract task properties
        complexity = task.get('complexity', 0.5)
        command = task.get('command', '')
        context = task.get('context', {})
        
        # Identify required skills
        required_skills = []
        if 'file_operation' in command.lower():
            required_skills.append('file_management')
        if 'api' in command.lower():
            required_skills.append('api_interaction')
        if 'debug' in command.lower():
            required_skills.append('debugging')
        if 'test' in command.lower():
            required_skills.append('testing')
        
        # Determine prerequisites
        prerequisites = []
        if 'file_management' in required_skills:
            prerequisites.append('basic_io')
        if 'debugging' in required_skills:
            prerequisites.append('code_analysis')
        
        # Estimate success probability
        skill_levels = [
            self.skill_levels.get(skill, 0.0)
            for skill in required_skills
        ]
        estimated_success = (
            np.mean(skill_levels) if skill_levels else 0.5
        )
        
        return TaskDifficulty(
            complexity=complexity,
            required_skills=required_skills,
            prerequisites=prerequisites,
            estimated_success_rate=estimated_success
        )

class MetaLearner:
    """Meta-learning system to optimize learning strategies"""
    
    def __init__(self):
        self.strategy_performance: Dict[str, List[float]] = {}
        self.current_strategy: Optional[str] = None
        self.adaptation_rate = 0.1
        
    async def select_learning_strategy(
        self,
        task: Dict[str, Any],
        context: Dict[str, Any]
    ) -> str:
        """Select best learning strategy for current task"""
        strategies = [
            'default',
            'exploration_focused',
            'exploitation_focused',
            'error_minimizing',
            'speed_optimizing'
        ]
        
        if not self.strategy_performance:
            # Initialize performance tracking
            self.strategy_performance = {
                s: [0.5] for s in strategies
            }
        
        # Calculate strategy scores
        scores = {
            strategy: np.mean(performances)
            for strategy, performances in self.strategy_performance.items()
        }
        
        # Apply context-based adjustments
        scores = self._adjust_scores(scores, task, context)
        
        # Select strategy (epsilon-greedy)
        if np.random.random() < self.adaptation_rate:
            strategy = np.random.choice(strategies)
        else:
            strategy = max(scores.items(), key=lambda x: x[1])[0]
        
        self.current_strategy = strategy
        return strategy
    
    def update_strategy_performance(self, performance: float):
        """Update performance metrics for current strategy"""
        if self.current_strategy:
            self.strategy_performance.setdefault(
                self.current_strategy, []
            ).append(performance)
            
            # Limit history length
            if len(self.strategy_performance[self.current_strategy]) > 100:
                self.strategy_performance[self.current_strategy] = (
                    self.strategy_performance[self.current_strategy][-100:]
                )
    
    def _adjust_scores(
        self,
        scores: Dict[str, float],
        task: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, float]:
        """Adjust strategy scores based on task and context"""
        adjusted = scores.copy()
        
        # Adjust for task complexity
        complexity = task.get('complexity', 0.5)
        if complexity > 0.7:
            # Favor error minimizing for complex tasks
            adjusted['error_minimizing'] *= 1.2
        elif complexity < 0.3:
            # Favor speed optimizing for simple tasks
            adjusted['speed_optimizing'] *= 1.2
        
        # Adjust for system load
        system_load = context.get('system_load', 0.5)
        if system_load > 0.8:
            # Favor resource-efficient strategies under high load
            adjusted['speed_optimizing'] *= 0.8
            adjusted['error_minimizing'] *= 1.1
        
        return adjusted

class TransferLearning:
    """Manages knowledge transfer between related tasks"""
    
    def __init__(self, model_dir: str):
        self.model_dir = Path(model_dir)
        self.task_embeddings: Dict[str, np.ndarray] = {}
        self.transfer_history: List[Dict[str, Any]] = []
    
    async def find_related_tasks(
        self,
        current_task: Dict[str, Any],
        similarity_threshold: float = 0.7
    ) -> List[str]:
        """Find tasks similar to current task"""
        current_embedding = self._compute_task_embedding(current_task)
        
        related = []
        for task_id, embedding in self.task_embeddings.items():
            similarity = self._compute_similarity(
                current_embedding,
                embedding
            )
            if similarity >= similarity_threshold:
                related.append(task_id)
        
        return related
    
    async def transfer_knowledge(
        self,
        source_task: str,
        target_task: str,
        transfer_params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Transfer learning from source to target task"""
        # Record transfer attempt
        transfer_record = {
            'source': source_task,
            'target': target_task,
            'params': transfer_params,
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            # Load source task model
            source_path = self.model_dir / f"{source_task}_model.h5"
            if not source_path.exists():
                raise ValueError(f"No model found for source task {source_task}")
            
            # Perform transfer
            transferred_params = self._adapt_parameters(
                transfer_params,
                source_task,
                target_task
            )
            
            transfer_record['success'] = True
            transfer_record['adapted_params'] = transferred_params
            
        except Exception as e:
            transfer_record['success'] = False
            transfer_record['error'] = str(e)
        
        self.transfer_history.append(transfer_record)
        return transfer_record
    
    def _compute_task_embedding(self, task: Dict[str, Any]) -> np.ndarray:
        """Compute embedding vector for task"""
        # Extract task features
        features = [
            task.get('complexity', 0.5),
            len(task.get('required_skills', [])) / 10,
            task.get('priority', 0.5),
            task.get('estimated_duration', 1.0) / 3600
        ]
        
        # Add semantic features from task description
        description = task.get('description', '')
        word_features = self._extract_word_features(description)
        features.extend(word_features)
        
        return np.array(features, dtype=np.float32)
    
    def _extract_word_features(self, text: str) -> List[float]:
        """Extract semantic features from text"""
        # Simple bag-of-words approach
        important_words = {
            'file': 0, 'api': 1, 'test': 2, 'debug': 3,
            'analyze': 4, 'create': 5, 'modify': 6, 'delete': 7
        }
        
        features = [0.0] * len(important_words)
        words = text.lower().split()
        
        for word in words:
            if word in important_words:
                features[important_words[word]] = 1.0
        
        return features
    
    def _compute_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Compute similarity between task embeddings"""
        # Cosine similarity
        dot_product = np.dot(embedding1, embedding2)
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        return dot_product / (norm1 * norm2)
    
    def _adapt_parameters(
        self,
        params: Dict[str, Any],
        source_task: str,
        target_task: str
    ) -> Dict[str, Any]:
        """Adapt parameters for transfer learning"""
        adapted = params.copy()
        
        # Adjust learning rate based on task similarity
        source_embedding = self.task_embeddings.get(source_task)
        target_embedding = self.task_embeddings.get(target_task)
        
        if source_embedding is not None and target_embedding is not None:
            similarity = self._compute_similarity(
                source_embedding,
                target_embedding
            )
            
            # Scale learning rate based on similarity
            adapted['learning_rate'] = params.get('learning_rate', 0.001) * similarity
        
        return adapted
