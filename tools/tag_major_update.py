#!/usr/bin/env python3
"""
ALEJO Major Update Tagger

This script helps tag commits as major updates to trigger the automated GitHub workflow.
It ensures consistent formatting of commit messages for major updates and can
optionally create a new version tag.

Usage:
    python tag_major_update.py --type feature --message "Implemented reasoning engine"
    python tag_major_update.py --type security --message "Fixed critical auth vulnerability" --version-bump minor
"""

import argparse
import os
import subprocess
import sys
from datetime import datetime


UPDATE_TYPES = {
    'feature': '[MAJOR FEATURE]',
    'security': '[SECURITY FIX]',
    'performance': '[PERFORMANCE]',
    'ux': '[UX]'
}

VERSION_BUMPS = ['patch', 'minor', 'major']


def run_command(command):
    """Run a shell command and return its output."""
    try:
        result = subprocess.run(command, shell=True, check=True, 
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               universal_newlines=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {command}")
        print(f"Error message: {e.stderr}")
        sys.exit(1)


def get_current_branch():
    """Get the name of the current git branch."""
    return run_command("git rev-parse --abbrev-ref HEAD")


def check_clean_working_directory():
    """Check if the working directory is clean."""
    status = run_command("git status --porcelain")
    if status:
        print("Error: Working directory is not clean. Please commit or stash your changes first.")
        sys.exit(1)


def create_tagged_commit(update_type, message, version_bump=None):
    """Create a commit with the appropriate tag for a major update."""
    if update_type not in UPDATE_TYPES:
        print(f"Error: Invalid update type '{update_type}'. Must be one of: {', '.join(UPDATE_TYPES.keys())}")
        sys.exit(1)
    
    # Format the commit message with the appropriate tag
    tag = UPDATE_TYPES[update_type]
    formatted_message = f"{tag} {message}"
    
    # Create the commit
    print(f"Creating commit: {formatted_message}")
    run_command(f'git commit -m "{formatted_message}"')
    
    # Create a version tag if requested
    if version_bump:
        if version_bump not in VERSION_BUMPS:
            print(f"Error: Invalid version bump '{version_bump}'. Must be one of: {', '.join(VERSION_BUMPS)}")
            sys.exit(1)
        
        # Get the current version from the version file
        try:
            with open("alejo/version.py", "r") as f:
                version_content = f.read()
                current_version = version_content.split('__version__ = "')[1].split('"')[0]
                print(f"Current version: {current_version}")
        except (FileNotFoundError, IndexError):
            print("Warning: Could not determine current version. Using 0.1.0 as base.")
            current_version = "0.1.0"
        
        # Calculate the new version
        major, minor, patch = map(int, current_version.split('.'))
        if version_bump == "major":
            new_version = f"{major + 1}.0.0"
        elif version_bump == "minor":
            new_version = f"{major}.{minor + 1}.0"
        else:  # patch
            new_version = f"{major}.{minor}.{patch + 1}"
        
        # Create a tag for the new version
        tag_name = f"v{new_version}"
        print(f"Creating version tag: {tag_name}")
        run_command(f'git tag -a {tag_name} -m "Version {new_version}"')
        
        # Update the version file
        print(f"Updating version file to {new_version}")
        with open("alejo/version.py", "w") as f:
            f.write(f'__version__ = "{new_version}"\n')
        
        # Commit the version change
        run_command('git add alejo/version.py')
        run_command(f'git commit -m "Bump version to {new_version}"')
    
    print("\nCommit created successfully!")
    print("\nTo push these changes and trigger the workflow, run:")
    print(f"  git push origin {get_current_branch()}")
    if version_bump:
        print(f"  git push origin {tag_name}")


def main():
    """Main function to parse arguments and create the tagged commit."""
    parser = argparse.ArgumentParser(description="Tag a commit as a major update to trigger the GitHub workflow")
    parser.add_argument("--type", required=True, choices=UPDATE_TYPES.keys(),
                        help="Type of update (feature, security, performance, ux)")
    parser.add_argument("--message", required=True,
                        help="Commit message (without the tag)")
    parser.add_argument("--version-bump", choices=VERSION_BUMPS,
                        help="Optional version bump (patch, minor, major)")
    
    args = parser.parse_args()
    
    # Ensure we're in the project root
    if not os.path.exists("alejo"):
        print("Error: This script must be run from the ALEJO project root directory.")
        sys.exit(1)
    
    # Check if the working directory is clean
    check_clean_working_directory()
    
    # Create the tagged commit
    create_tagged_commit(args.type, args.message, args.version_bump)


if __name__ == "__main__":
    main()
