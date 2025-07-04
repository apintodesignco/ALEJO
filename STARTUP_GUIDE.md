# ALEJO Startup Guide

## Introduction

ALEJO (Advanced Language and Execution Joint Operator) is designed with an extraordinary, futuristic startup experience featuring a powerful half-human, half-machine awakening sequence with synchronized audio-visual effects. This guide explains the multiple ways to start ALEJO and customize your experience.

## Startup Methods

### 1. One-Click Batch File (Recommended for Most Users)

The simplest way to start ALEJO is by double-clicking the `Start_ALEJO.bat` file. This will:

- Automatically request administrator privileges
- Run the full startup sequence with visual and audio effects
- Create desktop shortcuts if they don't exist
- Download the high-quality ALEJO icon if needed
- Generate the startup sound if needed
- Launch ALEJO with optimized settings

### 2. PowerShell Script (Advanced Users)

For more control, you can use the PowerShell script:

```powershell
.\Start-ALEJO.ps1
```text

This script provides the same functionality as the batch file but with more detailed output and error handling.

### 3. Voice Activation

ALEJO can be started using voice commands:

#### Using Windows Speech Recognition:

1. Run the `enable_voice_commands.reg` file once to register ALEJO with Windows Speech Recognition
2. Start Windows Speech Recognition (Win+H or search for "Speech Recognition")
3. Say any of these wake phrases:
   - "Wake up ALEJO"
   - "Hey ALEJO"
   - "Start ALEJO"
   - "Hello ALEJO"

#### Using ALEJO's Built-in Voice Recognition:

1. Run `wake_alejo.py` to start the background listener
2. Say "Wake up, ALEJO" or any configured wake phrase
3. The system will automatically start ALEJO with the full startup sequence

### 4. Gesture Recognition

ALEJO can be activated using specific gestures:

1. Run `wake_alejo.py` to start the gesture recognition system
2. Perform one of the following gestures in front of your webcam:
   - Eye rubbing gesture (rub eyes with hands)
   - Waving gesture (wave hand in front of camera)

### 5. System Tray Icon

Once `wake_alejo.py` is running:

1. Look for the ALEJO icon in your system tray
2. Right-click the icon to see options
3. Select "Start ALEJO" from the menu

### 6. Command Line (For Developers)

For maximum control, you can start ALEJO directly from the command line:

```bash
python run_alejo_optimized.py [options]
```text

Available options:

- `--port PORT`: Specify the port number (default: 8000)
- `--host HOST`: Specify the host (default: 127.0.0.1)
- `--debug`: Enable debug mode
- `--no-browser`: Don't open browser automatically
- `--optimize-resources`: Clean up redundant processes
- `--enable-comfort`: Enable comfort features
- `--skip-startup`: Skip the startup sequence
- `--create-shortcut`: Create desktop shortcut
- `--add-to-startup`: Add ALEJO to Windows startup

## Startup Sequence

The default startup sequence includes:

1. A futuristic half-human, half-machine awakening animation
2. Custom-generated startup sound that combines mechanical and organic elements
3. System status checks and resource optimization
4. Automatic privilege elevation (on Windows)
5. Icon and resource preparation

## Customization

### Modifying the Startup Sound

The startup sound is generated using `assets/create_startup_sound.py`. You can customize it by modifying this script and regenerating the sound:

```bash
python assets/create_startup_sound.py --duration 6.0
```text

### Changing the Icon

ALEJO automatically downloads a high-quality half-human, half-robot face icon. To use a custom icon:

1. Replace `assets/alejo_icon.ico` with your preferred icon
2. Ensure it's in ICO format for best compatibility

## Troubleshooting

### ALEJO Won't Start

- Ensure Python 3.8+ is installed and in your PATH
- Check that all dependencies are installed (`pip install -r requirements.txt`)
- Try running with administrator privileges
- Check the logs in the `logs` directory

### Voice or Gesture Recognition Not Working

- Ensure your microphone/webcam is properly connected and has permissions
- Check that required dependencies are installed (SpeechRecognition, OpenCV, MediaPipe)
- Try running `wake_alejo.py` directly to see detailed error messages

### Registry Script Not Working

- Ensure you're running the registry script as an administrator
- Verify that Windows Speech Recognition is properly installed on your system
- Restart your computer after installing the registry entries

## Security Notes

- ALEJO requires administrator privileges for full functionality
- The icon download feature requires internet access
- All startup methods are designed to be secure and transparent
