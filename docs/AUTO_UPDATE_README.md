# ALEJO Automatic Update System

This document explains the automatic update system implemented in ALEJO to ensure users always have the latest security patches and features.

## How It Works

The ALEJO update system performs the following operations:

1. **Pre-launch Update Check**: Before ALEJO starts, it automatically checks for updates from the main repository.
2. **Secure Update Process**:
   - Creates a backup of the current installation before applying any updates
   - Updates the codebase from the repository
   - Updates dependencies if necessary
   - Performs database schema migrations if required
   - Rolls back to the backup if any errors occur during the update
3. **Scheduled Checks**: Updates are checked at configurable intervals (default: every 4 hours) to avoid excessive network traffic.

## Usage

The update system works automatically and requires no user intervention. However, several command-line options are available:

```bash
# Normal startup with automatic update check
python start_alejo_with_gestures.py

# Skip update check during startup
python start_alejo_with_gestures.py --skip-updates

# Manually check for updates without starting ALEJO
python update_manager.py --check-only

# Force update check regardless of when the last check occurred
python update_manager.py --force
```

## Configuration

The update system can be configured through environment variables:

- `ALEJO_REPO_URL`: Override the default GitHub repository URL
- `ALEJO_REPO_BRANCH`: Override the default branch (default: main)
- `ALEJO_UPDATE_INTERVAL`: Set the minimum hours between update checks (default: 4)

## Troubleshooting

If you encounter issues with the automatic update system:

1. Check the log file (`alejo_update.log`) for detailed error messages
2. Try running a manual update with `python update_manager.py --force`
3. If updates consistently fail, you can bypass them with `--skip-updates` and update manually

## Security Considerations

The automatic update system enhances ALEJO's security by ensuring users always have the latest security patches. The system:

- Only pulls from trusted repositories
- Creates backups before applying updates
- Validates the repository connection is secure
- Maintains a log of all update operations

## For Developers

To extend or modify the update system:

1. The core functionality is in `update_manager.py`
2. Test cases are available in `test_update_manager.py`
3. The update system is integrated into ALEJO's startup process in `start_alejo_with_gestures.py`

Before making changes, run the test suite to ensure everything works correctly:

```bash
python -m unittest test_update_manager.py
```
