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
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from typing import Generator

# Get database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://powernova:powernova_dev_2024@localhost:5432/powernova"
)

# Get connection pool settings from environment
# Supabase Session mode has strict connection limits, so we need conservative settings
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "3"))  # Reduced from 5 to 3
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "5"))  # Reduced from 10 to 5
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))  # Reduced from 3600 to 1800 (30 min)

# Detect if using Supabase connection pooler (port 6543) or Session mode (port 5432)
is_supabase_pooler = ":6543/" in DATABASE_URL
is_supabase_direct = "supabase.com" in DATABASE_URL and ":5432/" in DATABASE_URL

# Log connection mode for debugging
if is_supabase_pooler:
    print("🔌 Using Supabase Connection Pooler (Transaction mode) - NullPool")
elif is_supabase_direct:
    print("⚠️  Using Supabase Direct Connection (Session mode) - Limited connections!")
    print(f"   Pool: size={DB_POOL_SIZE}, max_overflow={DB_MAX_OVERFLOW}")
else:
    print(f"🔌 Using Direct PostgreSQL Connection - Pool size={DB_POOL_SIZE}")

# Create SQLAlchemy engine with connection pooling
# For Supabase pooler (port 6543), use NullPool to let Supabase handle pooling
# For Supabase direct (port 5432), use VERY conservative pooling due to strict limits
# For local/Azure direct, use standard connection pooling
if is_supabase_pooler:
    # Supabase Transaction mode (pooler) - let PgBouncer handle pooling
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
        connect_args={
            "sslmode": "require" if "sslmode" not in DATABASE_URL else None,
            "connect_timeout": 10,
        },
        echo=os.getenv("ENVIRONMENT") == "development",
    )
    print("✓ Engine created with NullPool (Supabase handles pooling)")
elif is_supabase_direct:
    # Supabase Session mode (direct) - VERY conservative pooling
    # Session mode has strict connection limits (often 15-20 total)
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # CRITICAL: Verify connections before using
        pool_size=DB_POOL_SIZE,  # Keep very low (3)
        max_overflow=DB_MAX_OVERFLOW,  # Keep very low (5)
        pool_timeout=DB_POOL_TIMEOUT,  # 30 second timeout
        pool_recycle=DB_POOL_RECYCLE,  # Recycle after 30 min
        echo=os.getenv("ENVIRONMENT") == "development",
        connect_args={
            "sslmode": "require" if "sslmode" not in DATABASE_URL else None,
            "connect_timeout": 10,
            "options": "-c statement_timeout=300000",  # 5 min query timeout
        }
    )
    print(f"✓ Engine created with QueuePool (Conservative: {DB_POOL_SIZE}+{DB_MAX_OVERFLOW})")
else:
    # Local or Azure direct connection - standard pooling
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=DB_POOL_SIZE,
        max_overflow=DB_MAX_OVERFLOW,
        pool_timeout=DB_POOL_TIMEOUT,
        pool_recycle=DB_POOL_RECYCLE,
        echo=os.getenv("ENVIRONMENT") == "development",
    )
    print(f"✓ Engine created with QueuePool ({DB_POOL_SIZE}+{DB_MAX_OVERFLOW})")

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
    
    IMPORTANT: This properly closes the session after each request,
    returning the connection to the pool. Always use this with
    FastAPI's Depends() to ensure cleanup happens even on errors.
    """
    db = SessionLocal()
    try:
        yield db
        # Commit any pending transactions
        db.commit()
    except Exception as e:
        # Rollback on error
        db.rollback()
        raise
    finally:
        # ALWAYS close the session to return connection to pool
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
            result = conn.execute(text("SELECT 1"))
            result.close()
        return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False
