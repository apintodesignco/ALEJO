"""
Security Headers Module for ALEJO

This module provides security header configurations for web applications to protect against
common web vulnerabilities like XSS, clickjacking, and content sniffing.

This is a wrapper around the comprehensive security implementation in the security package.
"""

import sys
import os
from pathlib import Path

# Add the parent directory to the path to allow importing from security package
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Import from the comprehensive security implementation
from security.middleware import SecurityHeadersMiddleware, add_security_headers, configure_app_security

# Re-export for backwards compatibility
from enum import Enum


class SecurityHeaderLevel(Enum):
    """Security level for header configurations"""
    BASIC = "basic"
    STANDARD = "standard"
    STRICT = "strict"


class SecurityHeaders:
    """
    Implements security headers for web applications according to OWASP recommendations.
    Provides different security levels and customization options.
    
    This class is a wrapper around the comprehensive SecurityHeadersMiddleware implementation
    from the security package. It maintains the same interface for backwards compatibility.
    """

    def __init__(self, level: SecurityHeaderLevel = SecurityHeaderLevel.STANDARD):
        """
        Initialize security headers with specified security level.
        
        Args:
            level: Security level (BASIC, STANDARD, or STRICT)
        """
        self.level = level
        # Map our security levels to the middleware's configuration
        security_level = {
            SecurityHeaderLevel.BASIC: "basic",
            SecurityHeaderLevel.STANDARD: "standard",
            SecurityHeaderLevel.STRICT: "strict"
        }[level]
        
        # Use the middleware's implementation to generate headers
        middleware = SecurityHeadersMiddleware(None, security_level=security_level)
        self._headers = middleware.get_security_headers()
    
    def get_headers(self) -> dict:
        """
        Get the current security headers.
        
        Returns:
            Dictionary of security headers
        """
        return self._headers
    
    def add_csp_directive(self, directive: str, value: str) -> None:
        """
        Add or modify a Content-Security-Policy directive.
        
        Args:
            directive: CSP directive name (e.g., 'script-src')
            value: Value for the directive (e.g., "'self' https://trusted.com")
        """
        current_csp = self._headers.get("Content-Security-Policy", "")
        
        # Check if directive already exists
        if f"{directive} " in current_csp:
            # Replace existing directive
            parts = []
            for part in current_csp.split(";"):
                if part.strip().startswith(directive):
                    parts.append(f"{directive} {value}")
                else:
                    parts.append(part.strip())
            new_csp = "; ".join(parts)
        else:
            # Add new directive
            new_csp = f"{current_csp}; {directive} {value}" if current_csp else f"{directive} {value}"
        
        self._headers["Content-Security-Policy"] = new_csp
    
    def set_header(self, header: str, value: str) -> None:
        """
        Set or override a security header.
        
        Args:
            header: Header name
            value: Header value
        """
        self._headers[header] = value
    
    def remove_header(self, header: str) -> None:
        """
        Remove a security header.
        
        Args:
            header: Header name to remove
        """
        if header in self._headers:
            del self._headers[header]
    
    def get_flask_headers(self) -> Dict[str, str]:
        """
        Get headers formatted for Flask applications.
        
        Returns:
            Dictionary of headers for Flask
        """
        return self._headers
    
    def get_django_headers(self) -> Dict[str, str]:
        """
        Get headers formatted for Django security middleware.
        
        Returns:
            Dictionary of headers for Django
        """
        django_headers = {}
        
        # Map standard headers to Django settings
        if "Content-Security-Policy" in self._headers:
            django_headers["CSP_DEFAULT_SRC"] = ["'self'"]
            
        if "X-Frame-Options" in self._headers:
            django_headers["X_FRAME_OPTIONS"] = self._headers["X-Frame-Options"]
            
        if "Strict-Transport-Security" in self._headers:
            django_headers["SECURE_HSTS_SECONDS"] = 31536000
            django_headers["SECURE_HSTS_INCLUDE_SUBDOMAINS"] = "includeSubDomains" in self._headers["Strict-Transport-Security"]
            django_headers["SECURE_HSTS_PRELOAD"] = "preload" in self._headers["Strict-Transport-Security"]
            
        django_headers["SECURE_CONTENT_TYPE_NOSNIFF"] = "X-Content-Type-Options" in self._headers
        django_headers["SECURE_BROWSER_XSS_FILTER"] = "X-XSS-Protection" in self._headers
        
        return django_headers


# Example usage
if __name__ == "__main__":
    # Create security headers with standard level
    headers = SecurityHeaders(SecurityHeaderLevel.STANDARD)
    
    # Add a custom CSP directive
    headers.add_csp_directive("script-src", "'self' https://cdn.example.com")
    
    # Print all headers
    for name, value in headers.get_headers().items():
        print(f"{name}: {value}")
    
    # Example of using the middleware directly
    print("\nUsing middleware directly:")
    from security.middleware import SecurityHeadersMiddleware
    middleware = SecurityHeadersMiddleware(None, security_level="strict")
    for name, value in middleware.get_security_headers().items():
        print(f"{name}: {value}")
