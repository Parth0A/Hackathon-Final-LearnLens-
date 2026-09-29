from typing import Any


def diagnose_root_gap(attempts: list[dict[str, Any]], states: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    if not attempts:
        return None
    confusion = [item for item in attempts if item.get("misconception_tag") == "FIFO_LIFO_CONFUSION" and not item.get("correct")]
    stack_errors = [item for item in attempts if item.get("concept_id") == "stack" and not item.get("correct")]
    lifo_errors = [item for item in attempts if item.get("concept_id") == "lifo" and not item.get("correct")]
    lifo_mastery = states.get("lifo", {}).get("mastery", 0.0)
    stack_mastery = states.get("stack", {}).get("mastery", 0.0)
    if len(confusion) >= 2 and (len(stack_errors) >= 1 or len(lifo_errors) >= 1) and lifo_mastery < 0.8:
        evidence = [
            {"text": f"{len(stack_errors) + len(lifo_errors)} related Stack/LIFO questions incorrect", "kind": "pattern"},
            {"text": f"FIFO/LIFO confusion repeated across {len(confusion)} attempts", "kind": "misconception"},
            {"text": "LIFO is a prerequisite for Stack in the concept graph", "kind": "prerequisite"},
        ]
        return {
            "concept_id": "stack", "root_gap": "lifo", "confidence": 0.87,
            "mastery": lifo_mastery, "evidence": evidence, "stack_mastery": stack_mastery,
        }
    return None