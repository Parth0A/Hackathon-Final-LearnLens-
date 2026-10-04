# LearnLens Learning Recovery Platform

## Product
An interactive, resettable Data Structures learning-recovery demo for Demo Student. It turns question-level evidence into a prerequisite-gap diagnosis, targeted intervention, practice, retest, recovery decision, and updated path.

## Home and profile
- Every signed-in Student and Teacher lands on the LearnLens Home launcher first, never directly on Dashboard.
- Home has seven cards: Dashboard, Learning Diagnosis, Why Am I Stuck?, Recovery Center, Learning Path, Library, and Classroom Radar. Classroom Radar opens the role-aware classroom link/assessment workspace: teachers create links; students only join them.
- The exact uploaded `/frontend/public/LearnLens_logo.svg` is the official app logo. Its SHA-256 is `e8297a79ccbb7a47a8f8e3905e7542d786439d80a6385980a2cd86e067540e2a`.
- Profile remains a left-side drawer opened from the top-left icon. It overlays and blurs the still-visible Home, contains no feature navigation, and closes by X or outside click.

## Data model
Mongo collections include students, concepts, prerequisites, questions, question_attempts, learning_states, learning_gaps, interventions, practice_attempts, retests, learning_path, and activity_events. Demo Student is `demo-student`. Reference content is seeded from `backend/services/curriculum.py`.

## Key flows
- Diagnostic Assessment presents 10 seeded questions and stores every answer.
- Debugger detects repeated FIFO/LIFO confusion plus Stack errors and identifies LIFO as the prerequisite gap.
- Recovery Center selects deterministic MOCKED content, requires three targeted practice attempts, then unlocks the retest.
- Retest score determines prototype status: RECOVERED >=80%, PARTIALLY_RECOVERED 60-79%, NOT_RECOVERED below 60%.
- Recovery updates LIFO and unlocks Stack in the derived learning path. Dashboard and Teacher Radar read shared Mongo state.
- Reset Demo deletes Demo Student activity and restores LIFO 42% / Stack 45% initial state.

## Accounts and roles
- Cookie-based server sessions protect personal and classroom data. Student users can access only their own learning state and private Library; teachers can access only classrooms they own and aggregate learning data for enrolled students.
- Demo Student: `student@learnlens.demo`; Demo Teacher: `teacher@learnlens.demo`; seeded classroom code: `DS26A7`. Working passwords are in `memory/test_credentials.md`.
- Student and Teacher registration is supported. Teacher registration requires the controlled prototype verification code.

## Library and storage
- Each account has private folders, notes, search, rename, favourite, delete, download, and a 500 MB usage meter.
- Uploaded files and profile avatars are stored in **MongoDB GridFS** (`backend/services/storage.py`), so uploads require no external storage key. Notes and folders continue to work independently. (Earlier builds used Emergent object storage; that integration was replaced during deployment hardening.)
- Teacher-uploaded file metadata is marked `ready_for_future_retrieval`; teachers cannot access student Library records.

## Classrooms
- Teachers create classrooms with unique codes/links, view rosters, and publish assessments from the Data Structures bank.
- Students join with one code/link and submit published assessments. Every answer is stored in `classroom_question_attempts` and the shared `question_attempts` evidence stream.
- Classroom Radar is teacher-only and aggregates the same learning gaps, interventions, and recovery records for enrolled students.

## Architecture
Normal application code owns scoring, graph traversal, mastery, state transitions, analytics, authorization, and persistence. `MockAIProvider` and `MockKnowledgeRetriever` are deterministic seams clearly labeled MOCKED in the UI for future approved-provider/RAG work.