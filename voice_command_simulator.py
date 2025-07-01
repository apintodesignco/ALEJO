#!/usr/bin/env python
"""
ALEJO Voice Command Simulator
This script provides a simple GUI to simulate voice commands for testing ALEJO
without requiring actual voice input
"""

import sys
import os
import logging
from dotenv import load_dotenv
import tkinter as tk
from tkinter import scrolledtext, ttk
from threading import Thread

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("voice_simulator")

# Load environment variables
load_dotenv()

# Add the project root to the path if needed
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import ALEJO modules
try:
    from alejo.brain.alejo_brain import ALEJOBrain
except ImportError as e:
    logger.error(f"Import error: {e}")
    sys.exit(1)

class VoiceCommandSimulator:
    """GUI for simulating voice commands to ALEJO"""
    
    def __init__(self, root):
        """Initialize the simulator GUI"""
        self.root = root
        self.root.title("ALEJO Voice Command Simulator")
        self.root.geometry("800x600")
        self.root.minsize(600, 400)
        
        # Initialize ALEJO brain
        self.brain = ALEJOBrain()
        
        # Check if command processor is available
        if hasattr(self.brain, 'command_processor') and self.brain.command_processor:
            logger.info("Command processor initialized successfully")
            self.has_command_processor = True
        else:
            logger.warning("Command processor not available")
            self.has_command_processor = False
        
        # Create GUI elements
        self._create_widgets()
        
        # Add example commands
        self._add_example_commands()
        
        logger.info("Voice command simulator initialized")
    
    def _create_widgets(self):
        """Create the GUI widgets"""
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title
        title_label = ttk.Label(main_frame, text="ALEJO Voice Command Simulator", 
                              font=("Arial", 16, "bold"))
        title_label.pack(pady=10)
        
        # Status indicator
        status_frame = ttk.Frame(main_frame)
        status_frame.pack(fill=tk.X, pady=5)
        
        status_label = ttk.Label(status_frame, text="Status:")
        status_label.pack(side=tk.LEFT, padx=5)
        
        self.status_indicator = ttk.Label(status_frame, 
                                        text="Ready" if self.has_command_processor else "Command Processor Not Available",
                                        foreground="green" if self.has_command_processor else "red")
        self.status_indicator.pack(side=tk.LEFT)
        
        # Command input
        input_frame = ttk.Frame(main_frame)
        input_frame.pack(fill=tk.X, pady=10)
        
        wake_word_label = ttk.Label(input_frame, text="Wake Word:")
        wake_word_label.pack(side=tk.LEFT, padx=5)
        
        self.wake_word_var = tk.StringVar(value="alejo")
        wake_word_entry = ttk.Entry(input_frame, textvariable=self.wake_word_var, width=10)
        wake_word_entry.pack(side=tk.LEFT, padx=5)
        
        command_label = ttk.Label(input_frame, text="Command:")
        command_label.pack(side=tk.LEFT, padx=5)
        
        self.command_var = tk.StringVar()
        command_entry = ttk.Entry(input_frame, textvariable=self.command_var, width=40)
        command_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        command_entry.bind("<Return>", self._on_send)
        
        send_button = ttk.Button(input_frame, text="Send", command=self._on_send)
        send_button.pack(side=tk.RIGHT, padx=5)
        
        # Example commands dropdown
        example_frame = ttk.Frame(main_frame)
        example_frame.pack(fill=tk.X, pady=5)
        
        example_label = ttk.Label(example_frame, text="Example Commands:")
        example_label.pack(side=tk.LEFT, padx=5)
        
        self.example_var = tk.StringVar()
        self.example_dropdown = ttk.Combobox(example_frame, textvariable=self.example_var, width=50)
        self.example_dropdown.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        self.example_dropdown.bind("<<ComboboxSelected>>", self._on_example_selected)
        
        use_example_button = ttk.Button(example_frame, text="Use", command=self._on_use_example)
        use_example_button.pack(side=tk.RIGHT, padx=5)
        
        # Conversation log
        log_frame = ttk.LabelFrame(main_frame, text="Conversation Log")
        log_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, wrap=tk.WORD, width=70, height=20)
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.log_text.config(state=tk.DISABLED)
        
        # Clear button
        clear_button = ttk.Button(main_frame, text="Clear Log", command=self._clear_log)
        clear_button.pack(pady=5)
    
    def _add_example_commands(self):
        """Add example commands to the dropdown"""
        examples = [
            "open website youtube.com",
            "search for cute cat videos",
            "play video how to make pasta",
            "take screenshot",
            "check system",
            "create file test.txt",
            "edit file test.txt",
            "open file test.txt",
            "rename file test.txt to new_test.txt",
            "edit image screenshot.png",
            "what time is it",
            "tell me about artificial intelligence",
            "open youtube and search for cooking tutorials",
            "can you show me some funny videos"
        ]
        self.example_dropdown['values'] = examples
    
    def _on_example_selected(self, event):
        """Handle example selection"""
        self.command_var.set(self.example_var.get())
    
    def _on_use_example(self):
        """Use the selected example"""
        self.command_var.set(self.example_var.get())
        self._on_send()
    
    def _on_send(self, event=None):
        """Handle sending a command"""
        wake_word = self.wake_word_var.get().strip().lower()
        command = self.command_var.get().strip()
        
        if not command:
            return
        
        # Format the full command with wake word
        full_command = f"{wake_word} {command}"
        
        # Log the user command
        self._add_to_log(f"You: {full_command}", "blue")
        
        # Process in a separate thread to keep UI responsive
        Thread(target=self._process_command, args=(command,)).start()
        
        # Clear the command entry
        self.command_var.set("")
    
    def _process_command(self, command):
        """Process the command and update the log"""
        try:
            # Process the command
            response = self.brain.process_command(command)
            
            # Log the response
            self._add_to_log(f"ALEJO: {response}", "green")
            
        except Exception as e:
            logger.error(f"Error processing command: {e}")
            self._add_to_log(f"Error: {str(e)}", "red")
    
    def _add_to_log(self, message, color="black"):
        """Add a message to the log"""
        def _update():
            self.log_text.config(state=tk.NORMAL)
            self.log_text.insert(tk.END, message + "\n\n", color)
            self.log_text.tag_config(color, foreground=color)
            self.log_text.see(tk.END)
            self.log_text.config(state=tk.DISABLED)
        
        # Update in the main thread
        self.root.after(0, _update)
    
    def _clear_log(self):
        """Clear the conversation log"""
        self.log_text.config(state=tk.NORMAL)
        self.log_text.delete(1.0, tk.END)
        self.log_text.config(state=tk.DISABLED)

def main():
    """Main function"""
    root = tk.Tk()
    app = VoiceCommandSimulator(root)
    root.mainloop()

if __name__ == "__main__":
    main()