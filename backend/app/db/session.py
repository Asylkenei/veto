from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import DATABASE_URL

if not DATABASE_URL.startswith("postgresql+psycopg://"):
    raise RuntimeError(
        "DATABASE_URL must use the postgresql+psycopg:// scheme. "
        "Locally: docker compose -f docker-compose.local.yml up -d postgres"
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True)


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass
