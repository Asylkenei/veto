from alembic import context
from sqlalchemy import create_engine
from app.core.config import DATABASE_URL
from app.db.session import Base
from app import models  # noqa: F401

target_metadata = Base.metadata


def run_migrations_online() -> None:
    url = context.config.attributes.get("url") or DATABASE_URL
    connectable = context.config.attributes.get("connection")
    if connectable is not None:
        context.configure(connection=connectable, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
        return
    engine = create_engine(url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
