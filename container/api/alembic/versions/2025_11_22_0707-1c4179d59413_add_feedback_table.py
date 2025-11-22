"""Mako script for generating migration files"""

"""add_feedback_table

Revision ID: 1c4179d59413
Revises: 80cc28c75bca
Create Date: 2025-11-22 07:07:13.852674

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1c4179d59413'
down_revision: Union[str, None] = '80cc28c75bca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create feedback table
    op.create_table(
        'feedback',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.Enum('new', 'in_progress', 'resolved', 'archived', name='feedbackstatus'), nullable=False, server_default='new'),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_feedback_id'), 'feedback', ['id'], unique=False)
    op.create_index(op.f('ix_feedback_email'), 'feedback', ['email'], unique=False)
    op.create_index(op.f('ix_feedback_status'), 'feedback', ['status'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_feedback_status'), table_name='feedback')
    op.drop_index(op.f('ix_feedback_email'), table_name='feedback')
    op.drop_index(op.f('ix_feedback_id'), table_name='feedback')
    
    # Drop table
    op.drop_table('feedback')
    
    # Drop enum type
    sa.Enum(name='feedbackstatus').drop(op.get_bind(), checkfirst=True)
