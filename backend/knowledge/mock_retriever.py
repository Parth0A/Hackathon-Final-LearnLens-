from typing import Any

from knowledge.retriever import KnowledgeRetriever


class MockKnowledgeRetriever(KnowledgeRetriever):
    """Approved-content seam for future RAG; no external documents are claimed or imported."""

    def retrieve(self, concept_id: str, root_gap: str) -> list[dict[str, Any]]:
        return [{
            "concept": root_gap,
            "source": "Data Structures Course Material",
            "chapter": "Stacks and Queues",
            "section": "Stack Basics",
            "status": "mock_approved_content",
        }]