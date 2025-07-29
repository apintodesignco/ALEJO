import subprocess
import sys

def main():
    """
    Runs `safety check` to find known security vulnerabilities in dependencies.
    """
    print("--- Running Security Scan ---")
    try:
        # Using sys.executable ensures we use the same python interpreter
        # that is running this script.
        command = [sys.executable, "-m", "safety", "check"]
        
        print(f"Executing command: {' '.join(command)}")
        
        # We use check=True to automatically raise an exception on non-zero exit codes,
        # which `safety` uses to indicate found vulnerabilities.
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        print(result.stdout)
        print("\nSecurity scan completed. No vulnerabilities found.")
        sys.exit(0)

    except FileNotFoundError:
        print("Error: 'safety' is not installed or not in PATH.", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        # `safety` exits with a non-zero code when vulnerabilities are found.
        # The output of the command will contain the report.
        print("\nSecurity scan found vulnerabilities:", file=sys.stderr)
        print(e.stdout, file=sys.stdout)
        print(e.stderr, file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
