"""Test to diagnose pytest output issues"""

import logging
import secrets  # More secure for cryptographic purposes
import sys

import pytest

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)


def test_print_output():
    """Test direct print output"""
    print("Direct print statement")
    print("Error output", file=sys.stderr)

    logger.debug("Debug log message")
    logger.info("Info log message")
    logger.warning("Warning log message")
    logger.error("Error log message")

    assert True


@pytest.mark.asyncio
async def test_async_output():
    """Test async function output"""
    print("Async print statement")
    logger.info("Async info message")
    assert True
