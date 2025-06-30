import os
import zipfile


def create_offline_installer(source_dir: str, output_zip: str) -> None:
    """Packages the entire ALEJO project into a self-contained zip file for offline installation."""
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                # Exclude unnecessary files (e.g., .git, __pycache__ directories) if needed
                if '.git' in file_path or '__pycache__' in file_path:
                    continue
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)
    print(f"Offline installer created at {output_zip}")


if __name__ == '__main__':
    # Assume current directory is the project root
    project_root = os.path.abspath('.')
    installer_path = os.path.join(project_root, 'alejo_offline_installer.zip')
    create_offline_installer(project_root, installer_path)
