from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

from models.learning import AssessmentAnswer, Question, PublicQuestion


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Literal["student", "teacher", "admin"]
    student_id: str | None = None
    class_name: str | None = None
    about: str = ""
    avatar_url: str | None = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=80)
    role: Literal["student", "teacher"] = "student"
    class_name: str | None = Field(default=None, max_length=80)
    teacher_verification_code: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    class_name: str | None = Field(default=None, max_length=80)
    about: str = Field(default="", max_length=400)


class AuthResponse(BaseModel):
    user: UserResponse
    message: str


class StorageStatus(BaseModel):
    enabled: bool
    provider: str = "MongoDB GridFS"
    limit_bytes: int
    used_bytes: int
    message: str


class FolderCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    parent_id: str | None = None


class LibraryFolder(BaseModel):
    id: str
    owner_id: str
    name: str
    parent_id: str | None = None
    created_at: str


class NoteCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=100_000)
    folder_id: str | None = None


class LibraryItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    folder_id: str | None = None
    favorite: bool | None = None


class LibraryItem(BaseModel):
    id: str
    owner_id: str
    kind: Literal["file", "note"]
    name: str
    content_type: str
    size: int
    folder_id: str | None = None
    favorite: bool = False
    storage_path: str | None = None
    content: str | None = None
    source_metadata: dict[str, Any] = Field(default_factory=dict)
    retrieval_status: str = "not_applicable"
    created_at: str
    updated_at: str


class ClassroomCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    subject: str = Field(min_length=2, max_length=100)
    class_division: str = Field(min_length=1, max_length=80)
    academic_year: str | None = Field(default=None, max_length=20)


class ClassroomJoinRequest(BaseModel):
    code: str = Field(min_length=4, max_length=16)


class Classroom(BaseModel):
    id: str
    owner_id: str
    name: str
    subject: str
    class_division: str
    academic_year: str | None = None
    code: str
    join_link: str
    student_count: int = 0
    created_at: str


class RosterStudent(BaseModel):
    student_id: str
    name: str
    email: str
    joined_at: str


class ClassroomAssessmentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    question_ids: list[str] = Field(min_length=1, max_length=30)
    published: bool = True


class ClassroomAssessment(BaseModel):
    id: str
    classroom_id: str
    teacher_id: str
    title: str
    question_ids: list[str]
    questions: list[PublicQuestion] = Field(default_factory=list)
    published: bool
    submission_count: int = 0
    created_at: str


class ClassroomAssessmentSubmission(BaseModel):
    answers: list[AssessmentAnswer]


class ClassroomAssessmentResult(BaseModel):
    id: str
    assessment_id: str
    student_id: str
    correct: int
    total: int
    score: float
    attempts_saved: int
    submitted_at: str

class PaperGenerateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    topic_ids: list[str] = Field(default_factory=list, max_length=20)
    question_count: int = Field(default=5, ge=1, le=30)
    difficulty: Literal["any", "easy", "moderate", "difficult"] = "any"
    published: bool = False


class PaperQuestionAnalysis(BaseModel):
    question_id: str
    text: str
    concept_id: str
    concept: str
    difficulty: str
    question_type: str
    cognitive_level: str
    marks: int
    prerequisite: str | None = None
    page: int | None = None
    section: str | None = None
    keywords: list[str] = Field(default_factory=list)
    quality_flags: list[str] = Field(default_factory=list)


class PaperXRay(BaseModel):
    question_count: int
    page_count: int = 0
    extracted_text_chars: int = 0
    extraction_warning: str | None = None
    total_marks: int = 0
    average_marks: float = 0.0
    marks_distribution: dict[str, int] = Field(default_factory=dict)
    concepts: list[dict[str, Any]]
    difficulty_distribution: dict[str, int]
    overall_difficulty: str
    question_types: dict[str, int]
    cognitive_distribution: dict[str, int]
    prerequisite_coverage: dict[str, int] = Field(default_factory=dict)
    balance: str
    quality_checks: list[str] = Field(default_factory=list)
    questions: list[PaperQuestionAnalysis]


class PaperGenerateResponse(BaseModel):
    title: str
    question_ids: list[str]
    questions: list[Question]
    xray: PaperXRay
