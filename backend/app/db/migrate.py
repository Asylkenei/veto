"""Apply Alembic migrations on startup.

Databases created by MVP 0.1 (via create_all) have no alembic_version table:
they are stamped as the baseline first, so their data is kept and only the
additive 0002 migration runs.
"""
import logging
from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from app.core.config import DATABASE_URL
from app.db.session import engine

log = logging.getLogger("veto.migrate")
BACKEND_DIR = Path(__file__).resolve().parents[2]


def alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.attributes["url"] = DATABASE_URL
    return cfg


def upgrade_database() -> None:
    cfg = alembic_config()
    tables = set(inspect(engine).get_table_names())
    if "rooms" in tables and "alembic_version" not in tables:
        log.info("legacy database detected, stamping baseline", extra={"event": "migrate_stamp"})
        command.stamp(cfg, "0001_baseline")
    command.upgrade(cfg, "head")
    log.info("database is up to date", extra={"event": "migrate_done"})
