# LearnLens — PRD / Working Notes

## Original problem statement
Run and preview the uploaded LearnLens project AS-IS. Do not rebuild, redesign, refactor,
or add features. Only apply the minimal fixes required to make the existing app start, and
report the existing features and any blockers.

## Architecture (as uploaded)
- Frontend: React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + TanStack Query. Served on :3000.
  API access via relative `/api` (fetch), auth via httpOnly session cookie.
- Backend: FastAPI (modular: routers/ services/ models/ lib/ ai/ knowledge/). Served on :8001,
  all routes under `/api`. Startup lifespan builds Mongo indexes + seeds demo data.
- Database: MongoDB (local, via MONGO_URL / DB_NAME).
- AI/Knowledge: deterministic MOCK providers (MockAIProvider, MockKnowledgeRetriever). No LLM keys needed.
- Optional integrations (degrade gracefully, inactive in preview):
  - File/library uploads -> Emergent object storage (needs EMERGENT_LLM_KEY)
  - Admin email verification -> Resend (needs RESEND_API_KEY + EMAIL_FROM)

## User personas
- Student: takes diagnostic assessment, sees detected gaps, gets targeted intervention,
  practices, retests, tracks mastery/recovery + learning path.
- Teacher: views class-wide radar (students needing attention, common gaps) for owned classroom.
- Admin (optional): email-verified admin panel (inactive without email key).

## Existing features (observed in running app)
- Auth: login / register, role select (student/teacher), education-level & branch demo selector,
  password show/hide, admin panel entry, teacher verification-code registration.
- Student Home: dashboard (overall mastery, active gaps, current concept, activity feed),
  assessment start/submit, gap detail ("why stuck" evidence), interventions + practice,
  retest with recovery gating, learning path with prerequisite unlocking.
- Classrooms view, Library view, Learning Intelligence view, Profile drawer.
- Teacher radar (class-wide gap analytics). Join-classroom route (/join/:code).
- Curriculum: 13 Data Structures concepts, 32 questions, prerequisite graph. Demo reset endpoint.

## Minimal fixes applied to get it running (2026-06)
1. Placed uploaded project into /app (backend + frontend), preserved env files.
2. Installed backend requirements (pip) and frontend deps (yarn).
3. Added `"start": "vite"` script to frontend/package.json (supervisor runs `yarn start`;
   uploaded project only had `dev`).
4. backend/.env: added the 4 REQUIRED demo-credential vars (no defaults in code) —
   DEMO_STUDENT_EMAIL/PASSWORD, DEMO_TEACHER_EMAIL/PASSWORD; set CORS_ORIGINS to include the
   preview URL (backend security middleware blocks cross-origin POSTs otherwise); added
   optional TEACHER_VERIFICATION_CODE.
5. vite.config.ts dev proxy target 8000 -> 8001 (aligns with supervisor backend port).
6. Fixed 2 pre-existing JSX syntax errors that blocked compilation:
   - src/pages/Home.tsx:519 — a `<button>` was closed with `</div>`.
   - src/pages/Login.tsx:237 — two adjacent JSX siblings (div + form) in a ternary branch
     were not wrapped; added a `<>…</>` fragment.

## Remaining blockers / inactive without keys (preview-acceptable)
- ~~Library file uploads~~ — ACTIVATED 2026-09-30: Emergent File & Media Storage enabled by setting
  EMERGENT_LLM_KEY in backend/.env (integration was already fully coded in services/storage.py +
  routers/library.py + LibraryView.tsx; no code changes). Verified iteration_9 (100% BE+FE):
  student/teacher upload → store → preview → download → delete all work; notes unaffected.
- ~~Admin email verification~~ — ACTIVATED 2026-09-29 via Resend (RESEND_API_KEY + EMAIL_FROM +
  ADMIN_EMAIL=parthandhale07@gmail.com set in backend/.env). Full E2E VERIFIED (test_reports/iteration_4.json):
  real emailed code verified (200, user learnlens-admin role=admin created, session cookie persists),
  UI Send-code → verify-step works, wrong code shows 401, student login regression fixed.
- CORS note: the platform serves the app on internal `*.cluster-12.preview.emergentcf.cloud` hosts (each public
  preview URL maps to one), so the browser Origin is the cluster host. CORS_ORIGINS in backend/.env must include
  BOTH the public URL and its cluster host — for BOTH preview URLs in use: c4415e13-85b5-41ac-9271-7c10262216c6.*
  and lens-inspect-2.* (the user accesses the app via lens-inspect-2.preview.emergentagent.com). All four are
  configured (env-only fix, verified iteration_6: admin send-code 200, student+teacher logins 200 on both URLs).

## Status
Running & previewable. Login works for both demo accounts; all core Home/teacher APIs return 200.
No further building requested under this plan.

## Incremental changes (user-requested, minimal)
- 2026-09-29: Admin email verification activated via Resend (env-only). Verified iterations 4-6.
- 2026-09-29: CORS_ORIGINS env fix — added actual browser origins (cluster-12 hosts + lens-inspect-2 URL pair).
  Verified iteration_6 (admin send-code 200, student+teacher logins 200 on both preview URLs).
- 2026-09-29: Added ONLY a "Log Out" button to the Admin page (AdminView in Home.tsx,
  data-testid=admin-logout-button), using the existing endSession() mechanism (POST /auth/logout →
  cache clear → redirect to Login). Verified iteration_7: button renders, logout returns to Login and
  invalidates the session server-side; student/teacher regressions pass.
- 2026-09-29: Git fix — /app was missing .git ("fatal: not a git repository"). Initialized git (branch main),
  remote origin = github.com/Parth0A/Hackathon-Final-LearnLens-.git, pushed as initial history (no force-push).
  .github/workflows/backend-tests.yml excluded from the PUSHED commit only (user token lacks GitHub 'workflow'
  scope); file remains on disk. Verified iteration_8: repo healthy, secrets not tracked, app unaffected.
  NOTE: platform infra creates local "checkpoint" commits that re-add the workflow file to the local index
  (local main may diverge from origin/main); before any future push either grant the token Workflows scope
  or re-exclude .github/workflows from the index.
