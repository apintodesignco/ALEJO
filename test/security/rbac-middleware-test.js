/**
 * ALEJO RBAC Middleware Tests
 * 
 * Tests the RBAC middleware integration with API endpoints, UI components, and routes.
 */

import { jest } from '@jest/globals';
import * as rbacMiddleware from '../../src/security/rbac-middleware.js';
import * as rbac from '../../src/security/rbac.js';
import { auditTrail } from '../../src/security/audit-trail.js';

// Mock dependencies
jest.mock('../../src/security/rbac.js');
jest.mock('../../src/security/audit-trail.js');

describe('RBAC Middleware', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    rbac.hasPermission.mockImplementation((userId, permission) => {
      // Allow 'read' permission for any user, deny others
      return permission === 'read';
    });
    
    rbac.getUserPermissions.mockReturnValue(['read']);
    rbac.getUserRoles.mockReturnValue(['user']);
    
    auditTrail.log = jest.fn().mockResolvedValue(true);
  });
  
  describe('protectEndpoint', () => {
    test('should allow access when user has permission', () => {
      // Arrange
      const middleware = rbacMiddleware.protectEndpoint('read');
      const req = { 
        user: { id: 'user123' },
        method: 'GET',
        originalUrl: '/api/data'
      };
      const res = {};
      const next = jest.fn();
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
      expect(rbac.hasPermission).toHaveBeenCalledWith('user123', 'read');
      expect(auditTrail.log).toHaveBeenCalledWith(
        'security:rbac:endpoint_access', 
        expect.objectContaining({
          userId: 'user123',
          granted: true
        })
      );
    });
    
    test('should deny access when user lacks permission', () => {
      // Arrange
      const middleware = rbacMiddleware.protectEndpoint('write');
      const req = { 
        user: { id: 'user123' },
        method: 'POST',
        originalUrl: '/api/data'
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'access_denied'
      }));
      expect(auditTrail.log).toHaveBeenCalledWith(
        'security:rbac:endpoint_access', 
        expect.objectContaining({
          userId: 'user123',
          granted: false
        })
      );
    });
    
    test('should handle anonymous users', () => {
      // Arrange
      const middleware = rbacMiddleware.protectEndpoint('read');
      const req = { 
        method: 'GET',
        originalUrl: '/api/data'
      };
      const res = {};
      const next = jest.fn();
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(rbac.hasPermission).toHaveBeenCalledWith('anonymous', 'read');
    });
    
    test('should return empty results when failSilently is true', () => {
      // Arrange
      const middleware = rbacMiddleware.protectEndpoint('write', { failSilently: true });
      const req = { 
        user: { id: 'user123' },
        method: 'GET',
        originalUrl: '/api/data'
      };
      const res = {
        json: jest.fn()
      };
      const next = jest.fn();
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ data: [], count: 0 });
    });
    
    test('should handle multiple required permissions (any)', () => {
      // Arrange
      const middleware = rbacMiddleware.protectEndpoint(['write', 'read']);
      const req = { 
        user: { id: 'user123' },
        method: 'GET',
        originalUrl: '/api/data'
      };
      const res = {};
      const next = jest.fn();
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('checkPermission', () => {
    test('should return true when user has permission', () => {
      // Act
      const result = rbacMiddleware.checkPermission('user123', 'read', { audit: true });
      
      // Assert
      expect(result).toBe(true);
      expect(rbac.hasPermission).toHaveBeenCalledWith('user123', 'read');
      expect(auditTrail.log).toHaveBeenCalled();
    });
    
    test('should return false when user lacks permission', () => {
      // Act
      const result = rbacMiddleware.checkPermission('user123', 'write');
      
      // Assert
      expect(result).toBe(false);
      expect(rbac.hasPermission).toHaveBeenCalledWith('user123', 'write');
    });
    
    test('should not audit when audit option is false', () => {
      // Act
      rbacMiddleware.checkPermission('user123', 'read', { audit: false });
      
      // Assert
      expect(auditTrail.log).not.toHaveBeenCalled();
    });
  });
  
  describe('filterByPermission', () => {
    test('should filter items based on permissions', () => {
      // Arrange
      const items = [
        { id: 1, type: 'document' },
        { id: 2, type: 'image' },
        { id: 3, type: 'document' }
      ];
      
      // Mock hasPermission to only allow 'document' types
      rbac.hasPermission.mockImplementation((userId, permission) => {
        return permission === 'document:read';
      });
      
      // Act
      const result = rbacMiddleware.filterByPermission(
        'user123', 
        items, 
        (item) => `${item.type}:read`
      );
      
      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { id: 1, type: 'document' },
        { id: 3, type: 'document' }
      ]);
    });
    
    test('should handle null or non-array items', () => {
      // Act & Assert
      expect(rbacMiddleware.filterByPermission('user123', null, jest.fn())).toEqual([]);
      expect(rbacMiddleware.filterByPermission('user123', 'not-an-array', jest.fn())).toEqual([]);
      expect(rbacMiddleware.filterByPermission('user123', [], jest.fn())).toEqual([]);
    });
  });
  
  describe('createUIPermissionAdapter', () => {
    test('should create adapter with correct methods', () => {
      // Act
      const adapter = rbacMiddleware.createUIPermissionAdapter('user123');
      
      // Assert
      expect(adapter).toHaveProperty('can');
      expect(adapter).toHaveProperty('cannot');
      expect(adapter).toHaveProperty('getAllPermissions');
      expect(adapter).toHaveProperty('getRoles');
      expect(adapter).toHaveProperty('hasRole');
    });
    
    test('adapter.can should check permissions correctly', () => {
      // Arrange
      const adapter = rbacMiddleware.createUIPermissionAdapter('user123');
      
      // Act & Assert
      expect(adapter.can('read')).toBe(true);
      expect(adapter.can('write')).toBe(false);
      expect(rbac.hasPermission).toHaveBeenCalledWith('user123', 'read');
    });
    
    test('adapter.cannot should be inverse of can', () => {
      // Arrange
      const adapter = rbacMiddleware.createUIPermissionAdapter('user123');
      
      // Act & Assert
      expect(adapter.cannot('read')).toBe(false);
      expect(adapter.cannot('write')).toBe(true);
    });
    
    test('adapter.getAllPermissions should return user permissions', () => {
      // Arrange
      const adapter = rbacMiddleware.createUIPermissionAdapter('user123');
      
      // Act
      const permissions = adapter.getAllPermissions();
      
      // Assert
      expect(permissions).toEqual(['read']);
      expect(rbac.getUserPermissions).toHaveBeenCalledWith('user123');
    });
    
    test('adapter.getRoles should return user roles', () => {
      // Arrange
      const adapter = rbacMiddleware.createUIPermissionAdapter('user123');
      
      // Act
      const roles = adapter.getRoles();
      
      // Assert
      expect(roles).toEqual(['user']);
      expect(rbac.getUserRoles).toHaveBeenCalledWith('user123');
    });
    
    test('adapter.hasRole should check if user has role', () => {
      // Arrange
      const adapter = rbacMiddleware.createUIPermissionAdapter('user123');
      
      // Act & Assert
      expect(adapter.hasRole('user')).toBe(true);
      expect(adapter.hasRole('admin')).toBe(false);
    });
  });
  
  describe('attachPermissionAdapter', () => {
    test('should attach permission adapter to request', () => {
      // Arrange
      const middleware = rbacMiddleware.attachPermissionAdapter();
      const req = { user: { id: 'user123' } };
      const res = {};
      const next = jest.fn();
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(req).toHaveProperty('permissions');
      expect(req.permissions).toHaveProperty('can');
      expect(req.permissions).toHaveProperty('cannot');
      expect(next).toHaveBeenCalled();
    });
    
    test('should handle anonymous users', () => {
      // Arrange
      const middleware = rbacMiddleware.attachPermissionAdapter();
      const req = {};
      const res = {};
      const next = jest.fn();
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(req).toHaveProperty('permissions');
    });
  });
  
  // Mock React components for protectComponent tests
  const React = {
    createElement: jest.fn((component, props) => ({ component, props }))
  };
  
  describe('protectComponent', () => {
    beforeEach(() => {
      global.React = React;
    });
    
    test('should render component when user has permission', () => {
      // Arrange
      const Component = () => {};
      const ProtectedComponent = rbacMiddleware.protectComponent(Component, 'read');
      const props = { user: { userId: 'user123' } };
      
      // Act
      const result = ProtectedComponent(props);
      
      // Assert
      expect(result).toEqual({ component: Component, props });
    });
    
    test('should render fallback when user lacks permission', () => {
      // Arrange
      const Component = () => {};
      const FallbackComponent = () => {};
      const ProtectedComponent = rbacMiddleware.protectComponent(Component, 'write', FallbackComponent);
      const props = { user: { userId: 'user123' } };
      
      // Act
      const result = ProtectedComponent(props);
      
      // Assert
      expect(result).toEqual({ component: FallbackComponent, props });
    });
    
    test('should render null when no fallback and user lacks permission', () => {
      // Arrange
      const Component = () => {};
      const ProtectedComponent = rbacMiddleware.protectComponent(Component, 'write');
      const props = { user: { userId: 'user123' } };
      
      // Act
      const result = ProtectedComponent(props);
      
      // Assert
      expect(result).toBeNull();
    });
  });
  
  describe('routeGuard', () => {
    test('should allow navigation when user has permission', () => {
      // Arrange
      const guard = rbacMiddleware.routeGuard('read');
      const to = { path: '/dashboard', meta: { userId: 'user123' } };
      const from = { path: '/' };
      const next = jest.fn();
      
      // Act
      guard(to, from, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith();
      expect(auditTrail.log).toHaveBeenCalledWith(
        'security:rbac:route_access', 
        expect.objectContaining({
          userId: 'user123',
          granted: true
        })
      );
    });
    
    test('should redirect when user lacks permission', () => {
      // Arrange
      const guard = rbacMiddleware.routeGuard('write');
      const to = { path: '/admin', meta: { userId: 'user123' } };
      const from = { path: '/' };
      const next = jest.fn();
      
      // Act
      guard(to, from, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith({ path: '/access-denied' });
      expect(auditTrail.log).toHaveBeenCalledWith(
        'security:rbac:route_access', 
        expect.objectContaining({
          userId: 'user123',
          granted: false
        })
      );
    });
    
    test('should use custom redirect path', () => {
      // Arrange
      const guard = rbacMiddleware.routeGuard('write', '/login');
      const to = { path: '/admin', meta: { userId: 'user123' } };
      const from = { path: '/' };
      const next = jest.fn();
      
      // Act
      guard(to, from, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith({ path: '/login' });
    });
  });
  
  describe('renderWithPermission', () => {
    test('should render content when user has permission', () => {
      // Arrange
      const contentRenderer = jest.fn().mockReturnValue('content');
      const fallbackRenderer = jest.fn().mockReturnValue('fallback');
      
      // Act
      const result = rbacMiddleware.renderWithPermission(
        'user123',
        'read',
        contentRenderer,
        fallbackRenderer
      );
      
      // Assert
      expect(result).toBe('content');
      expect(contentRenderer).toHaveBeenCalled();
      expect(fallbackRenderer).not.toHaveBeenCalled();
    });
    
    test('should render fallback when user lacks permission', () => {
      // Arrange
      const contentRenderer = jest.fn().mockReturnValue('content');
      const fallbackRenderer = jest.fn().mockReturnValue('fallback');
      
      // Act
      const result = rbacMiddleware.renderWithPermission(
        'user123',
        'write',
        contentRenderer,
        fallbackRenderer
      );
      
      // Assert
      expect(result).toBe('fallback');
      expect(contentRenderer).not.toHaveBeenCalled();
      expect(fallbackRenderer).toHaveBeenCalled();
    });
    
    test('should handle multiple permissions (any)', () => {
      // Arrange
      const contentRenderer = jest.fn().mockReturnValue('content');
      const fallbackRenderer = jest.fn().mockReturnValue('fallback');
      
      // Act
      const result = rbacMiddleware.renderWithPermission(
        'user123',
        ['write', 'read'],
        contentRenderer,
        fallbackRenderer
      );
      
      // Assert
      expect(result).toBe('content');
      expect(contentRenderer).toHaveBeenCalled();
    });
    
    test('should use default fallback when not provided', () => {
      // Act
      const result = rbacMiddleware.renderWithPermission(
        'user123',
        'write',
        () => 'content'
      );
      
      // Assert
      expect(result).toBeNull();
    });
  });
});
