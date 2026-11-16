import pytest
from app.core.errors import AppError
from app.services.decision_service import calculate

A, B, C = ({"id": i, "title": i, "description": ""} for i in "ABC")
PEOPLE = ["u1", "u2", "u3", "u4"]


def ballots(*choices):
    return [{"participant_id": f"u{i}", "choice_option_id": c, "details": {}} for i, c in enumerate(choices, 1)]


def stances(*rows):
    return [{"participant_id": f"u{i}", "choice_option_id": None, "details": r} for i, r in enumerate(rows, 1)]


def test_requires_every_vote_unless_forced():
    with pytest.raises(AppError):
        calculate("majority", PEOPLE, [A, B], ballots("A", "A"))


def test_majority_winner():
    r = calculate("majority", PEOPLE, [A, B], ballots("A", "A", "A", "B"))
    assert r["success"] and r["winner"]["id"] == "A" and not r["tie"]


def test_majority_tie_lists_equal_leaders_and_no_winner():
    r = calculate("majority", PEOPLE, [A, B, C], ballots("A", "B", "A", "B"))
    assert not r["success"] and r["tie"] and r["winner"] is None
    assert {o["id"] for o in r["leaders"]} == {"A", "B"}
    assert {o["id"] for o in r["tiebreak_candidates"]} == {"A", "B"}


def test_unanimity_success_only_if_all_same():
    assert calculate("unanimity", PEOPLE, [A, B], ballots("A", "A", "A", "A"))["success"]
    r = calculate("unanimity", PEOPLE, [A, B], ballots("A", "A", "A", "B"))
    assert not r["success"] and r["tiebreak_candidates"] == []  # 3:1 is not a 50/50 tie


def test_unanimity_fifty_fifty_offers_tiebreak_but_stays_failed():
    r = calculate("unanimity", PEOPLE, [A, B], ballots("A", "B", "A", "B"))
    assert not r["success"] and r["tie"]
    assert {o["id"] for o in r["tiebreak_candidates"]} == {"A", "B"}


def test_objections_all_acceptable_options_are_equal():
    r = calculate("objections", ["u1", "u2"], [A, B, C], stances(
        {"A": "yes", "B": "yes", "C": "no"}, {"A": "yes", "B": "yes", "C": "yes"}))
    assert r["success"] and {o["id"] for o in r["acceptable"]} == {"A", "B"}
    assert len(r["tiebreak_candidates"]) == 2


def test_objections_none_acceptable():
    r = calculate("objections", ["u1"], [A], stances({"A": "no"}))
    assert not r["success"] and r["acceptable"] == []


def test_forced_counts_only_submitted():
    r = calculate("majority", PEOPLE, [A, B], ballots("B"), forced=True)
    assert r["success"] and r["winner"]["id"] == "B" and r["submitted"] == 1 and r["total"] == 4
    assert "досрочно" in r["explanation"]


def test_forced_with_no_votes():
    r = calculate("unanimity", PEOPLE, [A, B], [], forced=True)
    assert not r["success"]


def test_objections_reports_agreement_alongside_objections():
    r = calculate("objections", ["u1", "u2", "u3"], [A, B], stances(
        {"A": "yes", "B": "no"}, {"A": "yes", "B": "yes"}, {"A": "yes", "B": "yes"}))
    rows = {row["option"]["id"]: row for row in r["counts"]}
    assert rows["A"]["agree"] == 3 and rows["B"]["agree"] == 2 and rows["B"]["objections"] == 1
    assert [o["id"] for o in r["acceptable"]] == ["A"]  # the rule itself is unchanged
