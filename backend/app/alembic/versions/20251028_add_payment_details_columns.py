"""add payment details columns

Revision ID: add_payment_details_cols_20251028
Revises: 
Create Date: 2025-10-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_payment_details_cols_20251028'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    with op.batch_alter_table('payments') as batch:
        batch.add_column(sa.Column('currency', sa.String(length=8), nullable=True))
        batch.add_column(sa.Column('order_id', sa.String(length=64), nullable=True))
        batch.add_column(sa.Column('updated_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('details', sa.JSON(), nullable=True))
        batch.add_column(sa.Column('gateway_response', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('payments') as batch:
        batch.drop_column('gateway_response')
        batch.drop_column('details')
        batch.drop_column('updated_at')
        batch.drop_column('order_id')
        batch.drop_column('currency')
