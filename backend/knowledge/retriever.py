from typing import Any, Protocol


class KnowledgeRetriever(Protocol):
    def retrieve(self, concept_id: str, root_gap: str) -> list[dict[str, Any]]: ...