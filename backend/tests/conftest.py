import os
import tempfile
import uuid

_tmp = tempfile.mkdtemp(prefix="veto-test-")
os.environ["DATA_DIR"] = _tmp
# Tests run against a real, separate PostgreSQL database that is wiped on start.
TEST_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://veto:veto-local-password@localhost:5432/veto_test"
)
os.environ["DATABASE_URL"] = TEST_URL


def _reset_database(url: str) -> None:
    import psycopg

    plain = url.replace("postgresql+psycopg://", "postgresql://")
    base, name = plain.rsplit("/", 1)
    with psycopg.connect(f"{base}/postgres", autocommit=True) as conn:
        if not conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,)).fetchone():
            conn.execute(f'CREATE DATABASE "{name}"')
    with psycopg.connect(plain, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")


_reset_database(TEST_URL)
os.environ["SCHEDULER_INTERVAL_SECONDS"] = "3600"
os.environ["PHOTOS_ENABLED"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def _app():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def make_user(_app):
    """Each user gets an isolated client (own cookie jar)."""
    clients = []

    def factory(name: str = "Участник", register: bool = True) -> TestClient:
        client = TestClient(app)
        if register:
            email = f"{uuid.uuid4().hex[:10]}@test.kz"
            r = client.post("/api/auth/register", json={"display_name": name, "email": email, "password": "secret123"})
            assert r.status_code == 201, r.text
            client.email = email
        else:
            r = client.post("/api/auth/guest", json={"display_name": name})
            assert r.status_code == 201, r.text
        client.user = r.json()["user"]
        clients.append(client)
        return client

    yield factory


def make_room(host, method="majority", options=("Пицца", "Суши"), **extra):
    r = host.post("/api/rooms", json={"title": "Ужин", "question": "Что едим?", "method": method, **extra})
    assert r.status_code == 201, r.text
    room = r.json()
    for title in options:
        room = host.post(f"/api/rooms/{room['id']}/options", json={"title": title}).json()
    return room


def option_id(room, title):
    return next(o["id"] for o in room["options"] if o["title"] == title)
