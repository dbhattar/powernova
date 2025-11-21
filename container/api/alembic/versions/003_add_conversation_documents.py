"""Add conversation_documents junction table

Revision ID: conv_docs_001
Revises: add_must_change_pwd
Create Date: 2025-11-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'conv_docs_001'
down_revision = 'add_must_change_pwd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add conversation_documents table for linking documents to conversations"""
    op.create_table(
        'conversation_documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='SET NULL')
    )
    
    # Create indexes for better query performance
    op.create_index(op.f('ix_conversation_documents_id'), 'conversation_documents', ['id'], unique=False)
    op.create_index(op.f('ix_conversation_documents_conversation_id'), 'conversation_documents', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_conversation_documents_document_id'), 'conversation_documents', ['document_id'], unique=False)
    
    # Create composite unique index to prevent duplicate document-conversation links
    op.create_index('ix_conversation_documents_unique', 'conversation_documents', ['conversation_id', 'document_id'], unique=True)


def downgrade() -> None:
    """Remove conversation_documents table"""
    op.drop_index(op.f('ix_conversation_documents_unique'), table_name='conversation_documents')
    op.drop_index(op.f('ix_conversation_documents_document_id'), table_name='conversation_documents')
    op.drop_index(op.f('ix_conversation_documents_conversation_id'), table_name='conversation_documents')
    op.drop_index(op.f('ix_conversation_documents_id'), table_name='conversation_documents')
    op.drop_table('conversation_documents')
