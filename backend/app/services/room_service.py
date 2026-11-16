"""Room lifecycle: collecting -> voting -> completed / no consensus -> (new round).

All permission checks and every state transition happen here, on the server.
Every mutation bumps `room.version`, which drives the live (SSE) updates.
"""
import json
import logging
import secrets
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from app.core.errors import AppError
from app.core.metrics import DOMAIN_EVENTS
from app.crud import rooms as room_crud, votes as vote_crud
from app.models import Option, Participant, Place, Room, User, UserPlaceHistory
from app.schemas.rooms import RoomCreate, RoomUpdate
from app.schemas.votes import VoteSubmit
from app.services.decision_service import calculate
from app.services.notification_service import flush_push, notify

log = logging.getLogger("veto.rooms")
FINAL = {"COMPLETED", "NO_CONSENSUS", "CANCELLED"}
OPEN = {"COLLECTING", "READY"}
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _event(name: str, room_id: str, user_id: str | None = None) -> None:
    DOMAIN_EVENTS.labels(name).inc()
    log.info(name, extra={"event": name, "room_id": room_id, "user_id": user_id})


def bump(db: Session, room_id: str) -> None:
    db.execute(
        update(Room).where(Room.id == room_id).values(version=Room.version + 1, updated_at=_now())
    )


def commit(db: Session, room_id: str) -> None:
    bump(db, room_id)
    db.commit()
    flush_push(db)
    from app.services.photo_service import queue_option

    for option_id in db.info.pop("new_options", []):
        queue_option(option_id)


def new_invite_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if not db.scalar(select(Room.id).where(Room.invite_code == code)):
            return code


def require_room(db: Session, room_id: str) -> Room:
    room = room_crud.get(db, room_id)
    if not room:
        raise AppError(404, "Комната не найдена. Проверьте ссылку.")
    return room


def is_member(db: Session, room_id: str, user_id: str) -> bool:
    return room_crud.get_participant(db, room_id, user_id) is not None


def require_member(db: Session, room: Room, user: User, message: str = "Сначала присоединитесь к комнате по приглашению") -> None:
    if not is_member(db, room.id, user.id):
        raise AppError(403, message)


def require_host(room: Room, user: User, message: str = "Это действие доступно только организатору") -> None:
    if room.host_id != user.id:
        raise AppError(403, message)


def member_ids(room: Room) -> list[str]:
    return [p.user_id for p in room.participants]


def link(room: Room, page: str = "") -> str:
    return f"/rooms/{room.id}{('/' + page) if page else ''}"


# ---------------------------------------------------------------- serialize

def _option(o: Option, viewer_id: str | None, room: Room) -> dict:
    editable = room.status in OPEN and viewer_id in (o.author_id, room.host_id)
    return {
        "id": o.id,
        "title": o.title,
        "description": o.description,
        "author": o.author.display_name,
        "author_id": o.author_id,
        "status": o.status,
        "rejection_reason": o.rejection_reason,
        "place_id": o.place_id,
        "can_edit": editable,
        "position": o.position,
        "image_url": o.image_url,
        "image_credit": o.image_credit,
    }


def serialize_room(room: Room, viewer_id: str | None = None) -> dict:
    member = any(p.user_id == viewer_id for p in room.participants)
    host_name = next(
        (p.user.display_name for p in room.participants if p.user_id == room.host_id), "Организатор"
    )
    data = {
        "id": room.id,
        "title": room.title,
        "question": room.question,
        "description": room.description,
        "method": room.method,
        "status": room.status,
        "host_id": room.host_id,
        "host_name": host_name,
        "participant_count": len(room.participants),
        "allow_suggestions": room.allow_suggestions,
        "allow_comments": room.allow_comments,
        "hide_results": room.hide_results,
        "deadline": _aware(room.deadline),
        "created_at": _aware(room.created_at),
        "updated_at": _aware(room.updated_at or room.created_at),
        "invite_code": room.invite_code if member else None,
        "template": room.template,
        "version": room.version,
        "is_host": viewer_id == room.host_id,
        "is_member": member,
        "current_user_id": viewer_id,
        "participants": [
            {
                "id": p.user_id,
                "display_name": p.user.display_name,
                "role": p.role,
                "avatar_color": p.user.avatar_color,
            }
            for p in room.participants
        ],
        "options": [],
        "comments": [],
        "rounds": [],
    }
    if not member:
        return data  # invite preview: no options, comments or ballots
    ordered = sorted(room.options, key=lambda o: (o.position, o.created_at or room.created_at))
    data["options"] = [_option(o, viewer_id, room) for o in ordered]
    data["comments"] = [
        {
            "id": c.id,
            "option_id": c.option_id,
            "author": c.author.display_name,
            "text": c.text,
            "created_at": c.created_at,
        }
        for c in room.comments
    ]
    for rnd in room.rounds:
        reveal = not room.hide_results or rnd.status in FINAL
        ballots = [
            {
                "participant_id": v.user_id,
                "choice_option_id": v.choice_option_id if reveal or v.user_id == viewer_id else None,
                "details": (
                    [{"option_id": d.option_id, "stance": d.stance} for d in v.details]
                    if reveal or v.user_id == viewer_id
                    else []
                ),
            }
            for v in rnd.votes
        ]
        data["rounds"].append(
            {
                "id": rnd.id,
                "number": rnd.number,
                "status": rnd.status,
                "kind": rnd.kind,
                "end_reason": rnd.end_reason,
                "participant_ids": json.loads(rnd.frozen_participants_json or "[]"),
                "option_ids": json.loads(rnd.frozen_options_json or "[]"),
                "ballots": ballots,
                "result": json.loads(rnd.result_json) if rnd.result_json and reveal else None,
                "tiebreak": json.loads(rnd.tiebreak_json) if rnd.tiebreak_json else None,
                "started_at": _aware(rnd.started_at),
                "ended_at": _aware(rnd.ended_at),
            }
        )
    return data


# ---------------------------------------------------------------- reads

def list_rooms(db: Session, user: User) -> list[dict]:
    rooms = room_crud.list_for_user(db, user.id)
    if any(enforce_deadline(db, room) for room in rooms):
        rooms = room_crud.list_for_user(db, user.id)
    return [serialize_room(room, user.id) for room in rooms]


def get_room(db: Session, room_id: str, user: User) -> dict:
    room = require_room(db, room_id)
    if enforce_deadline(db, room):
        room = require_room(db, room_id)
    return serialize_room(room, user.id)


def find_by_code(db: Session, code: str) -> str:
    room_id = db.scalar(select(Room.id).where(func.upper(Room.invite_code) == code.strip().upper()))
    if not room_id:
        raise AppError(404, "Комната с таким кодом не найдена")
    return room_id


# ---------------------------------------------------------------- create / settings

def _validate_deadline(deadline: datetime | None) -> datetime | None:
    deadline = _aware(deadline)
    if deadline and deadline <= _now():
        raise AppError(422, "Срок голосования должен быть в будущем")
    return deadline


def create_room(db: Session, user: User, data: RoomCreate) -> dict:
    room = room_crud.create(
        db,
        title=data.title,
        question=data.question,
        description=data.description,
        method=data.method,
        host=user,
        allow_suggestions=data.allow_suggestions,
        allow_comments=data.allow_comments,
        hide_results=data.hide_results,
        deadline=_validate_deadline(data.deadline),
        invite_code=new_invite_code(db),
        template=data.template,
    )
    for item in data.options:
        _insert_option(db, room, user, item.title, item.description, item.place_id)
    commit(db, room.id)
    _event("room_created", room.id, user.id)
    return serialize_room(require_room(db, room.id), user.id)


def update_room(db: Session, room_id: str, user: User, data: RoomUpdate) -> dict:
    room = require_room(db, room_id)
    require_host(room, user, "Изменять настройки может только организатор")
    if room.status not in OPEN:
        raise AppError(409, "Настройки можно менять только до начала голосования")
    values = data.model_dump(exclude_unset=True)
    if "deadline" in values:
        values["deadline"] = _validate_deadline(values["deadline"])
    for key, value in values.items():
        setattr(room, key, value.strip() if isinstance(value, str) else value)
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


# ---------------------------------------------------------------- membership

def join_room(db: Session, room_id: str, user: User) -> dict:
    room = require_room(db, room_id)
    if room_crud.get_participant(db, room_id, user.id) is None:
        if room.status not in OPEN:
            raise AppError(409, "Комната уже закрыта для новых участников")
        db.add(Participant(id=str(uuid4()), room_id=room_id, user_id=user.id, role="PARTICIPANT"))
        notify(
            db, [room.host_id], "participant_joined", f"{user.display_name} присоединился(ась)",
            room.title, room.id, link(room), exclude=user.id,
        )
        commit(db, room.id)
        _event("participant_joined", room.id, user.id)
    return serialize_room(require_room(db, room_id), user.id)


def leave_room(db: Session, room_id: str, user: User) -> None:
    room = require_room(db, room_id)
    participant = room_crud.get_participant(db, room_id, user.id)
    if not participant:
        raise AppError(404, "Вы не состоите в этой комнате")
    if room.host_id == user.id:
        raise AppError(409, "Организатор не может покинуть свою комнату")
    if room.status not in OPEN:
        raise AppError(409, "Покинуть комнату можно только до начала голосования")
    db.delete(participant)
    commit(db, room.id)
    _event("participant_left", room.id, user.id)


def remove_participant(db: Session, room_id: str, user: User, target_id: str) -> dict:
    room = require_room(db, room_id)
    require_host(room, user)
    if target_id == room.host_id:
        raise AppError(409, "Нельзя удалить организатора")
    if room.status not in OPEN:
        raise AppError(409, "Состав участников зафиксирован на время голосования")
    participant = room_crud.get_participant(db, room_id, target_id)
    if not participant:
        raise AppError(404, "Участник не найден")
    db.delete(participant)
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


def invite_by_email(db: Session, room_id: str, user: User, email: str) -> dict:
    room = require_room(db, room_id)
    require_member(db, room, user)
    if room.status not in OPEN:
        raise AppError(409, "Приглашать можно только до начала голосования")
    target = db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))
    if not target or target.deleted_at:
        raise AppError(404, "Пользователь с таким email не найден. Отправьте ему ссылку-приглашение.")
    if is_member(db, room.id, target.id):
        raise AppError(409, "Этот пользователь уже в комнате")
    notify(
        db, [target.id], "invited", f"{user.display_name} приглашает вас в решение",
        room.title, room.id, f"/join/{room.id}",
    )
    commit(db, room.id)
    return {"ok": True, "display_name": target.display_name}


# ---------------------------------------------------------------- options

def _insert_option(db: Session, room: Room, user: User, title: str, description: str, place_id: str | None) -> Option:
    if place_id and not db.get(Place, place_id):
        raise AppError(404, "Место не найдено")
    option = Option(
        id=str(uuid4()),
        room_id=room.id,
        author_id=user.id,
        title=title.strip(),
        description=description.strip(),
        status="ACCEPTED" if user.id == room.host_id else "PENDING",
        place_id=place_id,
        position=max((o.position for o in room.options), default=0) + 1 + len(db.info.setdefault("new_options", [])),
    )
    db.add(option)
    db.info["new_options"].append(option.id)
    if place_id:
        db.add(UserPlaceHistory(id=str(uuid4()), user_id=user.id, place_id=place_id, room_id=room.id, action="added"))
    return option


def add_option(db: Session, room_id: str, user: User, title: str, description: str, place_id: str | None = None) -> dict:
    room = require_room(db, room_id)
    if room.status not in OPEN:
        raise AppError(409, "Предложения закрыты на этом этапе")
    require_member(db, room, user, "Присоединитесь к комнате, чтобы предложить вариант")
    if not room.allow_suggestions and user.id != room.host_id:
        raise AppError(403, "Организатор отключил предложения участников")
    title_key = title.strip().lower()
    if any(o.title.strip().lower() == title_key and o.status != "REJECTED" for o in room.options):
        raise AppError(409, "Такой вариант уже есть в списке")
    _insert_option(db, room, user, title, description, place_id)
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


def reorder_options(db: Session, room_id: str, user: User, ids: list[str]) -> dict:
    room = require_room(db, room_id)
    require_host(room, user, "Менять порядок вариантов может только организатор")
    if room.status not in OPEN:
        raise AppError(409, "После запуска голосования порядок зафиксирован")
    by_id = {o.id: o for o in room.options}
    if set(ids) != set(by_id) or len(ids) != len(by_id):
        raise AppError(422, "Передайте все варианты комнаты ровно по одному разу")
    for position, option_id in enumerate(ids, start=1):
        by_id[option_id].position = position
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


def _editable_option(db: Session, room_id: str, option_id: str, user: User) -> tuple[Room, Option]:
    room = require_room(db, room_id)
    if room.status not in OPEN:
        raise AppError(409, "После запуска голосования варианты изменять нельзя")
    option = next((o for o in room.options if o.id == option_id), None)
    if not option:
        raise AppError(404, "Вариант не найден")
    if user.id not in (option.author_id, room.host_id):
        raise AppError(403, "Изменять вариант может только его автор")
    return room, option


def edit_option(db: Session, room_id: str, option_id: str, user: User, title: str, description: str) -> dict:
    room, option = _editable_option(db, room_id, option_id, user)
    option.title, option.description = title.strip(), description.strip()
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


def delete_option(db: Session, room_id: str, option_id: str, user: User) -> dict:
    room, option = _editable_option(db, room_id, option_id, user)
    referenced = any(option_id in json.loads(r.frozen_options_json or "[]") for r in room.rounds)
    if referenced:
        # The option is part of an earlier round's history: hide it from new rounds instead.
        option.status, option.rejection_reason = "REJECTED", "Удалён автором"
    else:
        db.delete(option)
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


def moderate_option(db: Session, room_id: str, option_id: str, user: User, status: str, reason: str) -> dict:
    room = require_room(db, room_id)
    require_host(room, user, "Только организатор может рассматривать варианты")
    if room.status not in OPEN:
        raise AppError(409, "Список вариантов уже зафиксирован")
    option = next((o for o in room.options if o.id == option_id), None)
    if not option:
        raise AppError(404, "Вариант не найден")
    room_crud.update_option(db, option, status, reason)
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


def add_comment(db: Session, room_id: str, option_id: str, user: User, text: str) -> dict:
    room = require_room(db, room_id)
    if not room.allow_comments:
        raise AppError(403, "Комментарии отключены в этой комнате")
    if room.status not in OPEN or not is_member(db, room_id, user.id):
        raise AppError(409, "Обсуждение в этой комнате закрыто")
    if not any(o.id == option_id for o in room.options):
        raise AppError(404, "Вариант не найден")
    room_crud.add_comment(db, room_id, option_id, user.id, text)
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


# ---------------------------------------------------------------- voting

def _open_round(db: Session, room: Room, people: list[str], options: list[str], kind: str) -> None:
    room_crud.add_round(db, room.id, len(room.rounds) + 1, people, options, kind=kind)
    room.status = "VOTING"
    notify(
        db, people, "voting_started" if kind == "regular" else "new_round",
        "Голосование началось" if kind == "regular" else "Повторное голосование между лидерами",
        room.title, room.id, link(room, "vote"), exclude=room.host_id,
    )


def start_voting(db: Session, room_id: str, user: User) -> dict:
    room = require_room(db, room_id)
    require_host(room, user, "Только организатор может начать голосование")
    if room.status not in OPEN:
        raise AppError(409, "Голосование нельзя начать на текущем этапе")
    people = member_ids(room)
    options = [o.id for o in room.options if o.status == "ACCEPTED"]
    if len(people) < 2:
        raise AppError(422, "Пригласите хотя бы одного участника помимо себя")
    if not options:
        raise AppError(422, "Нужен хотя бы один принятый вариант")
    if room.deadline and _aware(room.deadline) <= _now():
        raise AppError(422, "Срок голосования уже прошёл — измените его в настройках")
    _open_round(db, room, people, options, "regular")
    commit(db, room.id)
    _event("voting_started", room.id, user.id)
    return serialize_room(require_room(db, room.id), user.id)


def _finalize(db: Session, room: Room, rnd, reason: str) -> None:
    participants = json.loads(rnd.frozen_participants_json)
    option_ids = json.loads(rnd.frozen_options_json)
    option_rows = [
        {"id": o.id, "title": o.title, "description": o.description}
        for o in sorted(room.options, key=lambda o: o.position)
        if o.id in option_ids
    ]
    ballots = [
        {
            "participant_id": v.user_id,
            "choice_option_id": v.choice_option_id,
            "details": {d.option_id: d.stance for d in v.details},
        }
        for v in rnd.votes
    ]
    result = calculate(room.method, participants, option_rows, ballots, forced=reason != "all_voted")
    rnd.status = "COMPLETED" if result["success"] else "NO_CONSENSUS"
    rnd.result_json = json.dumps(result, ensure_ascii=False, default=str)
    rnd.ended_at = _now()
    rnd.end_reason = reason
    room.status = rnd.status
    winners = [result["winner"]] if result.get("winner") else result.get("acceptable") or []
    for w in winners:
        place_id = next((o.place_id for o in room.options if o.id == w["id"]), None)
        if place_id:
            for uid in participants:
                db.add(UserPlaceHistory(id=str(uuid4()), user_id=uid, place_id=place_id, room_id=room.id, action="won"))
    title = {
        "all_voted": "Результат готов",
        "forced": "Голосование завершено организатором",
        "deadline": "Срок голосования истёк",
    }[reason]
    notify(db, participants, "result_ready" if reason == "all_voted" else "voting_closed", title, room.title, room.id, link(room, "results"))
    _event(f"round_{rnd.status.lower()}", room.id)


def submit_vote(db: Session, room_id: str, user: User, data: VoteSubmit) -> dict:
    room = require_room(db, room_id)
    if enforce_deadline(db, room):
        raise AppError(409, "Срок голосования истёк — голоса больше не принимаются")
    if room.status != "VOTING":
        raise AppError(409, "Голосование не активно")
    require_member(db, room, user, "Вы не состоите в этой комнате")
    rnd = room.rounds[-1] if room.rounds else None
    if not rnd:
        raise AppError(409, "Активный раунд не найден")
    participants = json.loads(rnd.frozen_participants_json)
    options = json.loads(rnd.frozen_options_json)
    if user.id not in participants:
        raise AppError(403, "Вы не входите в зафиксированный состав участников")
    if vote_crud.has_voted(db, rnd.id, user.id):
        raise AppError(409, "Ваш голос уже учтён")
    details: dict[str, str] = {}
    choice = data.choice_option_id
    if room.method in ("majority", "unanimity"):
        if choice not in options:
            raise AppError(422, "Выберите один вариант из списка")
        if data.details:
            raise AppError(422, "Для этого метода требуется один выбранный вариант")
    else:
        details = data.details
        if set(details) != set(options) or any(v not in ("yes", "no") for v in details.values()):
            raise AppError(422, "Оцените каждый вариант: подходит или есть возражение")
        if choice:
            raise AppError(422, "Для метода без возражений выберите позицию по каждому варианту")
    vote_crud.submit(db, rnd, user.id, choice, details)
    db.flush()
    _event("vote_submitted", room.id, user.id)
    if len(rnd.votes) == len(participants):
        _finalize(db, room, rnd, "all_voted")
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


def force_finish(db: Session, room_id: str, user: User) -> dict:
    room = require_room(db, room_id)
    require_host(room, user, "Завершить голосование досрочно может только организатор")
    if room.status != "VOTING" or not room.rounds:
        raise AppError(409, "Голосование не активно")
    _finalize(db, room, room.rounds[-1], "forced")
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


def enforce_deadline(db: Session, room: Room) -> bool:
    """Close voting when the deadline has passed. Returns True if the room changed."""
    if room.status != "VOTING" or not room.deadline or not room.rounds:
        return False
    if _aware(room.deadline) > _now():
        return False
    _finalize(db, room, room.rounds[-1], "deadline")
    commit(db, room.id)
    return True


def start_new_round(db: Session, room_id: str, user: User) -> dict:
    """Back to discussion: options can be edited again (MVP behaviour)."""
    room = require_room(db, room_id)
    require_host(room, user, "Только организатор может открыть новый раунд")
    if room.status not in FINAL:
        raise AppError(409, "Сначала завершите текущий раунд")
    room.status = "COLLECTING"
    room.deadline = None
    notify(db, member_ids(room), "new_round", "Обсуждение снова открыто", room.title, room.id, link(room), exclude=user.id)
    commit(db, room.id)
    return serialize_room(require_room(db, room.id), user.id)


def _last_result(room: Room) -> tuple[object, dict]:
    if room.status not in FINAL or not room.rounds:
        raise AppError(409, "Сначала завершите голосование")
    rnd = room.rounds[-1]
    if not rnd.result_json:
        raise AppError(409, "У раунда нет результата")
    return rnd, json.loads(rnd.result_json)


def runoff(db: Session, room_id: str, user: User) -> dict:
    """Re-vote only between options that shared the top result."""
    room = require_room(db, room_id)
    require_host(room, user, "Повторное голосование запускает организатор")
    rnd, result = _last_result(room)
    leaders = [o["id"] for o in result.get("tiebreak_candidates") or []]
    if len(leaders) < 2:
        raise AppError(409, "Повторное голосование возможно только при равных результатах")
    people = [uid for uid in member_ids(room)]
    _open_round(db, room, people, leaders, "runoff")
    room.deadline = None
    commit(db, room.id)
    _event("runoff_started", room.id, user.id)
    return serialize_room(require_room(db, room.id), user.id)


def tiebreak(db: Session, room_id: str, user: User) -> dict:
    """Random draw between options with exactly equal top results.

    Computed once on the server with `secrets` and stored in the round, so every
    participant sees the same outcome. It is a separate tie-break, never a
    substitute for the original result: `result.success` stays untouched.
    """
    room = require_room(db, room_id)
    require_host(room, user, "Случайный выбор запускает организатор")
    rnd, result = _last_result(room)
    if rnd.tiebreak_json:
        raise AppError(409, "Случайный выбор для этого раунда уже проведён")
    candidates = result.get("tiebreak_candidates") or []
    frozen = set(json.loads(rnd.frozen_options_json))
    candidates = [c for c in candidates if c["id"] in frozen]
    if len(candidates) < 2:
        raise AppError(409, "Случайный выбор доступен только между вариантами с равным результатом")
    chosen = secrets.choice(candidates)
    rnd.tiebreak_json = json.dumps(
        {
            "option": chosen,
            "candidates": candidates,
            "drawn_at": _now().isoformat(),
            "drawn_by": user.display_name,
            "method": "random",
            "note": "Выбрано случайно среди равнозначных вариантов. Это не единогласное решение и не победа по голосам.",
        },
        ensure_ascii=False,
    )
    notify(db, member_ids(room), "tiebreak", f"Случайный выбор: {chosen['title']}", room.title, room.id, link(room, "results"), exclude=user.id)
    commit(db, room.id)
    _event("tiebreak_drawn", room.id, user.id)
    return serialize_room(require_room(db, room.id), user.id)
