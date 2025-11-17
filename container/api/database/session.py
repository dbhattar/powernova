"""
Database session management and connection pooling

Supports two connection modes:
1. Supabase Connection Pooler (port 6543) - Uses NullPool, Supabase handles pooling
2. Direct PostgreSQL (port 5432) - Uses QueuePool with configurable settings

Environment Variables:
- DATABASE_URL: PostgreSQL connection string
- DB_POOL_SIZE: Number of persistent connections (default: 5)
- DB_MAX_OVERFLOW: Additional connections when pool is full (default: 10)
- DB_POOL_TIMEOUT: Timeout for getting connection from pool (default: 30)
- DB_POOL_RECYCLE: Recycle connections after this many seconds (default: 3600)
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from typing import Generator

# Get database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://powernova:powernova_dev_2024@localhost:5432/powernova"
)

# Get connection pool settings from environment
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "3600"))

# Detect if using Supabase connection pooler (port 6543)
is_supabase_pooler = ":6543/" in DATABASE_URL

# Create SQLAlchemy engine with connection pooling
# For Supabase pooler, use NullPool to let Supabase handle pooling
# For direct connections (local/Azure), use QueuePool
if is_supabase_pooler:
    # Supabase handles pooling via PgBouncer, so disable SQLAlchemy pooling
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
        connect_args={
            "sslmode": "require" if "sslmode" not in DATABASE_URL else None,
            "connect_timeout": 10,
        },
        echo=os.getenv("ENVIRONMENT") == "development",
    )
else:
    # For direct connections, use standard connection pooling
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=DB_POOL_SIZE,  # Number of persistent connections
        max_overflow=DB_MAX_OVERFLOW,  # Additional connections when pool is full
        pool_timeout=DB_POOL_TIMEOUT,  # Timeout for getting connection from pool
        pool_recycle=DB_POOL_RECYCLE,  # Recycle connections after this many seconds
        echo=os.getenv("ENVIRONMENT") == "development",  # Log SQL in dev
    )

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency for FastAPI routes to get database session
    
    Usage:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            users = db.query(User).all()
            return users
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Initialize database tables
    Creates all tables defined in models if they don't exist
    
    Note: In production, use Alembic migrations instead
    """
    from models.base import Base
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables initialized")


def check_db_connection() -> bool:
    """
    Check if database connection is working
    Returns True if connection is successful, False otherwise
    """
    try:
        with engine.connect() as conn:
            result = conn.execute("SELECT 1")
            result.close()
        return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False
