"""Mako script for generating migration files"""

"""add_crawl_state_tracking_tables

Revision ID: b5b677d0fede
Revises: 1c4179d59413
Create Date: 2025-11-22 18:37:37.965293

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5b677d0fede'
down_revision: Union[str, None] = '1c4179d59413'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create crawl_visited_urls table
    op.create_table(
        'crawl_visited_urls',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('crawl_job_id', sa.Integer(), nullable=False),
        sa.Column('url', sa.String(length=2048), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('depth', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('visited_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['crawl_job_id'], ['crawl_jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for crawl_visited_urls
    op.create_index('idx_crawl_visited_url', 'crawl_visited_urls', ['crawl_job_id', 'url'])
    op.create_index(op.f('ix_crawl_visited_urls_id'), 'crawl_visited_urls', ['id'], unique=False)
    op.create_index(op.f('ix_crawl_visited_urls_crawl_job_id'), 'crawl_visited_urls', ['crawl_job_id'], unique=False)
    
    # Create crawl_queued_urls table
    op.create_table(
        'crawl_queued_urls',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('crawl_job_id', sa.Integer(), nullable=False),
        sa.Column('url', sa.String(length=2048), nullable=False),
        sa.Column('depth', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('priority', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('added_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['crawl_job_id'], ['crawl_jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for crawl_queued_urls
    op.create_index('idx_crawl_queued_url', 'crawl_queued_urls', ['crawl_job_id', 'url'])
    op.create_index('idx_crawl_queue_priority', 'crawl_queued_urls', ['crawl_job_id', 'priority', 'added_at'])
    op.create_index(op.f('ix_crawl_queued_urls_id'), 'crawl_queued_urls', ['id'], unique=False)
    op.create_index(op.f('ix_crawl_queued_urls_crawl_job_id'), 'crawl_queued_urls', ['crawl_job_id'], unique=False)


def downgrade() -> None:
    # Drop crawl_queued_urls table and indexes
    op.drop_index(op.f('ix_crawl_queued_urls_crawl_job_id'), table_name='crawl_queued_urls')
    op.drop_index(op.f('ix_crawl_queued_urls_id'), table_name='crawl_queued_urls')
    op.drop_index('idx_crawl_queue_priority', table_name='crawl_queued_urls')
    op.drop_index('idx_crawl_queued_url', table_name='crawl_queued_urls')
    op.drop_table('crawl_queued_urls')
    
    # Drop crawl_visited_urls table and indexes
    op.drop_index(op.f('ix_crawl_visited_urls_crawl_job_id'), table_name='crawl_visited_urls')
    op.drop_index(op.f('ix_crawl_visited_urls_id'), table_name='crawl_visited_urls')
    op.drop_index('idx_crawl_visited_url', table_name='crawl_visited_urls')
    op.drop_table('crawl_visited_urls')
