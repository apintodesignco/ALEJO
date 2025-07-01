"""
ALEJO Security Middleware

This module provides middleware components for enhancing application security without
affecting usability. It implements best practices for web security including:
- Content Security Policy
- HTTP Strict Transport Security
- XSS Protection
- And other security headers
"""

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import logging

logger = logging.getLogger(__name__)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds security headers to all responses.
    
    These headers help protect against common web vulnerabilities like:
    - Cross-Site Scripting (XSS)
    - Clickjacking
    - MIME type sniffing
    - Cross-site request forgery
    - Information leakage
    """
    
    def __init__(
        self, 
        app, 
        csp_policy: str = None,
        enable_hsts: bool = True,
        enable_xss_protection: bool = True,
        enable_content_type_options: bool = True,
        enable_frame_options: bool = True,
        enable_referrer_policy: bool = True
    ):
        super().__init__(app)
        self.csp_policy = csp_policy or self._default_csp_policy()
        self.enable_hsts = enable_hsts
        self.enable_xss_protection = enable_xss_protection
        self.enable_content_type_options = enable_content_type_options
        self.enable_frame_options = enable_frame_options
        self.enable_referrer_policy = enable_referrer_policy
        
        logger.info("SecurityHeadersMiddleware initialized")
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add Content-Security-Policy header
        if self.csp_policy:
            response.headers["Content-Security-Policy"] = self.csp_policy
        
        # Add HTTP Strict Transport Security header
        if self.enable_hsts:
            # Max age of 1 year in seconds, include subdomains
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Add X-XSS-Protection header
        if self.enable_xss_protection:
            # Enable XSS filtering and block rendering if detected
            response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Add X-Content-Type-Options header
        if self.enable_content_type_options:
            # Prevent MIME type sniffing
            response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Add X-Frame-Options header
        if self.enable_frame_options:
            # Prevent clickjacking by denying framing from other sites
            response.headers["X-Frame-Options"] = "DENY"
        
        # Add Referrer-Policy header
        if self.enable_referrer_policy:
            # Only send the origin as the referrer
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            
        # Add Feature-Policy header
        response.headers["Permissions-Policy"] = "geolocation=self, microphone=self, camera=self"
        
        return response
    
    def _default_csp_policy(self) -> str:
        """
        Generate a sensible default Content Security Policy.
        
        Follows best practices while allowing basic functionality.
        """
        return (
            # Default fallback for everything not explicitly specified
            "default-src 'self'; "
            # Scripts from self and trusted CDNs
            "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
            # Styles from self and trusted CDNs
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            # Font sources
            "font-src 'self' https://fonts.gstatic.com; "
            # Image sources
            "img-src 'self' data: blob:; "
            # Connect to self only
            "connect-src 'self' ws: wss:; "
            # Media sources
            "media-src 'self'; "
            # Object sources
            "object-src 'none'; "
            # Form targets
            "form-action 'self'; "
            # Frame sources
            "frame-src 'self'; "
            # Frame ancestors
            "frame-ancestors 'none'; "
            # Upgrade insecure requests
            "upgrade-insecure-requests; "
            # Block mixed content
            "block-all-mixed-content;"
        )


def add_security_headers(app: FastAPI, **kwargs) -> None:
    """
    Add security headers middleware to a FastAPI application.
    
    Args:
        app: The FastAPI application to add the middleware to
        **kwargs: Additional options to pass to the SecurityHeadersMiddleware
    """
    app.add_middleware(SecurityHeadersMiddleware, **kwargs)
    logger.info("Security headers middleware added to FastAPI application")


def configure_app_security(app: FastAPI) -> None:
    """
    Configure comprehensive security for a FastAPI application.
    
    This function applies all recommended security settings to a FastAPI app.
    
    Args:
        app: The FastAPI application to configure
    """
    # Add security headers
    add_security_headers(app)
    
    logger.info("Application security configured")
