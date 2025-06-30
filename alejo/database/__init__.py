"""
ALEJO Database Module

This module provides database handling capabilities to ALEJO, enabling:
- Persistent storage of long-term memory
- Management of relationship data
- Storage of user preferences
"""

from .manager import DatabaseManager

__all__ = ['DatabaseManager']
