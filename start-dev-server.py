#!/usr/bin/env python3
"""
Simple Development Server for ALEJO
Uses Python's built-in HTTP server to serve the application
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

# Configuration
PORT = 5173
DIRECTORY = "src"

class ALEJOHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def main():
    # Change to the project directory
    project_dir = Path(__file__).parent
    os.chdir(project_dir)
    
    # Check if src directory exists
    if not os.path.exists(DIRECTORY):
        print(f"❌ Error: {DIRECTORY} directory not found!")
        print(f"Current directory: {os.getcwd()}")
        sys.exit(1)
    
    # Create the server
    with socketserver.TCPServer(("", PORT), ALEJOHTTPRequestHandler) as httpd:
        print(f"🚀 ALEJO Development Server starting...")
        print(f"📁 Serving files from: {os.path.abspath(DIRECTORY)}")
        print(f"🌐 Server running at: http://localhost:{PORT}")
        print(f"🔧 Press Ctrl+C to stop the server")
        
        # Open browser automatically
        webbrowser.open(f"http://localhost:{PORT}")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Shutting down ALEJO Development Server...")
            httpd.shutdown()

if __name__ == "__main__":
    main()
