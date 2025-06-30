"""Basic test to verify pytest functionality"""
import pytest

def test_simple():
    """Simple test that should always pass"""
    assert True

@pytest.mark.asyncio
async def test_async_simple():
    """Simple async test that should always pass"""
    assert True
