"""add vector index to document chunks

Revision ID: chunks_vector_idx_001
Revises: 7036e3afc055
Create Date: 2025-12-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'chunks_vector_idx_001'
down_revision: Union[str, None] = '7036e3afc055'  # Latest migration
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add HNSW index to document_chunks.embedding for fast similarity search.
    
    HNSW (Hierarchical Navigable Small World) is optimal for:
    - < 1M vectors
    - Fast approximate nearest neighbor search
    - Better recall than IVFFlat for smaller datasets
    
    Parameters:
    - m=16: Number of connections per layer (default, good balance)
    - ef_construction=64: Size of dynamic candidate list during construction (default)
    
    Higher values = better recall but slower index creation and more memory.
    For production with many documents, consider m=32, ef_construction=128.
    """
    
    # Create HNSW index for fast cosine similarity search
    # Using vector_cosine_ops for cosine distance (1 - cosine similarity)
    # Note: CONCURRENTLY cannot be used inside a transaction, so we need special handling
    
    # Check if we're in a transaction (Alembic default)
    # For production with large datasets, consider running this manually with CONCURRENTLY
    op.execute("""
        CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
        ON document_chunks 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)
    
    # Note: Index creation can take time on large tables (minutes for 100k+ chunks)
    # Consider running with CONCURRENTLY for zero-downtime in production:
    # CREATE INDEX CONCURRENTLY document_chunks_embedding_idx ...
    
    print("✓ HNSW index created on document_chunks.embedding")
    print("  This will significantly speed up similarity searches!")


def downgrade() -> None:
    """Remove the HNSW index"""
    op.execute('DROP INDEX IF EXISTS document_chunks_embedding_idx')
    print("✗ HNSW index removed from document_chunks.embedding")
