from app.core import config
from app.db.session import SessionLocal
from app.models import Place
from app.services import photo_service
from app.services.photo_service import Photo


def test_place_photo_is_downloaded_once_and_credited(_app, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PHOTO_DIR", tmp_path)
    calls = []
    monkeypatch.setattr(photo_service, "find", lambda q: calls.append(q) or Photo("https://x/img.jpg", "Фото: Автор, CC BY-SA 4.0, Wikimedia Commons", True))

    class Resp:
        headers = {"Content-Type": "image/jpeg"}
        def read(self, n): return b"\xff\xd8jpeg"
        def __enter__(self): return self
        def __exit__(self, *a): pass

    monkeypatch.setattr(photo_service.urllib.request, "urlopen", lambda *a, **k: Resp())
    assert photo_service.fetch_place("astana-baiterek") is True
    assert photo_service.fetch_place("astana-baiterek") is False  # cached: no second lookup
    with SessionLocal() as db:
        place = db.get(Place, "astana-baiterek")
        assert place.image_url == "/media/photos/place-astana-baiterek.jpg" and "Wikimedia" in place.image_credit
    assert (tmp_path / "place-astana-baiterek.jpg").exists() and calls == ["wiki:Байтерек монумент Астана"]


def test_unsplash_is_hotlinked_not_rehosted(monkeypatch):
    pinged = []
    monkeypatch.setattr(config, "UNSPLASH_ACCESS_KEY", "k")
    monkeypatch.setattr(photo_service, "_get_json", lambda url, h=None: pinged.append(url) or {})
    url = photo_service._store(Photo("https://images.unsplash.com/x", "Фото: A, Unsplash", False, "https://api.unsplash.com/dl"), "option-1")
    assert url == "https://images.unsplash.com/x" and pinged == ["https://api.unsplash.com/dl"]


def test_failed_provider_falls_through(monkeypatch):
    def boom(q): raise OSError("offline")
    monkeypatch.setattr(photo_service, "pexels", boom)
    monkeypatch.setattr(photo_service, "unsplash", lambda q: None)
    monkeypatch.setattr(photo_service, "commons_search", lambda q: Photo("u", "c", True))
    assert photo_service.find("bowling").url == "u"
