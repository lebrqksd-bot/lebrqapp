from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from app.db import get_session, engine
import logging

router = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/health")
async def health():
    """Basic health check - always returns ok"""
    return {"status": "ok"}


@router.get("/health/detailed")
async def health_detailed():
    """
    Detailed health check including database connectivity
    Useful for diagnosing 500 errors on deployed stage
    """
    health_status = {
        "status": "ok",
        "checks": {
            "api": "ok",
            "database": "unknown"
        }
    }
    
    # Test database connectivity
    try:
        async for session in get_session():
            result = await session.execute(text("SELECT 1"))
            result.scalar()
            health_status["checks"]["database"] = "ok"
            break
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}", exc_info=True)
        health_status["status"] = "degraded"
        health_status["checks"]["database"] = f"error: {str(e)}"
        health_status["error"] = {
            "type": type(e).__name__,
            "message": str(e)
        }
    
    # Return appropriate status code
    if health_status["status"] == "ok":
        return health_status
    else:
        raise HTTPException(status_code=503, detail=health_status)


@router.get("/health/memory")
async def get_memory_stats():
    """
    Get current memory usage statistics.
    Useful for monitoring memory protection middleware effectiveness.
    """
    try:
        import psutil
        mem = psutil.virtual_memory()
        return {
            "total_gb": round(mem.total / (1024 ** 3), 2),
            "available_gb": round(mem.available / (1024 ** 3), 2),
            "used_percent": round(mem.percent, 2),
            "used_gb": round(mem.used / (1024 ** 3), 2),
            "threshold_percent": 85.0,
            "critical_percent": 90.0,
            "status": (
                "ok" if mem.percent < 85 
                else "warning" if mem.percent < 90 
                else "critical"
            ),
            "message": (
                "Memory usage is normal" if mem.percent < 85
                else "Memory usage is high" if mem.percent < 90
                else "Memory usage is critical"
            )
        }
    except ImportError:
        return {
            "error": "psutil not installed",
            "message": "Install psutil to enable memory monitoring"
        }
    except Exception as e:
        logger.error(f"Memory stats error: {e}", exc_info=True)
        return {
            "error": str(e),
            "message": "Failed to get memory stats"
        }


@router.get("/health/pool")
async def get_pool_diagnostics():
    """
    Get database connection pool diagnostics.
    Monitors connection pool saturation to detect exhaustion issues early.
    """
    try:
        # Get the sync engine's pool (async engine wraps sync engine)
        sync_engine = engine.sync_engine if hasattr(engine, 'sync_engine') else engine
        pool = sync_engine.pool if hasattr(sync_engine, 'pool') else None
        
        if pool is None:
            return {
                "status": "unavailable",
                "message": "Connection pool not accessible",
                "pool_type": type(engine).__name__
            }
        
        # Get pool statistics (available for QueuePool)
        checked_out = pool.checkedout() if hasattr(pool, 'checkedout') else None
        pool_size = pool.size() if hasattr(pool, 'size') else None
        overflow = pool.overflow() if hasattr(pool, 'overflow') else None
        
        # Calculate saturation
        total_capacity = (pool.pool_size if hasattr(pool, 'pool_size') else 0) + \
                        (pool.max_overflow if hasattr(pool, 'max_overflow') else 0)
        
        if checked_out is not None and total_capacity > 0:
            saturation_percent = (checked_out / total_capacity) * 100
        else:
            saturation_percent = None
        
        # Determine health status
        status = "ok"
        warning = None
        if saturation_percent is not None:
            if saturation_percent >= 90:
                status = "critical"
                warning = "Pool saturation critical - connection exhaustion likely"
            elif saturation_percent >= 75:
                status = "warning"
                warning = "Pool saturation high - monitor for exhaustion"
            elif saturation_percent >= 50:
                warning = "Pool saturation moderate - requests may queue"
        
        return {
            "status": status,
            "pool_type": type(pool).__name__,
            "pool_size": pool.pool_size if hasattr(pool, 'pool_size') else None,
            "max_overflow": pool.max_overflow if hasattr(pool, 'max_overflow') else None,
            "checked_out": checked_out,
            "pool_size_actual": pool_size,
            "overflow_actual": overflow,
            "saturation_percent": round(saturation_percent, 1) if saturation_percent is not None else None,
            "warning": warning,
            "pool_timeout_seconds": 30,
            "pool_recycle_seconds": 280,
            "pool_pre_ping_enabled": True,
            "recommendations": [
                "Pool saturation >90%: Increase DB_POOL_SIZE or DB_MAX_OVERFLOW",
                "Saturation >75%: Reduce per-request DB queries or optimize queries",
                "Saturation >50% persistent: Check for connection leaks or slow queries"
            ] if saturation_percent is not None and saturation_percent > 50 else []
        }
    except Exception as e:
        logger.error(f"Pool diagnostics error: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
            "message": "Failed to get pool diagnostics"
        }