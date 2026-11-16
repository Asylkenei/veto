from tests.conftest import make_room


def test_catalogue_random_excludes_visited_and_shown(make_user):
    u = make_user()
    places = u.get("/api/places").json()
    assert len(places) > 10
    target = places[0]["id"]
    u.put(f"/api/places/{target}/visited", json={"value": True})
    shown = []
    for _ in range(len(places) - 1):
        r = u.post("/api/places/random", json={"exclude": shown}).json()
        assert r["place"]["id"] != target and r["place"]["id"] not in shown
        shown.append(r["place"]["id"])
    assert u.post("/api/places/random", json={"exclude": shown}).json()["exhausted"] is True


def test_place_of_day_is_stable(make_user):
    u = make_user()
    assert u.get("/api/places/today").json() == u.get("/api/places/today").json()


def test_recent_comes_from_real_history_and_popularity_is_honest(make_user):
    u = make_user()
    assert u.get("/api/places/recent").json() == []
    room = make_room(u, options=())
    u.post(f"/api/rooms/{room['id']}/options", json={"title": "Медеу", "place_id": "almaty-medeu"})
    assert [p["id"] for p in u.get("/api/places/recent").json()] == ["almaty-medeu"]
    popular = u.get("/api/places/popular").json()
    assert popular["is_popularity"] is True and popular["items"][0]["times_chosen"] >= 1


def test_support_ticket_is_stored(make_user):
    u = make_user()
    r = u.post("/api/support/tickets", json={"kind": "bug", "category": "results", "subject": "Ошибка", "message": "Не вижу результат после голосования"})
    assert r.status_code == 201
    assert u.get("/api/support/tickets").json()[0]["id"] == r.json()["id"]


def test_settings_profile_and_prefs(make_user):
    u = make_user()
    r = u.patch("/api/auth/me", json={"display_name": "Новое имя", "theme": "dark", "notification_prefs": {"voting": False}})
    body = r.json()
    assert body["display_name"] == "Новое имя" and body["theme"] == "dark" and body["notification_prefs"]["voting"] is False


def test_meta_and_metrics(_app):
    assert _app.get("/api/meta").json()["features"]["live_updates"] is True
    assert "veto_http_requests_total" in _app.get("/metrics").text
