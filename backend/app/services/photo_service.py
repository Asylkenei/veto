"""Automatic topical photos with a server-side cache.

Lookup order
1. Landmarks (`photo_query` starting with "wiki:"): the lead image of the best
   matching Russian Wikipedia article, restricted to freely licensed files.
2. Generic ideas ("bowling", "Пицца", …): Pexels → Unsplash → Wikimedia Commons
   search, depending on which API keys are configured.

Caching
* Wikimedia and Pexels images are downloaded once into DATA_DIR/photos and
  served from /media/photos, so the demo works offline and without rate limits.
* Unsplash forbids re-hosting: its URL is stored (hotlinked) and the required
  download ping is sent, as the API guidelines demand.
Every stored photo carries an attribution line shown under the image.
A failed lookup never breaks anything: the UI falls back to a category cover.
"""
import json
import logging
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import select
from app.core import config
from app.core.metrics import DOMAIN_EVENTS
from app.db.session import SessionLocal
from app.models import Option, Place

log = logging.getLogger("veto.photos")
UA = "VETO/2.1 (group decisions app; contact: support@veto.app)"
TIMEOUT = 8
MAX_BYTES = 4 * 1024 * 1024
_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="photos")


class Photo:
    def __init__(self, url: str, credit: str, download: bool, ping: str = ""):
        self.url, self.credit, self.download, self.ping = url, credit, download, ping


def _get_json(url: str, headers: dict | None = None) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode())


def _strip_html(value: str) -> str:
    return re.sub(r"<[^>]+>", "", value or "").strip()


# ---------------------------------------------------------------- providers

def _commons_file(file_title: str) -> Photo | None:
    q = urllib.parse.urlencode({
        "action": "query", "format": "json", "titles": file_title, "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": 900,
    })
    pages = _get_json(f"https://commons.wikimedia.org/w/api.php?{q}").get("query", {}).get("pages", {})
    for page in pages.values():
        info = (page.get("imageinfo") or [None])[0]
        if not info:
            continue
        meta = info.get("extmetadata", {})
        license_ = _strip_html(meta.get("LicenseShortName", {}).get("value", ""))
        if not license_ or "fair use" in license_.lower() or "non-free" in license_.lower():
            return None
        artist = _strip_html(meta.get("Artist", {}).get("value", ""))[:80] or "Wikimedia Commons"
        return Photo(info.get("thumburl") or info["url"], f"Фото: {artist}, {license_}, Wikimedia Commons", True)
    return None


def wikipedia_lead(query: str) -> Photo | None:
    q = urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search", "gsrsearch": query, "gsrlimit": 1,
        "prop": "pageimages", "piprop": "name", "pilicense": "free",
    })
    pages = _get_json(f"https://ru.wikipedia.org/w/api.php?{q}").get("query", {}).get("pages", {})
    for page in pages.values():
        if page.get("pageimage"):
            return _commons_file("File:" + page["pageimage"])
    return None


def commons_search(query: str) -> Photo | None:
    q = urllib.parse.urlencode({
        "action": "query", "format": "json", "list": "search", "srsearch": f"{query} filetype:bitmap",
        "srnamespace": 6, "srlimit": 5,
    })
    for hit in _get_json(f"https://commons.wikimedia.org/w/api.php?{q}").get("query", {}).get("search", []):
        photo = _commons_file(hit["title"])
        if photo:
            return photo
    return None


def pexels(query: str) -> Photo | None:
    if not config.PEXELS_API_KEY:
        return None
    q = urllib.parse.urlencode({"query": query, "per_page": 1, "orientation": "landscape", "locale": "ru-RU"})
    data = _get_json(f"https://api.pexels.com/v1/search?{q}", {"Authorization": config.PEXELS_API_KEY})
    photo = (data.get("photos") or [None])[0]
    if not photo:
        return None
    return Photo(photo["src"]["large"], f"Фото: {photo.get('photographer', 'Pexels')}, Pexels", True)


def unsplash(query: str) -> Photo | None:
    if not config.UNSPLASH_ACCESS_KEY:
        return None
    q = urllib.parse.urlencode({"query": query, "per_page": 1, "orientation": "landscape", "content_filter": "high"})
    data = _get_json(f"https://api.unsplash.com/search/photos?{q}", {"Authorization": f"Client-ID {config.UNSPLASH_ACCESS_KEY}"})
    photo = (data.get("results") or [None])[0]
    if not photo:
        return None
    name = photo.get("user", {}).get("name", "Unsplash")
    return Photo(photo["urls"]["regular"], f"Фото: {name}, Unsplash", False, photo.get("links", {}).get("download_location", ""))


def find(query: str) -> Photo | None:
    if query.startswith("wiki:"):
        return wikipedia_lead(query[5:])
    for provider in (pexels, unsplash, commons_search):
        try:
            photo = provider(query)
        except Exception:
            log.warning("photo provider failed", extra={"event": f"photo_{provider.__name__}_failed"})
            photo = None
        if photo:
            return photo
    return None


# ---------------------------------------------------------------- cache

def _store(photo: Photo, name: str) -> str:
    if not photo.download:
        if photo.ping and config.UNSPLASH_ACCESS_KEY:
            try:
                _get_json(photo.ping, {"Authorization": f"Client-ID {config.UNSPLASH_ACCESS_KEY}"})
            except Exception:
                pass
        return photo.url
    req = urllib.request.Request(photo.url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        if not resp.headers.get("Content-Type", "").startswith("image/"):
            raise ValueError("not an image")
        data = resp.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("image too large")
    safe = re.sub(r"[^a-z0-9-]", "-", name.lower())[:80]
    (config.PHOTO_DIR / f"{safe}.jpg").write_bytes(data)
    return f"/media/photos/{safe}.jpg"


def fetch_place(place_id: str) -> bool:
    with SessionLocal() as db:
        place = db.get(Place, place_id)
        if not place or place.image_url or not place.photo_query:
            return False
        photo = find(place.photo_query)
        if not photo:
            return False
        place.image_url = _store(photo, f"place-{place.id}")
        place.image_credit = photo.credit
        db.commit()
        DOMAIN_EVENTS.labels("photo_cached").inc()
        return True


def fetch_option(option_id: str) -> None:
    from app.services.room_service import bump

    with SessionLocal() as db:
        option = db.get(Option, option_id)
        if not option or option.image_url:
            return
        if option.place_id:
            place = db.get(Place, option.place_id)
            if place and place.image_url:
                option.image_url, option.image_credit = place.image_url, place.image_credit
        else:
            try:
                photo = find(option.title)
                if photo:
                    option.image_url = _store(photo, f"option-{option.id}")
                    option.image_credit = photo.credit
            except Exception:
                log.warning("option photo failed", extra={"event": "photo_option_failed"})
        if option.image_url:
            bump(db, option.room_id)  # participants get the photo live via SSE
            db.commit()


def queue_option(option_id: str) -> None:
    if config.PHOTOS_ENABLED:
        _pool.submit(fetch_option, option_id)


def warm_places() -> int:
    """Fill missing place photos (runs in the background at startup)."""
    if not config.PHOTOS_ENABLED:
        return 0
    with SessionLocal() as db:
        ids = list(db.scalars(select(Place.id).where(Place.image_url == "", Place.photo_query != "")))
    done = 0
    for pid in ids:
        try:
            done += fetch_place(pid)
        except Exception:
            log.warning("place photo failed", extra={"event": "photo_place_failed"})
    if ids:
        log.info(f"photos cached: {done}/{len(ids)}", extra={"event": "photo_warmup"})
    return done
