import os
import sys
from pathlib import Path

def main():
    project_root = Path(__file__).parent.parent
    sys.path.insert(0, str(project_root))
    
    alejo_src = project_root / "alejo"
    print(f"--- Starting Import Diagnosis for ALEJO ---")
    print(f"Scanning for Python files in: {alejo_src}")

    for root, _, files in os.walk(alejo_src):
        for file in files:
            if file.endswith(".py"):
                file_path = Path(root) / file
                
                # Convert file path to a Python module path
                relative_path = file_path.relative_to(project_root)
                module_path = str(relative_path).replace(os.sep, ".")[:-3] # remove .py

                print(f"Attempting to import: {module_path}...", end="", flush=True)
                try:
                    __import__(module_path)
                    print(" OK")
                except Exception as e:
                    print(f" FAILED: {e}")

    print("--- Import Diagnosis Complete ---")

if __name__ == "__main__":
    main()
