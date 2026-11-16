"""VETO 2.0: accounts, sessions, invite codes, tiebreak, notifications, push, support, places.

Additive only: no existing table or column is dropped or renamed.

Revision ID: 0002_veto_2
Revises: 0001_baseline
"""
import secrets
from alembic import op
import sqlalchemy as sa

revision = "0002_veto_2"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

TZ = sa.DateTime(timezone=True)
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def upgrade() -> None:
    # users
    op.add_column("users", sa.Column("email", sa.String(254), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("is_guest", sa.Boolean, nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("avatar_color", sa.String(16), nullable=False, server_default="sand"))
    op.add_column("users", sa.Column("theme", sa.String(12), nullable=False, server_default="system"))
    op.add_column("users", sa.Column("city", sa.String(80), nullable=False, server_default=""))
    op.add_column("users", sa.Column("notification_prefs_json", sa.Text, nullable=False, server_default="{}"))
    op.add_column("users", sa.Column("deleted_at", TZ, nullable=True))
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # rooms
    op.add_column("rooms", sa.Column("invite_code", sa.String(12), nullable=True))
    op.add_column("rooms", sa.Column("template", sa.String(40), nullable=False, server_default=""))
    op.add_column("rooms", sa.Column("version", sa.Integer, nullable=False, server_default="0"))
    op.add_column("rooms", sa.Column("updated_at", TZ, nullable=True))
    bind = op.get_bind()
    used: set[str] = set()
    for (room_id,) in bind.execute(sa.text("SELECT id FROM rooms")).fetchall():
        code = "".join(secrets.choice(ALPHABET) for _ in range(6))
        while code in used:
            code = "".join(secrets.choice(ALPHABET) for _ in range(6))
        used.add(code)
        bind.execute(sa.text("UPDATE rooms SET invite_code=:c WHERE id=:i"), {"c": code, "i": room_id})
    op.create_index("ix_rooms_invite_code", "rooms", ["invite_code"], unique=True)

    # rounds
    op.add_column("rounds", sa.Column("kind", sa.String(16), nullable=False, server_default="regular"))
    op.add_column("rounds", sa.Column("end_reason", sa.String(16), nullable=False, server_default=""))
    op.add_column("rounds", sa.Column("tiebreak_json", sa.Text, nullable=True))
    op.add_column("rounds", sa.Column("reminder_sent", sa.Boolean, nullable=False, server_default=sa.false()))

    # places catalogue
    op.create_table(
        "place_categories",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("icon", sa.String(32), nullable=False),
        sa.Column("sort", sa.Integer, nullable=False),
    )
    op.create_table(
        "places",
        sa.Column("id", sa.String(48), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("city", sa.String(80), nullable=False),
        sa.Column("category_id", sa.String(32), sa.ForeignKey("place_categories.id")),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("why_visit", sa.Text, nullable=False),
        sa.Column("fact", sa.Text, nullable=False),
        sa.Column("image_url", sa.String(500), nullable=False),
    )
    op.create_index("ix_places_category_id", "places", ["category_id"])

    # options
    op.add_column("options", sa.Column("place_id", sa.String(48), nullable=True))
    op.add_column("options", sa.Column("created_at", TZ, nullable=True))

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("created_at", TZ),
        sa.Column("expires_at", TZ, nullable=False),
        sa.Column("user_agent", sa.String(255)),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("expires_at", TZ, nullable=False),
        sa.Column("used_at", TZ, nullable=True),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("room_id", sa.String(36), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=True),
        sa.Column("link", sa.String(300), nullable=False),
        sa.Column("created_at", TZ),
        sa.Column("read_at", TZ, nullable=True),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("endpoint", sa.String(1000), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(255), nullable=False),
        sa.Column("auth", sa.String(255), nullable=False),
        sa.Column("created_at", TZ),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("contact", sa.String(254), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", TZ),
    )
    op.create_table(
        "user_place_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("place_id", sa.String(48), sa.ForeignKey("places.id", ondelete="CASCADE")),
        sa.Column("room_id", sa.String(36), sa.ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("created_at", TZ),
    )
    op.create_index("ix_user_place_history_user_id", "user_place_history", ["user_id"])
    op.create_index("ix_user_place_history_place_id", "user_place_history", ["place_id"])
    op.create_index("ix_user_place_history_created_at", "user_place_history", ["created_at"])
    for name in ("user_visited_places", "saved_places"):
        op.create_table(
            name,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE")),
            sa.Column("place_id", sa.String(48), sa.ForeignKey("places.id", ondelete="CASCADE")),
            sa.Column("created_at", TZ),
            sa.UniqueConstraint("user_id", "place_id", name="uq_visited" if name.startswith("user") else "uq_saved"),
        )
        op.create_index(f"ix_{name}_user_id", name, ["user_id"])
    op.create_table(
        "daily_place_recommendations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("day", sa.Date, nullable=False),
        sa.Column("place_id", sa.String(48), sa.ForeignKey("places.id", ondelete="CASCADE")),
        sa.UniqueConstraint("user_id", "day", name="uq_daily_place"),
    )
    op.create_index("ix_daily_place_recommendations_user_id", "daily_place_recommendations", ["user_id"])


def downgrade() -> None:
    for table in (
        "daily_place_recommendations", "saved_places", "user_visited_places", "user_place_history",
        "support_tickets", "push_subscriptions", "notifications", "password_reset_tokens",
        "auth_sessions",
    ):
        op.drop_table(table)
    with op.batch_alter_table("options") as batch:
        batch.drop_column("place_id")
        batch.drop_column("created_at")
    op.drop_table("places")
    op.drop_table("place_categories")
    with op.batch_alter_table("rounds") as batch:
        for col in ("kind", "end_reason", "tiebreak_json", "reminder_sent"):
            batch.drop_column(col)
    op.drop_index("ix_rooms_invite_code", "rooms")
    with op.batch_alter_table("rooms") as batch:
        for col in ("invite_code", "template", "version", "updated_at"):
            batch.drop_column(col)
    op.drop_index("ix_users_email", "users")
    with op.batch_alter_table("users") as batch:
        for col in ("email", "password_hash", "is_guest", "avatar_color", "theme", "city",
                    "notification_prefs_json", "deleted_at"):
            batch.drop_column(col)
