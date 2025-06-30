"""
ALEJO Error Handling and Logging Module
Provides robust error handling, logging, and recovery mechanisms
"""

import os
import sys
import time
import random
import logging
import traceback
import functools
import threading
import json
from typing import Dict, Any, Callable, List, Optional, Tuple, Union
from datetime import datetime
from pathlib import Path

# Import custom exceptions
from .exceptions import RateLimitError, APIError

# Configure logger
logger = logging.getLogger("alejo.error_handling")

# Constants
ERROR_LEVELS = {
    "CRITICAL": 50,
    "ERROR": 40,
    "WARNING": 30,
    "INFO": 20,
    "DEBUG": 10
}

class ErrorTracker:
    """
    Tracks and manages errors throughout the ALEJO system
    
    Features:
    - Error categorization and prioritization
    - Automatic recovery strategies
    - Error reporting and analytics
    - Graceful degradation of services
    - Automatic component health monitoring
    - Self-healing capabilities for known issues
    """
    
    # Error categories and their severity levels
    ERROR_CATEGORIES = {
        'critical': {
            'level': 50,
            'requires_immediate_action': True,
            'max_retries': 1
        },
        'system': {
            'level': 40,
            'requires_immediate_action': True,
            'max_retries': 3
        },
        'operational': {
            'level': 30,
            'requires_immediate_action': False,
            'max_retries': 5
        },
        'recoverable': {
            'level': 20,
            'requires_immediate_action': False,
            'max_retries': 10
        }
    }
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the error tracker
        
        Args:
            config: Optional configuration dictionary with settings for error handling
        """
        self.config = config or {}
        self.log_dir = Path(self.config.get('log_dir', 'logs'))
        self.log_dir.mkdir(exist_ok=True)
        
        # Initialize core tracking state
        self.error_log_path = self.log_dir / "error_log.json"
        self.error_counts = self._load_error_counts()
        self.error_history: List[Dict[str, Any]] = []
        self.recovery_attempts: Dict[str, int] = {}
        
        # Test mode configuration
        self.test_mode = self.config.get('test_mode', False)
        if 'unittest' in sys.modules or 'pytest' in sys.modules:
            self.test_mode = True
            logger.info("Error tracker running in test mode - component health monitoring disabled")
        
        # Initialize component configuration
        self.thresholds = {
            'command_processor': 5,    # Can handle more errors
            'voice_recognition': 3,    # More sensitive to errors
            'llm_service': 5,         # Can retry LLM calls
            'web_interface': 3,       # Keep UI stable
            'default': 4              # Default threshold
        }
        
        # Initialize component health status
        self.component_health = {component: True for component in self.thresholds.keys()}
        
        # Initialize recovery strategies
        self.recovery_strategies = {
            # Core system errors
            'connection': self._recover_connection,
            'memory': self._recover_memory,
            'timeout': self._recover_timeout,
            
            # Component-specific errors
            'command_processor': self._recover_command_processor,
            'voice_recognition': self._recover_voice_recognition,
            'llm_service': self._recover_llm_service,
            'web_interface': self._recover_web_interface,
            
            # Resource errors
            'file': self._recover_file_operation,
            'network': self._recover_network,
            'permission': self._recover_permission
        }
        
        # Thread safety
        self.lock = threading.Lock()
        
        logger.info("Error tracker initialized")
    
    def _load_error_counts(self) -> Dict[str, int]:
        """
        Load error counts from log file
        
        Returns:
            Dictionary of error counts by type
        """
        if not self.error_log_path.exists():
            return {}
        
        try:
            with open(self.error_log_path, 'r') as f:
                error_data = json.load(f)
                return error_data.get('error_counts', {})
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Failed to load error counts: {e}")
            return {}
    
    def get_errors(self) -> List[Dict[str, Any]]:
        """
        Return the history of tracked errors
        
        Returns:
            List of error dictionaries
        """
        with self.lock:
            return list(self.error_history)

    def _save_error_counts(self) -> None:
        """Save error counts to log file"""
        try:
            error_data = {
                'error_counts': self.error_counts,
                'last_updated': datetime.now().isoformat()
            }
            
            with open(self.error_log_path, 'w') as f:
                json.dump(error_data, f, indent=2)
        except IOError as e:
            logger.error(f"Failed to save error counts: {e}")
    
    def _init_recovery_strategies(self) -> Dict[str, Callable]:
        """
        Initialize recovery strategies for different error types
        
        Returns:
            Dictionary of recovery functions by error type
        """
        return {
            "command_processor": self._recover_command_processor,
            "voice_recognition": self._recover_voice_recognition,
            "llm_service": self._recover_llm_service,
            "web_interface": self._recover_web_interface,
            "file_operation": self._recover_file_operation,
            "network": self._recover_network,
            "permission": self._recover_permission
        }
    
    def track_error(self, 
                   component: str, 
                   error_type: str, 
                   error: Exception, 
                   context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Track an error and apply recovery strategy if available
        
        Args:
            component: Component where error occurred
            error_type: Type of error
            error: Exception object
            context: Additional context information
            
        Returns:
            Dictionary with error details and recovery information
        """
        error_key = f"{component}:{error_type}"
        error_info = {
            "component": component,
            "category": error_type,
            "message": str(error),
            "timestamp": time.time(),
            "context": {} if context is None else {k: v for k, v in context.items() if isinstance(k, str)}
        }
        
        # Log the error
        logger.error(f"Error in {component} ({error_type}): {error}")
        
        # Update error counts and history
        with self.lock:
            self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1
            self.error_history.append(error_info)
        
        # Check if threshold exceeded - only affect component health if not in test mode
        threshold = self.thresholds.get(component, 3)
        if self.error_counts[error_key] >= threshold and not self.test_mode:
            logger.warning(f"Error threshold exceeded for {component}. Marking component as unhealthy.")
            self.component_health[component] = False
        elif self.error_counts[error_key] >= threshold and self.test_mode:
            logger.info(f"Error threshold exceeded for {component}, but test mode is active. Component health unchanged.")
        
        # Apply recovery strategy
        recovery_result = None
        if component in self.recovery_strategies:
            try:
                recovery_result = self.recovery_strategies[component](error, context)
            except Exception as recovery_error:
                logger.error(f"Recovery strategy failed: {recovery_error}")
                recovery_result = {'success': False, 'reason': str(recovery_error)}
        else:
            recovery_result = {'success': False, 'reason': 'No recovery strategy available'}
        
        return {
            "error": error_info,
            "recovery": recovery_result
        }
    
    def is_component_healthy(self, component: str) -> bool:
        """
        Check if a component is healthy
        
        Args:
            component: Component name
            
        Returns:
            True if component is healthy
        """
        return self.component_health.get(component, True)
    
    def reset_component_health(self, component: str) -> None:
        """
        Reset component health status
        
        Args:
            component: Component name
        """
        with self.lock:
            self.component_health[component] = True
            
            # Reset error counts for this component
            for error_key in list(self.error_counts.keys()):
                if error_key.startswith(f"{component}:"):
                    self.error_counts[error_key] = 0
            
            self._save_error_counts()
        
        logger.info(f"Reset health status for {component}")
    
    def set_test_mode(self, enabled: bool = True) -> None:
        """
        Enable or disable test mode
        
        In test mode, errors don't affect component health status.
        This is useful for integration tests where errors are expected.
        
        Args:
            enabled: True to enable test mode, False to disable
        """
        self.test_mode = enabled
        logger.info(f"Error tracker test mode {'enabled' if enabled else 'disabled'}")
        
        # If disabling test mode, reset all component health
        if not enabled:
            for component in self.component_health:
                self.reset_component_health(component)
    
    def get_error_count(self, component: str, category: str = None) -> int:
        """Get the number of errors for a component and optional category.
        
        Args:
            component: The component to check errors for
            category: Optional category to filter by
            
        Returns:
            Number of errors
        """
        count = 0
        for error in self.error_history:
            if error['component'] == component:
                if category is None or error['category'] == category:
                    count += 1
        return count
        
    def get_error_report(self) -> Dict[str, Any]:
        """
        Generate an error report
        
        Returns:
            Dictionary with error statistics and component health
        """
        return {
            "error_counts": self.error_counts,
            "component_health": self.component_health,
            "timestamp": datetime.now().isoformat()
        }
    
    # Recovery strategies
    def _recover_connection(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recovery strategy for connection errors.
        Attempts to re-establish connections with exponential backoff.
        
        Args:
            error: The exception that occurred
            context: Additional error context
            
        Returns:
            Dict containing recovery status and actions taken
        """
        try:
            retry_count = context.get('retry_count', 0)
            max_retries = context.get('max_retries', 3)
            
            if retry_count >= max_retries:
                return {'success': False, 'reason': f'Max retries ({max_retries}) exceeded'}
            
            actions_taken = []
            
            # Apply exponential backoff
            wait_time = min((2 ** retry_count) + random.uniform(0, 1), 30)
            time.sleep(wait_time)
            actions_taken.append(f'backoff_wait_{wait_time}s')
            
            # Reset connection if available
            if 'connection' in context:
                conn = context['connection']
                if hasattr(conn, 'reset'):
                    conn.reset()
                    actions_taken.append('reset_connection')
                elif hasattr(conn, 'reconnect'):
                    conn.reconnect()
                    actions_taken.append('reconnected')
            
            return {
                'success': True,
                'actions': actions_taken
            }
            
        except Exception as e:
            logger.error(f"Connection recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
    
    def _recover_memory(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recovery strategy for memory-related errors.
        Attempts to free memory and garbage collect.
        
        Args:
            error: The exception that occurred
            context: Additional error context
            
        Returns:
            Dict containing recovery status and actions taken
        """
        try:
            import gc
            actions_taken = []
            
            # Force garbage collection
            gc.collect()
            actions_taken.append('garbage_collection')
            
            # Clear caches if available
            if 'cache' in context:
                cache = context['cache']
                if hasattr(cache, 'clear'):
                    cache.clear()
                    actions_taken.append('cleared_cache')
            
            # Release large objects if specified
            if 'large_objects' in context:
                for obj in context['large_objects']:
                    if hasattr(obj, 'release'):
                        obj.release()
                        actions_taken.append('released_large_object')
            
            return {
                'success': True,
                'actions': actions_taken
            }
            
        except Exception as e:
            logger.error(f"Memory recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
    
    def _recover_timeout(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recovery strategy for timeout errors.
        Implements retry with increased timeouts.
        
        Args:
            error: The exception that occurred
            context: Additional error context
            
        Returns:
            Dict containing recovery status and actions taken
        """
        try:
            retry_count = context.get('retry_count', 0)
            max_retries = context.get('max_retries', 3)
            
            if retry_count >= max_retries:
                return {'success': False, 'reason': f'Max retries ({max_retries}) exceeded'}
            
            actions_taken = []
            
            # Increase timeout for next attempt
            current_timeout = context.get('timeout', 30)
            new_timeout = min(current_timeout * 2, 300)  # Cap at 5 minutes
            actions_taken.append(f'increased_timeout_to_{new_timeout}s')
            
            # Update context with new timeout
            if 'update_timeout' in context:
                context['update_timeout'](new_timeout)
                actions_taken.append('updated_timeout_setting')
            
            return {
                'success': True,
                'actions': actions_taken,
                'new_timeout': new_timeout
            }
            
        except Exception as e:
            logger.error(f"Timeout recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
    
    def _recover_command_processor(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recovery strategy for command processor errors.
        Attempts to reset the command processor state and clear any stuck commands.
        
        Args:
            error: The exception that occurred
            context: Additional error context
            
        Returns:
            Dict containing recovery status and actions taken
        """
        try:
            # Get the command processor instance from context
            cmd_processor = context.get('processor')
            if not cmd_processor:
                return {'success': False, 'reason': 'No command processor instance provided'}
            
            # Clear any pending commands
            if hasattr(cmd_processor, 'clear_pending_commands'):
                cmd_processor.clear_pending_commands()
            
            # Reset internal state
            if hasattr(cmd_processor, 'reset_state'):
                cmd_processor.reset_state()
            
            # Clear command history if it exists
            if hasattr(cmd_processor, 'clear_history'):
                cmd_processor.clear_history()
            
            return {
                'success': True,
                'actions': ['cleared_pending_commands', 'reset_state', 'cleared_history']
            }
            
        except Exception as e:
            logger.error(f"Command processor recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
    
    def _recover_voice_recognition(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recovery strategy for voice recognition errors.
        Attempts to reset the voice service and reinitialize if needed.
        
        Args:
            error: The exception that occurred
            context: Additional error context
            
        Returns:
            Dict containing recovery status and actions taken
        """
        try:
            voice_service = context.get('service')
            if not voice_service:
                return {'success': False, 'reason': 'No voice service instance provided'}
            
            actions_taken = []
            
            # Stop any active listening
            if hasattr(voice_service, 'stop_listening'):
                voice_service.stop_listening()
                actions_taken.append('stopped_listening')
            
            # Reset audio stream
            if hasattr(voice_service, 'reset_audio_stream'):
                voice_service.reset_audio_stream()
                actions_taken.append('reset_audio_stream')
            
            # Reinitialize if needed
            if isinstance(error, (IOError, OSError)):
                if hasattr(voice_service, 'reinitialize'):
                    voice_service.reinitialize()
                    actions_taken.append('reinitialized_service')
            
            return {
                'success': True,
                'actions': actions_taken
            }
            
        except Exception as e:
            logger.error(f"Voice recognition recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
    
    def _recover_llm_service(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recovery strategy for LLM service errors.
        Implements exponential backoff and API key rotation if available.
        
        Args:
            error: The exception that occurred
            context: Additional error context
            
        Returns:
            Dict containing recovery status and actions taken
        """
        try:
            service = context.get('service')
            if not service:
                return {'success': False, 'reason': 'No LLM service instance provided'}
            
            actions_taken = []
            retry_count = context.get('retry_count', 0)
            
            # Handle rate limiting with exponential backoff
            if isinstance(error, (RateLimitError, APIError)):
                wait_time = min((2 ** retry_count) + random.uniform(0, 1), 60)
                time.sleep(wait_time)
                actions_taken.append(f'backoff_wait_{wait_time}s')
            
            # Rotate API keys if available
            if hasattr(service, 'rotate_api_key'):
                service.rotate_api_key()
                actions_taken.append('rotated_api_key')
                
            # Clear context if needed
            if hasattr(service, 'clear_context'):
                service.clear_context()
                actions_taken.append('cleared_context')
                
            return {
                'success': True,
                'actions': actions_taken
            }
            
        except Exception as e:
            logger.error(f"LLM service recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
    
    def _recover_web_interface(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recovery strategy for web interface errors.
        Attempts to reset the web interface state and reconnect if needed.
        
        Args:
            error: The exception that occurred
            context: Additional error context
            
        Returns:
            Dict containing recovery status and actions taken
        """
        try:
            web_interface = context.get('interface')
            if not web_interface:
                return {'success': False, 'reason': 'No web interface instance provided'}
            
            actions_taken = []
            
            # Clear any stuck sessions
            if hasattr(web_interface, 'clear_sessions'):
                web_interface.clear_sessions()
                actions_taken.append('cleared_sessions')
            
            # Reset connection pool
            if hasattr(web_interface, 'reset_connections'):
                web_interface.reset_connections()
                actions_taken.append('reset_connections')
            
            # Attempt to reconnect
            if isinstance(error, (ConnectionError, TimeoutError)):
                if hasattr(web_interface, 'reconnect'):
                    web_interface.reconnect()
                    actions_taken.append('reconnected')
                    
            return {
                'success': True,
                'actions': actions_taken
            }
            
        except Exception as e:
            logger.error(f"Web interface recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
            logger.error(f"Web interface recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
    
    def _recover_file_operation(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recovery strategy for file operation errors.
        Handles common file system issues like locks and permissions.
        
        Args:
            error: The exception that occurred
            context: Additional error context
            
        Returns:
            Dict containing recovery status and actions taken
        """
        try:
            file_path = context.get('file_path')
            if not file_path:
                return {'success': False, 'reason': 'No file path provided'}
            
            actions_taken = []
            
            # Handle file lock issues
            if isinstance(error, (IOError, OSError)) and 'permission denied' in str(error).lower():
                time.sleep(1)  # Brief wait for lock release
                actions_taken.append('waited_for_lock')
            
            # Create parent directories if missing
            if isinstance(error, FileNotFoundError):
                parent_dir = os.path.dirname(file_path)
                if parent_dir and not os.path.exists(parent_dir):
                    os.makedirs(parent_dir, exist_ok=True)
                    actions_taken.append('created_parent_dirs')
            
            return {
                'success': True,
                'actions': actions_taken
            }
            
        except Exception as e:
            logger.error(f"File operation recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
    
    def _recover_network(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recovery strategy for network errors.
        Implements exponential backoff and connection pool reset.
        
        Args:
            error: The exception that occurred
            context: Additional error context
            
        Returns:
            Dict containing recovery status and actions taken
        """
        try:
            retry_count = context.get('retry_count', 0)
            max_retries = context.get('max_retries', 3)
            
            if retry_count >= max_retries:
                return {'success': False, 'reason': f'Max retries ({max_retries}) exceeded'}
            
            actions_taken = []
            
            # Apply exponential backoff
            wait_time = min((2 ** retry_count) + random.uniform(0, 1), 30)
            time.sleep(wait_time)
            actions_taken.append(f'backoff_wait_{wait_time}s')
            
            # Reset connection pools if available
            if 'client' in context and hasattr(context['client'], 'reset_pool'):
                context['client'].reset_pool()
                actions_taken.append('reset_connection_pool')
            
            return {
                'success': True,
                'actions': actions_taken
            }
            
        except Exception as e:
            logger.error(f"Network recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
    
    def _recover_permission(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recovery strategy for permission errors.
        Attempts to handle common permission issues.
        
        Args:
            error: The exception that occurred
            context: Additional error context
            
        Returns:
            Dict containing recovery status and actions taken
        """
        try:
            actions_taken = []
            resource = context.get('resource')
            
            if not resource:
                return {'success': False, 'reason': 'No resource information provided'}
            
            # Check for alternative access methods
            if 'alternative_paths' in context:
                for alt_path in context['alternative_paths']:
                    try:
                        # Attempt to use alternative path
                        if os.access(alt_path, os.R_OK):
                            actions_taken.append(f'using_alternative_path_{alt_path}')
                            return {'success': True, 'actions': actions_taken}
                    except Exception:
                        continue
            
            # Attempt to acquire temporary elevated permissions if supported
            if 'elevate_permissions' in context:
                try:
                    context['elevate_permissions'](resource)
                    actions_taken.append('elevated_permissions')
                    return {'success': True, 'actions': actions_taken}
                except Exception as e:
                    logger.warning(f"Failed to elevate permissions: {e}")
            
            return {
                'success': False,
                'reason': 'No successful recovery strategy found',
                'actions': actions_taken
            }
            
        except Exception as e:
            logger.error(f"Permission recovery failed: {str(e)}")
            return {'success': False, 'reason': str(e)}
    
    def _recover_file_operation(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """Recovery strategy for file operation errors"""
        logger.info("Attempting to recover from file operation error")
        
        file_path = context.get("file_path", "unknown")
        operation = context.get("operation", "unknown")
        
        # Check for permission errors
        if isinstance(error, PermissionError):
            return {
                "action": "suggest_permission_fix",
                "success": False,
                "message": f"Permission error for {operation} on {file_path}. Please check file permissions."
            }
        
        # Check for file not found
        if isinstance(error, FileNotFoundError):
            if operation == "read":
                return {
                    "action": "suggest_file_creation",
                    "success": False,
                    "message": f"File {file_path} not found. Please verify the file path."
                }
        
        return {
            "action": "log_and_notify",
            "success": False,
            "message": f"File operation {operation} failed on {file_path}"
        }
    
    def _recover_network(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """Recovery strategy for network errors"""
        logger.info("Attempting to recover from network error")
        
        url = context.get("url", "unknown")
        operation = context.get("operation", "unknown")
        
        # Implement retry logic with exponential backoff
        max_retries = context.get("max_retries", 3)
        retry_count = context.get("retry_count", 0)
        
        if retry_count < max_retries:
            backoff_time = 2 ** retry_count
            logger.info(f"Retrying network operation in {backoff_time} seconds (attempt {retry_count + 1}/{max_retries})")
            
            time.sleep(backoff_time)
            
            return {
                "success": True,
                "actions": ["retry", f"backoff_{backoff_time}s"],
                "retry_count": retry_count + 1,
                "message": f"Retrying network operation to {url}"
            }
        
        return {
            "action": "network_failure",
            "success": False,
            "message": f"Network operation {operation} to {url} failed after {max_retries} retries"
        }
    


# Decorator for error handling
def handle_errors(component: str, category: str = None):
    """
    Decorator to handle errors in functions, track them, and return a friendly message.

    Args:
        component: The name of the component where the error occurs (e.g., 'command_processor').
        category: The category of the operation (e.g., 'file_operation').
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # Use the provided category or default to a general one.
                error_category = category or 'general_exception'
                
                # Create context for the error log.
                context = {
                    "function": func.__name__,
                    "args": str(args[1:]),  # Exclude 'self' from the logged arguments.
                    "kwargs": str(kwargs)
                }
                
                # Get the error tracker from the instance if available
                instance = args[0] if args else None
                if instance and hasattr(instance, 'error_tracker'):
                    tracker = instance.error_tracker
                else:
                    tracker = get_error_tracker()
                
                # Track the error using the instance's tracker.
                tracker.track_error(
                    component, 
                    error_category, 
                    e,  # Pass the actual exception object.
                    context
                )
                
                # Re-raise the original exception
                raise
        return wrapper
    return decorator

# Singleton instance
_error_tracker_instance = None

def get_error_tracker(config: Dict[str, Any] = None) -> ErrorTracker:
    """
    Get or create the error tracker instance
    
    Args:
        config: Optional configuration dictionary
        
    Returns:
        ErrorTracker instance
    """
    global _error_tracker_instance
    if _error_tracker_instance is None:
        _error_tracker_instance = ErrorTracker(config)
    return _error_tracker_instance

# Configure default exception handler
def configure_global_exception_handler():
    """Configure global exception handler to catch unhandled exceptions"""
    def global_exception_handler(exctype, value, tb):
        """Global exception handler"""
        error_tracker = get_error_tracker()
        
        # Format traceback
        traceback_str = ''.join(traceback.format_tb(tb))
        
        # Log the error
        logger.critical(f"Unhandled exception: {exctype.__name__}: {value}\n{traceback_str}")
        
        # Track the error
        error_tracker.track_error(
            "global", exctype.__name__, value, 
            {"traceback": traceback_str}
        )
        
        # Call the original exception handler
        sys.__excepthook__(exctype, value, tb)
    
    # Set the exception handler
    sys.excepthook = global_exception_handler
