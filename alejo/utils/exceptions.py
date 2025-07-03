"""
ALEJO - Advanced Language and Execution Joint Operator
Exception Classes
"""

import secrets  # More secure for cryptographic purposes

class AlejoBaseException(Exception):
    """Base exception for all ALEJO exceptions"""
    def __init__(self, message="An error occurred in ALEJO", error_code=None):
        self.message = message
        self.error_code = error_code or secrets.token_hex(4)
        super().__init__(self.message)
        
    def __str__(self):
        return f"[{self.error_code}] {self.message}"


class CommandError(AlejoBaseException):
    """Raised when a command fails to execute correctly"""
    def __init__(self, message="Command execution failed", command=None, error_code=None):
        self.command = command
        super().__init__(message, error_code)
        
    def __str__(self):
        cmd_str = f" (Command: {self.command})" if self.command else ""
        return f"[{self.error_code}] {self.message}{cmd_str}"


class FileOperationError(AlejoBaseException):
    """Raised when a file operation fails"""
    def __init__(self, message="File operation failed", filepath=None, error_code=None):
        self.filepath = filepath
        super().__init__(message, error_code)
        
    def __str__(self):
        path_str = f" (Path: {self.filepath})" if self.filepath else ""
        return f"[{self.error_code}] {self.message}{path_str}"


class APIError(AlejoBaseException):
    """Raised when an API request fails"""
    def __init__(self, message="API request failed", status_code=None, endpoint=None, error_code=None):
        self.status_code = status_code
        self.endpoint = endpoint
        super().__init__(message, error_code)
        
    def __str__(self):
        endpoint_str = f" (Endpoint: {self.endpoint})" if self.endpoint else ""
        status_str = f" (Status: {self.status_code})" if self.status_code else ""
        return f"[{self.error_code}] {self.message}{endpoint_str}{status_str}"


class NetworkError(AlejoBaseException):
    """Raised when a network operation fails"""
    def __init__(self, message="Network operation failed", host=None, port=None, error_code=None):
        self.host = host
        self.port = port
        super().__init__(message, error_code)
        
    def __str__(self):
        host_str = f" (Host: {self.host})" if self.host else ""
        port_str = f":{self.port}" if self.port else ""
        return f"[{self.error_code}] {self.message}{host_str}{port_str}"


class LLMServiceError(AlejoBaseException):
    """Raised when an LLM service fails"""
    def __init__(self, message="LLM service error", service_name=None, error_code=None):
        self.service_name = service_name
        super().__init__(message, error_code)
        
    def __str__(self):
        service_str = f" (Service: {self.service_name})" if self.service_name else ""
        return f"[{self.error_code}] {self.message}{service_str}"


class VoiceRecognitionError(AlejoBaseException):
    """Raised when voice recognition fails"""
    def __init__(self, message="Voice recognition failed", error_code=None):
        super().__init__(message, error_code)
