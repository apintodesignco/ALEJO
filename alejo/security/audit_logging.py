#!/usr/bin/env python3
"""
ALEJO Audit Logging Module
Provides secure, tamper-evident audit logging capabilities
"""

import os
import json
import time
import logging
import hashlib
import datetime
from typing import Dict, List, Optional, Union, Any, Tuple
from pathlib import Path

logger = logging.getLogger("alejo.security.audit_logging")

class AuditLogger:
    """
    ALEJO Audit Logger for secure, tamper-evident audit logging
    
    This class provides methods for logging security-relevant events with
    tamper-evident features to ensure log integrity.
    """
    
    def __init__(self, config: Dict = None):
        """
        Initialize the audit logger
        
        Args:
            config: Optional configuration dictionary with settings
        """
        self.config = config or {}
        
        # Set up log file path
        self.log_dir = Path(self.config.get("log_dir", "audit_logs"))
        self.log_dir.mkdir(exist_ok=True)
        
        # Current log file and previous hash
        self.current_log_file = None
        self.previous_hash = None
        
        # Configure logging
        self._setup_logging()
        
        # Initialize the log file
        self._initialize_log_file()
        
        logger.info("Audit logger initialized")
    
    def _setup_logging(self):
        """Configure logging for the audit logger"""
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
    
    def _initialize_log_file(self):
        """Initialize a new log file"""
        # Generate a timestamp for the log file name
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create the log file
        self.current_log_file = self.log_dir / f"audit_log_{timestamp}.json"
        self.previous_hash = None
        
        # Write the initial log entry
        initial_entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "event_type": "log_initialized",
            "username": "system",
            "details": {
                "log_file": str(self.current_log_file)
            },
            "previous_hash": None,
            "hash": None
        }
        
        # Calculate the hash for the initial entry
        entry_json = json.dumps(initial_entry, sort_keys=True)
        entry_hash = hashlib.sha256(entry_json.encode()).hexdigest()
        initial_entry["hash"] = entry_hash
        
        # Write the initial entry to the log file
        with open(self.current_log_file, "w") as f:
            json.dump([initial_entry], f, indent=2)
        
        # Update the previous hash
        self.previous_hash = entry_hash
        
        logger.info(f"Initialized audit log file: {self.current_log_file}")
    
    def log_event(self, event_type: str, username: str, details: Dict, level: str = "INFO") -> bool:
        """
        Log a security-relevant event
        
        Args:
            event_type: Type of event (e.g., "login", "access_denied")
            username: Username associated with the event
            details: Additional details about the event
            level: Log level (INFO, WARNING, ERROR)
            
        Returns:
            True if the event was logged successfully, False otherwise
        """
        try:
            # Create the log entry
            entry = {
                "timestamp": datetime.datetime.now().isoformat(),
                "event_type": event_type,
                "username": username,
                "level": level,
                "details": details,
                "previous_hash": self.previous_hash,
                "hash": None
            }
            
            # Calculate the hash for this entry
            entry_json = json.dumps(entry, sort_keys=True)
            entry_hash = hashlib.sha256(entry_json.encode()).hexdigest()
            entry["hash"] = entry_hash
            
            # Read the current log file
            with open(self.current_log_file, "r") as f:
                log_entries = json.load(f)
            
            # Append the new entry
            log_entries.append(entry)
            
            # Write the updated log file
            with open(self.current_log_file, "w") as f:
                json.dump(log_entries, f, indent=2)
            
            # Update the previous hash
            self.previous_hash = entry_hash
            
            # Log to the standard logger as well
            log_message = f"{event_type} by {username}: {json.dumps(details)}"
            if level == "WARNING":
                logger.warning(log_message)
            elif level == "ERROR":
                logger.error(log_message)
            else:
                logger.info(log_message)
            
            return True
            
        except Exception as e:
            logger.error(f"Error logging event: {e}")
            return False
    
    def verify_log_integrity(self, log_file: str = None) -> Tuple[bool, List[Dict]]:
        """
        Verify the integrity of an audit log file
        
        Args:
            log_file: Path to the log file to verify (default: current log file)
            
        Returns:
            Tuple of (integrity_verified, tampered_entries)
        """
        if log_file is None:
            log_file = self.current_log_file
        
        try:
            # Read the log file
            with open(log_file, "r") as f:
                log_entries = json.load(f)
            
            # Verify each entry
            tampered_entries = []
            previous_hash = None
            
            for i, entry in enumerate(log_entries):
                # Check if the previous hash matches
                if entry["previous_hash"] != previous_hash:
                    tampered_entries.append({
                        "index": i,
                        "entry": entry,
                        "reason": "previous_hash_mismatch"
                    })
                
                # Calculate the hash for this entry
                entry_copy = entry.copy()
                entry_copy["hash"] = None
                entry_json = json.dumps(entry_copy, sort_keys=True)
                calculated_hash = hashlib.sha256(entry_json.encode()).hexdigest()
                
                # Check if the hash matches
                if entry["hash"] != calculated_hash:
                    tampered_entries.append({
                        "index": i,
                        "entry": entry,
                        "reason": "hash_mismatch"
                    })
                
                # Update the previous hash
                previous_hash = entry["hash"]
            
            # Return the verification result
            integrity_verified = len(tampered_entries) == 0
            
            if integrity_verified:
                logger.info(f"Log integrity verified for {log_file}")
            else:
                logger.warning(f"Log integrity verification failed for {log_file}: {len(tampered_entries)} tampered entries found")
            
            return (integrity_verified, tampered_entries)
            
        except Exception as e:
            logger.error(f"Error verifying log integrity: {e}")
            return (False, [{"reason": f"verification_error: {e}"}])
    
    def rotate_log(self) -> bool:
        """
        Rotate the audit log file
        
        Returns:
            True if the log was rotated successfully, False otherwise
        """
        try:
            # Verify the integrity of the current log file
            integrity_verified, _ = self.verify_log_integrity()
            
            if not integrity_verified:
                logger.warning("Log integrity verification failed during rotation")
            
            # Initialize a new log file
            self._initialize_log_file()
            
            logger.info("Audit log rotated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error rotating audit log: {e}")
            return False
    
    def get_logs(self, start_time: str = None, end_time: str = None, 
                event_types: List[str] = None, username: str = None) -> List[Dict]:
        """
        Get audit logs filtered by criteria
        
        Args:
            start_time: ISO format start time filter
            end_time: ISO format end time filter
            event_types: List of event types to include
            username: Username filter
            
        Returns:
            List of matching log entries
        """
        try:
            # Read the current log file
            with open(self.current_log_file, "r") as f:
                log_entries = json.load(f)
            
            # Apply filters
            filtered_entries = []
            
            for entry in log_entries:
                # Skip the initialization entry
                if entry["event_type"] == "log_initialized":
                    continue
                
                # Apply start time filter
                if start_time and entry["timestamp"] < start_time:
                    continue
                
                # Apply end time filter
                if end_time and entry["timestamp"] > end_time:
                    continue
                
                # Apply event type filter
                if event_types and entry["event_type"] not in event_types:
                    continue
                
                # Apply username filter
                if username and entry["username"] != username:
                    continue
                
                # Add the entry to the filtered list
                filtered_entries.append(entry)
            
            logger.info(f"Retrieved {len(filtered_entries)} log entries matching filters")
            return filtered_entries
            
        except Exception as e:
            logger.error(f"Error getting logs: {e}")
            return []
    
    def export_logs(self, output_file: str, format_type: str = "json") -> bool:
        """
        Export audit logs to a file
        
        Args:
            output_file: Path to the output file
            format_type: Format type (json or csv)
            
        Returns:
            True if the logs were exported successfully, False otherwise
        """
        try:
            # Read the current log file
            with open(self.current_log_file, "r") as f:
                log_entries = json.load(f)
            
            # Export based on format type
            if format_type.lower() == "json":
                with open(output_file, "w") as f:
                    json.dump(log_entries, f, indent=2)
            
            elif format_type.lower() == "csv":
                import csv
                
                with open(output_file, "w", newline="") as f:
                    writer = csv.writer(f)
                    
                    # Write header
                    writer.writerow(["Timestamp", "Event Type", "Username", "Level", "Details", "Hash"])
                    
                    # Write entries
                    for entry in log_entries:
                        writer.writerow([
                            entry["timestamp"],
                            entry["event_type"],
                            entry["username"],
                            entry.get("level", "INFO"),
                            json.dumps(entry["details"]),
                            entry["hash"]
                        ])
            
            else:
                logger.error(f"Unsupported export format: {format_type}")
                return False
            
            logger.info(f"Exported {len(log_entries)} log entries to {output_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error exporting logs: {e}")
            return False
