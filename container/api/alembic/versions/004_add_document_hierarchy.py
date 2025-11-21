"""Add document hierarchy support

Revision ID: doc_hierarchy_001
Revises: conv_docs_001
Create Date: 2025-11-20 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'doc_hierarchy_001'
down_revision = 'conv_docs_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add document_scope and uploaded_by columns to documents table"""
    
    # Create DocumentScope enum type
    document_scope_enum = postgresql.ENUM('platform', 'user', 'conversation', name='documentscope')
    document_scope_enum.create(op.get_bind(), checkfirst=True)
    
    # Add document_scope column (default to 'platform' for existing crawled documents)
    op.add_column('documents', 
        sa.Column('document_scope', 
                  sa.Enum('platform', 'user', 'conversation', name='documentscope'),
                  nullable=False, 
                  server_default='platform'))
    
    # Add uploaded_by column (NULL for platform/crawled documents)
    op.add_column('documents', 
        sa.Column('uploaded_by', sa.Integer(), nullable=True))
    
    # Add foreign key constraint for uploaded_by
    op.create_foreign_key(
        'fk_documents_uploaded_by',
        'documents', 'users',
        ['uploaded_by'], ['id'],
        ondelete='SET NULL'
    )
    
    # Create indexes for better query performance
    op.create_index(op.f('ix_documents_document_scope'), 'documents', ['document_scope'], unique=False)
    op.create_index(op.f('ix_documents_uploaded_by'), 'documents', ['uploaded_by'], unique=False)


def downgrade() -> None:
    """Remove document hierarchy columns"""
    
    # Drop indexes
    op.drop_index(op.f('ix_documents_uploaded_by'), table_name='documents')
    op.drop_index(op.f('ix_documents_document_scope'), table_name='documents')
    
    # Drop foreign key
    op.drop_constraint('fk_documents_uploaded_by', 'documents', type_='foreignkey')
    
    # Drop columns
    op.drop_column('documents', 'uploaded_by')
    op.drop_column('documents', 'document_scope')
    
    # Drop enum type
    document_scope_enum = postgresql.ENUM('platform', 'user', 'conversation', name='documentscope')
    document_scope_enum.drop(op.get_bind(), checkfirst=True)
