# ALEJO Security Hardening

This document provides an overview of the security features implemented in ALEJO. These features are designed to provide a robust security foundation for the platform, focusing on local-first principles and data privacy.

## Table of Contents

1. [Overview](#overview)
2. [Security Components](#security-components)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [Security Best Practices](#security-best-practices)
6. [Troubleshooting](#troubleshooting)

## Overview

ALEJO's security hardening includes the following major components:

- **Encryption**: Industry-standard encryption for data at rest and in transit.
- **Access Control**: Role-based access control with user authentication.
- **Audit Logging**: Tamper-evident, encrypted audit logs with hash chaining.
- **Multi-Factor Authentication**: TOTP and backup codes for enhanced security.
- **Secure Camera Integration**: Enhanced camera capabilities with security controls.
- **Secure Browser Testing**: Browser testing with integrated security features.

These components are designed to work together to provide a comprehensive security solution for ALEJO.

## Security Components

### Encryption (`core.security.encryption`)

The encryption module provides industry-standard encryption using Fernet (AES-128-CBC with HMAC-SHA256), text and file encryption/decryption, password-based key derivation, and key export/import functionality.

```python
from core.security.encryption import AlejoEncryption

# Create encryption instance
encryption = AlejoEncryption()
# Encrypt text
encrypted_data = encryption.encrypt_text("Sensitive data")
# Decrypt text
decrypted_data = encryption.decrypt_text(encrypted_data)
```

### Access Control (`core.security.access_control`)

The access control module provides role-based access control (admin, developer, tester, viewer), user authentication with password hashing, session management, and permission checks.

```python
from core.security.access_control import AccessControl

# Create access control instance
access_control = AccessControl()
# Authenticate user
session = access_control.authenticate("username", "password")
# Check permission
has_permission = access_control.has_permission(session["session_id"], "read")
```

### Audit Logging (`core.security.audit_logging`)

The audit logging module provides tamper-evident, encrypted audit logs with log rotation, hash chaining, and event logging with severity and source IP.

```python
from core.security.audit_logging import AuditLogger

# Create audit logger instance
audit_logger = AuditLogger("./audit_logs")
# Log event
event_id = audit_logger.log_event("user_login", "username", {"ip": "192.168.1.1"}, "INFO")
```

### Multi-Factor Authentication (`core.security.mfa`)

The MFA module provides TOTP (Time-based One-Time Password) authentication, backup codes for recovery, and QR code generation for TOTP setup.

```python
from core.security.mfa import MFAManager

# Create MFA manager instance
mfa_manager = MFAManager()
# Set up TOTP for a user
totp_setup = mfa_manager.setup_totp("username")
# Verify TOTP code
valid = mfa_manager.verify_totp("username", "123456")
```

## Configuration

### Environment Variables

- `ALEJO_ENCRYPTION_KEY`: Master encryption key.
- `ALEJO_AUDIT_KEY`: Key for audit log encryption.

### Configuration File

Create a `config.json` file for the `AlejoSecurity` class:

```json
{
    "security_level": "high",
    "data_dir": "./alejo_secure_data",
    "audit_log_dir": "./alejo_audit_logs",
    "mfa": {
        "storage_path": "./alejo_mfa_data",
        "totp_issuer": "ALEJO"
    }
}
```

## Usage

### Unified Interface

The `AlejoSecurity` class provides a unified interface for all security features:

```python
from alejo.security import AlejoSecurity

# Create AlejoSecurity instance
secure_alejo = AlejoSecurity("config.json")
# Authenticate user
auth_result = secure_alejo.authenticate("username", "password", "123456")
```

### Command Line Interface

A command-line interface is available via `alejo_security.py`:

```bash
# Show security status
python alejo_security.py --status

# Encrypt a file
python alejo_security.py --encrypt path/to/file.txt
```

## Security Best Practices

1. **Key Management**: Store encryption keys securely.
2. **Password Policy**: Enforce strong password policies.
3. **MFA**: Enable multi-factor authentication for all users.
4. **Audit Logs**: Regularly review audit logs for suspicious activity.
5. **Access Control**: Follow the principle of least privilege.

## Troubleshooting

### Common Issues

- **Encryption Key Not Found**: Set the `ALEJO_ENCRYPTION_KEY` environment variable.
- **Authentication Failed**: Check username, password, and MFA code.
- **Permission Denied**: Check user role and permissions.

### Logging

Enable debug logging for more detailed information:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Security Integration Test

Run the security integration test to verify that all components are working correctly:

```bash
python tests/security_integration_test.py
```
