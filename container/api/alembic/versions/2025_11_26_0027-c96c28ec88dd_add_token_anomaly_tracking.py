"""add_token_anomaly_tracking

Revision ID: c96c28ec88dd
Revises: 2025_11_23_request_type
Create Date: 2025-11-26 00:27:37.889143

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c96c28ec88dd'
down_revision: Union[str, None] = '2025_11_23_request_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add token anomaly tracking columns to documents table
    op.add_column('documents', sa.Column('token_anomaly', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('documents', sa.Column('token_to_char_ratio', sa.Float(), nullable=True))
    
    # Create index for efficient querying of anomalous documents
    op.create_index('idx_documents_token_anomaly', 'documents', ['token_anomaly'], unique=False)


def downgrade() -> None:
    # Remove index and columns
    op.drop_index('idx_documents_token_anomaly', table_name='documents')
    op.drop_column('documents', 'token_to_char_ratio')
    op.drop_column('documents', 'token_anomaly')
