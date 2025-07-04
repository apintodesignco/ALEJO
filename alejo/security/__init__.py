"""
ALEJO - Advanced Language and Execution Joint Operator
Security module for protecting sensitive data and ensuring system integrity
"""

from alejo.security.encryption import (
    encrypt_data,
    decrypt_data,
    decrypt_to_string,
    decrypt_to_dict,
    set_encryption_key,
    EncryptionManager
)

__all__ = [
    'encrypt_data',
    'decrypt_data',
    'decrypt_to_string',
    'decrypt_to_dict',
    'set_encryption_key',
    'EncryptionManager'
]
