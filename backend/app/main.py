import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from app import models  # noqa: F401 — register model metadata
from app.api.routes import ALL as ROUTERS
from app.core import config
from app.core.errors import AppError
from app.core.logging import request_id_var, setup_logging
from app.core.metrics import APP_ERRORS, HTTP_LATENCY, HTTP_REQUESTS
from app.db.migrate import upgrade_database
from app.db.session import SessionLocal
from app.services import notification_service, photo_service, scheduler
from app.services.place_seed import seed_places

setup_logging()
log = logging.getLogger("veto")

FIELD_NAMES = {
    "email": "Email", "password": "Пароль", "display_name": "Имя", "title": "Название",
    "question": "Вопрос", "message": "Сообщение", "subject": "Тема", "text": "Текст",
    "new_password": "Новый пароль", "confirm": "Подтверждение",
}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    upgrade_database()
    with SessionLocal() as db:
        seed_places(db)
    notification_service.vapid_keys()
    photo_service._pool.submit(photo_service.warm_places)  # never blocks startup
    stop = asyncio.Event()
    task = asyncio.create_task(scheduler.run_forever(stop))
    log.info("VETO started", extra={"event": "startup"})
    yield
    stop.set()
    await task


app = FastAPI(
    title="VETO API",
    version=config.APP_VERSION,
    description="Конструктор групповых решений. Авторизация — cookie `veto_session` или `Authorization: Bearer <token>`.",
    lifespan=lifespan,
)


@app.middleware("http")
async def observe(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    token = request_id_var.set(rid)
    start = time.perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        response.headers["X-Request-ID"] = rid
        return response
    finally:
        route = request.scope.get("route")
        path = getattr(route, "path", "unmatched")
        elapsed = time.perf_counter() - start
        if path.startswith(config.API_PREFIX) and not path.endswith("/stream"):
            HTTP_REQUESTS.labels(request.method, path, str(status)).inc()
            HTTP_LATENCY.labels(request.method, path).observe(elapsed)
            log.info(
                "request",
                extra={
                    "method": request.method,
                    "path": path,
                    "status": status,
                    "duration_ms": round(elapsed * 1000, 1),
                    "user_id": getattr(request.state, "user_id", None),
                },
            )
        request_id_var.reset(token)


@app.exception_handler(AppError)
def handle_app_error(_request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
def handle_validation(_request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = next((str(p) for p in reversed(first.get("loc", [])) if isinstance(p, str)), "")
    label = FIELD_NAMES.get(field, field)
    kind = first.get("type", "")
    if "email" in kind or field == "email":
        message = "Укажите корректный email"
    elif kind == "string_too_short":
        message = f"{label}: слишком короткое значение" if label else "Слишком короткое значение"
    elif kind == "string_too_long":
        message = f"{label}: слишком длинное значение"
    elif kind == "missing":
        message = f"Заполните поле «{label}»"
    elif field == "confirm":
        message = "Введите слово УДАЛИТЬ для подтверждения"
    else:
        message = f"Проверьте поле «{label}»" if label else "Проверьте введённые данные"
    return JSONResponse(status_code=422, content={"detail": message, "errors": jsonable(exc.errors())})


def jsonable(errors):
    return [{"loc": e.get("loc"), "type": e.get("type"), "msg": e.get("msg")} for e in errors]


@app.exception_handler(Exception)
def handle_unexpected(_request: Request, exc: Exception):
    APP_ERRORS.inc()
    log.exception("unhandled error")
    return JSONResponse(
        status_code=500,
        content={"detail": "Что-то пошло не так на сервере. Мы уже видим ошибку в логах.", "request_id": request_id_var.get()},
    )


for router in ROUTERS:
    app.include_router(router, prefix=config.API_PREFIX)


@app.get("/metrics", include_in_schema=False)
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


app.mount("/media/photos", StaticFiles(directory=config.PHOTO_DIR), name="photos")

if (config.FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")


def _index():
    if (config.FRONTEND_DIST / "index.html").is_file():
        return FileResponse(config.FRONTEND_DIST / "index.html", headers={"Cache-Control": "no-cache"})
    return JSONResponse({"message": "VETO API is running. Start the frontend with `npm run dev` from frontend/."})


@app.get("/", include_in_schema=False)
def frontend_index():
    return _index()


@app.get("/{full_path:path}", include_in_schema=False)
def frontend_fallback(full_path: str):
    # Keep React Router deep links refreshable when FastAPI serves the production build.
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    dist = config.FRONTEND_DIST.resolve()
    candidate = (config.FRONTEND_DIST / full_path).resolve()
    if dist.is_dir() and candidate.is_file() and dist in candidate.parents:
        headers = {"Cache-Control": "no-cache"} if candidate.name in ("sw.js", "manifest.webmanifest") else None
        return FileResponse(candidate, headers=headers)
    return _index()
