"""Download topical photos for every place into DATA_DIR/photos (run once before a demo).

    cd backend && python -m scripts.fetch_photos

Needs internet. Optional keys for better generic photos: PEXELS_API_KEY, UNSPLASH_ACCESS_KEY.
"""
from app.db.migrate import upgrade_database
from app.db.session import SessionLocal
from app.services.photo_service import warm_places
from app.services.place_seed import seed_places

if __name__ == "__main__":
    upgrade_database()
    with SessionLocal() as db:
        seed_places(db)
    print(f"Новых фото сохранено: {warm_places()}")
