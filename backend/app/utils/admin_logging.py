"""
Admin operation logging and error tracking.
Helps track and diagnose issues with admin update operations.
"""

import logging
import traceback
from typing import Any, Callable, Optional, TypeVar, Union
from functools import wraps
from fastapi import HTTPException, status
from datetime import datetime

logger = logging.getLogger(__name__)

# Type variable for async functions
F = TypeVar('F', bound=Callable[..., Any])


def log_admin_operation(operation_type: str, resource_id: Optional[Union[int, str]] = None):
    """
    Decorator to log admin update operations.
    
    Args:
        operation_type: Type of operation (e.g., 'update_space', 'update_vendor')
        resource_id: Optional resource identifier
    
    Usage:
        @log_admin_operation('update_space')
        async def update_space(space_id: int, payload: SpaceUpdate, session: AsyncSession = Depends(get_session)):
            ...
    """
    def decorator(func: F) -> F:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            start_time = datetime.utcnow()
            resource_str = f" [{resource_id}]" if resource_id else ""
            log_prefix = f"[AdminOp: {operation_type}{resource_str}]"
            
            try:
                logger.info(f"{log_prefix} Starting operation")
                result = await func(*args, **kwargs)
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                logger.info(f"{log_prefix} Completed successfully in {elapsed:.2f}s")
                return result
                
            except HTTPException as http_exc:
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                logger.warning(
                    f"{log_prefix} HTTP Exception (status={http_exc.status_code}): {http_exc.detail} "
                    f"(elapsed: {elapsed:.2f}s)"
                )
                raise
                
            except Exception as exc:
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                logger.error(
                    f"{log_prefix} Unhandled exception in {elapsed:.2f}s: {type(exc).__name__}: {str(exc)}\n"
                    f"{traceback.format_exc()}"
                )
                # Re-raise as 500 Internal Server Error
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to {operation_type.replace('_', ' ')}"
                )
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            start_time = datetime.utcnow()
            resource_str = f" [{resource_id}]" if resource_id else ""
            log_prefix = f"[AdminOp: {operation_type}{resource_str}]"
            
            try:
                logger.info(f"{log_prefix} Starting operation")
                result = func(*args, **kwargs)
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                logger.info(f"{log_prefix} Completed successfully in {elapsed:.2f}s")
                return result
                
            except HTTPException as http_exc:
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                logger.warning(
                    f"{log_prefix} HTTP Exception (status={http_exc.status_code}): {http_exc.detail} "
                    f"(elapsed: {elapsed:.2f}s)"
                )
                raise
                
            except Exception as exc:
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                logger.error(
                    f"{log_prefix} Unhandled exception in {elapsed:.2f}s: {type(exc).__name__}: {str(exc)}\n"
                    f"{traceback.format_exc()}"
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to {operation_type.replace('_', ' ')}"
                )
        
        # Return appropriate wrapper based on whether func is async
        if hasattr(func, '__call__') and (
            hasattr(func, '_is_coroutine') or 
            str(func).find('coroutine') > -1
        ):
            return async_wrapper  # type: ignore
        else:
            # Try to detect if async by inspection
            import inspect
            if inspect.iscoroutinefunction(func):
                return async_wrapper  # type: ignore
            else:
                return sync_wrapper  # type: ignore
    
    return decorator


def track_pool_exhaustion(func: F) -> F:
    """
    Decorator to track if operation appears to cause pool exhaustion.
    Logs warnings if pool appears saturated during or after operation.
    """
    @wraps(func)
    async def async_wrapper(*args, **kwargs) -> Any:
        import asyncio
        try:
            # Get pool info before operation
            from app.db import engine
            sync_engine = engine.sync_engine if hasattr(engine, 'sync_engine') else engine
            pool = sync_engine.pool if hasattr(sync_engine, 'pool') else None
            
            before_checked_out = None
            if pool and hasattr(pool, 'checkedout'):
                before_checked_out = pool.checkedout()
            
            # Run operation
            result = await func(*args, **kwargs)
            
            # Check pool after operation
            if pool and hasattr(pool, 'checkedout'):
                after_checked_out = pool.checkedout()
                if after_checked_out and after_checked_out > 8:  # More than 80% of 10 total
                    logger.warning(
                        f"[PoolWarning] High saturation after operation: "
                        f"{after_checked_out} connections checked out"
                    )
            
            return result
            
        except Exception as exc:
            logger.error(f"[PoolTracking] Error during operation tracking: {exc}")
            raise
    
    import inspect
    if inspect.iscoroutinefunction(func):
        return async_wrapper  # type: ignore
    else:
        return func  # type: ignore
    
    return func  # type: ignore


def log_admin_batch_operation(operation_type: str):
    """
    Decorator for batch operations (e.g., bulk delete, bulk update).
    Tracks count of affected resources and potential cascading issues.
    """
    def decorator(func: F) -> F:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            start_time = datetime.utcnow()
            log_prefix = f"[AdminBatch: {operation_type}]"
            
            try:
                logger.info(f"{log_prefix} Starting batch operation")
                result = await func(*args, **kwargs)
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                
                # Extract count from result if available
                count_str = ""
                if isinstance(result, dict) and 'count' in result:
                    count_str = f" ({result['count']} resources affected)"
                
                logger.info(f"{log_prefix} Completed{count_str} in {elapsed:.2f}s")
                return result
                
            except Exception as exc:
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                logger.error(
                    f"{log_prefix} Failed in {elapsed:.2f}s: {type(exc).__name__}: {str(exc)}"
                )
                raise
        
        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper  # type: ignore
        else:
            return func  # type: ignore
    
    return decorator
