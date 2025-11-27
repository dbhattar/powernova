"""create_document_jobs_table

Revision ID: 7036e3afc055
Revises: f537f78bf289
Create Date: 2025-11-27 01:10:00.136459

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7036e3afc055'
down_revision: Union[str, None] = 'f537f78bf289'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create document_jobs table
    op.create_table(
        'document_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', name='documentjobstatus'), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('processor_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    )
    
    # Create indexes
    op.create_index('ix_document_jobs_id', 'document_jobs', ['id'])
    op.create_index('ix_document_jobs_document_id', 'document_jobs', ['document_id'], unique=True)
    op.create_index('ix_document_jobs_status', 'document_jobs', ['status'])
    
    # Create index for efficient job polling (status + created_at for FIFO processing)
    op.create_index('ix_document_jobs_status_created', 'document_jobs', ['status', 'created_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_document_jobs_status_created', 'document_jobs')
    op.drop_index('ix_document_jobs_status', 'document_jobs')
    op.drop_index('ix_document_jobs_document_id', 'document_jobs')
    op.drop_index('ix_document_jobs_id', 'document_jobs')
    
    # Drop table
    op.drop_table('document_jobs')
    
    # Drop enum type
    op.execute('DROP TYPE documentjobstatus')
