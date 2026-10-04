from typing import Any

from ai.provider import AIProvider


class MockAIProvider(AIProvider):
    """Deterministic provider seam; replace this implementation when an approved model is connected."""

    def generate_intervention(self, root_gap: str, intervention_type: str, evidence: list[dict[str, Any]]) -> dict[str, Any]:
        if root_gap != "lifo":
            return {"title": "Recover the prerequisite", "explanation": "Review the prerequisite concept before trying the dependent concept again.", "example": "Connect the rule to a concrete sequence of operations.", "visual": [], "steps": []}
        content = {
            "title": "Understanding LIFO",
            "explanation": "A stack follows Last-In, First-Out. The last item added is the first item removed.",
            "example": "If A, then B, then C are pushed, C is popped first, then B, then A.",
            "visual": ["BOTTOM", "[A]", "[B]", "[C]  ← TOP", "Last in (C) leaves first"],
            "steps": ["Find the top of the stack", "Push each item onto the top", "Pop the top item before older items"],
            "contrast": "A queue uses FIFO: the first item in is the first item out. A stack uses LIFO.",
            "practice_focus": "Identify which item leaves first after a sequence of pushes.",
        }
        if intervention_type == "visual_explanation":
            content["title"] = "See LIFO in motion"
            content["visual"] = ["PUSH A → [A]", "PUSH B → [A, B]", "PUSH C → [A, B, C] ← TOP", "POP → C leaves first"]
        elif intervention_type == "worked_example":
            content["title"] = "Work through a stack example"
        return content