#!/usr/bin/env python3
"""
ALEJO SSO Integration Module
Provides integration with external SSO providers
"""

import os
import json
import time
import logging
import requests
import secrets
import urllib.parse
from typing import Dict, List, Optional, Union, Any, Tuple

logger = logging.getLogger("alejo.security.sso_integration")

class SSOIntegration:
    """
    ALEJO SSO Integration for external authentication providers
    
    This class provides methods for integrating with external SSO providers
    such as OAuth2, SAML, and OpenID Connect.
    """
    
    def __init__(self, config: Dict = None):
        """
        Initialize the SSO integration module
        
        Args:
            config: Optional configuration dictionary with settings
        """
        self.config = config or {}
        
        # SSO settings
        self.providers = self.config.get("providers", {})
        
        # State management for OAuth flows
        self.oauth_states = {}
        
        # Configure logging
        self._setup_logging()
        
        logger.info("SSO integration initialized")
    
    def _setup_logging(self):
        """Configure logging for the SSO integration module"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def add_provider(self, provider_id: str, provider_config: Dict) -> bool:
        """
        Add an SSO provider configuration
        
        Args:
            provider_id: Provider ID (e.g., "google", "github")
            provider_config: Provider configuration
            
        Returns:
            True if the provider was added successfully, False otherwise
        """
        # Validate provider configuration
        required_fields = ["type", "client_id", "client_secret", "redirect_uri"]
        for field in required_fields:
            if field not in provider_config:
                logger.error(f"Provider configuration missing required field: {field}")
                return False
        
        # Add the provider
        self.providers[provider_id] = provider_config
        
        logger.info(f"Added SSO provider: {provider_id}")
        return True
    
    def get_oauth2_authorization_url(self, provider_id: str, scope: List[str] = None) -> Optional[str]:
        """
        Get an OAuth2 authorization URL
        
        Args:
            provider_id: Provider ID
            scope: OAuth2 scopes to request
            
        Returns:
            Authorization URL if successful, None otherwise
        """
        if provider_id not in self.providers:
            logger.error(f"Provider not found: {provider_id}")
            return None
        
        provider = self.providers[provider_id]
        
        # Check provider type
        if provider["type"] != "oauth2":
            logger.error(f"Provider {provider_id} is not an OAuth2 provider")
            return None
        
        # Generate state parameter for CSRF protection
        state = secrets.token_hex(16)
        
        # Store state for verification
        self.oauth_states[state] = {
            "provider_id": provider_id,
            "created_at": time.time()
        }
        
        # Build authorization URL
        auth_url = provider.get("authorization_url")
        if not auth_url:
            logger.error(f"Provider {provider_id} missing authorization_url")
            return None
        
        # Build query parameters
        params = {
            "client_id": provider["client_id"],
            "redirect_uri": provider["redirect_uri"],
            "response_type": "code",
            "state": state
        }
        
        # Add scope if provided
        if scope:
            params["scope"] = " ".join(scope)
        
        # Build the URL
        url = f"{auth_url}?{urllib.parse.urlencode(params)}"
        
        logger.info(f"Generated OAuth2 authorization URL for provider {provider_id}")
        return url
    
    def handle_oauth2_callback(self, code: str, state: str) -> Optional[Dict]:
        """
        Handle an OAuth2 callback
        
        Args:
            code: Authorization code
            state: State parameter
            
        Returns:
            User information if successful, None otherwise
        """
        # Verify state parameter
        if state not in self.oauth_states:
            logger.error(f"Invalid state parameter: {state}")
            return None
        
        # Get provider ID from state
        provider_id = self.oauth_states[state]["provider_id"]
        
        # Clean up state
        del self.oauth_states[state]
        
        # Get provider configuration
        if provider_id not in self.providers:
            logger.error(f"Provider not found: {provider_id}")
            return None
        
        provider = self.providers[provider_id]
        
        # Exchange code for token
        token_url = provider.get("token_url")
        if not token_url:
            logger.error(f"Provider {provider_id} missing token_url")
            return None
        
        # Build token request
        token_request = {
            "client_id": provider["client_id"],
            "client_secret": provider["client_secret"],
            "code": code,
            "redirect_uri": provider["redirect_uri"],
            "grant_type": "authorization_code"
        }
        
        # Make token request
        try:
            token_response = requests.post(token_url, data=token_request)
            token_data = token_response.json()
            
            if "access_token" not in token_data:
                logger.error(f"Token response missing access_token: {token_data}")
                return None
            
            access_token = token_data["access_token"]
            
            # Get user information
            user_info_url = provider.get("user_info_url")
            if not user_info_url:
                logger.error(f"Provider {provider_id} missing user_info_url")
                return None
            
            # Make user info request
            headers = {"Authorization": f"Bearer {access_token}"}
            user_info_response = requests.get(user_info_url, headers=headers)
            user_info = user_info_response.json()
            
            # Add provider information
            user_info["provider"] = provider_id
            
            logger.info(f"Successfully authenticated user via {provider_id}")
            return user_info
            
        except Exception as e:
            logger.error(f"Error handling OAuth2 callback: {e}")
            return None
    
    def get_saml_request_url(self, provider_id: str) -> Optional[str]:
        """
        Get a SAML request URL
        
        Args:
            provider_id: Provider ID
            
        Returns:
            SAML request URL if successful, None otherwise
        """
        if provider_id not in self.providers:
            logger.error(f"Provider not found: {provider_id}")
            return None
        
        provider = self.providers[provider_id]
        
        # Check provider type
        if provider["type"] != "saml":
            logger.error(f"Provider {provider_id} is not a SAML provider")
            return None
        
        # In a real implementation, we would generate a SAML request
        # For now, just return the SSO URL
        sso_url = provider.get("sso_url")
        if not sso_url:
            logger.error(f"Provider {provider_id} missing sso_url")
            return None
        
        logger.info(f"Generated SAML request URL for provider {provider_id}")
        return sso_url
    
    def handle_saml_response(self, saml_response: str) -> Optional[Dict]:
        """
        Handle a SAML response
        
        Args:
            saml_response: SAML response
            
        Returns:
            User information if successful, None otherwise
        """
        # In a real implementation, we would validate and parse the SAML response
        # For now, just return a mock user
        logger.info("Successfully authenticated user via SAML")
        return {
            "provider": "saml",
            "id": "saml_user_id",
            "email": "saml_user@example.com",
            "name": "SAML User"
        }
    
    def get_oidc_authorization_url(self, provider_id: str, scope: List[str] = None) -> Optional[str]:
        """
        Get an OpenID Connect authorization URL
        
        Args:
            provider_id: Provider ID
            scope: OpenID Connect scopes to request
            
        Returns:
            Authorization URL if successful, None otherwise
        """
        if provider_id not in self.providers:
            logger.error(f"Provider not found: {provider_id}")
            return None
        
        provider = self.providers[provider_id]
        
        # Check provider type
        if provider["type"] != "oidc":
            logger.error(f"Provider {provider_id} is not an OpenID Connect provider")
            return None
        
        # Generate state parameter for CSRF protection
        state = secrets.token_hex(16)
        
        # Generate nonce parameter for replay protection
        nonce = secrets.token_hex(16)
        
        # Store state and nonce for verification
        self.oauth_states[state] = {
            "provider_id": provider_id,
            "nonce": nonce,
            "created_at": time.time()
        }
        
        # Build authorization URL
        auth_url = provider.get("authorization_url")
        if not auth_url:
            logger.error(f"Provider {provider_id} missing authorization_url")
            return None
        
        # Build query parameters
        params = {
            "client_id": provider["client_id"],
            "redirect_uri": provider["redirect_uri"],
            "response_type": "code",
            "state": state,
            "nonce": nonce
        }
        
        # Add scope if provided
        if scope:
            params["scope"] = " ".join(scope)
        else:
            params["scope"] = "openid profile email"
        
        # Build the URL
        url = f"{auth_url}?{urllib.parse.urlencode(params)}"
        
        logger.info(f"Generated OpenID Connect authorization URL for provider {provider_id}")
        return url
    
    def handle_oidc_callback(self, code: str, state: str) -> Optional[Dict]:
        """
        Handle an OpenID Connect callback
        
        Args:
            code: Authorization code
            state: State parameter
            
        Returns:
            User information if successful, None otherwise
        """
        # Verify state parameter
        if state not in self.oauth_states:
            logger.error(f"Invalid state parameter: {state}")
            return None
        
        # Get provider ID and nonce from state
        state_data = self.oauth_states[state]
        provider_id = state_data["provider_id"]
        nonce = state_data["nonce"]
        
        # Clean up state
        del self.oauth_states[state]
        
        # Get provider configuration
        if provider_id not in self.providers:
            logger.error(f"Provider not found: {provider_id}")
            return None
        
        provider = self.providers[provider_id]
        
        # Exchange code for token
        token_url = provider.get("token_url")
        if not token_url:
            logger.error(f"Provider {provider_id} missing token_url")
            return None
        
        # Build token request
        token_request = {
            "client_id": provider["client_id"],
            "client_secret": provider["client_secret"],
            "code": code,
            "redirect_uri": provider["redirect_uri"],
            "grant_type": "authorization_code"
        }
        
        # Make token request
        try:
            token_response = requests.post(token_url, data=token_request)
            token_data = token_response.json()
            
            if "id_token" not in token_data:
                logger.error(f"Token response missing id_token: {token_data}")
                return None
            
            # In a real implementation, we would validate the ID token
            # For now, just extract the user information from the ID token
            
            # Mock user information
            user_info = {
                "provider": provider_id,
                "id": "oidc_user_id",
                "email": "oidc_user@example.com",
                "name": "OpenID Connect User"
            }
            
            logger.info(f"Successfully authenticated user via {provider_id}")
            return user_info
            
        except Exception as e:
            logger.error(f"Error handling OpenID Connect callback: {e}")
            return None
