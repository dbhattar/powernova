"""add request_type to feedback table

Revision ID: 2025_11_23_request_type
Revises: 2025_11_22_1837-b5b677d0fede
Create Date: 2025-11-23

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2025_11_23_request_type'
down_revision = 'b5b677d0fede'
branch_labels = None
depends_on = None


def upgrade():
    """Add request_type column to feedback table"""
    
    # Create the enum type
    op.execute("CREATE TYPE feedbacktype AS ENUM ('feedback', 'account_request')")
    
    # Add the column with default value
    op.add_column('feedback', 
        sa.Column('request_type', 
                  sa.Enum('feedback', 'account_request', name='feedbacktype'),
                  nullable=False,
                  server_default='feedback')
    )
    
    # Create index on request_type
    op.create_index('ix_feedback_request_type', 'feedback', ['request_type'])


def downgrade():
    """Remove request_type column from feedback table"""
    
    # Drop the index
    op.drop_index('ix_feedback_request_type', table_name='feedback')
    
    # Drop the column
    op.drop_column('feedback', 'request_type')
    
    # Drop the enum type
    op.execute("DROP TYPE feedbacktype")
