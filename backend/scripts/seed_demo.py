"""Create demo accounts and decisions in every state, for the jury demo.

    cd backend && python -m scripts.seed_demo

All demo accounts use the password `demo1234`. Safe to run more than once
(existing demo accounts are reused).
"""
from fastapi.testclient import TestClient
from app.main import app

PASSWORD = "demo1234"
USERS = [("Аружан", "aruzhan@demo.veto"), ("Тимур", "timur@demo.veto"), ("Дана", "dana@demo.veto"), ("Ерлан", "erlan@demo.veto")]


def client_for(name: str, email: str) -> TestClient:
    c = TestClient(app)
    r = c.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    if r.status_code != 200:
        r = c.post("/api/auth/register", json={"display_name": name, "email": email, "password": PASSWORD})
        r.raise_for_status()
    return c


def room(host, title, question, method, options, **extra):
    r = host.post("/api/rooms", json={"title": title, "question": question, "method": method, **extra}).json()
    for item in options:
        title_, place = item if isinstance(item, tuple) else (item, None)
        r = host.post(f"/api/rooms/{r['id']}/options", json={"title": title_, "place_id": place}).json()
    return r


def oid(r, title):
    return next(o["id"] for o in r["options"] if o["title"] == title)


def main() -> None:
    with TestClient(app):
        a, t, d, e = (client_for(n, m) for n, m in USERS)
        people = [t, d, e]

        # 1. Collecting options, with a pending suggestion
        r = room(a, "Корпоратив в декабре", "Где отмечаем Новый год командой?", "objections",
                 [("Боулинг", "any-bowling"), ("Квест-комната", "any-escape-room")])
        for c in people:
            c.post(f"/api/rooms/{r['id']}/join")
        t.post(f"/api/rooms/{r['id']}/options", json={"title": "Караоке", "place_id": "any-karaoke"})

        # 2. Voting in progress
        r = room(a, "Кино в пятницу", "Какой фильм смотрим?", "majority", ["Дюна 2", "Интерстеллар", "Остров проклятых"])
        for c in people:
            c.post(f"/api/rooms/{r['id']}/join")
        r = a.post(f"/api/rooms/{r['id']}/start").json()
        a.post(f"/api/rooms/{r['id']}/votes", json={"choice_option_id": oid(r, "Интерстеллар")})
        t.post(f"/api/rooms/{r['id']}/votes", json={"choice_option_id": oid(r, "Дюна 2")})

        # 3. Completed: majority winner
        r = room(t, "Ужин в субботу", "Куда идём ужинать?", "majority", [("Зелёный базар", "almaty-green-bazaar"), ("Гастрономический маркет", "any-food-court")])
        for c in (a, d):
            c.post(f"/api/rooms/{r['id']}/join")
        r = t.post(f"/api/rooms/{r['id']}/start").json()
        for c, pick in ((t, "Гастрономический маркет"), (a, "Гастрономический маркет"), (d, "Зелёный базар")):
            c.post(f"/api/rooms/{r['id']}/votes", json={"choice_option_id": oid(r, pick)})

        # 4. Unanimity 50/50 — ready for the randomizer demo
        r = room(a, "Поездка на выходные", "Куда поедем?", "unanimity", [("Медеу", "almaty-medeu"), ("Чарынский каньон", "almaty-charyn")])
        d.post(f"/api/rooms/{r['id']}/join")
        r = a.post(f"/api/rooms/{r['id']}/start").json()
        a.post(f"/api/rooms/{r['id']}/votes", json={"choice_option_id": oid(r, "Медеу")})
        d.post(f"/api/rooms/{r['id']}/votes", json={"choice_option_id": oid(r, "Чарынский каньон")})
        print("Demo ready. Log in as aruzhan@demo.veto / demo1234 (also timur@, dana@, erlan@).")


if __name__ == "__main__":
    main()
