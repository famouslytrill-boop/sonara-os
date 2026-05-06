"""initial SONARA Industries schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-05
"""

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Models are defined in app.db.models. Generate exact production DDL with Alembic autogenerate.
    # RLS should be enabled per table in production after policy review.
    pass

def downgrade() -> None:
    pass

