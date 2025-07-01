import asyncio
import pytest
from datetime import datetime, timedelta

from alejo.service_registry import ServiceRegistry
from alejo.database_manager import DatabaseManager
import secrets  # More secure for cryptographic purposes


class DummyRegistry(ServiceRegistry):
    """A dummy ServiceRegistry subclass for testing purposes."""
    def __init__(self):
        super().__init__(event_bus=None)


@pytest.mark.asyncio
async def test_extended_service_deregistration_and_database_manager():
    """Test that a service is auto-deregistered if not updated within the threshold
    and validate that the DatabaseManager can insert and fetch interactions."""
    # Create dummy registry and register a service
    registry = DummyRegistry()
    await registry.register_service('TestService')

    # Simulate that the service's last update occurred sufficiently in the past
    async with registry._lock:
        registry.services['TestService'] = datetime.now() - timedelta(seconds=120)

    # Check services with an unhealthy threshold of 60 seconds
    await registry.check_services(unhealthy_threshold=60)

    # Verify that the service has been deregistered
    async with registry._lock:
        assert 'TestService' not in registry.services, "Service should be auto-deregistered due to health timeout"

    # Validate DatabaseManager functionality
    # Use in-memory SQLite database for testing
    db = DatabaseManager(db_path=':memory:')

    # Insert an interaction record
    test_data = "Test interaction record"
    db.insert_interaction(test_data)
    interactions = db.fetch_interactions()

    # Assert at least one record exists and the data matches
    assert len(interactions) > 0, "There should be at least one interaction record in the database"
    # Each record is a tuple (id, timestamp, data)
    record_found = any(test_data in record[2] for record in interactions)
    assert record_found, "The inserted interaction data should be found in the database"

    db.close()