/**
 * ALEJO Role-Based Access Control (RBAC) System
 * 
 * Provides a comprehensive role and permission management system for controlling
 * access to ALEJO features, data, and functionality based on user roles.
 * 
 * Features:
 * - Hierarchical role management
 * - Fine-grained permission control
 * - Dynamic permission checking
 * - Role assignment and management
 * - Integration with existing security components
 */

import { auditTrail } from './audit-trail.js';
import { secureStore, secureRetrieve } from './privacy-guard.js';
import { publish, subscribe } from '../core/events.js';

// Default roles with hierarchical structure
const DEFAULT_ROLES = {
  'guest': {
    description: 'Unauthenticated or limited access user',
    inherits: [],
    permissions: [
      'view:public',
      'use:basic_features'
    ]
  },
  'user': {
    description: 'Standard authenticated user',
    inherits: ['guest'],
    permissions: [
      'view:own_data',
      'edit:own_profile',
      'use:standard_features'
    ]
  },
  'premium_user': {
    description: 'Premium tier user with additional features',
    inherits: ['user'],
    permissions: [
      'use:premium_features',
      'access:advanced_personalization'
    ]
  },
  'content_creator': {
    description: 'User who can create and manage content',
    inherits: ['user'],
    permissions: [
      'create:content',
      'edit:own_content',
      'delete:own_content'
    ]
  },
  'moderator': {
    description: 'User who can moderate content and users',
    inherits: ['content_creator'],
    permissions: [
      'moderate:content',
      'moderate:users',
      'view:reports'
    ]
  },
  'admin': {
    description: 'Administrative user with extended system access',
    inherits: ['moderator', 'premium_user'],
    permissions: [
      'manage:users',
      'manage:content',
      'view:system_stats',
      'edit:system_settings'
    ]
  },
  'system': {
    description: 'System-level access for internal processes',
    inherits: [],
    permissions: [
      'access:all_data',
      'execute:system_operations',
      'bypass:rate_limits'
    ]
  }
};

// Permission categories for organization
const PERMISSION_CATEGORIES = {
  'view': 'Access to view specific data or pages',
  'edit': 'Ability to modify specific data',
  'create': 'Ability to create new data or content',
  'delete': 'Ability to remove data or content',
  'manage': 'Administrative control over a resource type',
  'use': 'Access to use specific features',
  'moderate': 'Ability to review and moderate content or users',
  'access': 'Special access to protected resources',
  'execute': 'Ability to run specific operations',
  'bypass': 'Special exemptions from certain restrictions'
};

// State management
let initialized = false;
let customRoles = {};
let userRoleAssignments = {};
let roleOverrides = {};

/**
 * Initialize the RBAC system
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  if (initialized) {
    console.warn('RBAC system already initialized');
    return true;
  }

  try {
    // Load custom roles if they exist
    try {
      const storedRoles = await secureRetrieve('rbac:custom_roles');
      if (storedRoles) {
        customRoles = JSON.parse(storedRoles);
      }
    } catch (error) {
      console.warn('Failed to load custom roles, using defaults only', error);
      customRoles = {};
    }

    // Load user role assignments
    try {
      const storedAssignments = await secureRetrieve('rbac:user_roles');
      if (storedAssignments) {
        userRoleAssignments = JSON.parse(storedAssignments);
      }
    } catch (error) {
      console.warn('Failed to load user role assignments', error);
      userRoleAssignments = {};
    }

    // Set up event listeners
    subscribe('user:login', handleUserLogin);
    subscribe('user:logout', handleUserLogout);
    subscribe('user:register', handleUserRegister);
    subscribe('role:assigned', handleRoleChange);
    subscribe('role:revoked', handleRoleChange);

    initialized = true;
    
    auditTrail.log('security:rbac:initialized', {
      customRolesCount: Object.keys(customRoles).length,
      userAssignmentsCount: Object.keys(userRoleAssignments).length
    });
    
    publish('security:rbac:ready', { timestamp: Date.now() });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize RBAC system', error);
    auditTrail.log('security:rbac:init_failed', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

/**
 * Get all available roles (default + custom)
 * @returns {Object} Combined roles object
 */
export function getAllRoles() {
  return { ...DEFAULT_ROLES, ...customRoles };
}

/**
 * Get a specific role definition
 * @param {string} roleName - Role identifier
 * @returns {Object|null} Role definition or null if not found
 */
export function getRole(roleName) {
  const allRoles = getAllRoles();
  return allRoles[roleName] || null;
}

/**
 * Create a new custom role
 * @param {string} roleName - Role identifier
 * @param {Object} roleDefinition - Role definition
 * @param {string} roleDefinition.description - Role description
 * @param {Array<string>} roleDefinition.inherits - Roles this role inherits from
 * @param {Array<string>} roleDefinition.permissions - Direct permissions for this role
 * @returns {Promise<boolean>} Success status
 */
export async function createRole(roleName, roleDefinition) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  // Validate role name
  if (typeof roleName !== 'string' || roleName.trim() === '') {
    throw new Error('Invalid role name');
  }
  
  // Check if role already exists
  if (DEFAULT_ROLES[roleName] || customRoles[roleName]) {
    throw new Error(`Role '${roleName}' already exists`);
  }
  
  // Validate role definition
  if (!roleDefinition || typeof roleDefinition !== 'object') {
    throw new Error('Invalid role definition');
  }
  
  if (!roleDefinition.description || typeof roleDefinition.description !== 'string') {
    throw new Error('Role must have a description');
  }
  
  if (!Array.isArray(roleDefinition.permissions)) {
    throw new Error('Role permissions must be an array');
  }
  
  if (!Array.isArray(roleDefinition.inherits)) {
    throw new Error('Role inheritance must be an array');
  }
  
  // Validate that inherited roles exist
  const allRoles = getAllRoles();
  for (const inheritedRole of roleDefinition.inherits) {
    if (!allRoles[inheritedRole]) {
      throw new Error(`Inherited role '${inheritedRole}' does not exist`);
    }
  }
  
  // Add the new role
  customRoles[roleName] = {
    description: roleDefinition.description,
    inherits: [...roleDefinition.inherits],
    permissions: [...roleDefinition.permissions]
  };
  
  // Persist custom roles
  try {
    await secureStore('rbac:custom_roles', JSON.stringify(customRoles));
    
    auditTrail.log('security:rbac:role_created', {
      roleName,
      description: roleDefinition.description,
      inherits: roleDefinition.inherits,
      permissionCount: roleDefinition.permissions.length
    });
    
    publish('role:created', { roleName });
    
    return true;
  } catch (error) {
    console.error(`Failed to save custom role '${roleName}'`, error);
    auditTrail.log('security:rbac:role_creation_failed', {
      roleName,
      error: error.message
    });
    
    // Revert the in-memory change
    delete customRoles[roleName];
    
    throw error;
  }
}

/**
 * Update an existing custom role
 * @param {string} roleName - Role identifier
 * @param {Object} updates - Role definition updates
 * @returns {Promise<boolean>} Success status
 */
export async function updateRole(roleName, updates) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  // Check if role exists and is custom
  if (!customRoles[roleName]) {
    throw new Error(`Custom role '${roleName}' does not exist or is a default role`);
  }
  
  const currentRole = { ...customRoles[roleName] };
  const updatedRole = { ...currentRole };
  
  // Apply updates
  if (updates.description) {
    updatedRole.description = updates.description;
  }
  
  if (Array.isArray(updates.inherits)) {
    // Validate that inherited roles exist
    const allRoles = getAllRoles();
    for (const inheritedRole of updates.inherits) {
      if (!allRoles[inheritedRole]) {
        throw new Error(`Inherited role '${inheritedRole}' does not exist`);
      }
    }
    updatedRole.inherits = [...updates.inherits];
  }
  
  if (Array.isArray(updates.permissions)) {
    updatedRole.permissions = [...updates.permissions];
  }
  
  // Update the role
  customRoles[roleName] = updatedRole;
  
  // Persist custom roles
  try {
    await secureStore('rbac:custom_roles', JSON.stringify(customRoles));
    
    auditTrail.log('security:rbac:role_updated', {
      roleName,
      updates: Object.keys(updates)
    });
    
    publish('role:updated', { roleName });
    
    return true;
  } catch (error) {
    console.error(`Failed to update custom role '${roleName}'`, error);
    auditTrail.log('security:rbac:role_update_failed', {
      roleName,
      error: error.message
    });
    
    // Revert the in-memory change
    customRoles[roleName] = currentRole;
    
    throw error;
  }
}

/**
 * Delete a custom role
 * @param {string} roleName - Role identifier
 * @returns {Promise<boolean>} Success status
 */
export async function deleteRole(roleName) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  // Check if role exists and is custom
  if (!customRoles[roleName]) {
    throw new Error(`Custom role '${roleName}' does not exist or is a default role`);
  }
  
  // Check if any roles inherit from this role
  const allRoles = getAllRoles();
  for (const [otherRoleName, roleDefinition] of Object.entries(allRoles)) {
    if (roleDefinition.inherits.includes(roleName)) {
      throw new Error(`Cannot delete role '${roleName}' because it is inherited by '${otherRoleName}'`);
    }
  }
  
  // Check if any users are assigned this role
  for (const [userId, roles] of Object.entries(userRoleAssignments)) {
    if (roles.includes(roleName)) {
      throw new Error(`Cannot delete role '${roleName}' because it is assigned to users`);
    }
  }
  
  // Store the role temporarily in case we need to revert
  const deletedRole = { ...customRoles[roleName] };
  
  // Delete the role
  delete customRoles[roleName];
  
  // Persist custom roles
  try {
    await secureStore('rbac:custom_roles', JSON.stringify(customRoles));
    
    auditTrail.log('security:rbac:role_deleted', {
      roleName
    });
    
    publish('role:deleted', { roleName });
    
    return true;
  } catch (error) {
    console.error(`Failed to delete custom role '${roleName}'`, error);
    auditTrail.log('security:rbac:role_deletion_failed', {
      roleName,
      error: error.message
    });
    
    // Revert the in-memory change
    customRoles[roleName] = deletedRole;
    
    throw error;
  }
}

/**
 * Assign a role to a user
 * @param {string} userId - User identifier
 * @param {string} roleName - Role to assign
 * @returns {Promise<boolean>} Success status
 */
export async function assignRoleToUser(userId, roleName) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  // Validate user ID
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('Invalid user ID');
  }
  
  // Check if role exists
  const allRoles = getAllRoles();
  if (!allRoles[roleName]) {
    throw new Error(`Role '${roleName}' does not exist`);
  }
  
  // Initialize user's roles array if it doesn't exist
  if (!userRoleAssignments[userId]) {
    userRoleAssignments[userId] = [];
  }
  
  // Check if user already has the role
  if (userRoleAssignments[userId].includes(roleName)) {
    return true; // Already assigned
  }
  
  // Add the role
  userRoleAssignments[userId].push(roleName);
  
  // Persist user role assignments
  try {
    await secureStore('rbac:user_roles', JSON.stringify(userRoleAssignments));
    
    auditTrail.log('security:rbac:role_assigned', {
      userId,
      roleName
    });
    
    publish('role:assigned', { userId, roleName });
    
    return true;
  } catch (error) {
    console.error(`Failed to assign role '${roleName}' to user '${userId}'`, error);
    auditTrail.log('security:rbac:role_assignment_failed', {
      userId,
      roleName,
      error: error.message
    });
    
    // Revert the in-memory change
    userRoleAssignments[userId] = userRoleAssignments[userId].filter(r => r !== roleName);
    
    throw error;
  }
}

/**
 * Remove a role from a user
 * @param {string} userId - User identifier
 * @param {string} roleName - Role to remove
 * @returns {Promise<boolean>} Success status
 */
export async function removeRoleFromUser(userId, roleName) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  // Validate user ID
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('Invalid user ID');
  }
  
  // Check if user has any roles
  if (!userRoleAssignments[userId] || !userRoleAssignments[userId].includes(roleName)) {
    return true; // Role not assigned, nothing to do
  }
  
  // Store current roles in case we need to revert
  const currentRoles = [...userRoleAssignments[userId]];
  
  // Remove the role
  userRoleAssignments[userId] = userRoleAssignments[userId].filter(r => r !== roleName);
  
  // Persist user role assignments
  try {
    await secureStore('rbac:user_roles', JSON.stringify(userRoleAssignments));
    
    auditTrail.log('security:rbac:role_removed', {
      userId,
      roleName
    });
    
    publish('role:revoked', { userId, roleName });
    
    return true;
  } catch (error) {
    console.error(`Failed to remove role '${roleName}' from user '${userId}'`, error);
    auditTrail.log('security:rbac:role_removal_failed', {
      userId,
      roleName,
      error: error.message
    });
    
    // Revert the in-memory change
    userRoleAssignments[userId] = currentRoles;
    
    throw error;
  }
}

/**
 * Get all roles assigned to a user
 * @param {string} userId - User identifier
 * @returns {Array<string>} Array of role names
 */
export function getUserRoles(userId) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  return userRoleAssignments[userId] || ['guest'];
}

/**
 * Get all permissions for a user, including inherited permissions
 * @param {string} userId - User identifier
 * @returns {Array<string>} Array of permission strings
 */
export function getUserPermissions(userId) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  const userRoles = getUserRoles(userId);
  const allRoles = getAllRoles();
  const permissions = new Set();
  
  // Helper function to recursively add permissions from a role and its inherited roles
  function addRolePermissions(roleName, visited = new Set()) {
    // Prevent circular inheritance
    if (visited.has(roleName)) {
      console.warn(`Circular role inheritance detected for role '${roleName}'`);
      return;
    }
    
    visited.add(roleName);
    
    const role = allRoles[roleName];
    if (!role) {
      console.warn(`Role '${roleName}' not found`);
      return;
    }
    
    // Add direct permissions
    role.permissions.forEach(permission => permissions.add(permission));
    
    // Add permissions from inherited roles
    role.inherits.forEach(inheritedRole => {
      addRolePermissions(inheritedRole, new Set(visited));
    });
  }
  
  // Add permissions from all user roles
  userRoles.forEach(roleName => {
    addRolePermissions(roleName);
  });
  
  // Add any role overrides specific to this user
  const userOverrides = roleOverrides[userId] || [];
  userOverrides.forEach(permission => {
    if (permission.startsWith('!')) {
      // Remove permission
      permissions.delete(permission.substring(1));
    } else {
      // Add permission
      permissions.add(permission);
    }
  });
  
  return Array.from(permissions);
}

/**
 * Check if a user has a specific permission
 * @param {string} userId - User identifier
 * @param {string} permission - Permission to check
 * @returns {boolean} Whether user has the permission
 */
export function hasPermission(userId, permission) {
  if (!initialized) {
    return false; // Fail closed if not initialized
  }
  
  const userPermissions = getUserPermissions(userId);
  
  // Check for direct permission match
  if (userPermissions.includes(permission)) {
    return true;
  }
  
  // Check for wildcard permissions
  const permissionParts = permission.split(':');
  if (permissionParts.length === 2) {
    const [category, resource] = permissionParts;
    
    // Check for category wildcard (e.g., "view:*")
    if (userPermissions.includes(`${category}:*`)) {
      return true;
    }
    
    // Check for admin permission on this category
    if (userPermissions.includes(`admin:${category}`)) {
      return true;
    }
  }
  
  // Check for global admin
  if (userPermissions.includes('admin:*')) {
    return true;
  }
  
  return false;
}

/**
 * Add a temporary permission override for a user
 * @param {string} userId - User identifier
 * @param {string} permission - Permission to add or remove (prefix with ! to remove)
 * @returns {void}
 */
export function addPermissionOverride(userId, permission) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  if (!roleOverrides[userId]) {
    roleOverrides[userId] = [];
  }
  
  if (!roleOverrides[userId].includes(permission)) {
    roleOverrides[userId].push(permission);
    
    auditTrail.log('security:rbac:permission_override', {
      userId,
      permission,
      action: permission.startsWith('!') ? 'remove' : 'add'
    });
  }
}

/**
 * Remove a temporary permission override for a user
 * @param {string} userId - User identifier
 * @param {string} permission - Permission to remove from overrides
 * @returns {void}
 */
export function removePermissionOverride(userId, permission) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  if (roleOverrides[userId]) {
    roleOverrides[userId] = roleOverrides[userId].filter(p => p !== permission);
    
    auditTrail.log('security:rbac:permission_override_removed', {
      userId,
      permission
    });
  }
}

/**
 * Clear all permission overrides for a user
 * @param {string} userId - User identifier
 * @returns {void}
 */
export function clearPermissionOverrides(userId) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  if (roleOverrides[userId]) {
    delete roleOverrides[userId];
    
    auditTrail.log('security:rbac:permission_overrides_cleared', {
      userId
    });
  }
}

/**
 * Get all users assigned a specific role
 * @param {string} roleName - Role to check
 * @returns {Array<string>} Array of user IDs
 */
export function getUsersWithRole(roleName) {
  if (!initialized) {
    throw new Error('RBAC system not initialized');
  }
  
  return Object.entries(userRoleAssignments)
    .filter(([_, roles]) => roles.includes(roleName))
    .map(([userId, _]) => userId);
}

/**
 * Handle user login event
 * @param {Object} data - Event data
 * @private
 */
function handleUserLogin(data) {
  const { userId } = data;
  
  // If user has no roles, assign default role
  if (!userRoleAssignments[userId]) {
    userRoleAssignments[userId] = ['user'];
    
    // Persist asynchronously
    secureStore('rbac:user_roles', JSON.stringify(userRoleAssignments))
      .catch(error => {
        console.error('Failed to persist default role assignment', error);
      });
    
    auditTrail.log('security:rbac:default_role_assigned', {
      userId,
      role: 'user'
    });
  }
}

/**
 * Handle user logout event
 * @param {Object} data - Event data
 * @private
 */
function handleUserLogout(data) {
  const { userId } = data;
  
  // Clear any temporary permission overrides
  if (roleOverrides[userId]) {
    delete roleOverrides[userId];
  }
}

/**
 * Handle user registration event
 * @param {Object} data - Event data
 * @private
 */
function handleUserRegister(data) {
  const { userId, userType } = data;
  
  // Assign appropriate role based on user type
  let roleToAssign = 'user';
  
  if (userType === 'content_creator') {
    roleToAssign = 'content_creator';
  } else if (userType === 'premium') {
    roleToAssign = 'premium_user';
  }
  
  // Assign role asynchronously
  assignRoleToUser(userId, roleToAssign)
    .catch(error => {
      console.error(`Failed to assign initial role '${roleToAssign}' to new user '${userId}'`, error);
    });
}

/**
 * Handle role change events
 * @param {Object} data - Event data
 * @private
 */
function handleRoleChange(data) {
  // This is a placeholder for any additional logic needed when roles change
  // Currently just used for potential future extensions
}

// Export permission categories for external use
export { PERMISSION_CATEGORIES };
