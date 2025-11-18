"""Add documents and crawl_jobs tables

Revision ID: 002_add_documents_crawl
Revises: 001_initial_schema
Create Date: 2025-11-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_documents_crawl'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Create crawl_jobs table
    op.create_table(
        'crawl_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('start_url', sa.String(length=2048), nullable=False),
        sa.Column('max_depth', sa.Integer(), nullable=True),
        sa.Column('max_pages', sa.Integer(), nullable=True),
        sa.Column('allowed_domains', sa.JSON(), nullable=True),
        sa.Column('file_types', sa.JSON(), nullable=True),
        sa.Column('url_patterns', sa.JSON(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', name='crawlstatus'), nullable=False),
        sa.Column('pages_crawled', sa.Integer(), nullable=True),
        sa.Column('documents_found', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_crawl_jobs_id'), 'crawl_jobs', ['id'], unique=False)
    
    # Create documents table
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('url', sa.String(length=2048), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('document_type', sa.Enum('PDF', 'HTML', 'TEXT', 'MARKDOWN', 'DOCX', 'OTHER', name='documenttype'), nullable=False),
        sa.Column('file_path', sa.String(length=1024), nullable=True),
        sa.Column('blob_url', sa.String(length=2048), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', name='documentstatus'), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('doc_metadata', sa.JSON(), nullable=True),
        sa.Column('crawl_job_id', sa.Integer(), nullable=True),
        sa.Column('embedding_generated', sa.Boolean(), nullable=True),
        sa.Column('chunk_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_documents_id'), 'documents', ['id'], unique=False)
    op.create_index(op.f('ix_documents_url'), 'documents', ['url'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_documents_url'), table_name='documents')
    op.drop_index(op.f('ix_documents_id'), table_name='documents')
    op.drop_table('documents')
    
    op.drop_index(op.f('ix_crawl_jobs_id'), table_name='crawl_jobs')
    op.drop_table('crawl_jobs')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS documentstatus')
    op.execute('DROP TYPE IF EXISTS documenttype')
    op.execute('DROP TYPE IF EXISTS crawlstatus')
