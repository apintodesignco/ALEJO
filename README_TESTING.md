# ALEJO Comprehensive Testing System

This document provides an overview of the comprehensive testing system for the ALEJO project, including how to use the various testing tools and integrate them into your development workflow.

## Overview

The ALEJO testing system consists of several components:

1. **Comprehensive Test Runner** - A unified interface for running all tests
2. **Bug Detection** - Static analysis to find common bugs and code issues
3. **Performance Testing** - Benchmarking and regression detection
4. **Security Scanning** - Vulnerability detection and security best practices

## Quick Start

To run all tests with default settings:

```bash
python run_comprehensive_tests.py
```

## Comprehensive Test Runner

The `run_comprehensive_tests.py` script orchestrates all testing tools and provides a unified interface.

### Usage

```bash
python run_comprehensive_tests.py [options]
```

### Options

- `--all` - Run all tests (default)
- `--unit` - Run unit tests only
- `--integration` - Run integration tests only
- `--e2e` - Run end-to-end tests only
- `--gesture` - Run gesture system tests only
- `--bugs` - Run bug detection only
- `--performance` - Run performance tests only
- `--security` - Run security scanning only
- `--quality` - Run code quality checks only
- `--report` - Generate HTML report
- `--output DIR` - Output directory for reports (default: test_reports)
- `--verbose` - Show detailed output
- `--ci` - Run in CI mode (fail on any error)

### Examples

Run only unit tests:

```bash
python run_comprehensive_tests.py --unit
```

Run unit and integration tests with verbose output:

```bash
python run_comprehensive_tests.py --unit --integration --verbose
```

Generate HTML reports for all tests:

```bash
python run_comprehensive_tests.py --all --report
```

## Bug Detection

The `alejo_bug_detector.py` script performs static analysis to find common bugs and code issues.

### Bug Detector Usage

```bash
python alejo_bug_detector.py --path PATH [options]
```

### Bug Detector Options

- `--path PATH` - Path to analyze (file or directory)
- `--output FILE` - Output file for report (default: stdout)
- `--min-severity {low,medium,high,critical}` - Minimum severity level to report
- `--verbose` - Show detailed output

## Performance Testing

The `alejo_performance_tester.py` script benchmarks ALEJO components and detects performance regressions.

### Performance Tester Usage

```bash
python alejo_performance_tester.py [options]
```

### Performance Tester Options

- `--component {brain,vision,gesture,all}` - Component to test (default: all)
- `--output FILE` - Output file for report (default: stdout)
- `--baseline FILE` - Baseline file for regression comparison
- `--save-baseline FILE` - Save current results as baseline
- `--verbose` - Show detailed profiling stats

## Security Scanning

The `alejo_security_scanner.py` script detects security vulnerabilities in Python, JavaScript, and HTML files.

### Security Scanner Usage

```bash
python alejo_security_scanner.py --path PATH [options]
```

### Security Scanner Options

- `--path PATH` - Path to scan (file or directory)
- `--output FILE` - Output file for report (default: stdout)
- `--min-severity {low,medium,high,critical}` - Minimum severity level to report
- `--verbose` - Show detailed output

## CI/CD Integration

The testing system is integrated into the CI/CD pipeline via GitHub Actions. The workflow runs all tests on every push to the main branch and pull request.

### GitHub Actions Workflow

The `.github/workflows/alejo.yml` file defines the CI/CD pipeline, which includes:

1. Backend validation (unit tests, linting)
2. Frontend validation
3. Comprehensive testing (all tests, bug detection, security scanning)
4. Security compliance checks

## Best Practices

1. **Run tests locally before pushing** - Use `run_comprehensive_tests.py` to run tests locally before pushing to avoid CI failures.
2. **Fix bugs and security issues promptly** - Address issues found by the bug detector and security scanner as soon as possible.
3. **Monitor performance regressions** - Regularly check for performance regressions using the performance tester.
4. **Maintain high test coverage** - Aim for at least 80% test coverage for all code.
5. **Write tests for new features** - Always write tests for new features and bug fixes.

## Troubleshooting

### Common Issues

1. **Tests fail in CI but pass locally** - This may be due to environment differences. Try running tests in a clean environment or Docker container.
2. **Performance tests show regressions** - Check recent changes that might affect performance. Consider optimizing the affected components.
3. **Security scanner reports false positives** - Review the reported issues carefully. If they are false positives, document them in the code.

## Contributing

When contributing to the ALEJO project, please ensure:

1. All tests pass locally before pushing
2. New features include appropriate tests
3. Bug fixes include regression tests
4. Code follows the project's style guidelines
5. Security best practices are followed

## Contact

For questions or issues related to the testing system, please contact the ALEJO development team.
