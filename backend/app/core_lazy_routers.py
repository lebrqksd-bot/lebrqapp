"""
Lazy Router Loading System

This module provides a lazy loading system for FastAPI routers to reduce
startup memory usage. Routers are only imported and registered when first accessed.

Critical routers (health, auth) are loaded immediately for availability.
"""

from __future__ import annotations

import logging
from typing import Callable, Optional
from fastapi import FastAPI, APIRouter

logger = logging.getLogger(__name__)

# Router registry - maps route paths to lazy loader functions
_router_registry: dict[str, Callable[[], APIRouter]] = {}
_loaded_routers: dict[str, APIRouter] = {}


def register_lazy_router(
    path: str,
    loader: Callable[[], APIRouter],
    description: str = ""
) -> None:
    """
    Register a router to be loaded lazily.
    
    Args:
        path: The route path prefix (e.g., "/api/bookings")
        loader: Function that returns the router when called
        description: Optional description for logging
    """
    _router_registry[path] = loader
    logger.debug(f"Registered lazy router: {path} {description}")


def get_or_load_router(path: str) -> Optional[APIRouter]:
    """
    Get a router, loading it if not already loaded.
    
    Args:
        path: The route path prefix
        
    Returns:
        The router if found, None otherwise
    """
    # Check if already loaded
    if path in _loaded_routers:
        return _loaded_routers[path]
    
    # Check if registered for lazy loading
    if path in _router_registry:
        try:
            logger.info(f"Lazy loading router: {path}")
            router = _router_registry[path]()
            _loaded_routers[path] = router
            return router
        except Exception as e:
            logger.error(f"Failed to load router {path}: {e}")
            return None
    
    return None


def lazy_router_middleware(app: FastAPI):
    """
    Middleware to intercept requests and load routers on-demand.
    
    This middleware checks if a router needs to be loaded based on the request path,
    loads it if needed, and includes it in the app.
    """
    from fastapi import Request
    from fastapi.responses import JSONResponse
    
    @app.middleware("http")
    async def load_router_on_demand(request: Request, call_next):
        """Load router on first access"""
        path = request.url.path
        
        # Check if this path matches any lazy router prefix
        for router_path, loader in _router_registry.items():
            if path.startswith(router_path) and router_path not in _loaded_routers:
                try:
                    logger.info(f"Lazy loading router for path: {router_path}")
                    router = loader()
                    app.include_router(router, prefix=router_path)
                    _loaded_routers[router_path] = router
                except Exception as e:
                    logger.error(f"Failed to lazy load router {router_path}: {e}")
                    return JSONResponse(
                        status_code=500,
                        content={"detail": f"Failed to load router: {str(e)}"}
                    )
        
        return await call_next(request)


# Alternative simpler approach: Just delay router imports
# This is safer and doesn't require middleware

def create_lazy_router_loader(module_path: str, router_attr: str = "router") -> Callable[[], APIRouter]:
    """
    Create a lazy loader function for a router.
    
    Args:
        module_path: Python module path (e.g., "app.routers.bookings")
        router_attr: Attribute name of the router in the module (default: "router")
        
    Returns:
        Function that imports and returns the router
    """
    def loader() -> APIRouter:
        """Lazy import and return router"""
        try:
            module = __import__(module_path, fromlist=[router_attr])
            router = getattr(module, router_attr)
            logger.info(f"Lazy loaded router from {module_path}")
            return router
        except Exception as e:
            logger.error(f"Failed to lazy load {module_path}: {e}")
            raise
    
    return loader


