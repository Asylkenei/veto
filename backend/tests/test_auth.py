from fastapi.testclient import TestClient
from app.main import app


def test_register_login_logout_session(make_user):
    user = make_user("Аня")
    assert user.get("/api/auth/me").json()["email"] == user.email
    assert user.post("/api/auth/logout").status_code == 204
    assert user.get("/api/auth/me").status_code == 401
    r = user.post("/api/auth/login", json={"email": user.email, "password": "secret123"})
    assert r.status_code == 200 and user.get("/api/auth/me").status_code == 200


def test_duplicate_email_rejected(make_user):
    user = make_user()
    fresh = TestClient(app)
    r = fresh.post("/api/auth/register", json={"display_name": "X", "email": user.email.upper(), "password": "secret123"})
    assert r.status_code == 409


def test_wrong_password_and_weak_password():
    c = TestClient(app)
    assert c.post("/api/auth/login", json={"email": "nobody@test.kz", "password": "x"}).status_code == 401
    r = c.post("/api/auth/register", json={"display_name": "X", "email": "weak@test.kz", "password": "abcdefgh"})
    assert r.status_code == 422 and "цифра" in r.json()["detail"]


def test_legacy_header_no_longer_grants_access(make_user):
    victim = make_user()
    attacker = TestClient(app)
    r = attacker.get("/api/rooms", headers={"X-User-ID": victim.user["id"]})
    assert r.status_code == 401


def test_guest_can_upgrade_to_account_and_keep_rooms(make_user):
    host = make_user("Хост")
    guest = make_user("Гость", register=False)
    room = host.post("/api/rooms", json={"title": "t", "question": "q", "method": "majority"}).json()
    guest.post(f"/api/rooms/{room['id']}/join")
    r = guest.post("/api/auth/register", json={"display_name": "Гость", "email": "guest-up@test.kz", "password": "secret123"})
    assert r.status_code == 201 and r.json()["user"]["id"] == guest.user["id"]
    assert [x["id"] for x in guest.get("/api/rooms").json()] == [room["id"]]


def test_change_password_and_delete_account(make_user):
    user = make_user()
    assert user.post("/api/auth/password", json={"current_password": "bad", "new_password": "newpass123"}).status_code == 403
    assert user.post("/api/auth/password", json={"current_password": "secret123", "new_password": "newpass123"}).status_code == 204
    assert user.post("/api/auth/delete", json={"password": "newpass123", "confirm": "УДАЛИТЬ"}).status_code == 204
    assert TestClient(app).post("/api/auth/login", json={"email": user.email, "password": "newpass123"}).status_code == 401


def test_recovery_is_not_simulated_without_smtp():
    c = TestClient(app)
    assert c.get("/api/auth/recovery").json()["available"] is False
    assert c.post("/api/auth/recovery/request", json={"email": "a@test.kz"}).status_code == 503


def test_session_endpoint_is_200_when_signed_out():
    r = TestClient(app).get("/api/auth/session")
    assert r.status_code == 200 and r.json() == {"user": None}
