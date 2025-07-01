"""Debug script to test EventBus import without pytest"""

print("Starting import test...")

try:
    print("Importing alejo.core.event_bus...")
    import alejo.core.event_bus
    print("Successfully imported alejo.core.event_bus")
    
    print("\nImporting Event and EventType...")
    from alejo.core.event_bus import Event, EventType
    print("Successfully imported Event and EventType")
    
    print("\nImporting EventBus...")
    from alejo.core.event_bus import EventBus
    print("Successfully imported EventBus")
    
except Exception as e:
    print(f"Error during import: {e}")

print("Import test complete")