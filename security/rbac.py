"""
ALEJO Role-Based Access Control (RBAC)

This module provides a comprehensive RBAC system for ALEJO that allows:
- Definition of user roles with specific permissions
- Dynamic permission checking
- Flexible role hierarchy
- Integration with FastAPI for protected routes
"""

import enum
import logging
from typing import Dict, List, Set, Optional, Union, Callable, Any
from functools import wraps

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

logger = logging.getLogger(__name__)

class Permission(enum.Enum):
    """
    Enumeration of all possible permissions in the ALEJO system.
    
    Each permission represents a specific action that can be performed.
    Permissions are atomic and should represent the smallest possible action unit.
    """
    # User management permissions
    USER_VIEW = "user:view"
    USER_CREATE = "user:create"
    USER_EDIT = "user:edit"
    USER_DELETE = "user:delete"
    
    # Configuration permissions
    CONFIG_VIEW = "config:view"
    CONFIG_EDIT = "config:edit"
    
    # Data access permissions
    DATA_VIEW = "data:view"
    DATA_CREATE = "data:create"
    DATA_EDIT = "data:edit"
    DATA_DELETE = "data:delete"
    
    # System management permissions
    SYSTEM_VIEW = "system:view"
    SYSTEM_EDIT = "system:edit"
    SYSTEM_RESTART = "system:restart"
    
    # Gesture system permissions
    GESTURE_USE = "gesture:use"
    GESTURE_TRAIN = "gesture:train"
    GESTURE_ADMIN = "gesture:admin"
    
    # API access permissions
    API_USE = "api:use"
    API_ADMIN = "api:admin"
    
    # Admin-level permissions
    ADMIN = "admin"  # Special permission that grants all access


class Role:
    """
    Defines a role with specific permissions.
    
    A role is a collection of permissions that can be assigned to users.
    Roles can inherit permissions from other roles to create hierarchies.
    """
    
    def __init__(self, name: str, description: str = "", permissions: Optional[List[Permission]] = None, 
                 parent_roles: Optional[List['Role']] = None):
        """
        Initialize a new role.
        
        Args:
            name: The unique name of the role.
            description: A human-readable description of the role.
            permissions: The list of permissions directly assigned to this role.
            parent_roles: Roles that this role inherits permissions from.
        """
        self.name = name
        self.description = description
        self._permissions = set(permissions or [])
        self._parent_roles = set(parent_roles or [])
    
    @property
    def permissions(self) -> Set[Permission]:
        """
        Get all permissions for this role, including inherited ones.
        
        Returns:
            A set of all permissions assigned to this role and its parents.
        """
        all_permissions = set(self._permissions)
        
        # Add permissions from parent roles
        for parent in self._parent_roles:
            all_permissions.update(parent.permissions)
        
        # Special case: if ADMIN permission is present, include all defined permissions
        if Permission.ADMIN in all_permissions:
            all_permissions.update(list(Permission))
        
        return all_permissions
    
    def add_permission(self, permission: Permission) -> None:
        """Add a permission to this role."""
        self._permissions.add(permission)
    
    def remove_permission(self, permission: Permission) -> None:
        """Remove a permission from this role."""
        if permission in self._permissions:
            self._permissions.remove(permission)
    
    def add_parent(self, role: 'Role') -> None:
        """Add a parent role to inherit permissions from."""
        self._parent_roles.add(role)
    
    def remove_parent(self, role: 'Role') -> None:
        """Remove a parent role."""
        if role in self._parent_roles:
            self._parent_roles.remove(role)
    
    def has_permission(self, permission: Permission) -> bool:
        """
        Check if this role has a specific permission.
        
        Args:
            permission: The permission to check.
            
        Returns:
            True if the role has the permission, False otherwise.
        """
        return permission in self.permissions
    
    def __repr__(self) -> str:
        return f"<Role '{self.name}'>"


class RBACManager:
    """
    Manages the RBAC system for ALEJO.
    
    This class is responsible for defining roles, assigning roles to users,
    and checking if users have specific permissions.
    """
    
    def __init__(self):
        """Initialize the RBAC manager."""
        self.roles: Dict[str, Role] = {}
        self.user_roles: Dict[str, Set[Role]] = {}
        
        # Initialize with default roles
        self._create_default_roles()
        
        logger.info("RBAC Manager initialized with default roles")
    
    def _create_default_roles(self) -> None:
        """Create the default roles for the system."""
        # Guest role with minimal permissions
        guest_role = Role(
            name="guest",
            description="Limited access for unauthenticated users",
            permissions=[
                Permission.DATA_VIEW
            ]
        )
        self.add_role(guest_role)
        
        # User role with basic permissions
        user_role = Role(
            name="user",
            description="Standard user with basic permissions",
            permissions=[
                Permission.DATA_VIEW,
                Permission.DATA_CREATE,
                Permission.GESTURE_USE
            ],
            parent_roles=[guest_role]
        )
        self.add_role(user_role)
        
        # Power user role with additional permissions
        power_user_role = Role(
            name="power_user",
            description="Advanced user with additional capabilities",
            permissions=[
                Permission.DATA_EDIT,
                Permission.CONFIG_VIEW,
                Permission.GESTURE_TRAIN,
                Permission.API_USE
            ],
            parent_roles=[user_role]
        )
        self.add_role(power_user_role)
        
        # Admin role with system management permissions
        admin_role = Role(
            name="admin",
            description="System administrator with full access",
            permissions=[
                Permission.ADMIN  # Special permission that grants all access
            ],
            parent_roles=[power_user_role]
        )
        self.add_role(admin_role)
    
    def add_role(self, role: Role) -> None:
        """
        Add a role to the RBAC system.
        
        Args:
            role: The role to add.
        """
        self.roles[role.name] = role
    
    def get_role(self, role_name: str) -> Optional[Role]:
        """
        Get a role by name.
        
        Args:
            role_name: The name of the role to get.
            
        Returns:
            The role with the given name, or None if not found.
        """
        return self.roles.get(role_name)
    
    def assign_role_to_user(self, user_id: str, role_name: str) -> bool:
        """
        Assign a role to a user.
        
        Args:
            user_id: The ID of the user.
            role_name: The name of the role to assign.
            
        Returns:
            True if the role was assigned, False if the role doesn't exist.
        """
        role = self.get_role(role_name)
        if not role:
            logger.warning(f"Attempted to assign non-existent role '{role_name}' to user '{user_id}'")
            return False
        
        if user_id not in self.user_roles:
            self.user_roles[user_id] = set()
        
        self.user_roles[user_id].add(role)
        logger.info(f"Assigned role '{role_name}' to user '{user_id}'")
        return True
    
    def remove_role_from_user(self, user_id: str, role_name: str) -> bool:
        """
        Remove a role from a user.
        
        Args:
            user_id: The ID of the user.
            role_name: The name of the role to remove.
            
        Returns:
            True if the role was removed, False if the user doesn't have the role.
        """
        role = self.get_role(role_name)
        if not role or user_id not in self.user_roles:
            return False
        
        if role in self.user_roles[user_id]:
            self.user_roles[user_id].remove(role)
            logger.info(f"Removed role '{role_name}' from user '{user_id}'")
            return True
        
        return False
    
    def get_user_roles(self, user_id: str) -> List[Role]:
        """
        Get all roles assigned to a user.
        
        Args:
            user_id: The ID of the user.
            
        Returns:
            A list of roles assigned to the user.
        """
        return list(self.user_roles.get(user_id, set()))
    
    def get_user_permissions(self, user_id: str) -> Set[Permission]:
        """
        Get all permissions a user has.
        
        Args:
            user_id: The ID of the user.
            
        Returns:
            A set of all permissions the user has.
        """
        permissions = set()
        for role in self.get_user_roles(user_id):
            permissions.update(role.permissions)
        return permissions
    
    def user_has_permission(self, user_id: str, permission: Permission) -> bool:
        """
        Check if a user has a specific permission.
        
        Args:
            user_id: The ID of the user.
            permission: The permission to check.
            
        Returns:
            True if the user has the permission, False otherwise.
        """
        # Special case: if ADMIN is in any of the user's roles, they have all permissions
        user_permissions = self.get_user_permissions(user_id)
        if Permission.ADMIN in user_permissions:
            return True
        
        return permission in user_permissions
    
    def user_has_role(self, user_id: str, role_name: str) -> bool:
        """
        Check if a user has a specific role.
        
        Args:
            user_id: The ID of the user.
            role_name: The name of the role to check.
            
        Returns:
            True if the user has the role, False otherwise.
        """
        role = self.get_role(role_name)
        if not role:
            return False
        
        return role in self.get_user_roles(user_id)


# Global RBAC manager instance
_rbac_manager = RBACManager()


def get_rbac_manager() -> RBACManager:
    """
    Get the global RBAC manager instance.
    
    Returns:
        The global RBAC manager.
    """
    return _rbac_manager


# FastAPI integration

def require_permission(permission: Permission):
    """
    FastAPI dependency for requiring a specific permission.
    
    Usage:
        @app.get("/protected")
        def protected_route(user=Depends(require_permission(Permission.DATA_VIEW))):
            return {"message": "You have access to this route"}
    
    Args:
        permission: The permission required to access the route.
        
    Returns:
        A dependency function that checks if the user has the required permission.
    """
    oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
    
    async def _require_permission(request: Request, token: str = Depends(oauth2_scheme)):
        # In a real application, you would extract the user ID from the token
        # and verify the token's validity
        
        # For this example, we'll use a mock implementation
        # that extracts user_id from the token directly
        user_id = token  # In reality, you would decode and validate the token
        
        rbac = get_rbac_manager()
        if not rbac.user_has_permission(user_id, permission):
            logger.warning(f"User '{user_id}' attempted to access a route requiring '{permission.value}' permission")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: {permission.value} required"
            )
        
        return user_id
    
    return _require_permission


def require_role(role_name: str):
    """
    FastAPI dependency for requiring a specific role.
    
    Usage:
        @app.get("/admin-only")
        def admin_route(user=Depends(require_role("admin"))):
            return {"message": "You have admin access"}
    
    Args:
        role_name: The name of the role required to access the route.
        
    Returns:
        A dependency function that checks if the user has the required role.
    """
    oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
    
    async def _require_role(request: Request, token: str = Depends(oauth2_scheme)):
        # In a real application, you would extract the user ID from the token
        # and verify the token's validity
        
        # For this example, we'll use a mock implementation
        # that extracts user_id from the token directly
        user_id = token  # In reality, you would decode and validate the token
        
        rbac = get_rbac_manager()
        if not rbac.user_has_role(user_id, role_name):
            logger.warning(f"User '{user_id}' attempted to access a route requiring '{role_name}' role")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: '{role_name}' role required"
            )
        
        return user_id
    
    return _require_role


# Decorator for function-level permission checks
def permission_required(permission: Permission):
    """
    Decorator for requiring a permission to call a function.
    
    Usage:
        @permission_required(Permission.DATA_EDIT)
        def edit_data(user_id, data):
            # Function implementation
    
    Args:
        permission: The permission required to call the function.
        
    Returns:
        A decorator function that checks if the user has the required permission.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract user_id from args or kwargs
            user_id = kwargs.get('user_id')
            if user_id is None and args:
                user_id = args[0]
            
            if not user_id:
                logger.error("permission_required: No user_id provided to protected function")
                raise ValueError("No user_id provided to protected function")
            
            rbac = get_rbac_manager()
            if not rbac.user_has_permission(user_id, permission):
                logger.warning(f"User '{user_id}' attempted to call a function requiring '{permission.value}' permission")
                raise PermissionError(f"User '{user_id}' doesn't have the required permission: {permission.value}")
            
            return func(*args, **kwargs)
        return wrapper
    return decorator
