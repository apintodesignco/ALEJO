"""
Privacy Controller for ALEJO Collective Learning
Ensures all data is properly anonymized and protected
"""

import logging
import re
from typing import Dict, Any, List, Set, Optional
import hashlib
import json
from dataclasses import asdict

logger = logging.getLogger("alejo.collective.privacy_controller")

class PrivacyController:
    """
    Controls privacy and data protection for the collective learning system
    
    Responsibilities:
    - Sanitize and anonymize all data before collection
    - Remove personally identifiable information (PII)
    - Ensure compliance with privacy standards
    - Apply privacy-preserving techniques
    """
    
    def __init__(self):
        """Initialize privacy controller"""
        # PII patterns to detect and remove
        self.pii_patterns = [
            # Email addresses
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            # Phone numbers (various formats)
            r'\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b',
            # Social security numbers
            r'\b\d{3}-\d{2}-\d{4}\b',
            # Credit card numbers
            r'\b(?:\d{4}[- ]?){3}\d{4}\b',
            # IP addresses
            r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
            # URLs
            r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+',
            # Paths that might contain usernames
            r'[/\\]Users[/\\][^/\\]+[/\\]',
            r'[/\\]home[/\\][^/\\]+[/\\]',
            # Names (more complex, requires NER in production)
            r'\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+\b'
        ]
        
        # Sensitive keys that should be removed or hashed
        self.sensitive_keys = {
            'password', 'token', 'secret', 'key', 'credential', 'auth',
            'username', 'user_id', 'email', 'phone', 'address', 'name',
            'first_name', 'last_name', 'birth', 'ssn', 'social', 'credit',
            'api_key', 'access_token', 'refresh_token', 'private_key'
        }
        
    def sanitize_insight(self, insight) -> Any:
        """
        Sanitize an insight to remove any PII or sensitive data
        
        Args:
            insight: The insight to sanitize
            
        Returns:
            Sanitized insight
        """
        try:
            # Convert to dict for processing
            if hasattr(insight, '__dataclass_fields__'):
                data = asdict(insight)
            else:
                data = insight
                
            # Process features and metadata
            if 'features' in data and isinstance(data['features'], dict):
                data['features'] = self._sanitize_dict(data['features'])
                
            if 'metadata' in data and isinstance(data['metadata'], dict):
                data['metadata'] = self._sanitize_dict(data['metadata'])
                
            # Reconstruct the insight if it's a dataclass
            if hasattr(insight, '__dataclass_fields__'):
                # Remove any fields that aren't in the dataclass
                valid_fields = set(insight.__dataclass_fields__.keys())
                filtered_data = {k: v for k, v in data.items() if k in valid_fields}
                
                # Create a new instance
                return insight.__class__(**filtered_data)
            
            return data
            
        except Exception as e:
            logger.error(f"Error sanitizing insight: {e}")
            # Return a safe version with minimal data
            if hasattr(insight, 'insight_id') and hasattr(insight, 'category'):
                return type(insight)(
                    insight_id=insight.insight_id,
                    category=insight.category,
                    pattern_type="sanitized",
                    features={},
                    confidence=0.0,
                    creation_timestamp=insight.creation_timestamp,
                    metadata={},
                    source_hash=insight.source_hash
                )
            return None
    
    def _sanitize_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize a dictionary to remove PII and sensitive data
        
        Args:
            data: Dictionary to sanitize
            
        Returns:
            Sanitized dictionary
        """
        result = {}
        
        for key, value in data.items():
            # Check if key contains sensitive information
            key_lower = key.lower()
            if any(sensitive in key_lower for sensitive in self.sensitive_keys):
                # Hash sensitive keys
                if isinstance(value, str):
                    result[key] = self._hash_value(value)
                else:
                    # Skip this field entirely
                    continue
            
            # Process based on value type
            elif isinstance(value, dict):
                result[key] = self._sanitize_dict(value)
            elif isinstance(value, list):
                result[key] = self._sanitize_list(value)
            elif isinstance(value, str):
                result[key] = self._sanitize_string(value)
            else:
                # Keep numbers, booleans, etc. as is
                result[key] = value
                
        return result
    
    def _sanitize_list(self, data: List[Any]) -> List[Any]:
        """
        Sanitize a list to remove PII and sensitive data
        
        Args:
            data: List to sanitize
            
        Returns:
            Sanitized list
        """
        result = []
        
        for item in data:
            if isinstance(item, dict):
                result.append(self._sanitize_dict(item))
            elif isinstance(item, list):
                result.append(self._sanitize_list(item))
            elif isinstance(item, str):
                result.append(self._sanitize_string(item))
            else:
                # Keep numbers, booleans, etc. as is
                result.append(item)
                
        return result
    
    def _sanitize_string(self, text: str) -> str:
        """
        Sanitize a string to remove PII
        
        Args:
            text: String to sanitize
            
        Returns:
            Sanitized string
        """
        # Skip very short strings
        if len(text) < 5:
            return text
            
        # Apply PII pattern matching
        for pattern in self.pii_patterns:
            text = re.sub(pattern, '[REDACTED]', text)
            
        return text
    
    def _hash_value(self, value: str) -> str:
        """
        Create a secure hash of a sensitive value
        
        Args:
            value: Value to hash
            
        Returns:
            Hashed value
        """
        return hashlib.sha256(value.encode()).hexdigest()[:16]
