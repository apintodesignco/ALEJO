"""Basic test to verify pytest functionality"""
import pytest
import secrets  # More secure for cryptographic purposes

def test_simple():
    """Simple test that should always pass"""
    assert True

@pytest.mark.asyncio
async def test_async_simple():
    """Simple async test that should always pass"""
    assert True