/**
 * ALEJO RBAC Middleware
 * 
 * Provides middleware functions for integrating the Role-Based Access Control system
 * with API endpoints, UI components, and application routes.
 * 
 * Features:
 * - API endpoint protection
 * - UI component access control
 * - Route guards for navigation
 * - Permission verification helpers
 */

import * as rbac from './rbac.js';
import { auditTrail } from './audit-trail.js';

/**
 * Middleware to protect API endpoints based on required permissions
 * @param {string|Array<string>} requiredPermissions - Permission(s) required to access the endpoint
 * @param {Object} options - Additional options
 * @param {boolean} options.failSilently - If true, returns empty results instead of error
 * @param {boolean} options.auditAccess - If true, logs access attempts
 * @returns {Function} Express middleware function
 */
export function protectEndpoint(requiredPermissions, options = {}) {
  const permissionList = Array.isArray(requiredPermissions) 
    ? requiredPermissions 
    : [requiredPermissions];
  
  const { failSilently = false, auditAccess = true } = options;
  
  return function(req, res, next) {
    const userId = req.user?.id || 'anonymous';
    
    // Check if user has any of the required permissions
    const hasAccess = permissionList.some(permission => 
      rbac.hasPermission(userId, permission)
    );
    
    if (auditAccess) {
      auditTrail.log('security:rbac:endpoint_access', {
        userId,
        endpoint: req.originalUrl,
        method: req.method,
        requiredPermissions: permissionList,
        granted: hasAccess
      });
    }
    
    if (hasAccess) {
      return next();
    }
    
    // Handle access denied
    if (failSilently) {
      // For GET requests, return empty results
      if (req.method === 'GET') {
        return res.json({ data: [], count: 0 });
      }
      // For other methods, return success but do nothing
      return res.json({ success: true });
    }
    
    // Return 403 Forbidden with appropriate message
    return res.status(403).json({
      error: 'access_denied',
      message: 'You do not have permission to access this resource'
    });
  };
}

/**
 * Higher-order component for React to protect UI components
 * @param {React.Component} Component - Component to protect
 * @param {string|Array<string>} requiredPermissions - Permission(s) required to access the component
 * @param {React.Component} FallbackComponent - Component to render if access is denied
 * @returns {React.Component} Protected component
 */
export function protectComponent(Component, requiredPermissions, FallbackComponent = null) {
  const permissionList = Array.isArray(requiredPermissions) 
    ? requiredPermissions 
    : [requiredPermissions];
  
  return function ProtectedComponent(props) {
    const { userId } = props.user || { userId: 'anonymous' };
    
    // Check if user has any of the required permissions
    const hasAccess = permissionList.some(permission => 
      rbac.hasPermission(userId, permission)
    );
    
    if (hasAccess) {
      return <Component {...props} />;
    }
    
    // Return fallback or null
    return FallbackComponent ? <FallbackComponent {...props} /> : null;
  };
}

/**
 * Route guard for Vue Router
 * @param {string|Array<string>} requiredPermissions - Permission(s) required to access the route
 * @param {string} redirectRoute - Route to redirect to if access is denied
 * @returns {Function} Vue Router navigation guard
 */
export function routeGuard(requiredPermissions, redirectRoute = '/access-denied') {
  const permissionList = Array.isArray(requiredPermissions) 
    ? requiredPermissions 
    : [requiredPermissions];
  
  return function(to, from, next) {
    const userId = to.meta?.userId || 'anonymous';
    
    // Check if user has any of the required permissions
    const hasAccess = permissionList.some(permission => 
      rbac.hasPermission(userId, permission)
    );
    
    auditTrail.log('security:rbac:route_access', {
      userId,
      route: to.path,
      requiredPermissions: permissionList,
      granted: hasAccess
    });
    
    if (hasAccess) {
      return next();
    }
    
    // Redirect to access denied page
    return next({ path: redirectRoute });
  };
}

/**
 * Check if current user has permission for an action
 * @param {string} userId - User identifier
 * @param {string} permission - Permission to check
 * @param {Object} options - Additional options
 * @param {boolean} options.audit - Whether to log the check
 * @returns {boolean} Whether user has permission
 */
export function checkPermission(userId, permission, options = {}) {
  const { audit = false } = options;
  
  const hasAccess = rbac.hasPermission(userId, permission);
  
  if (audit) {
    auditTrail.log('security:rbac:permission_check', {
      userId,
      permission,
      granted: hasAccess
    });
  }
  
  return hasAccess;
}

/**
 * Filter a list of items based on user permissions
 * @param {string} userId - User identifier
 * @param {Array<Object>} items - Items to filter
 * @param {Function} permissionExtractor - Function that returns required permission for an item
 * @returns {Array<Object>} Filtered items
 */
export function filterByPermission(userId, items, permissionExtractor) {
  if (!items || !Array.isArray(items)) {
    return [];
  }
  
  return items.filter(item => {
    const permission = permissionExtractor(item);
    return rbac.hasPermission(userId, permission);
  });
}

/**
 * Conditionally render content based on permissions
 * @param {string} userId - User identifier
 * @param {string|Array<string>} requiredPermissions - Permission(s) required to render content
 * @param {Function} contentRenderer - Function that returns content to render
 * @param {Function} fallbackRenderer - Function that returns fallback content
 * @returns {*} Rendered content
 */
export function renderWithPermission(userId, requiredPermissions, contentRenderer, fallbackRenderer = () => null) {
  const permissionList = Array.isArray(requiredPermissions) 
    ? requiredPermissions 
    : [requiredPermissions];
  
  // Check if user has any of the required permissions
  const hasAccess = permissionList.some(permission => 
    rbac.hasPermission(userId, permission)
  );
  
  return hasAccess ? contentRenderer() : fallbackRenderer();
}

/**
 * Create a permission-based UI adapter
 * @param {string} userId - User identifier
 * @returns {Object} UI adapter with permission-based helpers
 */
export function createUIPermissionAdapter(userId) {
  return {
    /**
     * Check if user can access a feature
     * @param {string} permission - Permission to check
     * @returns {boolean} Whether user has permission
     */
    can(permission) {
      return rbac.hasPermission(userId, permission);
    },
    
    /**
     * Check if user cannot access a feature
     * @param {string} permission - Permission to check
     * @returns {boolean} Whether user lacks permission
     */
    cannot(permission) {
      return !rbac.hasPermission(userId, permission);
    },
    
    /**
     * Get all permissions for the user
     * @returns {Array<string>} User permissions
     */
    getAllPermissions() {
      return rbac.getUserPermissions(userId);
    },
    
    /**
     * Get all roles for the user
     * @returns {Array<string>} User roles
     */
    getRoles() {
      return rbac.getUserRoles(userId);
    },
    
    /**
     * Check if user has a specific role
     * @param {string} roleName - Role to check
     * @returns {boolean} Whether user has the role
     */
    hasRole(roleName) {
      return rbac.getUserRoles(userId).includes(roleName);
    }
  };
}

/**
 * Create Express middleware to attach permission adapter to request
 * @returns {Function} Express middleware
 */
export function attachPermissionAdapter() {
  return function(req, res, next) {
    const userId = req.user?.id || 'anonymous';
    req.permissions = createUIPermissionAdapter(userId);
    next();
  };
}
