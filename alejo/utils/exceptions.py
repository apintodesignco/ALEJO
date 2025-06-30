"""
ALEJO Custom Exceptions Module
Defines custom exceptions used throughout the ALEJO system
"""

class ALEJOError(Exception):
    """Base exception class for all ALEJO-specific errors."""
    pass

class RateLimitError(ALEJOError):
    """Raised when a rate limit is exceeded (e.g., API calls)."""
    pass

class APIError(ALEJOError):
    """Raised when an API request fails."""
    pass

class ConfigurationError(ALEJOError):
    """Raised when there is a configuration-related error."""
    pass

class CommandError(ALEJOError):
    """Raised when there is an error processing a command."""
    pass

class VoiceRecognitionError(ALEJOError):
    """Error in voice recognition"""
    pass

class VisionError(ALEJOError):
    """Error in vision processing"""
    pass

class EmotionalMemoryError(ALEJOError):
    """Error in emotional memory system"""
    pass

class EmotionalProcessorError(ALEJOError):
    """Error in emotional processing"""
    pass

class EthicalFrameworkError(ALEJOError):
    """Error in ethical framework"""
    pass

class LLMServiceError(ALEJOError):
    """Raised when there is an error with the LLM service."""
    pass

class ModelError(ALEJOError):
    """Raised when there is an error with a model (loading, inference, etc.)."""
    pass

class WebInterfaceError(ALEJOError):
    """Raised when there is an error with the web interface."""
    pass

class FileOperationError(ALEJOError):
    """Raised when there is an error with file operations."""
    pass

class NetworkError(Exception):
    """Exception raised for network-related errors"""
    pass

class PermissionError(ALEJOError):
    """Raised when there is a permission-related error."""
    pass

class VisionError(ALEJOError):
    """Raised when there is an error with vision processing."""
    pass

class MemoryError(ALEJOError):
    """Raised when there is a memory-related error."""
    pass

class TimeoutError(ALEJOError):
    """Raised when an operation times out."""
    pass

class ConnectionError(ALEJOError):
    """Raised when there is a connection-related error."""
    pass

class EventBusError(ALEJOError):
    """Raised when there is an error with the event bus."""
    pass

class EmotionalProcessingError(ALEJOError):
    """Raised when there is an error in emotional processing operations."""
    pass

class EthicalEvaluationError(ALEJOError):
    """Raised when there is an error during ethical evaluation of decisions or emotional responses."""
    pass
