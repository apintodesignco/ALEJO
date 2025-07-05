# ALEJO Environment and Workflow Tools

This directory contains tools to help maintain, fix, and validate the ALEJO development environment and workflows.

## Environment Setup Tools

### setup-environment.js

This is the **recommended** comprehensive script for setting up the ALEJO development environment. It provides a permanent solution for all environment issues:

- Verifies Node.js and npm installation
- Installs required dependencies
- Adds necessary test scripts to package.json
- Fixes module system inconsistencies
- Validates GitHub workflows
- Provides instructions for permanent PATH fix

**Usage:**

```bash
node tools/setup-environment.js
```

### `fix-environment.js`

A comprehensive tool that addresses all Node.js environment issues in one go:

- Verifies Node.js installation and PATH
- Creates temporary batch wrappers if needed
- Runs the module system fixer to ensure ES module consistency
- Installs missing dependencies
- Validates GitHub workflow files
- Runs tests to verify the environment is working correctly

**Usage:**

```bash
node tools/fix-environment.js
```

### `add-nodejs-to-path.ps1`

A PowerShell script that permanently adds Node.js to the system PATH environment variable.

**Usage:**

```powershell
# Run as Administrator
powershell -ExecutionPolicy Bypass -File .\tools\add-nodejs-to-path.ps1
```

## Environment Fixing Tools

### `fix-module-system.js`

Scans the ALEJO codebase for CommonJS modules and converts them to ES modules to ensure consistency with the project's `"type": "module"` setting in package.json.

**Usage:**

```bash
node tools/fix-module-system.js
```

## Workflow Tools

### `validate-github-workflows.js`

Validates and fixes common issues in GitHub workflow files:

- Validates environment syntax
- Checks for deprecated action references
- Validates context access
- Ensures proper action versions are used

**Usage:**

```bash
node tools/validate-github-workflows.js
```

## Batch Wrappers

If Node.js is not in your PATH, the `fix-environment.js` script will create batch wrappers in the `tools/wrappers` directory:

- `node.bat` - Wrapper for node.exe
- `npm.bat` - Wrapper for npm.cmd
- `npx.bat` - Wrapper for npx.cmd

These wrappers allow you to run Node.js commands even when Node.js is not in your PATH.

## Troubleshooting

### Node.js Not Found in PATH

If Node.js is not in your PATH, you have two options:

1. **Temporary Fix:** Run `node tools/fix-environment.js` to create batch wrappers
2. **Permanent Fix:** Run `powershell -ExecutionPolicy Bypass -File tools/add-nodejs-to-path.ps1` as Administrator

### Module System Errors

If you encounter errors related to CommonJS vs ES modules (e.g., `require is not defined`), run:

```bash
node tools/fix-module-system.js
```

### GitHub Workflow Errors

If GitHub workflows are failing due to syntax errors or deprecated actions, run:

```bash
node tools/validate-github-workflows.js
```

## Best Practices

1. Always run `fix-environment.js` after pulling new changes
2. Use ES modules syntax consistently (import/export) rather than CommonJS (require/module.exports)
3. Keep GitHub workflow files up to date with the latest action versions
4. Run tests regularly to ensure the environment is working correctly
