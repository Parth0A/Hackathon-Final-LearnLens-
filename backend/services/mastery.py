from collections import defaultdict
from typing import Any


def calculate_mastery(attempts: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for attempt in attempts:
        grouped[attempt["concept_id"]].append(attempt)
    result: dict[str, dict[str, Any]] = {}
    for concept_id, records in grouped.items():
        correct = sum(1 for record in records if record.get("correct"))
        total = len(records)
        result[concept_id] = {
            "mastery": round(correct / total, 2) if total else 0.0,
            "attempts": total,
            "correct_attempts": correct,
            "incorrect_attempts": total - correct,
        }
    return result