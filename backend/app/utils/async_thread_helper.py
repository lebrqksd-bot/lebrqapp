"""
Utility for safely running async operations in background threads.

This prevents memory leaks from creating new event loops in threads.
Uses asyncio.run() which is safer than creating new event loops manually.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Callable, Any
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


def run_async_in_thread(async_func: Callable, *args, **kwargs) -> None:
    """
    Safely run an async function in a background thread.
    
    Uses asyncio.run() which properly creates and cleans up the event loop.
    This is safer than manually creating event loops with new_event_loop().
    
    Args:
        async_func: Async function to run
        *args: Positional arguments for async_func
        **kwargs: Keyword arguments for async_func
    
    Example:
        def send_email_in_background():
            run_async_in_thread(send_email_async, to="user@example.com")
        
        thread = threading.Thread(target=send_email_in_background, daemon=True)
        thread.start()
    """
    try:
        # asyncio.run() creates a new event loop, runs the coroutine, and cleans up
        # This is the recommended way to run async code in threads
        asyncio.run(async_func(*args, **kwargs))
    except Exception as e:
        logger.error(f"Error running async function in thread: {e}", exc_info=True)


def run_async_in_thread_pool(
    thread_pool: ThreadPoolExecutor,
    async_func: Callable,
    *args,
    **kwargs
) -> None:
    """
    Run an async function in a thread pool executor.
    
    This is more efficient than creating new threads for each operation.
    Use the shared thread pool from app.state.thread_pool.
    
    Args:
        thread_pool: ThreadPoolExecutor instance
        async_func: Async function to run
        *args: Positional arguments for async_func
        **kwargs: Keyword arguments for async_func
    """
    def run_in_thread():
        run_async_in_thread(async_func, *args, **kwargs)
    
    thread_pool.submit(run_in_thread)

