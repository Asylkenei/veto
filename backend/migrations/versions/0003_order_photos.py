"""VETO 2.1: manual option order and cached topical photos (additive).

Revision ID: 0003_order_photos
Revises: 0002_veto_2
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_order_photos"
down_revision = "0002_veto_2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("options", sa.Column("position", sa.Integer, nullable=False, server_default="0"))
    op.add_column("options", sa.Column("image_url", sa.String(500), nullable=False, server_default=""))
    op.add_column("options", sa.Column("image_credit", sa.String(300), nullable=False, server_default=""))
    op.add_column("places", sa.Column("image_credit", sa.String(300), nullable=False, server_default=""))
    op.add_column("places", sa.Column("photo_query", sa.String(200), nullable=False, server_default=""))
    # Keep the existing visual order: number options by insertion order within each room.
    bind = op.get_bind()
    order = "rowid" if bind.dialect.name == "sqlite" else "created_at, id"
    rows = bind.execute(sa.text(f"SELECT id, room_id FROM options ORDER BY room_id, {order}")).fetchall()
    counters: dict[str, int] = {}
    for option_id, room_id in rows:
        counters[room_id] = counters.get(room_id, 0) + 1
        bind.execute(sa.text("UPDATE options SET position=:p WHERE id=:i"), {"p": counters[room_id], "i": option_id})


def downgrade() -> None:
    with op.batch_alter_table("places") as batch:
        batch.drop_column("photo_query")
        batch.drop_column("image_credit")
    with op.batch_alter_table("options") as batch:
        batch.drop_column("image_credit")
        batch.drop_column("image_url")
        batch.drop_column("position")
