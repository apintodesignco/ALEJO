"""
ALEJO - Advanced Language and Execution Joint Operator
Error Handling Utilities
"""

import logging
from functools import wraps
from typing import Any, Callable, Dict, Optional, Type, Union

# Import secrets from exceptions for secure token generation
from alejo.utils.exceptions import secrets


class ErrorTracker:
    """
    Tracks errors that occur throughout the ALEJO system.
    """
    def __init__(self):
        self.errors = []
        self.error_counts = {}
        self.logger = logging.getLogger("alejo.error_tracker")
    
    def record(self, error, context=None):
        """Record an error with optional context"""
        error_info = {
            "error": error,
            "type": type(error).__name__,
            "context": context or {}
        }
        self.errors.append(error_info)
        self.logger.error(f"Error: {error} | Context: {context}")
        
        # Track error counts by component and category
        component = context.get('component') if context else None
        category = context.get('category') if context else None
        
        if component and category:
            # Create combined key for component.category tracking
            key = f"{component}.{category}"
            if key not in self.error_counts:
                self.error_counts[key] = 0
            self.error_counts[key] += 1
        
        # Also track by component alone
        if component:
            if component not in self.error_counts:
                self.error_counts[component] = 0
            self.error_counts[component] += 1
            
        return error_info
    
    def get_errors(self, error_type=None, component=None, category=None):
        """Get all recorded errors, optionally filtered by type, component, or category"""
        filtered_errors = self.errors
        
        if error_type is not None:
            filtered_errors = [e for e in filtered_errors if e["type"] == error_type.__name__]
        
        if component is not None:
            filtered_errors = [e for e in filtered_errors 
                             if e["context"].get("component") == component]
        
        if category is not None:
            filtered_errors = [e for e in filtered_errors 
                             if e["context"].get("category") == category]
            
        return filtered_errors
    
    def clear(self):
        """Clear all recorded errors and error counts"""
        self.errors = []
        self.error_counts = {}


# Global error tracker instance
error_tracker = ErrorTracker()


def handle_errors(error_types=Exception, default_return=None, record=True, component=None, category=None):
    """
    Decorator for handling errors in functions
    
    Parameters:
        error_types: Exception type(s) to catch
        default_return: Value to return if an exception occurs (if None, returns a formatted error string)
        record: Whether to record the error in the error tracker
        component: Component where the error occurred (e.g., 'voice', 'vision')
        category: Category of the error (e.g., 'network', 'file', 'api')
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except error_types as e:
                error_id = secrets.token_hex(4) if hasattr(secrets, 'token_hex') else ''
                error_msg = str(e)
                
                if record:
                    error_context = {
                        "function": func.__name__,
                        "args": args,
                        "kwargs": kwargs
                    }
                    
                    # Add component and category metadata if provided
                    if component:
                        error_context["component"] = component
                    if category:
                        error_context["category"] = category
                        
                    tracker = args[0].error_tracker if args and hasattr(args[0], "error_tracker") else error_tracker
                    tracker.record(e, error_context)
                    
                    # If error category is 'connection', simulate exponential backoff
                    if category == 'connection':
                        import time
                        time.sleep(1)
                
                # If default_return is None, return a formatted error message string
                if default_return is None:
                    prefix = f"[{error_id}] " if error_id else ""
                    return f"Error: {prefix}{error_msg}"
                return default_return
        return wrapper
    return decorator
