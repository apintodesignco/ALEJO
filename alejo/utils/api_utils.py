"""
ALEJO API Utilities Module
Provides enhanced API handling capabilities with rate limiting protection and retry logic.
"""

import time
import logging
import random
import functools
import threading
from typing import Callable, Any, Dict, Optional

# Try to import our custom logging utilities
try:
    from alejo.utils.logging_utils import get_logger
    logger = get_logger('alejo.api_utils')
except ImportError:
    # Fall back to standard logging if the module isn't available
    logger = logging.getLogger('alejo.api_utils')

class RateLimitError(Exception):
    """Exception raised when API rate limits are exceeded."""
    pass

def retry_with_exponential_backoff(
    max_retries: int = 5,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    backoff_factor: float = 2.0,
    jitter: bool = True,
    retry_on: tuple = None
) -> Callable:
    # Default retry exceptions if none provided
    if retry_on is None:
        # Default to generic exceptions for broader compatibility
        retry_on = (TimeoutError, ConnectionError, RateLimitError)
    """
    Decorator that retries a function with exponential backoff when specific exceptions occur.
    
    Args:
        max_retries: Maximum number of retries before giving up
        initial_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        backoff_factor: Factor by which the delay increases with each retry
        jitter: Whether to add random jitter to the delay
        retry_on: Tuple of exception types to retry on
        
    Returns:
        Decorated function with retry logic
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            delay = initial_delay
            num_retries = 0
            
            while True:
                try:
                    # Get provider from kwargs or use default
                    provider = kwargs.pop('provider', 'default')
                    
                    # Get appropriate rate limiter
                    limiter = default_rate_limiters.get(
                        provider,
                        default_rate_limiters['default']
                    )
                    
                    # Check if we can make the request
                    if not limiter.acquire(tokens=1):
                        raise RateLimitError(f"API rate limit exceeded for provider {provider}")
                    
                    return func(*args, **kwargs)
                except retry_on as e:
                    num_retries += 1
                    if num_retries > max_retries:
                        logger.error(f"Maximum retries ({max_retries}) exceeded for {func.__name__}: {e}")
                        raise
                    
                    # Calculate next delay with optional jitter
                    if jitter:
                        delay_with_jitter = delay * (0.5 + random.random())
                    else:
                        delay_with_jitter = delay
                    
                    # Cap the delay at max_delay
                    actual_delay = min(delay_with_jitter, max_delay)
                    
                    logger.warning(
                        f"Retry {num_retries}/{max_retries} for {func.__name__} after {actual_delay:.2f}s due to: {e}"
                    )
                    
                    # Wait before retrying
                    time.sleep(actual_delay)
                    
                    # Increase delay for next potential retry
                    delay = min(delay * backoff_factor, max_delay)
        
        return wrapper
    
    return decorator

class APIRateLimiter:
    """
    Rate limiter for API calls to prevent hitting rate limits.
    Uses a token bucket algorithm to manage request rates.
    """
    
    def __init__(
        self, 
        requests_per_minute: int = 60,
        burst_limit: int = 10,
        initial_tokens: Optional[int] = None
    ):
        """
        Initialize the rate limiter.
        
        Args:
            requests_per_minute: Maximum number of requests allowed per minute
            burst_limit: Maximum number of requests allowed in a burst
            initial_tokens: Initial number of tokens (defaults to burst_limit)
        """
        self.requests_per_minute = requests_per_minute
        self.burst_limit = burst_limit
        self.tokens = initial_tokens if initial_tokens is not None else burst_limit
        self.token_refresh_rate = requests_per_minute / 60.0  # tokens per second
        self.last_refresh_time = time.time()
        self.lock = threading.Lock()
    
    def _refresh_tokens(self) -> None:
        """Refresh tokens based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_refresh_time
        new_tokens = elapsed * self.token_refresh_rate
        
        self.tokens = min(self.tokens + new_tokens, self.burst_limit)
        self.last_refresh_time = now
    
    def acquire(self, tokens: int = 1, block: bool = True, timeout: Optional[float] = None) -> bool:
        """
        Acquire tokens from the bucket.
        
        Args:
            tokens: Number of tokens to acquire
            block: Whether to block until tokens are available
            timeout: Maximum time to wait for tokens
            
        Returns:
            True if tokens were acquired, False otherwise
            
        Raises:
            RateLimitError: If tokens could not be acquired and block is False
        """
        start_time = time.time()
        
        with self.lock:
            while True:
                self._refresh_tokens()
                
                if self.tokens >= tokens:
                    self.tokens -= tokens
                    return True
                
                if not block:
                    raise RateLimitError(f"Rate limit exceeded: needed {tokens} tokens but only had {self.tokens}")
                
                if timeout is not None and time.time() - start_time > timeout:
                    return False
                
                # Calculate time to wait for enough tokens
                wait_time = (tokens - self.tokens) / self.token_refresh_rate
                wait_time = max(0.1, min(wait_time, 1.0))  # Wait between 0.1 and 1 second
                
                # Release lock while waiting
                self.lock.release()
                try:
                    time.sleep(wait_time)
                finally:
                    self.lock.acquire()

# Create default rate limiters for different providers
default_rate_limiters = {
    'openai': APIRateLimiter(
        requests_per_minute=50,  # Conservative limit for OpenAI
        burst_limit=10
    ),
    'ollama': APIRateLimiter(
        requests_per_minute=120,  # Higher limit for local Ollama
        burst_limit=20
    ),
    'default': APIRateLimiter(
        requests_per_minute=60,  # Default conservative limit
        burst_limit=10
    )
}

def rate_limited_api_call(rate_limiter=None, tokens=1):
    """
    Decorator to apply rate limiting to API calls.
    
    Args:
        rate_limiter: Rate limiter to use (defaults to openai_rate_limiter)
        tokens: Number of tokens to consume per call
        
    Returns:
        Decorated function with rate limiting
    """
    if rate_limiter is None:
        rate_limiter = openai_rate_limiter
        
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                rate_limiter.acquire(tokens=tokens)
                return func(*args, **kwargs)
            except RateLimitError as e:
                logger.warning(f"Rate limit exceeded for {func.__name__}: {e}")
                raise
        return wrapper
    return decorator
