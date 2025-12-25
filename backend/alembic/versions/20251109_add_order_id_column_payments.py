"""Add missing order_id column to payments if absent.

Revision ID: 20251109_add_order_id_column_payments
Revises: 1a2b3c4d5e6f_add_advance_payment_percentage_to_space
Create Date: 2025-11-09
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20251109_add_order_id_column_payments'
down_revision = '1a2b3c4d5e6f_add_advance_payment_percentage_to_space'
branch_labels = None
depends_on = None

def upgrade():
    # Use raw SQL for adding columns that may or may not exist
    op.execute("""
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS order_id VARCHAR(100) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS currency VARCHAR(8) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS details JSONB DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS gateway_response JSONB DEFAULT NULL;
    """)

def downgrade():
    op.execute("""
        ALTER TABLE payments
        DROP COLUMN IF EXISTS gateway_response,
        DROP COLUMN IF EXISTS details,
        DROP COLUMN IF EXISTS updated_at,
        DROP COLUMN IF EXISTS currency,
        DROP COLUMN IF EXISTS order_id;
    """)
