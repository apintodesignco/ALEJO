# GitHub Actions Setup for ALEJO

This document explains the GitHub Actions workflows that have been set up for ALEJO and what you need to do to get them working.

## Workflows Created

1. **Security Scan (`security-scan.yml`)**
   - Runs CodeQL analysis for security vulnerabilities
   - Checks for vulnerable npm and Python dependencies
   - Runs weekly and on code pushes

2. **Automated Testing (`automated-testing.yml`)**
   - Runs JavaScript unit tests
   - Runs Python unit tests
   - Runs gesture system tests
   - Runs integration tests
   - Performs end-to-end testing

3. **Code Quality (`code-quality.yml`)**
   - Lints JavaScript code with ESLint
   - Formats code with Prettier
   - Lints Python code with flake8, black, isort, and mypy
   - Performs TypeScript type checking
   - Runs SonarCloud analysis

4. **Deployment (`deployment.yml`)**
   - Builds ALEJO
   - Validates the gesture system
   - Tests the Docker deployment
   - Deploys to development, staging, or production environments

## Required Setup

To get these workflows working properly, you need to:

1. **Push these workflow files to GitHub**
   - They'll be automatically detected and enabled

2. **Create GitHub Environments**
   - Go to your repository Settings → Environments
   - Create three environments: `development`, `staging`, and `production`
   - Add environment-specific secrets if needed

3. **Add Required Secrets**
   - Go to Settings → Secrets and Variables → Actions
   - Add the following secrets if you plan to use them:
     - `SONAR_TOKEN` (if using SonarCloud)
     - Any deployment credentials needed

4. **Enable GitHub Pages** (for documentation)
   - Go to Settings → Pages
   - Select the `gh-pages` branch as the source

## Manually Running Workflows

You can manually run most of these workflows:

1. Go to the Actions tab in your GitHub repository
2. Select the workflow you want to run
3. Click the "Run workflow" button
4. For deployment, select the environment you want to deploy to

## Configuring SonarCloud

If you want to use SonarCloud:

1. Sign up at [https://sonarcloud.io/](https://sonarcloud.io/) using your GitHub account
2. Set up your organization
3. Add your repository
4. Get your SONAR_TOKEN and add it to your GitHub secrets

## Next Steps

1. Test each workflow by pushing a small change to your repository
2. Check the Actions tab to make sure everything is running correctly
3. Customize the workflows as needed for your specific requirements

These workflows complement the unit tests we've created for ALEJO, providing comprehensive automated testing and quality assurance.
