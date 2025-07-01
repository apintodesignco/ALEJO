# ALEJO Security Module
# Contains security enhancements, middlewares, and utilities

"""ALEJO Security Module

This package provides comprehensive security features for ALEJO, including:
- Security Headers Middleware
- Role-Based Access Control (RBAC)
- Data Encryption
- Dependency Security Scanner
"""

# Import key security components for easier access
from .middleware import (
    SecurityHeadersMiddleware,
    add_security_headers_middleware,
    get_default_security_headers
)

# Import encryption components
from .encryption import (
    DataEncryption,
    SecureConfig
)

# Import RBAC components
from .rbac import (
    Permission,
    Role,
    RBACManager,
    get_rbac_manager,
    require_permission,
    require_role,
    permission_required
)

# Import dependency scanner
from .dependency_scanner import (
    DependencyScanner,
    scan_project,
    generate_report
)

__all__ = [
    # Middleware
    'SecurityHeadersMiddleware',
    'add_security_headers_middleware',
    'get_default_security_headers',
    
    # Encryption
    'DataEncryption',
    'SecureConfig',
    
    # RBAC
    'Permission',
    'Role',
    'RBACManager',
    'get_rbac_manager',
    'require_permission',
    'require_role',
    'permission_required',
    
    # Dependency Scanner
    'DependencyScanner',
    'scan_project',
    'generate_report'
]
