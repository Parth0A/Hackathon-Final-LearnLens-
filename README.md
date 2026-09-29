# LearnLens

LearnLens is a prototype **learning-debugging and recovery system** built with FastAPI, MongoDB, React, and TypeScript.

The prototype currently demonstrates the learning-debugger workflow with a **Data Structures** curriculum. Data Structures is the demonstration dataset for the prototype; the core idea is to detect prerequisite/root learning gaps from student evidence, prescribe targeted recovery, and verify recovery through practice and retesting.

## Prototype flow

```
Student
  ↓
Diagnostic assessment
  ↓
Learning evidence
  ↓
Root/prerequisite gap detection
  ↓
Targeted intervention
  ↓
Practice
  ↓
Retest
  ↓
Mastery / recovery status
  ↓
Learning path + dashboard
```

Example:

```
FIFO/LIFO confusion
      ↓
LIFO identified as root gap
      ↓
Stack blocked
      ↓
Targeted LIFO intervention
      ↓
3 practice questions
      ↓
Retest
      ↓
Recovery
      ↓
Stack becomes available
```

## Current technology

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Query
- **Backend:** FastAPI, Python, Pydantic
- **Database:** MongoDB
- **Authentication:** HTTP-only session cookie with hashed passwords
- **Storage:** MongoDB metadata plus Emergent object storage when enabled
- **AI/RAG prototype seams:** deterministic mock AI provider and mock knowledge retriever
- **Testing:** pytest for backend and Playwright for browser E2E tests

## Repository layout

```
backend/
  ai/             AI provider seam + mock implementation
  knowledge/      retrieval seam + mock implementation
  models/         Pydantic request/response models
  routers/        authentication, learning, library, classroom APIs
  services/       mastery, debugger, intervention, recovery, curriculum, auth
  tests/          backend regression/API tests

frontend/
  src/
    pages/
    components/
    lib/

tests/
  e2e/
```

## Authentication

Student learning endpoints require an authenticated session and verify that the authenticated user owns the requested student profile.

Teacher-only radar endpoints require a teacher session and restrict data to classrooms owned by that teacher.

The backend tests therefore authenticate their student/teacher fixtures instead of bypassing the application's real authorization behavior.

Required test credentials:

```text
DEMO_STUDENT_EMAIL
DEMO_STUDENT_PASSWORD
DEMO_TEACHER_EMAIL
DEMO_TEACHER_PASSWORD
```

## Learning data persistence

A newly registered student receives learning-state records initialized to zero:

- mastery: 0
- attempts: 0
- correct attempts: 0
- incorrect attempts: 0
- no root gap
- no confidence score
- recovery status: not started

Actual assessment, intervention, practice, retest, activity, and learning-history records are stored against the student's own ID.

The dashboard derives its metrics from persisted records rather than placeholder values.

## AI and retrieval status

The current prototype deliberately uses deterministic mock components:

- `MockAIProvider` generates the prototype intervention content.
- `MockKnowledgeRetriever` returns approved placeholder course-material metadata.

These are **provider seams**, not claims of a production AI/RAG system. A real model or retrieval provider can be connected later without changing the learning-debugger flow.

## Running locally

Backend:

```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Frontend:

```bash
cd frontend
yarn dev
```

The frontend uses relative `/api` requests. In development, Vite proxies them to the FastAPI backend.

## Backend tests

```bash
cd /app/backend
pytest
```

The canonical pytest configuration already enables xdist. Do not add another `-n` flag.

The core regression tests cover:

1. authenticated access to protected learning routes;
2. new-student zero-state behavior;
3. student data isolation;
4. persisted assessment/mastery history;
5. real assessment learning-time calculation;
6. retest gating on targeted intervention practice.

## Submission/testing note

Before submission, run the backend pytest suite against the live application environment and record the actual result. Also run the frontend typecheck and the project's browser E2E pass.

The current prototype is intentionally focused on proving the **learning-debugger mechanism**. Its curriculum can be expanded later without changing the fundamental diagnostic → intervention → practice → retest architecture.
