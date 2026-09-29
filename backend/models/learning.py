from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class Student(BaseModel):
    id: str
    name: str
    education_level: str


class Concept(BaseModel):
    id: str
    name: str
    description: str
    difficulty: str


class Prerequisite(BaseModel):
    id: str
    prerequisite_concept_id: str
    dependent_concept_id: str


class Question(BaseModel):
    id: str
    text: str
    options: list[str]
    correct_answer: str
    concept_id: str
    prerequisite_concept_id: str | None = None
    difficulty: str
    misconception_tag: str
    source: dict[str, str] = Field(default_factory=dict)


class PublicQuestion(BaseModel):
    id: str
    text: str
    options: list[str]
    concept_id: str
    prerequisite_concept_id: str | None = None
    difficulty: str
    misconception_tag: str
    source: dict[str, str] = Field(default_factory=dict)


class AssessmentAnswer(BaseModel):
    question_id: str
    selected_answer: str


class StartAssessmentRequest(BaseModel):
    student_id: str = "demo-student"


class SubmitAssessmentRequest(BaseModel):
    student_id: str = "demo-student"
    answers: list[AssessmentAnswer]
    started_at: str | None = None


class ConceptState(BaseModel):
    student_id: str
    concept_id: str
    mastery: float
    attempts: int
    correct_attempts: int
    incorrect_attempts: int
    root_gap: str | None = None
    confidence: float | None = None
    recovery_status: str = "not_started"
    updated_at: str


class Evidence(BaseModel):
    text: str
    kind: str


class LearningGap(BaseModel):
    id: str
    student_id: str
    concept_id: str
    root_gap: str
    confidence: float
    evidence: list[Evidence]
    mastery: float
    status: str = "active"
    created_at: str


class AssessmentSession(BaseModel):
    student_id: str
    question_count: int
    questions: list[PublicQuestion]
    focus: str


class AssessmentResult(BaseModel):
    score: float
    correct: int
    total: int
    attempts_saved: int
    detected_gap: LearningGap | None = None
    states: list[ConceptState]


class Intervention(BaseModel):
    id: str
    student_id: str
    concept_id: str
    root_gap: str
    type: str
    title: str
    content: dict[str, Any]
    created_at: str
    completed: bool = False
    result: str | None = None
    mastery_before: float
    mastery_after: float | None = None


class StartInterventionRequest(BaseModel):
    student_id: str = "demo-student"
    concept_id: str = "stack"


class CompleteInterventionRequest(BaseModel):
    completed: bool = True
    result: str = "started_practice"


class PracticeSubmission(BaseModel):
    student_id: str = "demo-student"
    intervention_id: str
    question_id: str
    selected_answer: str


class PracticeResult(BaseModel):
    correct: bool
    correct_answer: str
    practice_completed: int
    practice_target: int
    retest_unlocked: bool
    question_id: str


class StartRetestRequest(BaseModel):
    student_id: str = "demo-student"
    concept_id: str = "lifo"


class SubmitRetestRequest(BaseModel):
    student_id: str = "demo-student"
    retest_id: str
    answers: list[AssessmentAnswer]


class RetestSession(BaseModel):
    id: str
    student_id: str
    concept_id: str
    questions: list[PublicQuestion]
    mastery_before: float
    practice_completed: int


class RetestResult(BaseModel):
    id: str
    score: float
    correct: int
    total: int
    mastery_before: float
    mastery_after: float
    status: Literal["RECOVERED", "PARTIALLY_RECOVERED", "NOT_RECOVERED"]
    improvement: float
    unlocked_concept: str | None = None


class PathItem(BaseModel):
    concept_id: str
    name: str
    status: str
    mastery: float
    order: int
    prerequisite_ids: list[str]


class LearningPathResponse(BaseModel):
    student_id: str
    items: list[PathItem]
    current_concept: str


class DashboardResponse(BaseModel):
    student: Student
    overall_mastery: float
    recovered_count: int
    active_gaps: int
    current_concept: str
    current_gap: str | None
    assessment_count: int
    learning_time_seconds: int
    recovery_time_seconds: int
    recent_activity: list[dict[str, Any]]
    mastery_history: list[dict[str, Any]]
    concept_mastery: list[dict[str, Any]]
    intervention_effectiveness: list[dict[str, Any]]


class RadarResponse(BaseModel):
    class_mastery: float
    students_needing_attention: list[dict[str, Any]]
    common_gaps: list[dict[str, Any]]
    misconceptions: list[dict[str, Any]]
    intervention_results: list[dict[str, Any]]
    recovery_comparison: list[dict[str, Any]] = Field(default_factory=list)


class ResetResponse(BaseModel):
    message: str
    student: Student
    initial_mastery: dict[str, float]