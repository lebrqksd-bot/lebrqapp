"""
Shared thread pool utility for background tasks.
This prevents thread exhaustion by reusing a limited pool of threads
instead of creating unlimited threads.
"""
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
import logging

# Global thread pool executor (initialized in core.py)
_thread_pool: Optional[ThreadPoolExecutor] = None

def get_thread_pool() -> Optional[ThreadPoolExecutor]:
    """Get the shared thread pool executor"""
    return _thread_pool

def set_thread_pool(pool: ThreadPoolExecutor):
    """Set the shared thread pool executor (called from core.py)"""
    global _thread_pool
    _thread_pool = pool

def submit_task(func, *args, **kwargs):
    """
    Submit a task to the shared thread pool.
    Falls back to creating a new thread if pool is not available.
    
    Args:
        func: Function to execute in thread
        *args: Positional arguments for func
        **kwargs: Keyword arguments for func
    
    Returns:
        Future object (can be ignored for fire-and-forget tasks)
    """
    pool = get_thread_pool()
    if pool:
        try:
            return pool.submit(func, *args, **kwargs)
        except RuntimeError as e:
            # Pool might be shutting down
            logging.warning(f"[ThreadPool] Error submitting task: {e}, falling back to direct thread")
            import threading
            thread = threading.Thread(target=func, args=args, kwargs=kwargs, daemon=True)
            thread.start()
            return None
    else:
        # Fallback: create thread directly if pool not available
        logging.warning("[ThreadPool] Thread pool not available, creating direct thread")
        import threading
        thread = threading.Thread(target=func, args=args, kwargs=kwargs, daemon=True)
        thread.start()
        return None

