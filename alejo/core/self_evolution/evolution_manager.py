"""
Self-Evolution Manager for ALEJO

This module implements the core self-evolution capabilities that allow ALEJO
to autonomously improve itself over time, learn from errors, expand its knowledge,
and enhance its capabilities.
"""

import logging
import asyncio
import time
import os
import json
from typing import Dict, List, Optional, Any, Set, Tuple
from enum import Enum
from dataclasses import dataclass
import threading
from datetime import datetime, timedelta
import importlib

from ..memory_event_bus import MemoryEventBus
from ..resource_manager import ResourceManager, ResourceType
from ...services.user_preferences import get_user_preferences

logger = logging.getLogger(__name__)

class EvolutionPriority(Enum):
    """Priority levels for evolution tasks"""
    CRITICAL = "critical"   # Must be addressed immediately
    HIGH = "high"           # Important for system functionality
    MEDIUM = "medium"       # Beneficial but not urgent
    LOW = "low"             # Nice to have improvements


@dataclass
class EvolutionTask:
    """A task for self-evolution"""
    task_id: str
    task_type: str  # "error_correction", "knowledge_expansion", "capability_enhancement"
    description: str
    priority: EvolutionPriority
    created_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "pending"  # "pending", "in_progress", "completed", "failed"
    result: Optional[Any] = None
    dependencies: List[str] = None  # List of task_ids this task depends on
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []


class SelfEvolutionManager:
    """
    Manages ALEJO's self-evolution capabilities
    
    This class orchestrates the autonomous improvement of ALEJO over time,
    including error correction, knowledge expansion, and capability enhancement.
    """
    
    def __init__(self, event_bus: Optional[MemoryEventBus] = None):
        """
        Initialize the self-evolution manager
        
        Args:
            event_bus: Optional event bus for communication
        """
        self.event_bus = event_bus
        self.resource_manager = ResourceManager()
        self.user_preferences = get_user_preferences()
        
        # Task management
        self.tasks: Dict[str, EvolutionTask] = {}
        self.task_queue: List[str] = []
        self.active_tasks: Set[str] = set()
        self.completed_tasks: Set[str] = set()
        self.failed_tasks: Set[str] = set()
        
        # Component systems
        self.error_correction = None  # Will be initialized later
        self.knowledge_expansion = None  # Will be initialized later
        self.capability_enhancement = None  # Will be initialized later
        
        # Evolution history
        self.evolution_history = []
        self.last_assessment_time = datetime.now()
        
        # Configuration
        self.max_concurrent_tasks = 3
        self.assessment_interval = timedelta(hours=6)
        
        # Thread management
        self.running = False
        self.evolution_thread = None
        
        logger.info("Self-evolution manager initialized")
    
    async def start(self):
        """Start the self-evolution system"""
        if self.running:
            logger.warning("Self-evolution manager is already running")
            return
        
        logger.info("Starting self-evolution manager")
        self.running = True
        
        # Initialize component systems
        self._initialize_components()
        
        # Subscribe to events
        if self.event_bus:
            await self._subscribe_to_events()
        
        # Start evolution thread
        self.evolution_thread = threading.Thread(
            target=self._evolution_loop,
            daemon=True
        )
        self.evolution_thread.start()
        
        # Perform initial assessment
        await self.perform_system_assessment()
        
        logger.info("Self-evolution manager started")
    
    async def stop(self):
        """Stop the self-evolution system"""
        if not self.running:
            logger.warning("Self-evolution manager is not running")
            return
        
        logger.info("Stopping self-evolution manager")
        self.running = False
        
        # Wait for evolution thread to terminate
        if self.evolution_thread and self.evolution_thread.is_alive():
            self.evolution_thread.join(timeout=5.0)
        
        # Save state
        self._save_state()
        
        logger.info("Self-evolution manager stopped")
    
    def _initialize_components(self):
        """Initialize component systems"""
        # Import here to avoid circular imports
        from .error_correction import ErrorCorrectionSystem
        from .knowledge_expansion import KnowledgeExpansionEngine
        from .capability_enhancement import CapabilityEnhancementSystem
        
        self.error_correction = ErrorCorrectionSystem(self)
        self.knowledge_expansion = KnowledgeExpansionEngine(self)
        self.capability_enhancement = CapabilityEnhancementSystem(self)
        
        logger.info("Self-evolution components initialized")
    
    async def _subscribe_to_events(self):
        """Subscribe to relevant events"""
        if not self.event_bus:
            return
        
        # Subscribe to error events
        self.event_bus.subscribe("error.*", self._handle_error_event)
        
        # Subscribe to knowledge events
        self.event_bus.subscribe("knowledge.*", self._handle_knowledge_event)
        
        # Subscribe to capability events
        self.event_bus.subscribe("capability.*", self._handle_capability_event)
        
        logger.info("Subscribed to evolution-related events")
    
    async def _handle_error_event(self, event):
        """Handle error events"""
        if not self.error_correction:
            return
        
        logger.info(f"Received error event: {event.event_type}")
        await self.error_correction.process_error(event)
    
    async def _handle_knowledge_event(self, event):
        """Handle knowledge events"""
        if not self.knowledge_expansion:
            return
        
        logger.info(f"Received knowledge event: {event.event_type}")
        await self.knowledge_expansion.process_knowledge_event(event)
    
    async def _handle_capability_event(self, event):
        """Handle capability events"""
        if not self.capability_enhancement:
            return
        
        logger.info(f"Received capability event: {event.event_type}")
        await self.capability_enhancement.process_capability_event(event)
    
    def _evolution_loop(self):
        """Main evolution loop running in a separate thread"""
        logger.info("Evolution loop started")
        
        while self.running:
            try:
                # Check if it's time for a system assessment
                now = datetime.now()
                if now - self.last_assessment_time >= self.assessment_interval:
                    asyncio.run(self.perform_system_assessment())
                    self.last_assessment_time = now
                
                # Process tasks in the queue
                self._process_task_queue()
                
                # Sleep to avoid high CPU usage
                time.sleep(1.0)
            except Exception as e:
                logger.error(f"Error in evolution loop: {str(e)}", exc_info=True)
                time.sleep(5.0)  # Sleep longer after an error
    
    def _process_task_queue(self):
        """Process tasks in the queue"""
        # Check if we can start more tasks
        while len(self.active_tasks) < self.max_concurrent_tasks and self.task_queue:
            # Get next task
            for i, task_id in enumerate(self.task_queue):
                task = self.tasks[task_id]
                
                # Check if dependencies are satisfied
                dependencies_met = all(
                    dep_id in self.completed_tasks 
                    for dep_id in task.dependencies
                )
                
                if dependencies_met:
                    # Start task
                    self._start_task(task_id)
                    self.task_queue.pop(i)
                    break
    
    def _start_task(self, task_id: str):
        """Start a task"""
        task = self.tasks[task_id]
        logger.info(f"Starting evolution task: {task.description}")
        
        task.status = "in_progress"
        self.active_tasks.add(task_id)
        
        # Start task in a separate thread
        thread = threading.Thread(
            target=self._execute_task,
            args=(task_id,),
            daemon=True
        )
        thread.start()
    
    def _execute_task(self, task_id: str):
        """Execute a task"""
        task = self.tasks[task_id]
        
        try:
            # Execute based on task type
            if task.task_type == "error_correction":
                result = self.error_correction.execute_correction_task(task)
            elif task.task_type == "knowledge_expansion":
                result = self.knowledge_expansion.execute_expansion_task(task)
            elif task.task_type == "capability_enhancement":
                result = self.capability_enhancement.execute_enhancement_task(task)
            else:
                raise ValueError(f"Unknown task type: {task.task_type}")
            
            # Mark task as completed
            task.status = "completed"
            task.completed_at = datetime.now()
            task.result = result
            self.active_tasks.remove(task_id)
            self.completed_tasks.add(task_id)
            
            # Add to evolution history
            self.evolution_history.append({
                "task_id": task_id,
                "task_type": task.task_type,
                "description": task.description,
                "completed_at": task.completed_at.isoformat(),
                "success": True
            })
            
            logger.info(f"Evolution task completed: {task.description}")
            
            # Publish event if available
            if self.event_bus:
                asyncio.run(self.event_bus.publish(
                    f"evolution.task.completed.{task.task_type}",
                    {
                        "task_id": task_id,
                        "description": task.description,
                        "result": result
                    }
                ))
        except Exception as e:
            # Mark task as failed
            task.status = "failed"
            task.result = str(e)
            self.active_tasks.remove(task_id)
            self.failed_tasks.add(task_id)
            
            # Add to evolution history
            self.evolution_history.append({
                "task_id": task_id,
                "task_type": task.task_type,
                "description": task.description,
                "completed_at": datetime.now().isoformat(),
                "success": False,
                "error": str(e)
            })
            
            logger.error(f"Evolution task failed: {task.description}", exc_info=True)
            
            # Publish event if available
            if self.event_bus:
                asyncio.run(self.event_bus.publish(
                    f"evolution.task.failed.{task.task_type}",
                    {
                        "task_id": task_id,
                        "description": task.description,
                        "error": str(e)
                    }
                ))
    
    async def perform_system_assessment(self):
        """
        Perform a comprehensive assessment of the system to identify
        areas for improvement
        """
        logger.info("Performing system assessment")
        
        try:
            # Assess error patterns
            if self.error_correction:
                error_tasks = await self.error_correction.assess_error_patterns()
                for task in error_tasks:
                    self.add_task(task)
            
            # Assess knowledge gaps
            if self.knowledge_expansion:
                knowledge_tasks = await self.knowledge_expansion.assess_knowledge_gaps()
                for task in knowledge_tasks:
                    self.add_task(task)
            
            # Assess capability gaps
            if self.capability_enhancement:
                capability_tasks = await self.capability_enhancement.assess_capability_gaps()
                for task in capability_tasks:
                    self.add_task(task)
            
            logger.info("System assessment completed")
        except Exception as e:
            logger.error(f"Error during system assessment: {str(e)}", exc_info=True)
    
    def add_task(self, task: EvolutionTask):
        """
        Add a new evolution task
        
        Args:
            task: The task to add
        """
        if task.task_id in self.tasks:
            logger.warning(f"Task with ID {task.task_id} already exists")
            return
        
        self.tasks[task.task_id] = task
        self.task_queue.append(task.task_id)
        
        # Sort queue by priority
        self.task_queue.sort(
            key=lambda tid: self._get_priority_value(self.tasks[tid].priority)
        )
        
        logger.info(f"Added evolution task: {task.description}")
    
    def _get_priority_value(self, priority: EvolutionPriority) -> int:
        """Get numeric value for priority for sorting"""
        priority_values = {
            EvolutionPriority.CRITICAL: 0,
            EvolutionPriority.HIGH: 1,
            EvolutionPriority.MEDIUM: 2,
            EvolutionPriority.LOW: 3
        }
        return priority_values.get(priority, 4)
    
    def get_task(self, task_id: str) -> Optional[EvolutionTask]:
        """
        Get a task by ID
        
        Args:
            task_id: The task ID
            
        Returns:
            The task, or None if not found
        """
        return self.tasks.get(task_id)
    
    def get_evolution_status(self) -> Dict[str, Any]:
        """
        Get the current status of the evolution system
        
        Returns:
            Dictionary with evolution status information
        """
        return {
            "active_tasks": len(self.active_tasks),
            "pending_tasks": len(self.task_queue),
            "completed_tasks": len(self.completed_tasks),
            "failed_tasks": len(self.failed_tasks),
            "last_assessment": self.last_assessment_time.isoformat(),
            "next_assessment": (self.last_assessment_time + self.assessment_interval).isoformat(),
            "recent_history": self.evolution_history[-10:] if self.evolution_history else []
        }
    
    def _save_state(self):
        """Save the current state of the evolution system"""
        try:
            state_dir = os.path.join(os.path.dirname(__file__), "state")
            os.makedirs(state_dir, exist_ok=True)
            
            state_file = os.path.join(state_dir, "evolution_state.json")
            
            # Prepare state for serialization
            state = {
                "tasks": {
                    tid: {
                        "task_id": task.task_id,
                        "task_type": task.task_type,
                        "description": task.description,
                        "priority": task.priority.value,
                        "created_at": task.created_at.isoformat(),
                        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                        "status": task.status,
                        "dependencies": task.dependencies
                    }
                    for tid, task in self.tasks.items()
                },
                "task_queue": self.task_queue,
                "active_tasks": list(self.active_tasks),
                "completed_tasks": list(self.completed_tasks),
                "failed_tasks": list(self.failed_tasks),
                "evolution_history": self.evolution_history,
                "last_assessment_time": self.last_assessment_time.isoformat()
            }
            
            with open(state_file, 'w') as f:
                json.dump(state, f, indent=2)
            
            logger.info("Evolution state saved")
        except Exception as e:
            logger.error(f"Error saving evolution state: {str(e)}", exc_info=True)
    
    def _load_state(self):
        """Load the saved state of the evolution system"""
        try:
            state_file = os.path.join(
                os.path.dirname(__file__), 
                "state", 
                "evolution_state.json"
            )
            
            if not os.path.exists(state_file):
                logger.info("No saved evolution state found")
                return
            
            with open(state_file, 'r') as f:
                state = json.load(f)
            
            # Restore tasks
            self.tasks = {}
            for tid, task_data in state["tasks"].items():
                self.tasks[tid] = EvolutionTask(
                    task_id=task_data["task_id"],
                    task_type=task_data["task_type"],
                    description=task_data["description"],
                    priority=EvolutionPriority(task_data["priority"]),
                    created_at=datetime.fromisoformat(task_data["created_at"]),
                    completed_at=datetime.fromisoformat(task_data["completed_at"]) 
                                if task_data["completed_at"] else None,
                    status=task_data["status"],
                    dependencies=task_data["dependencies"]
                )
            
            # Restore other state
            self.task_queue = state["task_queue"]
            self.active_tasks = set(state["active_tasks"])
            self.completed_tasks = set(state["completed_tasks"])
            self.failed_tasks = set(state["failed_tasks"])
            self.evolution_history = state["evolution_history"]
            self.last_assessment_time = datetime.fromisoformat(state["last_assessment_time"])
            
            logger.info("Evolution state loaded")
        except Exception as e:
            logger.error(f"Error loading evolution state: {str(e)}", exc_info=True)


# Singleton instance
_evolution_manager = None

def get_evolution_manager(event_bus: Optional[MemoryEventBus] = None) -> SelfEvolutionManager:
    """Get the singleton evolution manager instance"""
    global _evolution_manager
    if _evolution_manager is None:
        _evolution_manager = SelfEvolutionManager(event_bus)
    return _evolution_manager
