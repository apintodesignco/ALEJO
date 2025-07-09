"""
Simple HTTP server for the ALEJO performance dashboard demo.
"""

import http.server
import socketserver
import os
import mimetypes
import sys
from pathlib import Path

# Default port
PORT = 8080

# Get the directory of this script
SCRIPT_DIR = Path(__file__).parent.absolute()

# Custom request handler
class DashboardRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Set the directory to serve files from
        super().__init__(*args, directory=str(SCRIPT_DIR), **kwargs)
    
    def do_GET(self):
        # If the path is '/', serve the dashboard demo
        if self.path == '/':
            self.path = '/dashboard-demo.html'
        
        # Try to serve the file
        try:
            return super().do_GET()
        except Exception as e:
            # If there's an error, serve the 404 page
            self.send_error(404, "File not found")
            return
    
    def send_error(self, code, message=None):
        # Custom error handling to serve our 404 page
        if code == 404:
            try:
                # Try to serve our custom 404 page
                self.send_response(404)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                with open(os.path.join(SCRIPT_DIR, '404.html'), 'rb') as f:
                    self.wfile.write(f.read())
            except:
                # Fall back to default error handling
                super().send_error(code, message)
        else:
            super().send_error(code, message)

def run_server():
    # Register common MIME types
    mimetypes.add_type('text/javascript', '.js')
    mimetypes.add_type('text/css', '.css')
    
    # Create the server
    handler = DashboardRequestHandler
    httpd = socketserver.TCPServer(("", PORT), handler)
    
    print(f"Server running at http://localhost:{PORT}/")
    print(f"Open http://localhost:{PORT}/dashboard-demo.html to view the performance dashboard demo")
    print("Press Ctrl+C to stop the server")
    
    try:
        # Start the server
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()
        print("Server stopped")
        sys.exit(0)

if __name__ == "__main__":
    run_server()
