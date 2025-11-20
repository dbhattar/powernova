"""add_pgvector_support

Revision ID: e64fd1918790
Revises: 002_add_documents_crawl
Create Date: 2025-11-18 23:12:57.622438

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'e64fd1918790'
down_revision: Union[str, None] = '002_add_documents_crawl'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    
    # Add embedding column to documents table
    # Using 1536 dimensions for OpenAI text-embedding-3-small
    op.add_column('documents', sa.Column('embedding', Vector(1536), nullable=True))
    
    # Create HNSW index for fast similarity search
    # HNSW (Hierarchical Navigable Small World) is faster than IVFFlat for < 1M vectors
    op.execute("""
        CREATE INDEX documents_embedding_idx ON documents 
        USING hnsw (embedding vector_cosine_ops)
    """)
    
    # Create index for combined filtering + vector search
    op.create_index('idx_documents_embedding_not_null', 'documents', ['crawl_job_id', 'document_type'], 
                    postgresql_where=sa.text('embedding IS NOT NULL'))


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_documents_embedding_not_null', table_name='documents')
    op.execute('DROP INDEX IF EXISTS documents_embedding_idx')
    
    # Drop embedding column
    op.drop_column('documents', 'embedding')
    
    # Note: We don't drop the vector extension as other tables might use it
    # op.execute('DROP EXTENSION IF EXISTS vector')

