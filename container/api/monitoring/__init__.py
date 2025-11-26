"""
Database Connection Pool Monitoring

Provides endpoints to monitor database connection pool health
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from database.session import engine

router = APIRouter()


@router.get("/api/admin/db-pool-status")
async def get_db_pool_status():
    """
    Get current database connection pool status
    
    Useful for:
    - Debugging connection pool exhaustion
    - Monitoring connection usage
    - Capacity planning
    
    Returns:
        JSON with pool statistics including:
        - pool_size: Number of persistent connections
        - checked_in: Available connections
        - checked_out: Connections currently in use
        - overflow: Additional overflow connections created
        - total_connections: Total active connections
        - max_connections: Maximum possible connections
    """
    try:
        pool = engine.pool
        
        return JSONResponse(content={
            "status": "healthy",
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "total_connections": pool.checkedin() + pool.checkedout(),
            "max_connections": pool.size() + pool._max_overflow,
            "pool_timeout": pool._timeout,
            "pool_recycle": pool._recycle,
            "usage_percent": round((pool.checkedout() / (pool.size() + pool._max_overflow)) * 100, 2),
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "error": str(e)
            }
        )
