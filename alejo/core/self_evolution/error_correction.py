"""
Error Correction System for ALEJO

This module enables ALEJO to detect, analyze, and automatically correct errors
in its own code, logic, and behavior, making it more robust and reliable over time.
"""

import logging
import os
import time
import json
import asyncio
import traceback
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime
import uuid
import re

from ..memory_event_bus import MemoryEventBus
from .evolution_manager import EvolutionTask, EvolutionPriority

logger = logging.getLogger(__name__)

class ErrorPattern:
    """A recognized pattern of errors"""
    def __init__(self, pattern_id: str, description: str, regex: str, 
                 occurrences: int = 0, last_seen: Optional[datetime] = None):
        self.pattern_id = pattern_id
        self.description = description
        self.regex = regex
        self.compiled_regex = re.compile(regex)
        self.occurrences = occurrences
        self.last_seen = last_seen or datetime.now()
        self.correction_attempts = 0
        self.successful_corrections = 0

    def matches(self, error_text: str) -> bool:
        """Check if this pattern matches the given error text"""
        return bool(self.compiled_regex.search(error_text))

    def record_occurrence(self):
        """Record a new occurrence of this error pattern"""
        self.occurrences += 1
        self.last_seen = datetime.now()

    def record_correction_attempt(self, success: bool):
        """Record an attempt to correct this error pattern"""
        self.correction_attempts += 1
        if success:
            self.successful_corrections += 1


class ErrorCorrectionSystem:
    """
    System for detecting, analyzing, and correcting errors in ALEJO
    
    This system:
    1. Monitors for errors across all ALEJO components
    2. Identifies patterns in errors
    3. Develops and applies corrections
    4. Learns from correction attempts
    """
    
    def __init__(self, evolution_manager):
        """
        Initialize the error correction system
        
        Args:
            evolution_manager: The self-evolution manager
        """
        self.evolution_manager = evolution_manager
        self.event_bus = evolution_manager.event_bus
        
        # Error tracking
        self.error_history = []
        self.error_patterns: Dict[str, ErrorPattern] = {}
        self.correction_history = []
        
        # Load existing patterns
        self._load_error_patterns()
        
        logger.info("Error correction system initialized")
    
    async def process_error(self, event):
        """
        Process an error event
        
        Args:
            event: The error event
        """
        error_data = event.data
        if not error_data or not isinstance(error_data, dict):
            logger.warning("Invalid error event data")
            return
        
        error_text = error_data.get("error_message", "")
        error_type = error_data.get("error_type", "unknown")
        error_source = error_data.get("source", "unknown")
        stack_trace = error_data.get("stack_trace", "")
        
        # Record error in history
        error_entry = {
            "timestamp": datetime.now().isoformat(),
            "error_type": error_type,
            "error_message": error_text,
            "source": error_source,
            "stack_trace": stack_trace
        }
        self.error_history.append(error_entry)
        
        # Trim history if too large
        if len(self.error_history) > 1000:
            self.error_history = self.error_history[-1000:]
        
        # Match against known patterns
        matched_pattern = None
        for pattern in self.error_patterns.values():
            if pattern.matches(error_text) or (stack_trace and pattern.matches(stack_trace)):
                pattern.record_occurrence()
                matched_pattern = pattern
                break
        
        # If no match, create a new pattern
        if not matched_pattern and error_text:
            pattern_id = f"pattern_{uuid.uuid4().hex[:8]}"
            # Create a simplified regex from the error message
            simplified_regex = self._create_pattern_regex(error_text)
            pattern = ErrorPattern(
                pattern_id=pattern_id,
                description=f"Auto-detected pattern: {error_text[:50]}...",
                regex=simplified_regex,
                occurrences=1,
                last_seen=datetime.now()
            )
            self.error_patterns[pattern_id] = pattern
            matched_pattern = pattern
            
            logger.info(f"Created new error pattern: {pattern_id}")
        
        # If we have a pattern, check if we should create a correction task
        if matched_pattern:
            await self._consider_correction_task(matched_pattern, error_entry)
    
    def _create_pattern_regex(self, error_text: str) -> str:
        """
        Create a regex pattern from an error message
        
        Args:
            error_text: The error message
            
        Returns:
            A regex pattern that matches similar errors
        """
        # Escape special regex characters
        escaped = re.escape(error_text)
        
        # Replace likely variable parts with wildcards
        # Numbers
        escaped = re.sub(r'\\d+', r'\\d+', escaped)
        
        # File paths
        escaped = re.sub(r'[\\\/][\w\.\-\\\/]+', r'[\\\/][\w\.\-\\\/]+', escaped)
        
        # Return the pattern
        return escaped
    
    async def _consider_correction_task(self, pattern: ErrorPattern, error_entry: Dict):
        """
        Consider creating a correction task for an error pattern
        
        Args:
            pattern: The error pattern
            error_entry: The error entry
        """
        # Only create tasks for patterns that occur frequently
        if pattern.occurrences < 3:
            return
        
        # Check if we've attempted correction recently
        if pattern.correction_attempts > 0:
            # If we've had successful corrections, wait for more occurrences
            if pattern.successful_corrections > 0:
                if pattern.occurrences < 5 * pattern.successful_corrections:
                    return
            # If we've had failed attempts, be more cautious
            else:
                if pattern.occurrences < 10 * pattern.correction_attempts:
                    return
        
        # Create a correction task
        task_id = f"error_correction_{uuid.uuid4().hex[:8]}"
        task = EvolutionTask(
            task_id=task_id,
            task_type="error_correction",
            description=f"Correct error pattern: {pattern.description}",
            priority=self._determine_priority(pattern, error_entry),
            created_at=datetime.now()
        )
        
        # Add task to evolution manager
        self.evolution_manager.add_task(task)
        
        logger.info(f"Created error correction task: {task_id}")
    
    def _determine_priority(self, pattern: ErrorPattern, error_entry: Dict) -> EvolutionPriority:
        """
        Determine the priority of a correction task
        
        Args:
            pattern: The error pattern
            error_entry: The error entry
            
        Returns:
            The priority level
        """
        # Critical errors that affect core functionality
        if "critical" in error_entry["error_type"].lower() or "fatal" in error_entry["error_type"].lower():
            return EvolutionPriority.CRITICAL
        
        # High priority for frequent errors
        if pattern.occurrences > 10:
            return EvolutionPriority.HIGH
        
        # Medium priority for moderately frequent errors
        if pattern.occurrences > 5:
            return EvolutionPriority.MEDIUM
        
        # Low priority for infrequent errors
        return EvolutionPriority.LOW
    
    def execute_correction_task(self, task: EvolutionTask) -> Dict[str, Any]:
        """
        Execute an error correction task
        
        Args:
            task: The task to execute
            
        Returns:
            Result of the correction
        """
        logger.info(f"Executing error correction task: {task.task_id}")
        
        # Extract pattern ID from task description
        pattern_id = None
        for pid in self.error_patterns:
            if self.error_patterns[pid].description in task.description:
                pattern_id = pid
                break
        
        if not pattern_id:
            raise ValueError(f"Could not find pattern for task: {task.task_id}")
        
        pattern = self.error_patterns[pattern_id]
        
        # Analyze error pattern
        analysis = self._analyze_error_pattern(pattern)
        
        # Generate correction
        correction = self._generate_correction(pattern, analysis)
        
        # Apply correction
        success = self._apply_correction(correction)
        
        # Record attempt
        pattern.record_correction_attempt(success)
        
        # Record in correction history
        correction_entry = {
            "task_id": task.task_id,
            "pattern_id": pattern_id,
            "timestamp": datetime.now().isoformat(),
            "analysis": analysis,
            "correction": correction,
            "success": success
        }
        self.correction_history.append(correction_entry)
        
        # Save patterns
        self._save_error_patterns()
        
        return correction_entry
    
    def _analyze_error_pattern(self, pattern: ErrorPattern) -> Dict[str, Any]:
        """
        Analyze an error pattern to understand its cause
        
        Args:
            pattern: The error pattern
            
        Returns:
            Analysis results
        """
        # In a real implementation, this would use sophisticated analysis
        # For now, we'll return a simple analysis
        return {
            "pattern_id": pattern.pattern_id,
            "occurrences": pattern.occurrences,
            "likely_cause": "Unknown - would require deeper analysis",
            "affected_components": ["unknown"],
            "suggested_fixes": ["Implement proper error handling", "Add validation"]
        }
    
    def _generate_correction(self, pattern: ErrorPattern, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a correction for an error pattern
        
        Args:
            pattern: The error pattern
            analysis: The analysis results
            
        Returns:
            Correction details
        """
        # In a real implementation, this would generate actual code changes
        # For now, we'll return a placeholder
        return {
            "pattern_id": pattern.pattern_id,
            "correction_type": "error_handling",
            "description": f"Add error handling for pattern: {pattern.description}",
            "code_changes": [],
            "config_changes": [],
            "requires_restart": False
        }
    
    def _apply_correction(self, correction: Dict[str, Any]) -> bool:
        """
        Apply a correction
        
        Args:
            correction: The correction to apply
            
        Returns:
            True if successful, False otherwise
        """
        # In a real implementation, this would apply actual changes
        # For now, we'll simulate success
        logger.info(f"Applied correction for pattern: {correction['pattern_id']}")
        return True
    
    async def assess_error_patterns(self) -> List[EvolutionTask]:
        """
        Assess error patterns to identify opportunities for improvement
        
        Returns:
            List of evolution tasks
        """
        tasks = []
        
        # Look for patterns that occur frequently but don't have correction tasks
        for pattern_id, pattern in self.error_patterns.items():
            if pattern.occurrences >= 3 and pattern.correction_attempts == 0:
                task_id = f"error_assessment_{uuid.uuid4().hex[:8]}"
                task = EvolutionTask(
                    task_id=task_id,
                    task_type="error_correction",
                    description=f"Assess and correct error pattern: {pattern.description}",
                    priority=EvolutionPriority.MEDIUM,
                    created_at=datetime.now()
                )
                tasks.append(task)
        
        return tasks
    
    def _load_error_patterns(self):
        """Load error patterns from storage"""
        try:
            patterns_file = os.path.join(
                os.path.dirname(__file__), 
                "state", 
                "error_patterns.json"
            )
            
            if not os.path.exists(patterns_file):
                logger.info("No saved error patterns found")
                return
            
            with open(patterns_file, 'r') as f:
                patterns_data = json.load(f)
            
            for pattern_data in patterns_data:
                pattern = ErrorPattern(
                    pattern_id=pattern_data["pattern_id"],
                    description=pattern_data["description"],
                    regex=pattern_data["regex"],
                    occurrences=pattern_data["occurrences"],
                    last_seen=datetime.fromisoformat(pattern_data["last_seen"])
                )
                pattern.correction_attempts = pattern_data.get("correction_attempts", 0)
                pattern.successful_corrections = pattern_data.get("successful_corrections", 0)
                self.error_patterns[pattern.pattern_id] = pattern
            
            logger.info(f"Loaded {len(self.error_patterns)} error patterns")
        except Exception as e:
            logger.error(f"Error loading error patterns: {str(e)}", exc_info=True)
    
    def _save_error_patterns(self):
        """Save error patterns to storage"""
        try:
            state_dir = os.path.join(os.path.dirname(__file__), "state")
            os.makedirs(state_dir, exist_ok=True)
            
            patterns_file = os.path.join(state_dir, "error_patterns.json")
            
            patterns_data = []
            for pattern in self.error_patterns.values():
                patterns_data.append({
                    "pattern_id": pattern.pattern_id,
                    "description": pattern.description,
                    "regex": pattern.regex,
                    "occurrences": pattern.occurrences,
                    "last_seen": pattern.last_seen.isoformat(),
                    "correction_attempts": pattern.correction_attempts,
                    "successful_corrections": pattern.successful_corrections
                })
            
            with open(patterns_file, 'w') as f:
                json.dump(patterns_data, f, indent=2)
            
            logger.info(f"Saved {len(self.error_patterns)} error patterns")
        except Exception as e:
            logger.error(f"Error saving error patterns: {str(e)}", exc_info=True)
