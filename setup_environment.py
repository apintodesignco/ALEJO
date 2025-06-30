import os
import sys
import subprocess
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_command(command, cwd=None):
    try:
        result = subprocess.run(command, shell=True, check=True, text=True, capture_output=True, cwd=cwd)
        logger.info(f"Command '{command}' executed successfully")
        logger.info(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Error executing command '{command}': {e}")
        logger.error(e.stderr)
        return False

def setup_environment():
    logger.info("Setting up ALEJO project environment...")
    if 'ALEJO_ENV' not in os.environ:
        os.environ['ALEJO_ENV'] = 'development'
        logger.info("ALEJO_ENV set to development")
    project_root = os.path.abspath(os.path.dirname(__file__))
    
    # Step 1: Create or activate virtual environment
    venv_path = os.path.join(project_root, '.venv')
    if not os.path.exists(venv_path):
        logger.info("Creating virtual environment...")
        run_command(f"{sys.executable} -m venv {venv_path}")
    
    # Step 2: Install dependencies from requirements.txt if it exists
    requirements_path = os.path.join(project_root, 'requirements.txt')
    if os.path.exists(requirements_path):
        logger.info("Installing dependencies from requirements.txt...")
        if sys.platform == 'win32':
            pip_path = os.path.join(venv_path, 'Scripts', 'pip.exe')
        else:
            pip_path = os.path.join(venv_path, 'bin', 'pip')
        run_command(f"{pip_path} install -r {requirements_path}")
    else:
        logger.warning("requirements.txt not found. Skipping dependency installation.")
    
    # Step 3: Install additional required packages
    logger.info("Installing additional required packages...")
    run_command(f"{pip_path} install fastapi uvicorn requests psutil clip-by-openai")
    
    # Step 4: Verify project structure
    logger.info("Verifying project structure...")
    expected_dirs = [
        os.path.join(project_root, 'alejo'),
        os.path.join(project_root, 'alejo', 'brain'),
        os.path.join(project_root, 'alejo', 'emotional_intelligence'),
        os.path.join(project_root, 'alejo', 'services'),
        os.path.join(project_root, 'alejo', 'utils')
    ]
    for dir_path in expected_dirs:
        if not os.path.exists(dir_path):
            logger.warning(f"Expected directory {dir_path} not found. Creating it.")
            os.makedirs(dir_path, exist_ok=True)
    
    logger.info("Environment setup completed. You should now be able to run the services.")

if __name__ == '__main__':
    setup_environment()
