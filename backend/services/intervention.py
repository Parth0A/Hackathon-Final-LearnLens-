from typing import Any


def select_intervention_type(previous: list[dict[str, Any]]) -> str:
    if not previous:
        return "simple_explanation"
    latest = previous[-1]
    if latest.get("result") in {"NOT_RECOVERED", "PARTIALLY_RECOVERED"} or latest.get("type") == "simple_explanation":
        return "visual_explanation"
    return "worked_example"
