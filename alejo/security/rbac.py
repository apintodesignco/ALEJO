"""
ALEJO Role-Based Access Control (RBAC)

This module imports the comprehensive RBAC implementation from the security package.
This avoids duplication and ensures consistent RBAC behavior across the application.
"""

import sys
import os
from pathlib import Path

# Add the parent directory to the path to allow importing from security package
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Import the comprehensive RBAC implementation
from security.rbac import (
    Permission,
    Role,
    RBACManager,
    get_rbac_manager,
    require_permission,
    require_role,
    permission_required
)

# For backwards compatibility
RBAC = RBACManager

# Export the global RBAC manager instance for easy access
rbac_manager = get_rbac_manager()
