"""Add must_change_password to users table

Revision ID: add_must_change_pwd
Revises: e64fd1918790
Create Date: 2025-11-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_must_change_pwd'
down_revision = 'e64fd1918790'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add must_change_password column to users table"""
    # Add the column with default value True
    op.add_column('users', sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    """Remove must_change_password column from users table"""
    op.drop_column('users', 'must_change_password')
