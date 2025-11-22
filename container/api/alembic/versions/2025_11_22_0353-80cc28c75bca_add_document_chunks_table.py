"""Mako script for generating migration files"""

"""add_document_chunks_table

Revision ID: 80cc28c75bca
Revises: doc_hierarchy_001
Create Date: 2025-11-22 03:53:37.790737

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '80cc28c75bca'
down_revision: Union[str, None] = 'doc_hierarchy_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create document_chunks table
    op.create_table(
        'document_chunks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('word_count', sa.Integer(), default=0),
        sa.Column('char_start', sa.Integer(), default=0),
        sa.Column('char_end', sa.Integer(), default=0),
        sa.Column('embedding', sa.Text(), nullable=True),  # Will be converted to Vector by pgvector
        sa.Column('embedding_generated', sa.Boolean(), default=False, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    )
    
    # Create indexes
    op.create_index('ix_document_chunks_document_id', 'document_chunks', ['document_id'])
    op.create_index('ix_document_chunks_embedding_generated', 'document_chunks', ['embedding_generated'])
    
    # Enable vector operations on embedding column using pgvector
    op.execute('ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector(1536)')


def downgrade() -> None:
    op.drop_index('ix_document_chunks_embedding_generated', table_name='document_chunks')
    op.drop_index('ix_document_chunks_document_id', table_name='document_chunks')
    op.drop_table('document_chunks')
