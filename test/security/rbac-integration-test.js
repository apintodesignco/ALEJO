/**
 * ALEJO RBAC Integration Tests
 * 
 * Tests the integration of the RBAC system with other security components
 * including Privacy Guard, Audit Trail, and the overall security module.
 */

import { jest } from '@jest/globals';
import * as security from '../../src/security/index.js';
import * as rbac from '../../src/security/rbac.js';
import * as privacyGuard from '../../src/security/privacy-guard.js';
import { auditTrail } from '../../src/security/audit-trail.js';
import { publish } from '../../src/core/events.js';

// Mock dependencies that are not under test
jest.mock('../../src/security/privacy-guard.js', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  secureStore: jest.fn().mockResolvedValue(true),
  secureRetrieve: jest.fn().mockResolvedValue({}),
  secureDelete: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/security/audit-trail.js', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  logEvent: jest.fn().mockResolvedValue(true),
  log: jest.fn().mockResolvedValue(true),
  setPrivacyLevel: jest.fn()
}));

jest.mock('../../src/security/consent-manager.js', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  hasConsent: jest.fn().mockReturnValue(true)
}));

jest.mock('../../src/core/events.js', () => ({
  publish: jest.fn(),
  subscribe: jest.fn()
}));

describe('RBAC Integration Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create a spy on rbac.initialize to track calls
    const originalInitialize = rbac.initialize;
    rbac.initialize = jest.fn().mockImplementation(async (options) => {
      // Call the original initialize with test data
      const result = await originalInitialize(options);
      return result;
    });
    
    // Initialize security module
    await security.initialize({
      userId: 'test-user',
      securityLevel: 'standard'
    });
  });
  
  afterEach(async () => {
    // Clean up by resetting RBAC state
    await rbac.reset();
  });
  
  test('RBAC should be initialized with security module', () => {
    expect(rbac.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'test-user',
        securityLevel: 'standard'
      })
    );
  });
  
  test('Security module should expose RBAC functions', () => {
    expect(security.hasPermission).toBeDefined();
    expect(security.getUserPermissions).toBeDefined();
    expect(security.getUserRoles).toBeDefined();
    expect(security.rbac).toBeDefined();
    expect(security.rbacMiddleware).toBeDefined();
  });
  
  test('Role creation should be persisted via Privacy Guard', async () => {
    // Arrange
    const roleName = 'editor';
    const permissions = ['content:read', 'content:write'];
    
    // Act
    await rbac.createRole(roleName, {
      description: 'Content editor role',
      permissions
    });
    
    // Assert
    expect(privacyGuard.secureStore).toHaveBeenCalledWith(
      expect.stringContaining('rbac:role:'),
      expect.objectContaining({
        name: roleName,
        permissions: expect.arrayContaining(permissions)
      }),
      expect.anything()
    );
    
    expect(auditTrail.log).toHaveBeenCalledWith(
      'security:rbac:role_created',
      expect.objectContaining({
        roleName,
        permissions
      })
    );
  });
  
  test('Role assignment should be persisted via Privacy Guard', async () => {
    // Arrange
    const userId = 'test-user';
    const roleName = 'editor';
    
    // Create role first
    await rbac.createRole(roleName, {
      description: 'Content editor role',
      permissions: ['content:read', 'content:write']
    });
    
    // Reset mocks to clearly see the assignment calls
    jest.clearAllMocks();
    
    // Act
    await rbac.assignRoleToUser(userId, roleName);
    
    // Assert
    expect(privacyGuard.secureStore).toHaveBeenCalledWith(
      expect.stringContaining('rbac:assignment:'),
      expect.objectContaining({
        userId,
        roleName
      }),
      expect.anything()
    );
    
    expect(auditTrail.log).toHaveBeenCalledWith(
      'security:rbac:role_assigned',
      expect.objectContaining({
        userId,
        roleName
      })
    );
  });
  
  test('Permission checks should work through security module', async () => {
    // Arrange
    const userId = 'test-user';
    const roleName = 'editor';
    const permission = 'content:write';
    
    // Create role and assign to user
    await rbac.createRole(roleName, {
      description: 'Content editor role',
      permissions: ['content:read', permission]
    });
    await rbac.assignRoleToUser(userId, roleName);
    
    // Act & Assert
    expect(security.hasPermission(userId, permission)).toBe(true);
    expect(security.hasPermission(userId, 'admin:access')).toBe(false);
  });
  
  test('Role hierarchy should be respected in permission checks', async () => {
    // Arrange
    const userId = 'test-user';
    
    // Create role hierarchy: user -> editor -> admin
    await rbac.createRole('user', {
      description: 'Basic user role',
      permissions: ['content:read']
    });
    
    await rbac.createRole('editor', {
      description: 'Content editor role',
      permissions: ['content:write'],
      inherits: ['user']
    });
    
    await rbac.createRole('admin', {
      description: 'Administrator role',
      permissions: ['admin:access'],
      inherits: ['editor']
    });
    
    // Assign admin role to user
    await rbac.assignRoleToUser(userId, 'admin');
    
    // Act & Assert
    // Should have permissions from all roles in hierarchy
    expect(security.hasPermission(userId, 'content:read')).toBe(true);
    expect(security.hasPermission(userId, 'content:write')).toBe(true);
    expect(security.hasPermission(userId, 'admin:access')).toBe(true);
  });
  
  test('Permission overrides should take precedence over role permissions', async () => {
    // Arrange
    const userId = 'test-user';
    
    // Create role with permissions
    await rbac.createRole('user', {
      description: 'Basic user role',
      permissions: ['content:read']
    });
    
    // Assign role to user
    await rbac.assignRoleToUser(userId, 'user');
    
    // Add temporary permission override
    await rbac.addPermissionOverride(userId, 'special:access', true);
    
    // Act & Assert
    expect(security.hasPermission(userId, 'content:read')).toBe(true);
    expect(security.hasPermission(userId, 'special:access')).toBe(true);
    
    // Remove override
    await rbac.removePermissionOverride(userId, 'special:access');
    
    // Should no longer have the permission
    expect(security.hasPermission(userId, 'special:access')).toBe(false);
  });
  
  test('User logout should clear temporary permission overrides', async () => {
    // Arrange
    const userId = 'test-user';
    
    // Create role with permissions
    await rbac.createRole('user', {
      description: 'Basic user role',
      permissions: ['content:read']
    });
    
    // Assign role to user
    await rbac.assignRoleToUser(userId, 'user');
    
    // Add temporary permission override
    await rbac.addPermissionOverride(userId, 'special:access', true);
    
    // Verify permission is granted
    expect(security.hasPermission(userId, 'special:access')).toBe(true);
    
    // Act - simulate user logout event
    publish('user:logout', { userId });
    
    // Allow event handlers to process
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Assert - override should be cleared
    expect(security.hasPermission(userId, 'special:access')).toBe(false);
    // But role-based permission should remain
    expect(security.hasPermission(userId, 'content:read')).toBe(true);
  });
  
  test('Security level change should update RBAC behavior', async () => {
    // Arrange
    const userId = 'test-user';
    
    // Create role with permissions
    await rbac.createRole('user', {
      description: 'Basic user role',
      permissions: ['content:read']
    });
    
    // Assign role to user
    await rbac.assignRoleToUser(userId, 'user');
    
    // Act - change security level to enhanced
    security.setSecurityLevel('enhanced');
    
    // Allow event handlers to process
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Assert
    // In enhanced mode, permission checks might be more strict or have additional logging
    expect(auditTrail.setPrivacyLevel).toHaveBeenCalledWith('detailed');
  });
  
  test('Default roles should be assigned on user registration', async () => {
    // Arrange
    const newUserId = 'new-user';
    
    // Create default role
    await rbac.createRole('default', {
      description: 'Default role for all users',
      permissions: ['app:access', 'profile:read']
    });
    
    // Configure default roles
    await rbac.setDefaultRoles(['default']);
    
    // Act - simulate user registration event
    publish('user:registered', { userId: newUserId });
    
    // Allow event handlers to process
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Assert
    expect(security.getUserRoles(newUserId)).toContain('default');
    expect(security.hasPermission(newUserId, 'app:access')).toBe(true);
    expect(security.hasPermission(newUserId, 'profile:read')).toBe(true);
  });
  
  test('Role removal should update permissions immediately', async () => {
    // Arrange
    const userId = 'test-user';
    const roleName = 'temp-role';
    
    // Create role with permissions
    await rbac.createRole(roleName, {
      description: 'Temporary role',
      permissions: ['temp:access']
    });
    
    // Assign role to user
    await rbac.assignRoleToUser(userId, roleName);
    
    // Verify permission is granted
    expect(security.hasPermission(userId, 'temp:access')).toBe(true);
    
    // Act - remove role from user
    await rbac.removeRoleFromUser(userId, roleName);
    
    // Assert
    expect(security.hasPermission(userId, 'temp:access')).toBe(false);
    expect(security.getUserRoles(userId)).not.toContain(roleName);
  });
  
  test('Role deletion should cascade to all users', async () => {
    // Arrange
    const userId1 = 'test-user-1';
    const userId2 = 'test-user-2';
    const roleName = 'shared-role';
    
    // Create role with permissions
    await rbac.createRole(roleName, {
      description: 'Shared role',
      permissions: ['shared:access']
    });
    
    // Assign role to multiple users
    await rbac.assignRoleToUser(userId1, roleName);
    await rbac.assignRoleToUser(userId2, roleName);
    
    // Verify permission is granted to both users
    expect(security.hasPermission(userId1, 'shared:access')).toBe(true);
    expect(security.hasPermission(userId2, 'shared:access')).toBe(true);
    
    // Act - delete the role
    await rbac.deleteRole(roleName);
    
    // Assert - neither user should have the permission anymore
    expect(security.hasPermission(userId1, 'shared:access')).toBe(false);
    expect(security.hasPermission(userId2, 'shared:access')).toBe(false);
    expect(security.getUserRoles(userId1)).not.toContain(roleName);
    expect(security.getUserRoles(userId2)).not.toContain(roleName);
  });
  
  test('Permission checks should be logged via Audit Trail when requested', async () => {
    // Arrange
    const userId = 'test-user';
    const permission = 'sensitive:data:access';
    
    // Create role with permissions
    await rbac.createRole('data-access', {
      description: 'Data access role',
      permissions: [permission]
    });
    
    // Assign role to user
    await rbac.assignRoleToUser(userId, 'data-access');
    
    // Reset mocks to clearly see the audit calls
    jest.clearAllMocks();
    
    // Act - check permission with audit option
    const result = await rbac.hasPermission(userId, permission, { audit: true });
    
    // Assert
    expect(result).toBe(true);
    expect(auditTrail.log).toHaveBeenCalledWith(
      'security:rbac:permission_check',
      expect.objectContaining({
        userId,
        permission,
        granted: true
      })
    );
  });
});
