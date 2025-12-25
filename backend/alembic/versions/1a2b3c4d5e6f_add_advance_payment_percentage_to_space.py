"""Add advance_payment_percentage column to spaces.

Revision ID: 1a2b3c4d5e6f_add_advance_payment_percentage_to_space
Revises: None
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '1a2b3c4d5e6f_add_advance_payment_percentage_to_space'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    """Add advance_payment_percentage column if it doesn't exist."""
    # Use raw SQL to add column if not exists
    op.execute("""
        ALTER TABLE spaces
        ADD COLUMN IF NOT EXISTS advance_payment_percentage NUMERIC(5, 2) DEFAULT NULL;
    """)

def downgrade():
    """Remove advance_payment_percentage column."""
    op.execute("""
        ALTER TABLE spaces
        DROP COLUMN IF EXISTS advance_payment_percentage;
    """)
