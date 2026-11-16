# Архитектура и выпуск в продакшен

## Компоненты
```
Browser (React SPA) ──HTTP/JSON──▶ FastAPI ──SQLAlchemy──▶ PostgreSQL
        ▲                           │  ├─ services/ (бизнес-правила, проверки прав)
        └──── SSE (live) ◀──────────┤  ├─ decision_service (чистые функции подсчёта)
        ◀──── Web Push ◀── pywebpush┤  ├─ scheduler (дедлайны, напоминания)
                                     │  └─ /metrics ──▶ Prometheus ──▶ Grafana / alerts
```
- **Слои backend:** `api/routes` (HTTP, валидация) → `services` (правила и права) → `crud`/`models` (данные). Decision Engine — чистые функции без БД, покрыты юнит-тестами.
- **Все критичные операции на сервере:** права организатора, фиксация участников и вариантов при старте, один голос на участника (UNIQUE в БД), подсчёт, жребий.
- **Live-обновления:** каждая мутация увеличивает `rooms.version`. SSE-поток раз в 0,8 с читает одно число по первичному ключу и отправляет комнату целиком только при изменении. Фронтенд держит резервный опрос раз в 15 с.
- **Авторизация:** непрозрачный токен; в БД хранится только его SHA-256. Cookie `HttpOnly; SameSite=Lax; Secure` за HTTPS. Также поддерживается `Authorization: Bearer`.
- **Уведомления:** пишутся в той же транзакции, что и событие. Push отправляется после commit в фоновом пуле и не тормозит запрос.

## Модель данных (новое в 2.0, только аддитивно)
`users` (+email, password_hash, is_guest, prefs, theme, city, deleted_at), `auth_sessions`, `password_reset_tokens`, `rooms` (+invite_code, version, template), `rounds` (+kind, end_reason, tiebreak_json, reminder_sent), `options` (+place_id), `notifications`, `push_subscriptions`, `support_tickets`, `places`, `place_categories`, `user_place_history`, `user_visited_places`, `saved_places`, `daily_place_recommendations`. Ни одна таблица и ни одно поле MVP не удалены.

## Миграции
- Alembic: `0001_baseline` (схема MVP) → `0002_veto_2`. Применяются при старте приложения.
- База MVP без `alembic_version` автоматически помечается как baseline, затем накатывается 0002. Проверено на PostgreSQL 16: чистая установка, `upgrade → downgrade → upgrade` и база, созданная MVP через create_all (данные и порядок вариантов сохраняются).
- CI проверяет `upgrade → downgrade base → upgrade`.

## Релиз
1. Push в `main` → CI: тесты backend, сборка frontend, сборка Docker-образа, smoke-тест контейнера (`/api/health`, `/api/meta`, SPA), публикация в GHCR с тегами `sha` и `latest`.
2. На сервере: `docker compose pull && docker compose up -d`. Миграции выполняются до приёма трафика; healthcheck контейнера — `/api/health`.
3. Конфигурация через переменные окружения (`.env.example`), секреты не хранятся в образе. Данные — в volume `/data`.

## Откат
- Код: `docker compose up -d` с предыдущим тегом образа (`ghcr.io/...:<sha>`).
- Схема: 0002 аддитивна, поэтому старый код работает с новой схемой. Явный откат: `alembic downgrade 0001_baseline`.
- Перед релизом: бэкап базы `docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`.

## Риски и как они закрыты
| Риск | Мера |
|---|---|
| Гонка двух последних голосов | UNIQUE(round_id, user_id); подсчёт в той же транзакции, что и голос |
| Рандомайзер выдают за решение | Отдельное поле `tiebreak`, статус и `result.success` не меняются, в UI метка «Не единогласие» |
| Разный жребий у участников | Жребий один раз на сервере (`secrets.choice`), повтор запрещён (409) |
| Подмена пользователя | Удалён заголовок `X-User-ID`; есть тест, что он больше не даёт доступа |
| Потеря данных MVP | Только аддитивная миграция + автоматический stamp baseline |
| SSE за прокси | `X-Accel-Buffering: no` + `proxy_buffering off` и `proxy_read_timeout 1h` в `nginx/default.conf` |
| Масштабирование | Состояние SSE не хранится в памяти: несколько воркеров и инстансов backend работают с общим PostgreSQL |
| Нет почты на сервере | Восстановление честно недоступно, путь через поддержку |

## Наблюдаемость
- JSON-логи: `request_id` (возвращается в `X-Request-ID`), метод, маршрут, статус, длительность, `user_id`, бизнес-события.
- Метрики: `veto_http_requests_total`, `veto_http_request_duration_seconds`, `veto_domain_events_total{event}`, `veto_sse_connections`, `veto_push_sent_total`, `veto_unhandled_errors_total`.
- Grafana (`deploy/grafana`): RPS, p95, доля 5xx, live-подключения, бизнес-события, push. Алерты Prometheus: сервис недоступен, 5xx > 5%, p95 > 500 мс.
