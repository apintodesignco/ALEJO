# ALEJO Role-Based Access Control (RBAC) System

## Overview

The ALEJO Role-Based Access Control (RBAC) system provides a comprehensive security layer for managing user permissions through role assignments. This system enables fine-grained access control across the application, ensuring users can only access resources and perform actions they are authorized for.

## Key Features

- **Hierarchical Roles**: Roles can inherit permissions from other roles, creating a flexible permission hierarchy
- **Dynamic Permission Checks**: Real-time evaluation of user permissions based on roles and context
- **Temporary Permission Overrides**: Grant temporary permissions without changing role assignments
- **Secure Storage**: All role definitions and assignments are encrypted using the Privacy Guard
- **Comprehensive Audit Trail**: All security-related actions are logged for compliance and debugging
- **Event-Driven Architecture**: Integrates with ALEJO's event system for user lifecycle management
- **Middleware Components**: Ready-to-use middleware for protecting API endpoints, UI components, and routes

## Architecture

The RBAC system consists of several components:

1. **Core RBAC Engine** (`rbac.js`): Manages roles, permissions, and user assignments
2. **RBAC Middleware** (`rbac-middleware.js`): Provides integration with API endpoints, UI components, and routes
3. **Security Module Integration** (`index.js`): Exposes RBAC functionality through the main security module

```bash
src/security/
├── rbac.js              # Core RBAC implementation
├── rbac-middleware.js   # Integration middleware
└── index.js             # Security module integration
```

## Core Concepts

### Roles

A role is a collection of permissions that can be assigned to users. Roles can inherit permissions from other roles, creating a hierarchy.

```javascript
// Example role structure
{
  name: 'editor',
  description: 'Content editor role',
  permissions: ['content:read', 'content:write', 'media:upload'],
  inherits: ['user']  // Inherits all permissions from 'user' role
}
```

### Permissions

Permissions are string identifiers that represent actions a user can perform. They typically follow a resource:action format.

Examples:

- `content:read` - Can read content
- `content:write` - Can create/edit content
- `admin:access` - Can access admin area
- `user:manage` - Can manage user accounts

### Role Assignments

Role assignments connect users to roles. A user can have multiple roles, and their effective permissions are the union of all permissions from their assigned roles.

### Permission Overrides

Temporary permission grants or denials that override the permissions derived from a user's roles. Useful for temporary access or restrictions.

## Usage Examples

### Initializing the RBAC System

The RBAC system is automatically initialized when the security module is initialized:

```javascript
import * as security from '../security/index.js';

await security.initialize({
  userId: 'current-user-id',
  securityLevel: 'standard'
});
```

### Creating Roles

```javascript
import * as rbac from '../security/rbac.js';

// Create a basic user role
await rbac.createRole('user', {
  description: 'Basic user role',
  permissions: ['content:read', 'profile:edit']
});

// Create an editor role that inherits from user
await rbac.createRole('editor', {
  description: 'Content editor role',
  permissions: ['content:write', 'media:upload'],
  inherits: ['user']
});

// Create an admin role that inherits from editor
await rbac.createRole('admin', {
  description: 'Administrator role',
  permissions: ['user:manage', 'system:configure'],
  inherits: ['editor']
});
```

### Assigning Roles to Users

```javascript
// Assign a role to a user
await rbac.assignRoleToUser('user123', 'editor');

// Remove a role from a user
await rbac.removeRoleFromUser('user123', 'editor');

// Get all roles assigned to a user
const userRoles = await rbac.getUserRoles('user123');
```

### Checking Permissions

```javascript
// Check if a user has a specific permission
const canEdit = security.hasPermission('user123', 'content:write');

// Get all permissions for a user
const allPermissions = security.getUserPermissions('user123');
```

### Using Permission Overrides

```javascript
// Grant a temporary permission
await rbac.addPermissionOverride('user123', 'special:access', true);

// Revoke a temporary permission
await rbac.removePermissionOverride('user123', 'special:access');

// Clear all overrides for a user
await rbac.clearPermissionOverrides('user123');
```

## Middleware Integration

### Protecting API Endpoints

```javascript
import { protectEndpoint } from '../security/rbac-middleware.js';

// In Express route definition
app.get('/api/admin/users', 
  protectEndpoint('user:manage'), 
  (req, res) => {
    // Only accessible to users with 'user:manage' permission
    res.json({ users: [...] });
  }
);

// Require multiple permissions (any)
app.post('/api/content',
  protectEndpoint(['content:write', 'content:approve']),
  (req, res) => {
    // Accessible to users with either permission
  }
);

// Return empty results instead of error
app.get('/api/sensitive-data',
  protectEndpoint('data:access', { failSilently: true }),
  (req, res) => {
    // Unauthorized users get empty results instead of error
  }
);
```

### Protecting UI Components (React)

```jsx
import { protectComponent } from '../security/rbac-middleware.js';

// Basic protection
const ProtectedAdminPanel = protectComponent(
  AdminPanel,
  'admin:access'
);

// With fallback component
const ProtectedSettings = protectComponent(
  SettingsPanel,
  'settings:access',
  UnauthorizedMessage
);

// Usage
function App() {
  return (
    <div>
      <ProtectedAdminPanel user={currentUser} />
      <ProtectedSettings user={currentUser} />
    </div>
  );
}
```

### Route Guards (Vue Router)

```javascript
import { routeGuard } from '../security/rbac-middleware.js';

const router = new VueRouter({
  routes: [
    {
      path: '/admin',
      component: AdminDashboard,
      beforeEnter: routeGuard('admin:access')
    },
    {
      path: '/settings',
      component: SettingsPage,
      beforeEnter: routeGuard('settings:access', '/unauthorized')
    }
  ]
});
```

### UI Permission Adapter

```javascript
import { createUIPermissionAdapter } from '../security/rbac-middleware.js';

// Create adapter for current user
const permissions = createUIPermissionAdapter(currentUserId);

// Use in UI components
if (permissions.can('user:manage')) {
  showUserManagementUI();
}

if (permissions.hasRole('admin')) {
  showAdminControls();
}

// Conditional rendering
<div>
  {permissions.can('reports:view') && <ReportsPanel />}
  {permissions.cannot('settings:access') && <RestrictedMessage />}
</div>
```

### Express Middleware

```javascript
import { attachPermissionAdapter } from '../security/rbac-middleware.js';

// Attach to all routes
app.use(attachPermissionAdapter());

// Use in route handlers
app.get('/dashboard', (req, res) => {
  if (req.permissions.can('dashboard:access')) {
    // Show dashboard
  } else {
    // Show unauthorized message
  }
});
```

## Event Integration

The RBAC system integrates with ALEJO's event system to respond to user lifecycle events:

- `user:login` - Loads user's roles and permissions
- `user:logout` - Clears permission overrides
- `user:registered` - Assigns default roles to new users
- `security:level:change` - Updates security behavior based on security level

## Best Practices

1. **Use Hierarchical Roles**: Create a logical hierarchy of roles to simplify management
2. **Granular Permissions**: Define specific permissions rather than broad ones
3. **Descriptive Names**: Use clear, descriptive names for roles and permissions
4. **Audit Important Actions**: Enable audit logging for sensitive permission checks
5. **Default Deny**: Start with minimal permissions and add as needed
6. **Regular Review**: Periodically review role definitions and assignments

## Extending the RBAC System

The RBAC system can be extended in several ways:

1. **Custom Permission Validators**: Add custom logic for permission evaluation
2. **Role Templates**: Create role templates for different user types
3. **Permission Groups**: Group related permissions for easier management
4. **Time-Based Permissions**: Add time constraints to role assignments
5. **Context-Aware Permissions**: Make permissions dependent on request context

## Security Considerations

1. **Role Explosion**: Avoid creating too many roles with overlapping permissions
2. **Least Privilege**: Assign the minimum permissions necessary
3. **Regular Audits**: Review the audit trail regularly for suspicious activity
4. **Secure Default Roles**: Ensure default roles have minimal permissions
5. **Permission Naming**: Use consistent naming conventions for permissions

## Troubleshooting

### Common Issues

1. **Permission Denied Unexpectedly**:
   - Check role assignments with `getUserRoles(userId)`
   - Verify role permissions with `getRolePermissions(roleName)`
   - Look for negative permission overrides

2. **Permission Granted Unexpectedly**:
   - Check for permission overrides with `getUserPermissionOverrides(userId)`
   - Verify role inheritance chain with `getRoleHierarchy(roleName)`

3. **Performance Issues**:
   - Use the permission cache where appropriate
   - Minimize deep role hierarchies
   - Batch role assignments when possible

### Debugging

Enable debug logging for detailed information:

```javascript
await rbac.setDebugMode(true);
```

Check the audit trail for permission checks:

```javascript
const logs = await security.auditTrail.getFilteredLogs('security:rbac:*');
```

## API Reference

See the JSDoc comments in the source code for detailed API documentation:

- `src/security/rbac.js`
- `src/security/rbac-middleware.js`

## Testing

The RBAC system includes comprehensive tests:

- Unit tests: `test/security/rbac-test.js`
- Middleware tests: `test/security/rbac-middleware-test.js`
- Integration tests: `test/security/rbac-integration-test.js`

Run the tests with:

```bash
npm test -- --testPathPattern=rbac
```
