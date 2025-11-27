"""add_language_detection_to_documents

Revision ID: f537f78bf289
Revises: c96c28ec88dd
Create Date: 2025-11-26 12:08:59.540110

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f537f78bf289'
down_revision: Union[str, None] = 'c96c28ec88dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add language column to documents table
    op.add_column('documents', sa.Column('language', sa.String(length=10), nullable=True))
    
    # Set default value for existing records
    op.execute("UPDATE documents SET language = 'en' WHERE language IS NULL")
    
    # Add index for language filtering
    op.create_index('ix_documents_language', 'documents', ['language'])


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_documents_language', 'documents')
    
    # Remove language column
    op.drop_column('documents', 'language')
