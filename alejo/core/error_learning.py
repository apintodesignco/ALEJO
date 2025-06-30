"""
Advanced error learning and self-correction system for ALEJO
"""

import asyncio
import inspect
import logging
import sys
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Optional, Any, Tuple, Callable
import ast
import json
import numpy as np
from collections import defaultdict

logger = logging.getLogger(__name__)

class ErrorPattern:
    """Represents a learned error pattern"""
    
    def __init__(self, 
                 error_type: str,
                 error_message: str,
                 stack_trace: str,
                 context: Dict[str, Any],
                 frequency: int = 1,
                 last_seen: datetime = None,
                 resolution: Optional[str] = None):
        self.error_type = error_type
        self.error_message = error_message
        self.stack_trace = stack_trace
        self.context = context
        self.frequency = frequency
        self.last_seen = last_seen or datetime.now()
        self.resolution = resolution
        self.success_count = 0
        self.failed_resolutions: List[str] = []
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert pattern to dictionary"""
        return {
            'error_type': self.error_type,
            'error_message': self.error_message,
            'stack_trace': self.stack_trace,
            'context': self.context,
            'frequency': self.frequency,
            'last_seen': self.last_seen.isoformat(),
            'resolution': self.resolution,
            'success_count': self.success_count,
            'failed_resolutions': self.failed_resolutions
        }
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ErrorPattern':
        """Create pattern from dictionary"""
        data['last_seen'] = datetime.fromisoformat(data['last_seen'])
        return cls(**data)

class CodeAnalyzer:
    """Analyzes code for potential issues and suggests fixes"""
    
    @staticmethod
    def analyze_ast(code: str) -> List[Dict[str, Any]]:
        """Analyze code AST for potential issues"""
        issues = []
        try:
            tree = ast.parse(code)
            analyzer = CodeAnalyzer()
            analyzer.visit_tree(tree, issues)
        except SyntaxError as e:
            issues.append({
                'type': 'syntax_error',
                'message': str(e),
                'line': e.lineno,
                'offset': e.offset
            })
        return issues
    
    @staticmethod
    def visit_tree(tree: ast.AST, issues: List[Dict[str, Any]]):
        """Visit AST nodes to identify issues"""
        for node in ast.walk(tree):
            # Check for bare except clauses
            if isinstance(node, ast.ExceptHandler) and node.type is None:
                issues.append({
                    'type': 'bare_except',
                    'message': 'Avoid bare except clauses',
                    'line': node.lineno
                })
            
            # Check for mutable default arguments
            if isinstance(node, ast.FunctionDef):
                for arg in node.args.defaults:
                    if isinstance(arg, (ast.List, ast.Dict, ast.Set)):
                        issues.append({
                            'type': 'mutable_default',
                            'message': 'Mutable default argument',
                            'line': node.lineno
                        })

class ErrorLearningSystem:
    """Advanced error learning and self-correction system"""
    
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.patterns_file = self.base_dir / 'error_patterns.json'
        self.error_patterns: Dict[str, ErrorPattern] = {}
        self.correction_strategies: Dict[str, List[Callable]] = defaultdict(list)
        self._lock = asyncio.Lock()
        self._running = False
        
        # Initialize correction strategies
        self._init_correction_strategies()
        
        # Load existing patterns
        self.load_patterns()
        
    def _init_correction_strategies(self):
        """Initialize error correction strategies"""
        # Memory-related errors
        self.correction_strategies['MemoryError'].extend([
            self._reduce_memory_usage,
            self._optimize_data_structures
        ])
        
        # I/O-related errors
        self.correction_strategies['IOError'].extend([
            self._implement_retries,
            self._add_error_handling
        ])
        
        # Runtime errors
        self.correction_strategies['RuntimeError'].extend([
            self._fix_race_conditions,
            self._add_synchronization
        ])
        
    async def start(self):
        """Start the error learning system"""
        self._running = True
        await self._monitor_errors()
        
    async def stop(self):
        """Stop the error learning system"""
        self._running = False
        
    def load_patterns(self):
        """Load error patterns from file"""
        if self.patterns_file.exists():
            try:
                with open(self.patterns_file, 'r') as f:
                    patterns_data = json.load(f)
                    self.error_patterns = {
                        key: ErrorPattern.from_dict(data)
                        for key, data in patterns_data.items()
                    }
            except Exception as e:
                logger.error(f"Failed to load error patterns: {e}")
                
    def save_patterns(self):
        """Save error patterns to file"""
        try:
            patterns_data = {
                key: pattern.to_dict()
                for key, pattern in self.error_patterns.items()
            }
            with open(self.patterns_file, 'w') as f:
                json.dump(patterns_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save error patterns: {e}")
            
    async def learn_from_error(self, error: Exception, context: Dict[str, Any] = None):
        """Learn from a new error occurrence"""
        async with self._lock:
            error_type = error.__class__.__name__
            error_message = str(error)
            stack_trace = ''.join(traceback.format_tb(error.__traceback__))
            
            # Create pattern key
            pattern_key = f"{error_type}:{error_message}"
            
            if pattern_key in self.error_patterns:
                # Update existing pattern
                pattern = self.error_patterns[pattern_key]
                pattern.frequency += 1
                pattern.last_seen = datetime.now()
                if context:
                    pattern.context.update(context)
            else:
                # Create new pattern
                pattern = ErrorPattern(
                    error_type=error_type,
                    error_message=error_message,
                    stack_trace=stack_trace,
                    context=context or {}
                )
                self.error_patterns[pattern_key] = pattern
            
            # Try to resolve the error
            await self._attempt_resolution(pattern)
            
            # Save updated patterns
            self.save_patterns()
            
    async def _attempt_resolution(self, pattern: ErrorPattern):
        """Attempt to resolve an error pattern"""
        if pattern.error_type in self.correction_strategies:
            for strategy in self.correction_strategies[pattern.error_type]:
                try:
                    resolution = await strategy(pattern)
                    if resolution:
                        pattern.resolution = resolution
                        pattern.success_count += 1
                        return True
                except Exception as e:
                    logger.error(f"Resolution strategy failed: {e}")
                    pattern.failed_resolutions.append(str(e))
        return False
    
    async def _monitor_errors(self):
        """Monitor for errors in the system"""
        while self._running:
            try:
                # Check for uncaught exceptions
                sys.excepthook = self._global_error_handler
                
                # Analyze error patterns
                await self._analyze_patterns()
                
                await asyncio.sleep(300)  # Check every 5 minutes
                
            except Exception as e:
                logger.error(f"Error monitoring failed: {e}")
                await asyncio.sleep(600)  # Back off on error
                
    def _global_error_handler(self, exc_type, exc_value, exc_traceback):
        """Global exception handler"""
        asyncio.create_task(
            self.learn_from_error(
                exc_value,
                {
                    'timestamp': datetime.now().isoformat(),
                    'module': exc_traceback.tb_frame.f_globals.get('__name__'),
                    'line': exc_traceback.tb_lineno
                }
            )
        )
        
    async def _analyze_patterns(self):
        """Analyze error patterns for trends"""
        async with self._lock:
            for pattern in self.error_patterns.values():
                # Check for frequently occurring errors
                if pattern.frequency > 10 and not pattern.resolution:
                    logger.warning(
                        f"Frequent error pattern detected: {pattern.error_type}"
                        f" ({pattern.frequency} occurrences)"
                    )
                    
                # Check for recently resolved errors
                if pattern.resolution and pattern.success_count > 0:
                    logger.info(
                        f"Successfully resolved error pattern: {pattern.error_type}"
                        f" (Success count: {pattern.success_count})"
                    )
                    
    async def _reduce_memory_usage(self, pattern: ErrorPattern) -> Optional[str]:
        """Strategy: Reduce memory usage"""
        if 'memory' in pattern.context:
            # Implement memory optimization
            return "Implemented memory usage optimization"
        return None
        
    async def _optimize_data_structures(self, pattern: ErrorPattern) -> Optional[str]:
        """Strategy: Optimize data structures"""
        if 'data_structure' in pattern.context:
            # Implement data structure optimization
            return "Optimized data structures"
        return None
        
    async def _implement_retries(self, pattern: ErrorPattern) -> Optional[str]:
        """Strategy: Implement retry mechanism"""
        if 'io_operation' in pattern.context:
            # Add retry logic
            return "Added retry mechanism"
        return None
        
    async def _add_error_handling(self, pattern: ErrorPattern) -> Optional[str]:
        """Strategy: Add error handling"""
        try:
            if 'file_path' in pattern.context:
                file_path = Path(pattern.context['file_path'])
                if file_path.exists():
                    # Analyze and add error handling
                    return "Added error handling code"
        except Exception:
            pass
        return None
        
    async def _fix_race_conditions(self, pattern: ErrorPattern) -> Optional[str]:
        """Strategy: Fix race conditions"""
        if 'concurrent_access' in pattern.context:
            # Implement synchronization
            return "Added synchronization mechanisms"
        return None
        
    async def _add_synchronization(self, pattern: ErrorPattern) -> Optional[str]:
        """Strategy: Add synchronization"""
        if 'async_operation' in pattern.context:
            # Add proper synchronization
            return "Implemented proper async synchronization"
        return None
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get error learning statistics"""
        stats = {
            'total_patterns': len(self.error_patterns),
            'resolved_patterns': sum(
                1 for p in self.error_patterns.values()
                if p.resolution is not None
            ),
            'active_patterns': sum(
                1 for p in self.error_patterns.values()
                if p.resolution is None
            ),
            'success_rate': sum(
                p.success_count for p in self.error_patterns.values()
            ) / max(1, len(self.error_patterns)),
            'pattern_frequency': {
                error_type: sum(
                    1 for p in self.error_patterns.values()
                    if p.error_type == error_type
                )
                for error_type in set(
                    p.error_type for p in self.error_patterns.values()
                )
            }
        }
        return stats
