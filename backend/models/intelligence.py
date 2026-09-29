from typing import Any

from pydantic import BaseModel, Field


class ResourceXRay(BaseModel):
    item_id: str
    resource_name: str
    resource_type: str
    extracted_text_chars: int
    extraction_warning: str | None = None
    topics: list[str] = Field(default_factory=list)
    concepts: list[dict[str, Any]] = Field(default_factory=list)
    prerequisites: list[str] = Field(default_factory=list)
    difficulty_distribution: dict[str, int] = Field(default_factory=dict)
    question_patterns: dict[str, int] = Field(default_factory=dict)
    important_areas: list[str] = Field(default_factory=list)
    relationships: list[dict[str, str]] = Field(default_factory=list)


class IntelligenceTask(BaseModel):
    concept_id: str
    topic: str
    priority: str
    reason: str
    estimated_minutes: int
    activity: str
    status: str


class RetentionItem(BaseModel):
    concept_id: str
    topic: str
    mastery: float
    last_updated: str
    status: str
    next_action: str
    next_revision_at: str | None = None


class IntelligenceTaskUpdate(BaseModel):
    concept_id: str
    status: str = "completed"


class RetentionAction(BaseModel):
    concept_id: str
    action: str = "schedule"


class LearningIntelligenceOverview(BaseModel):
    student_id: str
    fingerprint: list[dict[str, Any]] = Field(default_factory=list)
    gaps: list[dict[str, Any]] = Field(default_factory=list)
    study_plan: list[IntelligenceTask] = Field(default_factory=list)
    retention: list[RetentionItem] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    resource_xrays: list[dict[str, Any]] = Field(default_factory=list)
