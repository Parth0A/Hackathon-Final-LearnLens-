from typing import Any, Protocol


class AIProvider(Protocol):
    def generate_intervention(self, root_gap: str, intervention_type: str, evidence: list[dict[str, Any]]) -> dict[str, Any]: ...
