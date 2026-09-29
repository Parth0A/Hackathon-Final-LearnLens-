export interface Student {
  id: string;
  name: string;
  education_level: string;
}

export interface Concept {
  id: string;
  name: string;
  description: string;
  difficulty: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correct_answer: string;
  concept_id: string;
  prerequisite_concept_id: string | null;
  difficulty: string;
  misconception_tag: string;
  source: Record<string, string>;
}

export interface AssessmentAnswer {
  question_id: string;
  selected_answer: string;
}

export interface AssessmentSession {
  student_id: string;
  question_count: number;
  questions: Question[];
  focus: string;
}

export interface ConceptState {
  student_id: string;
  concept_id: string;
  mastery: number;
  attempts: number;
  correct_attempts: number;
  incorrect_attempts: number;
  root_gap: string | null;
  confidence: number | null;
  recovery_status: string;
  updated_at: string;
}

export interface Evidence {
  text: string;
  kind: string;
}

export interface LearningGap {
  id: string;
  student_id: string;
  concept_id: string;
  root_gap: string;
  confidence: number;
  evidence: Evidence[];
  mastery: number;
  status: string;
  created_at: string;
}

export interface AssessmentResult {
  score: number;
  correct: number;
  total: number;
  attempts_saved: number;
  detected_gap: LearningGap | null;
  states: ConceptState[];
}

export interface Intervention {
  id: string;
  student_id: string;
  concept_id: string;
  root_gap: string;
  type: string;
  title: string;
  content: {
    title: string;
    explanation: string;
    example: string;
    visual: string[];
    steps: string[];
    contrast: string;
    practice_focus: string;
  };
  created_at: string;
  completed: boolean;
  result: string | null;
  mastery_before: number;
  mastery_after: number | null;
}

export interface PracticeResult {
  correct: boolean;
  correct_answer: string;
  practice_completed: number;
  practice_target: number;
  retest_unlocked: boolean;
  question_id: string;
}

export interface RetestSession {
  id: string;
  student_id: string;
  concept_id: string;
  questions: Question[];
  mastery_before: number;
  practice_completed: number;
}

export interface RetestResult {
  id: string;
  score: number;
  correct: number;
  total: number;
  mastery_before: number;
  mastery_after: number;
  status: "RECOVERED" | "PARTIALLY_RECOVERED" | "NOT_RECOVERED";
  improvement: number;
  unlocked_concept: string | null;
}

export interface PathItem {
  concept_id: string;
  name: string;
  status: string;
  mastery: number;
  order: number;
  prerequisite_ids: string[];
}

export interface LearningPathResponse {
  student_id: string;
  items: PathItem[];
  current_concept: string;
}

export interface DashboardResponse {
  student: Student;
  overall_mastery: number;
  recovered_count: number;
  active_gaps: number;
  current_concept: string;
  current_gap: string | null;
  assessment_count: number;
  learning_time_seconds: number;
  recovery_time_seconds: number;
  recent_activity: { label: string; detail: string; created_at: string; type: string }[];
  mastery_history: { label: string; mastery: number }[];
  concept_mastery: { concept_id: string; name: string; mastery: number; status: string }[];
  intervention_effectiveness: { type: string; before: number; after: number; result: string }[];
}

export interface RadarResponse {
  class_mastery: number;
  students_needing_attention: { student_id: string; name: string; gap: string | null; priority: string }[];
  common_gaps: { concept_id: string; name: string; students: number; label: string }[];
  misconceptions: { tag: string; label: string; occurrences: number }[];
  intervention_results: { type: string; result: string; student_id: string; improvement: number }[];
  recovery_comparison: { concept_id: string; name: string; before: number; after: number; recovered: number }[];
}

export interface ResetResponse {
  message: string;
  student: Student;
  initial_mastery: Record<string, number>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "student" | "teacher" | "admin";
  student_id: string | null;
  class_name: string | null;
  about: string;
  avatar_url: string | null;
}

export interface AuthResponse {
  user: User;
  message: string;
}

export interface StorageStatus {
  enabled: boolean;
  provider: string;
  limit_bytes: number;
  used_bytes: number;
  message: string;
}

export interface LibraryFolder {
  id: string;
  owner_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface LibraryItem {
  id: string;
  owner_id: string;
  kind: "file" | "note";
  name: string;
  content_type: string;
  size: number;
  folder_id: string | null;
  favorite: boolean;
  storage_path: string | null;
  content: string | null;
  source_metadata: Record<string, unknown>;
  retrieval_status: string;
  created_at: string;
  updated_at: string;
}

export interface Classroom {
  id: string;
  owner_id: string;
  name: string;
  subject: string;
  class_division: string;
  academic_year: string | null;
  code: string;
  join_link: string;
  student_count: number;
  created_at: string;
}

export interface RosterStudent {
  student_id: string;
  name: string;
  email: string;
  joined_at: string;
}

export interface ClassroomAssessment {
  id: string;
  classroom_id: string;
  teacher_id: string;
  title: string;
  question_ids: string[];
  questions: Question[];
  published: boolean;
  submission_count: number;
  created_at: string;
}

export interface ClassroomAssessmentResult {
  id: string;
  assessment_id: string;
  student_id: string;
  correct: number;
  total: number;
  score: number;
  attempts_saved: number;
  submitted_at: string;
}

export interface PaperQuestionAnalysis { question_id: string; text: string; concept_id: string; concept: string; difficulty: string; question_type: string; cognitive_level: string; marks: number; prerequisite: string | null; page?: number | null; section?: string | null; keywords?: string[]; quality_flags?: string[]; }
export interface PaperXRay { question_count: number; page_count?: number; extracted_text_chars?: number; extraction_warning?: string | null; total_marks?: number; average_marks?: number; marks_distribution?: Record<string, number>; concepts: { concept_id: string; name: string; questions: number; percentage: number }[]; difficulty_distribution: Record<string, number>; overall_difficulty: string; question_types: Record<string, number>; cognitive_distribution: Record<string, number>; prerequisite_coverage?: Record<string, number>; balance: string; quality_checks?: string[]; questions: PaperQuestionAnalysis[]; }
export interface PaperGenerateResponse { title: string; question_ids: string[]; questions: Question[]; xray: PaperXRay; }


export interface IntelligenceTask {
  concept_id: string;
  topic: string;
  priority: string;
  reason: string;
  estimated_minutes: number;
  activity: string;
  status: string;
}

export interface RetentionItem {
  concept_id: string;
  topic: string;
  mastery: number;
  last_updated: string;
  status: string;
  next_action: string;
}

export interface ResourceXRay {
  item_id: string;
  resource_name: string;
  resource_type: string;
  extracted_text_chars: number;
  extraction_warning: string | null;
  topics: string[];
  concepts: { concept_id: string; name: string; mentions: number; difficulty: string }[];
  prerequisites: string[];
  difficulty_distribution: Record<string, number>;
  question_patterns: Record<string, number>;
  important_areas: string[];
  relationships: { from: string; to: string; type: string }[];
}

export interface LearningIntelligenceOverview {
  student_id: string;
  fingerprint: { concept_id: string; topic: string; mastery: number; status: string; root_gap: string | null; confidence: number | null; attempts: number; updated_at: string | null }[];
  gaps: LearningGap[];
  study_plan: IntelligenceTask[];
  retention: RetentionItem[];
  metrics: { overall_mastery: number; active_gaps: number; planned_tasks: number; completed_tasks: number; scheduled_revisions: number; resources_analyzed: number };
  resource_xrays: ResourceXRay[];
}
