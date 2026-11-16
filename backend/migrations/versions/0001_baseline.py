"""Baseline: schema of VETO MVP 0.1 (previously created via create_all).

Revision ID: 0001_baseline
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

TZ = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("created_at", TZ, nullable=False),
    )
    op.create_table(
        "rooms",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("question", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("method", sa.String(24), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("host_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("allow_suggestions", sa.Boolean, nullable=False),
        sa.Column("allow_comments", sa.Boolean, nullable=False),
        sa.Column("hide_results", sa.Boolean, nullable=False),
        sa.Column("deadline", TZ, nullable=True),
        sa.Column("created_at", TZ, nullable=False),
    )
    op.create_table(
        "participants",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("room_id", sa.String(36), sa.ForeignKey("rooms.id", ondelete="CASCADE")),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("role", sa.String(24)),
        sa.UniqueConstraint("room_id", "user_id", name="uq_room_participant"),
    )
    op.create_index("ix_participants_room_id", "participants", ["room_id"])
    op.create_index("ix_participants_user_id", "participants", ["user_id"])
    op.create_table(
        "options",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("room_id", sa.String(36), sa.ForeignKey("rooms.id", ondelete="CASCADE")),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("rejection_reason", sa.Text, nullable=False),
    )
    op.create_index("ix_options_room_id", "options", ["room_id"])
    op.create_table(
        "rounds",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("room_id", sa.String(36), sa.ForeignKey("rooms.id", ondelete="CASCADE")),
        sa.Column("number", sa.Integer, nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("frozen_participants_json", sa.Text, nullable=False),
        sa.Column("frozen_options_json", sa.Text, nullable=False),
        sa.Column("result_json", sa.Text, nullable=True),
        sa.Column("started_at", TZ, nullable=True),
        sa.Column("ended_at", TZ, nullable=True),
        sa.UniqueConstraint("room_id", "number", name="uq_room_round_number"),
    )
    op.create_index("ix_rounds_room_id", "rounds", ["room_id"])
    op.create_table(
        "comments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("room_id", sa.String(36), sa.ForeignKey("rooms.id", ondelete="CASCADE")),
        sa.Column("option_id", sa.String(36), sa.ForeignKey("options.id", ondelete="CASCADE")),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("created_at", TZ),
    )
    op.create_index("ix_comments_room_id", "comments", ["room_id"])
    op.create_table(
        "votes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("round_id", sa.String(36), sa.ForeignKey("rounds.id", ondelete="CASCADE")),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("choice_option_id", sa.String(36), sa.ForeignKey("options.id"), nullable=True),
        sa.UniqueConstraint("round_id", "user_id", name="uq_round_user_vote"),
    )
    op.create_index("ix_votes_round_id", "votes", ["round_id"])
    op.create_table(
        "vote_details",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("vote_id", sa.String(36), sa.ForeignKey("votes.id", ondelete="CASCADE")),
        sa.Column("option_id", sa.String(36), sa.ForeignKey("options.id"), nullable=False),
        sa.Column("stance", sa.String(8), nullable=False),
    )
    op.create_index("ix_vote_details_vote_id", "vote_details", ["vote_id"])


def downgrade() -> None:
    for table in ("vote_details", "votes", "comments", "rounds", "options", "participants", "rooms", "users"):
        op.drop_table(table)
