"""
ALEJO Test Package
This package contains all tests for the ALEJO project.

Tests are organized into the following categories:
- Unit tests: Test individual components in isolation
- Integration tests: Test interactions between components
- End-to-end tests: Test complete user flows
- Performance tests: Test system performance under various conditions
- Security tests: Test security features and vulnerabilities
- Accessibility tests: Test accessibility features
"""

# Import common test utilities
from tests.common.test_utils import (
    setup_test_logging,
    get_test_data_path,
    load_test_json,
    PerformanceTimer,
    generate_test_token,
    generate_test_password,
    is_ci_environment,
    skip_in_ci
)

# Re-export secrets for backward compatibility
import secrets
