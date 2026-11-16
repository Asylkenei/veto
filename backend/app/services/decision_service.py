"""Decision Engine — pure functions, no database access.

The base rules of the three methods are unchanged from MVP 0.1. VETO 2.0 adds:
* `forced=True` — the organiser (or an expired deadline) closes voting early;
  the result is calculated from submitted ballots only and says so.
* `leaders` — every option sharing the top score, so ties are shown as
  equal results instead of silently picking one.
* `tiebreak_candidates` — options a random draw may choose from. A random draw
  never changes `success` / `winner`: it is stored separately (see room_service).
"""
from app.core.errors import AppError


def _people(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return f"{n} участник"
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return f"{n} участника"
    return f"{n} участников"


def calculate(
    method: str,
    participant_ids: list[str],
    option_rows: list[dict],
    ballots: list[dict],
    *,
    forced: bool = False,
) -> dict:
    total, submitted = len(participant_ids), len(ballots)
    if not total:
        raise AppError(409, "В раунде нет участников")
    if not forced and submitted != total:
        raise AppError(409, "Результат появится после голосов всех участников")
    base = {"submitted": submitted, "total": total, "forced": forced}
    partial_note = (
        f" Учтены голоса {submitted} из {total}: голосование завершено досрочно."
        if forced and submitted < total
        else ""
    )
    if submitted == 0:
        return {
            **base,
            "success": False,
            "winner": None,
            "tie": False,
            "leaders": [],
            "counts": [{"option": o, "count": 0} for o in option_rows],
            "tiebreak_candidates": [],
            "explanation": "Никто не успел проголосовать — решение не принято.",
        }

    if method in ("majority", "unanimity"):
        counts = [
            {"option": o, "count": sum(v.get("choice_option_id") == o["id"] for v in ballots)}
            for o in option_rows
        ]
        high = max((row["count"] for row in counts), default=0)
        leaders = [row["option"] for row in counts if row["count"] == high and high > 0]
        tie = len(leaders) > 1

        if method == "majority":
            winner = leaders[0] if len(leaders) == 1 else None
            explanation = (
                f"{len(leaders)} варианта набрали поровну — по {high}. Это равнозначные результаты, победитель не выбран."
                if tie
                else f"{high} из {submitted} проголосовавших выбрали этот вариант."
            )
            return {
                **base,
                "success": bool(winner),
                "winner": winner,
                "tie": tie,
                "leaders": leaders,
                "counts": counts,
                "tiebreak_candidates": leaders if tie else [],
                "explanation": explanation + partial_note,
            }

        # unanimity: every submitted ballot must name the same option
        winner = next(
            (o for o in option_rows if all(v.get("choice_option_id") == o["id"] for v in ballots)),
            None,
        )
        if winner:
            explanation = (
                "Единственный проголосовавший выбрал этот вариант."
                if submitted == 1
                else f"Все {_people(submitted)} выбрали один вариант."
            )
        elif tie:
            explanation = (
                f"Голоса разделились поровну между {len(leaders)} вариантами. Единогласия нет."
            )
        else:
            explanation = "Участники выбрали по-разному. Единогласия нет."
        return {
            **base,
            "success": bool(winner),
            "winner": winner,
            "tie": (not winner) and tie,
            "leaders": [winner] if winner else leaders,
            "counts": counts,
            "tiebreak_candidates": leaders if (not winner and tie) else [],
            "explanation": explanation + partial_note,
        }

    if method == "objections":
        counts = []
        for o in option_rows:
            objections = sum(v.get("details", {}).get(o["id"]) == "no" for v in ballots)
            # Every ballot rates every option, so "agree" is the positive view of the same data.
            counts.append({"option": o, "objections": objections, "agree": submitted - objections})
        acceptable = [row["option"] for row in counts if row["objections"] == 0]
        if acceptable:
            n = len(acceptable)
            explanation = (
                "1 вариант прошёл проверку без возражений."
                if n == 1
                else f"{n} варианта прошли без возражений — они равнозначны."
                if n < 5
                else f"{n} вариантов прошли без возражений — они равнозначны."
            )
        else:
            explanation = "У всех вариантов есть хотя бы одно возражение."
        return {
            **base,
            "success": bool(acceptable),
            "acceptable": acceptable,
            "leaders": acceptable,
            "tie": len(acceptable) > 1,
            "counts": counts,
            "tiebreak_candidates": acceptable if len(acceptable) > 1 else [],
            "explanation": explanation + partial_note,
        }
    raise AppError(422, "Неизвестный метод принятия решения")
