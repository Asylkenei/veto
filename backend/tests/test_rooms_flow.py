from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import make_room, option_id


def test_full_majority_flow_and_live_version(make_user):
    host, bob = make_user("Хост"), make_user("Боб")
    room = make_room(host)
    assert room["invite_code"] and len(room["invite_code"]) == 6
    preview = bob.get(f"/api/rooms/{room['id']}").json()
    assert preview["is_member"] is False and preview["options"] == []  # invite preview hides details
    assert bob.get(f"/api/rooms/by-code/{room['invite_code'].lower()}").json()["room_id"] == room["id"]
    room = bob.post(f"/api/rooms/{room['id']}/join").json()
    v0 = room["version"]
    room = host.post(f"/api/rooms/{room['id']}/start").json()
    assert room["status"] == "VOTING" and room["version"] > v0
    pizza = option_id(room, "Пицца")
    host.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": pizza})
    assert host.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": pizza}).status_code == 409
    room = bob.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": pizza}).json()
    assert room["status"] == "COMPLETED" and room["rounds"][-1]["result"]["winner"]["id"] == pizza
    kinds = [n["type"] for n in bob.get("/api/notifications").json()["items"]]
    assert "voting_started" in kinds and "result_ready" in kinds


def test_only_host_controls_and_strangers_cannot_vote(make_user):
    host, bob, eve = make_user(), make_user(), make_user()
    room = make_room(host)
    bob.post(f"/api/rooms/{room['id']}/join")
    assert bob.post(f"/api/rooms/{room['id']}/start").status_code == 403
    assert bob.patch(f"/api/rooms/{room['id']}", json={"title": "hack"}).status_code == 403
    host.post(f"/api/rooms/{room['id']}/start")
    assert eve.post(f"/api/rooms/{room['id']}/join").status_code == 409  # locked during voting
    assert eve.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": "x"}).status_code == 403


def test_leave_edit_delete_option_before_voting(make_user):
    host, bob = make_user(), make_user()
    room = make_room(host, options=())
    bob.post(f"/api/rooms/{room['id']}/join")
    room = bob.post(f"/api/rooms/{room['id']}/options", json={"title": "Кино"}).json()
    oid = option_id(room, "Кино")
    assert host.put(f"/api/rooms/{room['id']}/options/{oid}", json={"title": "Кино 2"}).status_code == 200  # host may edit
    other = make_user()
    other.post(f"/api/rooms/{room['id']}/join")
    assert other.put(f"/api/rooms/{room['id']}/options/{oid}", json={"title": "x"}).status_code == 403
    room = bob.delete(f"/api/rooms/{room['id']}/options/{oid}").json()
    assert all(o["id"] != oid for o in room["options"])
    assert bob.post(f"/api/rooms/{room['id']}/leave").status_code == 204
    assert host.post(f"/api/rooms/{room['id']}/leave").status_code == 409


def test_options_locked_after_start(make_user):
    host, bob = make_user(), make_user()
    room = make_room(host)
    bob.post(f"/api/rooms/{room['id']}/join")
    host.post(f"/api/rooms/{room['id']}/start")
    oid = room["options"][0]["id"]
    assert host.delete(f"/api/rooms/{room['id']}/options/{oid}").status_code == 409
    assert bob.post(f"/api/rooms/{room['id']}/leave").status_code == 409


def test_tie_tiebreak_and_runoff(make_user):
    host, bob = make_user(), make_user()
    room = make_room(host, method="unanimity")
    bob.post(f"/api/rooms/{room['id']}/join")
    room = host.post(f"/api/rooms/{room['id']}/start").json()
    host.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": option_id(room, "Пицца")})
    room = bob.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": option_id(room, "Суши")}).json()
    result = room["rounds"][-1]["result"]
    assert room["status"] == "NO_CONSENSUS" and result["tie"] and len(result["tiebreak_candidates"]) == 2
    assert bob.post(f"/api/rooms/{room['id']}/tiebreak").status_code == 403
    room = host.post(f"/api/rooms/{room['id']}/tiebreak").json()
    draw = room["rounds"][-1]["tiebreak"]
    assert draw["option"]["id"] in {c["id"] for c in result["tiebreak_candidates"]}
    # Random choice is NOT unanimity: original result and status untouched
    assert room["status"] == "NO_CONSENSUS" and room["rounds"][-1]["result"]["success"] is False
    assert bob.get(f"/api/rooms/{room['id']}").json()["rounds"][-1]["tiebreak"] == draw  # same for everyone
    assert host.post(f"/api/rooms/{room['id']}/tiebreak").status_code == 409  # only once
    room = host.post(f"/api/rooms/{room['id']}/runoff").json()
    assert room["status"] == "VOTING" and room["rounds"][-1]["kind"] == "runoff"
    assert len(room["rounds"][-1]["option_ids"]) == 2


def test_no_tiebreak_without_equal_leaders(make_user):
    host, a, b = make_user(), make_user(), make_user()
    room = make_room(host, method="unanimity")
    for c in (a, b):
        c.post(f"/api/rooms/{room['id']}/join")
    room = host.post(f"/api/rooms/{room['id']}/start").json()
    p, s = option_id(room, "Пицца"), option_id(room, "Суши")
    host.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": p})
    a.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": p})
    b.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": s})
    assert host.post(f"/api/rooms/{room['id']}/tiebreak").status_code == 409


def test_force_finish_and_deadline(make_user):
    host, bob = make_user(), make_user()
    room = make_room(host)
    bob.post(f"/api/rooms/{room['id']}/join")
    room = host.post(f"/api/rooms/{room['id']}/start").json()
    host.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": option_id(room, "Суши")})
    assert bob.post(f"/api/rooms/{room['id']}/finish").status_code == 403
    room = host.post(f"/api/rooms/{room['id']}/finish").json()
    rnd = room["rounds"][-1]
    assert rnd["end_reason"] == "forced" and rnd["result"]["submitted"] == 1 and rnd["result"]["total"] == 2

    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    assert host.post("/api/rooms", json={"title": "t", "question": "q", "method": "majority", "deadline": past}).status_code == 422


def test_deadline_closes_voting(make_user):
    from app.db.session import SessionLocal
    from app.models import Room
    host, bob = make_user(), make_user()
    soon = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    room = make_room(host, deadline=soon)
    bob.post(f"/api/rooms/{room['id']}/join")
    host.post(f"/api/rooms/{room['id']}/start")
    with SessionLocal() as db:
        db.get(Room, room["id"]).deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    room = bob.get(f"/api/rooms/{room['id']}").json()
    assert room["status"] in ("COMPLETED", "NO_CONSENSUS") and room["rounds"][-1]["end_reason"] == "deadline"


def test_hidden_results_until_end(make_user):
    host, bob = make_user(), make_user()
    room = make_room(host, hide_results=True)
    bob.post(f"/api/rooms/{room['id']}/join")
    room = host.post(f"/api/rooms/{room['id']}/start").json()
    host.post(f"/api/rooms/{room['id']}/votes", json={"choice_option_id": option_id(room, "Пицца")})
    seen_by_bob = bob.get(f"/api/rooms/{room['id']}").json()["rounds"][-1]["ballots"]
    assert seen_by_bob[0]["choice_option_id"] is None


def test_objections_requires_every_option(make_user):
    host, bob = make_user(), make_user()
    room = make_room(host, method="objections")
    bob.post(f"/api/rooms/{room['id']}/join")
    room = host.post(f"/api/rooms/{room['id']}/start").json()
    p = option_id(room, "Пицца")
    assert host.post(f"/api/rooms/{room['id']}/votes", json={"details": {p: "yes"}}).status_code == 422


def test_invite_by_email_creates_notification(make_user):
    host, bob = make_user(), make_user()
    room = make_room(host)
    assert host.post(f"/api/rooms/{room['id']}/invite", json={"email": bob.email}).status_code == 200
    assert bob.get("/api/notifications").json()["items"][0]["type"] == "invited"
    assert host.post(f"/api/rooms/{room['id']}/invite", json={"email": "ghost@test.kz"}).status_code == 404


def test_unauthenticated_requests_are_rejected():
    c = TestClient(app)
    assert c.get("/api/rooms").status_code == 401
    assert c.post("/api/rooms", json={"title": "t", "question": "q", "method": "majority"}).status_code == 401


def test_host_reorders_options_and_voting_keeps_order(make_user):
    host, bob = make_user(), make_user()
    room = make_room(host, options=("А", "Б", "В"))
    ids = [o["id"] for o in room["options"]]
    bob.post(f"/api/rooms/{room['id']}/join")
    assert bob.put(f"/api/rooms/{room['id']}/options/order", json={"ids": ids[::-1]}).status_code == 403
    assert host.put(f"/api/rooms/{room['id']}/options/order", json={"ids": ids[:2]}).status_code == 422
    room = host.put(f"/api/rooms/{room['id']}/options/order", json={"ids": ids[::-1]}).json()
    assert [o["title"] for o in room["options"]] == ["В", "Б", "А"]
    room = bob.post(f"/api/rooms/{room['id']}/options", json={"title": "Г"}).json()
    assert room["options"][-1]["title"] == "Г"  # new options go to the end
    room = host.post(f"/api/rooms/{room['id']}/start").json()
    assert host.put(f"/api/rooms/{room['id']}/options/order", json={"ids": ids}).status_code == 409
