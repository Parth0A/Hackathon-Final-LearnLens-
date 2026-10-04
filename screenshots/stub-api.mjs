// Minimal LearnLens API stub — serves the exact JSON shapes the student Home and
// Dashboard screens consume (mirrors frontend/src/lib/types.ts) so the real Vite app
// can run without Python/MongoDB. Only used for visual verification screenshots.
import { createServer } from "node:http";

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();

const user = {
  id: "demo-student",
  email: "demo.student@example.com",
  name: "Demo Student",
  role: "student",
  student_id: "demo-student",
  class_name: "Grade 12",
  about: "Working through Data Structures with LearnLens.",
  avatar_url: null,
};

const gap = {
  id: "gap-1",
  student_id: "demo-student",
  concept_id: "stack",
  root_gap: "lifo",
  confidence: 0.87,
  evidence: [
    { text: "Repeated incorrect answers on LIFO pop order across 3 stored attempts.", kind: "attempt_pattern" },
    { text: "Stack exercises depend on LIFO ordering (prerequisite edge lifo → stack).", kind: "prerequisite" },
    { text: "Retest after practice still missed the push/pop sequence question.", kind: "retest_signal" },
  ],
  mastery: 0.42,
  status: "active",
  created_at: iso(2 * 3600 * 1000),
};

const dashboard = {
  student: { id: "demo-student", name: "Demo Student", education_level: "Grade 12" },
  overall_mastery: 0.63,
  recovered_count: 2,
  active_gaps: 1,
  current_concept: "stack",
  current_gap: "lifo",
  assessment_count: 3,
  learning_time_seconds: 420,
  recovery_time_seconds: 180,
  recent_activity: [
    { label: "Diagnostic assessment submitted", detail: "10 responses stored · 6 correct", created_at: iso(2 * 3600 * 1000), type: "assessment" },
    { label: "Evidence traced to a LIFO prerequisite", detail: "Why Am I Stuck? flagged a root gap blocking Stack", created_at: iso(3 * 3600 * 1000), type: "diagnosis" },
    { label: "Recovery session started", detail: "Targeted lesson opened for LIFO ordering", created_at: iso(5 * 3600 * 1000), type: "intervention" },
    { label: "Targeted practice attempted", detail: "2 of 3 recovery questions answered", created_at: iso(6 * 3600 * 1000), type: "practice" },
    { label: "Library note created", detail: "“Stack vs Queue cheat sheet” saved", created_at: iso(26 * 3600 * 1000), type: "library" },
  ],
  mastery_history: [],
  concept_mastery: [
    { concept_id: "lifo", name: "LIFO", mastery: 42, status: "in_recovery" },
    { concept_id: "stack", name: "Stack", mastery: 45, status: "not_started" },
    { concept_id: "queue", name: "Queue", mastery: 61, status: "not_started" },
    { concept_id: "circular-queue", name: "Circular Queue", mastery: 78, status: "not_started" },
    { concept_id: "deque", name: "Deque", mastery: 84, status: "recovered" },
    { concept_id: "priority-queue", name: "Priority Queue", mastery: 91, status: "recovered" },
    { concept_id: "linked-list", name: "Linked List", mastery: 67, status: "not_started" },
  ],
  intervention_effectiveness: [],
};

const path = {
  student_id: "demo-student",
  current_concept: "lifo",
  items: [
    { concept_id: "lifo", name: "LIFO", status: "in_recovery", mastery: 0.42, order: 1, prerequisite_ids: [] },
    { concept_id: "stack", name: "Stack", status: "available", mastery: 0.45, order: 2, prerequisite_ids: ["lifo"] },
    { concept_id: "queue", name: "Queue", status: "available", mastery: 0.61, order: 3, prerequisite_ids: ["lifo"] },
    { concept_id: "circular-queue", name: "Circular Queue", status: "available", mastery: 0.78, order: 4, prerequisite_ids: ["queue"] },
    { concept_id: "deque", name: "Deque", status: "recovered", mastery: 0.84, order: 5, prerequisite_ids: ["queue"] },
    { concept_id: "priority-queue", name: "Priority Queue", status: "locked", mastery: 0.0, order: 6, prerequisite_ids: ["stack", "queue"] },
  ],
};

const overview = {
  student_id: "demo-student",
  fingerprint: [],
  gaps: [gap],
  study_plan: [
    { concept_id: "lifo", topic: "LIFO ordering", priority: "high", reason: "Root gap blocking Stack", estimated_minutes: 35, activity: "Root-gap recovery", status: "pending" },
    { concept_id: "stack", topic: "Stack operations", priority: "medium", reason: "Builds directly on LIFO", estimated_minutes: 25, activity: "Focused practice", status: "pending" },
    { concept_id: "queue", topic: "Queue operations", priority: "low", reason: "Scheduled retrieval", estimated_minutes: 15, activity: "Retrieval practice", status: "completed" },
  ],
  retention: [
    { concept_id: "deque", topic: "Deque", mastery: 0.84, last_updated: iso(48 * 3600 * 1000), status: "STABLE", next_action: "None — keep reviewing weekly", next_revision_at: iso(-72 * 3600 * 1000) },
  ],
  metrics: {
    overall_mastery: 0.63,
    active_gaps: 1,
    planned_tasks: 3,
    completed_tasks: 1,
    scheduled_revisions: 2,
    resources_analyzed: 4,
  },
  resource_xrays: [],
};

const makeQuestion = (id, text, options, answer, concept, difficulty) => ({
  id,
  text,
  options,
  correct_answer: answer,
  concept_id: concept,
  prerequisite_concept_id: null,
  difficulty,
  misconception_tag: "lifo_vs_fifo",
  source: { kind: "seeded_demo", reference: "learnlens-demo" },
});

const assessment = {
  student_id: "demo-student",
  question_count: 5,
  focus: "Stack & queue order",
  questions: [
    makeQuestion("q01", "Which structure returns elements in last-in, first-out order?", ["Queue", "Stack", "Circular queue", "Priority queue"], "Stack", "lifo", "moderate"),
    makeQuestion("q02", "After pushing A then B, which element pops first?", ["A", "B", "Queue front", "Nothing until push resumes"], "B", "lifo", "easy"),
    makeQuestion("q03", "Which structure removes elements in first-in, first-out order?", ["Stack", "Priority queue", "Queue", "Hash table"], "Queue", "queue", "easy"),
    makeQuestion("q04", "A Stack implementation built on an array must track which index next?", ["The lowest free slot", "The top of the stack", "The queue front", "The node root"], "The top of the stack", "stack", "moderate"),
    makeQuestion("q05", "Why does a Stack depend on LIFO ordering rules?", ["Because memory is linear", "Because it is a prerequisite concept for stack behaviour", "Because queues use LIFO", "Because push and pop are the same operation"], "Because it is a prerequisite concept for stack behaviour", "stack", "difficult"),
  ],
};

const routes = {
  "GET /api/": { message: "LearnLens Learning Recovery API (screenshot stub)", demo_student_id: "demo-student" },
  "GET /api/auth/session": user,
  "GET /api/questions": [],
  "POST /api/assessment/start": assessment,
  "GET /api/gaps/demo-student": [gap],
  "GET /api/dashboard/demo-student": dashboard,
  "GET /api/learning-path/demo-student": path,
  "GET /api/intelligence/overview/demo-student": overview,
};

const server = createServer((req, res) => {
  const key = `${req.method} ${req.url.split("?")[0]}`;
  const body = key in routes ? routes[key] : { detail: `stub has no route for ${key}` };
  const status = key in routes ? 200 : 404;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "true",
    "Cache-Control": "no-store",
  });
  res.end(payload);
});

server.listen(8001, "127.0.0.1", () => console.log("[stub] LearnLens API stub listening on http://127.0.0.1:8001"));
