# ALEJO Accessibility Testing Framework

This directory contains the comprehensive accessibility testing framework for ALEJO, focusing on ensuring that all components meet accessibility standards for users with various disabilities.

## Overview

The ALEJO accessibility testing framework includes:

1. **Unit and Integration Tests**: Tests for individual accessibility components and their integration
2. **Compliance Tests**: Automated tests against WCAG standards using axe-core
3. **Feature-Specific Tests**: Tests for specific accessibility features like screen readers, keyboard navigation, etc.
4. **CI/CD Integration**: GitHub Actions workflow for automated testing on commits and PRs

## Directory Structure

```
test/
├── accessibility/
│   ├── compliance-tests.js       # WCAG compliance testing
│   └── README.md                 # This documentation
├── personalization/
│   ├── hearing/
│   │   ├── deaf-accessibility-helpers.test.js
│   │   ├── hearing-impairment-detection.test.js
│   │   ├── run-hearing-accessibility-tests.js
│   │   ├── sign-language-processor.test.js
│   │   └── visual-communication-system.test.js
│   └── vision/
│       └── [vision accessibility tests]
└── run_comprehensive_tests.js    # Main test orchestration script
```

## Running Tests

### Running All Accessibility Tests

To run all accessibility tests:

```bash
node test/run_comprehensive_tests.js --accessibility
```

### Running Specific Module Tests

To run tests for a specific accessibility module:

```bash
node test/run_comprehensive_tests.js --module hearing
```

### Running Only Compliance Tests

To run only WCAG compliance tests:

```bash
node test/accessibility/compliance-tests.js
```

### Running Hearing Accessibility Tests

To run all tests related to hearing accessibility:

```bash
node test/personalization/hearing/run-hearing-accessibility-tests.js
```

## Test Reports

Test reports are generated in the `reports/` directory:

- `reports/hearing-accessibility/` - Reports for hearing accessibility tests
- `reports/vision-accessibility/` - Reports for vision accessibility tests
- `reports/accessibility-compliance/` - WCAG compliance test reports

## CI/CD Integration

The accessibility tests are integrated into the CI/CD pipeline via GitHub Actions. The workflow file is located at `.github/workflows/accessibility-tests.yml`.

The workflow runs on:
- Pushes to `main` and `develop` branches that modify accessibility-related files
- Pull requests to these branches
- Manual triggering via the GitHub Actions UI

## Adding New Tests

### Adding a New Component Test

1. Create a new test file in the appropriate directory (e.g., `test/personalization/hearing/new-component.test.js`)
2. Follow the existing test patterns using Mocha/Chai
3. Add the test file to the appropriate test runner (e.g., `run-hearing-accessibility-tests.js`)

### Adding a New Compliance Test

1. Add the test page to the `testPages` array in `compliance-tests.js`
2. Add any specific feature tests in the `testAccessibilityFeatures` function

## Accessibility Testing Standards

Our tests ensure compliance with:

1. **WCAG 2.1 AA** - Web Content Accessibility Guidelines
2. **WAI-ARIA 1.1** - Accessible Rich Internet Applications
3. **Section 508** - US federal accessibility requirements

## Best Practices

When writing accessibility tests:

1. **Test Real User Scenarios** - Don't just test technical compliance; test actual user workflows
2. **Test with Assistive Technologies** - Include tests that simulate screen readers, keyboard navigation, etc.
3. **Test for Multiple Disabilities** - Cover vision, hearing, motor, and cognitive impairments
4. **Include Both Automated and Manual Tests** - Some aspects require human judgment

## Troubleshooting

### Common Issues

1. **JSDOM Limitations** - JSDOM doesn't fully simulate browser behavior; some tests may need to be run in a real browser
2. **API Mocking** - Ensure all browser APIs (Web Speech, Web Audio, etc.) are properly mocked
3. **Test Isolation** - Make sure tests clean up after themselves to prevent interference

### Getting Help

If you encounter issues with the accessibility testing framework:

1. Check the documentation in this README
2. Review the test code for similar components
3. Consult the ALEJO development team for assistance
