FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DATA_DIR=/data \
    ENVIRONMENT=production

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
# Alembic runs on startup (app lifespan), so migrations must be in the image.
COPY backend/alembic.ini ./alembic.ini
COPY backend/migrations ./migrations
COPY backend/scripts ./scripts

# /data keeps cached photos and the Web Push (VAPID) key between deploys.
RUN addgroup --system app \
    && adduser --system --ingroup app --home /app app \
    && mkdir -p /data/photos \
    && chown -R app:app /data

USER app
VOLUME ["/data"]

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
