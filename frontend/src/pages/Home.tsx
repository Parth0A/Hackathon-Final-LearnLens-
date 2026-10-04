import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BookOpen, BrainCircuit, CalendarClock, Check, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, ClipboardCheck, Clock3, Flame, GitBranch, Home as HomeIcon, LayoutDashboard, Library, Lock, LogOut, RefreshCw, RotateCcw, School, SearchCheck, Target, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import { endSession } from "@/lib/session";
import type { AssessmentResult, AssessmentSession, DashboardResponse, Intervention, LearningGap, LearningIntelligenceOverview, LearningPathResponse, PracticeResult, Question, RadarResponse, ResetResponse, RetestResult, RetestSession, TeacherOverview, User } from "@/lib/types";
import ProfileDrawer from "@/components/ProfileDrawer";
import LibraryView from "@/components/LibraryView";
import ClassroomsView from "@/components/ClassroomsView";
import LearningIntelligenceView from "@/components/LearningIntelligenceView";
import DesktopWorkspaceNav from "@/components/DesktopWorkspaceNav";
import DesktopXRayView from "@/components/DesktopXRayView";
import TeacherStudentDashboardView from "@/components/TeacherStudentDashboardView";

type View = "home" | "dashboard" | "assessment" | "stuck" | "recovery" | "path" | "library" | "schedule-planner" | "streak" | "classrooms" | "teacher" | "learning-intelligence" | "teacher-student-dashboard" | "teacher-xray" | "teacher-create-paper" | "student-xray" | "student-create-paper";

const featureItems: { id: View; label: string; description: string; icon: typeof LayoutDashboard; studentOnly?: boolean; teacherOnly?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", description: "Shows your current mastery, active gaps, progress, and next learning priorities.", icon: LayoutDashboard, studentOnly: true },
  { id: "teacher", label: "Teacher Dashboard", description: "Live class overview, student activity, and classroom learning radar for your classrooms.", icon: Users, teacherOnly: true },
  { id: "assessment", label: "Learning Diagnosis", description: "Assesses your understanding and identifies evidence of concepts or prerequisites that need attention.", icon: SearchCheck, studentOnly: true },
  { id: "stuck", label: "Why Am I Stuck?", description: "Traces repeated mistakes to the underlying concept or prerequisite that may be blocking your progress.", icon: AlertTriangle, studentOnly: true },
  { id: "recovery", label: "Recovery Center", description: "Provides targeted learning and practice, then verifies recovery through a focused retest.", icon: RefreshCw, studentOnly: true },
  { id: "path", label: "Learning Path", description: "Maps prerequisite relationships and shows the order in which concepts become available to learn.", icon: GitBranch, studentOnly: true },
  { id: "library", label: "Library", description: "Stores your personal notes and study resources so you can organize, preview, and use them in your learning workflow.", icon: Library },
  { id: "schedule-planner", label: "Study Planner", description: "Builds a focused study schedule from your available time and learning priorities. Planner is currently being expanded.", icon: Clock3 },
  { id: "learning-intelligence", label: "Learning Intelligence", description: "Connects your resources, learning fingerprint, gaps, study priorities, recovery, and retention into one learning cycle.", icon: BrainCircuit, studentOnly: true },
  { id: "classrooms", label: "Classroom Radar", description: "Connects teachers and students through shared assessments, question-paper analysis, and class-level learning evidence.", icon: School },
];

const percent = (value: number) => `${Math.round(value * 100)}%`;
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "amber" }) {
  const toneClass = tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-blue-600";
  return <div data-testid="progress-bar" className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${toneClass} transition-[width] duration-500`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} /></div>;
}

function StatusPill({ status }: { status: string }) {
  const recovered = status.toLowerCase().includes("recover");
  const active = status.toLowerCase().includes("progress") || status.toLowerCase().includes("current");
  return <Badge data-testid={`status-pill-${status.replaceAll("_", "-")}`} variant="outline" className={recovered ? "border-emerald-200 bg-emerald-50 text-emerald-700" : active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{titleCase(status)}</Badge>;
}

export default function Home({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const studentId = user.student_id ?? "";
  const [view, setView] = useState<View>("home");
  const [assessment, setAssessment] = useState<AssessmentSession | null>(null);
  const [assessmentIndex, setAssessmentIndex] = useState(0);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, string>>({});
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({});
  const [practiceResults, setPracticeResults] = useState<Record<string, PracticeResult>>({});
  const [practiceCompleted, setPracticeCompleted] = useState(0);
  const [retest, setRetest] = useState<RetestSession | null>(null);
  const [retestAnswers, setRetestAnswers] = useState<Record<string, string>>({});
  const [retestResult, setRetestResult] = useState<RetestResult | null>(null);

  const dashboardQuery = useQuery({ queryKey: ["dashboard", studentId], queryFn: () => apiGet<DashboardResponse>(`/dashboard/${studentId}`), retry: 1, enabled: user.role === "student" });
  const gapQuery = useQuery({ queryKey: ["gaps", studentId], queryFn: () => apiGet<LearningGap[]>(`/gaps/${studentId}`), retry: 1, enabled: user.role === "student" });
  const pathQuery = useQuery({ queryKey: ["path", studentId], queryFn: () => apiGet<LearningPathResponse>(`/learning-path/${studentId}`), retry: 1, enabled: user.role === "student" });
  const radarQuery = useQuery({ queryKey: ["radar"], queryFn: () => apiGet<RadarResponse>("/teacher/radar"), retry: 1, enabled: user.role === "teacher" });
  const overviewQuery = useQuery({ queryKey: ["teacher-overview"], queryFn: () => apiGet<TeacherOverview>("/teacher/overview"), retry: 1, enabled: user.role === "teacher" });
  const questionsQuery = useQuery({ queryKey: ["questions"], queryFn: () => apiGet<Question[]>("/questions"), retry: 1, enabled: user.role === "student" });

  const refreshData = () => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard", studentId] });
    void queryClient.invalidateQueries({ queryKey: ["gaps", studentId] });
    void queryClient.invalidateQueries({ queryKey: ["path", studentId] });
    void queryClient.invalidateQueries({ queryKey: ["radar"] });
  };

  const startAssessment = useMutation({
    mutationFn: () => apiPost<AssessmentSession>("/assessment/start", { student_id: studentId }),
    onSuccess: (data) => {
      setAssessment(data);
      setAssessmentIndex(0);
      setAssessmentResult(null);
      setAssessmentAnswers(Object.fromEntries(data.questions.map((question) => [question.id, question.options[0]])));
    },
    onError: () => toast.error("Unable to load the assessment. Try again."),
  });

  const submitAssessment = useMutation({
    mutationFn: () => apiPost<AssessmentResult>("/assessment/submit", { student_id: studentId, answers: assessment?.questions.map((question) => ({ question_id: question.id, selected_answer: assessmentAnswers[question.id] })) ?? [] }),
    onSuccess: (data) => { setAssessmentResult(data); refreshData(); },
    onError: () => toast.error("Choose an answer for each question before submitting."),
  });

  const startIntervention = useMutation({
    mutationFn: async () => {
      const freshGaps = await queryClient.fetchQuery({
        queryKey: ["gaps", studentId],
        queryFn: () => apiGet<LearningGap[]>(`/gaps/${studentId}`),
      });
      const rootGap = freshGaps[0]?.root_gap ?? "lifo";
      return apiPost<Intervention>("/interventions/start", { student_id: studentId, concept_id: rootGap });
    },
    onSuccess: (data) => { setIntervention(data); setPracticeCompleted(0); setPracticeResults({}); setRetest(null); setRetestResult(null); setView("recovery"); },
    onError: (error: unknown) => {
      const detail = typeof error === "object" && error && "body" in error
        ? ((error as { body?: { detail?: string } }).body?.detail)
        : undefined;
      toast.error(detail ?? "Recovery could not be started. Refresh the learning evidence and try again.");
    },
  });

  const completeIntervention = useMutation({
    mutationFn: () => apiPost<Intervention>(`/interventions/${intervention?.id}/complete`, { completed: true, result: "started_practice" }),
    onSuccess: (data) => { setIntervention(data); },
  });

  const submitPractice = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) => apiPost<PracticeResult>("/practice/submit", { student_id: studentId, intervention_id: intervention?.id, question_id: questionId, selected_answer: answer }),
    onSuccess: (data) => { setPracticeResults((current) => ({ ...current, [data.question_id]: data })); setPracticeCompleted(data.practice_completed); },
    onError: () => toast.error("That practice answer could not be saved."),
  });

  const startRetest = useMutation({
    mutationFn: () => apiPost<RetestSession>("/retest/start", { student_id: studentId, concept_id: "lifo" }),
    onSuccess: (data) => { setRetest(data); setRetestAnswers(Object.fromEntries(data.questions.map((question) => [question.id, ""]))); setRetestResult(null); },
    onError: () => toast.error("Finish all three targeted practice questions first."),
  });

  const submitRetest = useMutation({
    mutationFn: () => apiPost<RetestResult>("/retest/submit", { student_id: studentId, retest_id: retest?.id, answers: retest?.questions.map((question) => ({ question_id: question.id, selected_answer: retestAnswers[question.id] })) ?? [] }),
    onSuccess: (data) => { setRetestResult(data); refreshData(); },
    onError: () => toast.error("Submit an answer for every retest question."),
  });

  const resetDemo = useMutation({
    mutationFn: () => apiPost<ResetResponse>("/demo/reset", {}),
    onSuccess: () => {
      setView("dashboard"); setAssessment(null); setAssessmentResult(null); setIntervention(null); setRetest(null); setRetestResult(null); setPracticeResults({}); setPracticeCompleted(0); refreshData();
    },
    onError: () => toast.error("Unable to reset the demo right now."),
  });

  // Admin branch is evaluated only after every hook above has run, so the hook
  // count stays identical across renders (rules-of-hooks).
  if (user.role === "admin") return <AdminView />;

  const dashboard = dashboardQuery.data;
  const gap = gapQuery.data?.[0] ?? null;
  const practiceQuestions = (questionsQuery.data ?? []).filter((question) => ["q09", "q10", "q30"].includes(question.id));
  const recoveryStarted = Boolean(intervention);
  const dataUnavailable = user.role === "student" && dashboardQuery.isError;
  const streakTracker = user.role === "student" ? <StreakTracker studentId={studentId} /> : null;

  const navigate = (nextView: View) => {
    setView(nextView);
    if (user.role === "student" && nextView === "assessment" && !assessment && !assessmentResult) startAssessment.mutate();
  };

  const studentOnlyView = user.role === "teacher" && ["dashboard", "assessment", "stuck", "recovery", "path", "learning-intelligence"].includes(view);

  return (
    <div data-testid="learning-app" className="min-h-svh bg-[#FAF8F5] text-slate-800">
      {streakTracker}
      <header data-testid="app-header" className="sticky top-0 z-20 border-b border-[#E2D9CE] bg-[#FAF8F5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div data-testid="brand-block" className="flex items-center gap-3">
            <ProfileDrawer user={user} />
            <img data-testid="learnlens-logo" src="/LearnLens_logo.svg" alt="LearnLens" className="size-14 object-contain sm:size-16" />
          </div>
          <div className="flex items-center gap-2">
            {view !== "home" ? <Button data-testid="return-home-button" variant="outline" size="sm" onClick={() => setView("home")}><HomeIcon size={15} /> Home</Button> : null}
            {user.role === "student" ? <StreakTopButton studentId={studentId} onOpen={() => navigate("streak")} /> : null}
            {view === "dashboard" && user.student_id === "demo-student" ? <Button data-testid="demo-reset-button" variant="outline" size="sm" onClick={() => resetDemo.mutate()} disabled={resetDemo.isPending}><RotateCcw size={14} /> <span className="hidden sm:inline">Reset Demo</span></Button> : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl">
        <div className="flex items-start gap-4 lg:gap-5">
          <DesktopWorkspaceNav user={user} view={view} onNavigate={(nextView) => navigate(nextView as View)} />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
          {view !== "home" ? (
            <button type="button" aria-label="Go back" data-testid="back-button" onClick={() => navigate("home")} className="mb-4 inline-flex size-9 items-center justify-center rounded-full border border-[#E2D9CE] bg-white text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <ChevronLeft size={17} />
            </button>
          ) : null}
          {dataUnavailable ? <div data-testid="backend-error-state" className="mb-5 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle size={18} /> Unable to connect to learning service. The workspace is still available; retry the page when the service returns.</div> : null}
          {view === "home" ? <HomeLauncher user={user} onOpen={navigate} dashboard={dashboard} dashboardLoading={dashboardQuery.isLoading} /> : null}
          {studentOnlyView ? <StudentFeatureNotice feature={featureItems.find((item) => item.id === view)?.label ?? "This feature"} onClassroom={() => setView("classrooms")} /> : null}
          {user.role === "student" && view === "dashboard" ? <DashboardView dashboard={dashboard} gap={gap} studentId={studentId} onStartAssessment={() => navigate("assessment")} onStuck={() => navigate("stuck")} /> : null}
          {user.role === "student" && view === "assessment" ? <AssessmentView assessment={assessment} assessmentIndex={assessmentIndex} answers={assessmentAnswers} result={assessmentResult} loading={startAssessment.isPending || submitAssessment.isPending} onAnswer={(questionId, answer) => setAssessmentAnswers((current) => ({ ...current, [questionId]: answer }))} onPrevious={() => setAssessmentIndex((current) => Math.max(0, current - 1))} onNext={() => setAssessmentIndex((current) => Math.min((assessment?.questions.length ?? 1) - 1, current + 1))} onStart={() => startAssessment.mutate()} onDemoAnswers={() => setAssessmentAnswers(Object.fromEntries((assessment?.questions ?? []).map((question) => [question.id, question.options[0]])))} onSubmit={() => submitAssessment.mutate()} onReview={() => navigate("stuck")} /> : null}
          {user.role === "student" && view === "stuck" ? <StuckView gap={gap} states={dashboard?.concept_mastery ?? []} onAssessment={() => navigate("assessment")} onStartRecovery={() => startIntervention.mutate()} loading={startIntervention.isPending} /> : null}
          {user.role === "student" && view === "recovery" ? <RecoveryView intervention={intervention} questions={practiceQuestions} practiceAnswers={practiceAnswers} practiceResults={practiceResults} practiceCompleted={practiceCompleted} retest={retest} retestAnswers={retestAnswers} retestResult={retestResult} onStart={() => startIntervention.mutate()} onComplete={() => completeIntervention.mutate()} onPracticeAnswer={(id, answer) => setPracticeAnswers((current) => ({ ...current, [id]: answer }))} onPracticeSubmit={(id) => submitPractice.mutate({ questionId: id, answer: practiceAnswers[id] ?? "" })} onStartRetest={() => startRetest.mutate()} onRetestAnswer={(id, answer) => setRetestAnswers((current) => ({ ...current, [id]: answer }))} onRetestSubmit={() => submitRetest.mutate()} onRetry={() => startIntervention.mutate()} onOpenPath={() => navigate("path")} /> : null}
          {user.role === "student" && view === "path" ? <PathView path={pathQuery.data} onRecovery={() => navigate("recovery")} /> : null}
          {view === "library" ? <LibraryView user={user} /> : null}
          {view === "schedule-planner" ? <SchedulePlannerView user={user} /> : null}
          {user.role === "student" && view === "streak" ? <LearningStreakView studentId={studentId} /> : null}
          {user.role === "student" && view === "learning-intelligence" ? <LearningIntelligenceView user={user} onOpen={navigate} /> : null}
          {view === "classrooms" ? <ClassroomsView user={user} /> : null}
          {view === "teacher" ? <TeacherView radar={radarQuery.data} overview={overviewQuery.data} /> : null}
          {user.role === "teacher" && view === "teacher-student-dashboard" ? <TeacherStudentDashboardView /> : null}
          {(user.role === "teacher" && view === "teacher-xray") || (user.role === "student" && view === "student-xray") ? <DesktopXRayView user={user} onBack={() => setView("home")} /> : null}
          {(user.role === "teacher" && view === "teacher-create-paper") || (user.role === "student" && view === "student-create-paper") ? <DesktopXRayView user={user} createPaper onBack={() => setView("home")} /> : null}
        </main>
        </div>
      </div>
    </div>
  );
}

function getStreakToday() {
  return new Date().toISOString().slice(0, 10);
}

type StreakState = {
  streak: number;
  today: string;
  todaySeconds: number;
  lastCompletedDate: string | null;
  storageBonusMb: number;
};

function readStreakState(studentId: string): StreakState {
  const fallback: StreakState = { streak: 0, today: getStreakToday(), todaySeconds: 0, lastCompletedDate: null, storageBonusMb: 0 };
  try {
    const raw = localStorage.getItem(`learnlens-streak-${studentId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StreakState>;
    return {
      streak: Math.max(0, Number(parsed.streak ?? 0)),
      today: typeof parsed.today === "string" ? parsed.today : fallback.today,
      todaySeconds: Math.max(0, Number(parsed.todaySeconds ?? 0)),
      lastCompletedDate: typeof parsed.lastCompletedDate === "string" ? parsed.lastCompletedDate : null,
      storageBonusMb: Math.max(0, Number(parsed.storageBonusMb ?? 0)),
    };
  } catch {
    return fallback;
  }
}

function writeStreakState(studentId: string, state: StreakState) {
  try { localStorage.setItem(`learnlens-streak-${studentId}`, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

function StreakTracker({ studentId }: { studentId: string }) {
  const TARGET_SECONDS = 90 * 60;
  useEffect(() => {
    if (!studentId) return;
    let lastActivity = Date.now();
    const markActive = () => { lastActivity = Date.now(); };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - lastActivity > 60000) return;
      const current = readStreakState(studentId);
      const today = getStreakToday();
      let next = current.today === today ? current : { ...current, today, todaySeconds: 0 };
      if (next.todaySeconds >= TARGET_SECONDS || next.lastCompletedDate === today) return;
      next = { ...next, todaySeconds: Math.min(TARGET_SECONDS, next.todaySeconds + 1) };
      if (next.todaySeconds >= TARGET_SECONDS) {
        const previousDay = next.lastCompletedDate ? new Date(`${next.lastCompletedDate}T00:00:00Z`) : null;
        const currentDay = new Date(`${today}T00:00:00Z`);
        const dayGap = previousDay ? Math.round((currentDay.getTime() - previousDay.getTime()) / 86400000) : null;
        next = { ...next, streak: dayGap === 1 ? next.streak + 1 : dayGap === 0 ? next.streak : 1, lastCompletedDate: today };
      }
      writeStreakState(studentId, next);
      window.dispatchEvent(new CustomEvent("learnlens-streak-updated"));
    }, 1000);
    return () => {
      window.clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, markActive));
    };
  }, [studentId]);
  return null;
}

function LearningStreakView({ studentId }: { studentId: string }) {
  const TARGET_SECONDS = 90 * 60;
  const [state, setState] = useState<StreakState>(() => readStreakState(studentId));
  const [details, setDetails] = useState(false);

  useEffect(() => {
    const sync = () => setState(readStreakState(studentId));
    sync();
    window.addEventListener("learnlens-streak-updated", sync);
    const timer = window.setInterval(sync, 1000);
    return () => {
      window.removeEventListener("learnlens-streak-updated", sync);
      window.clearInterval(timer);
    };
  }, [studentId]);

  const today = getStreakToday();
  const todaySeconds = state.today === today ? state.todaySeconds : 0;
  const completed = todaySeconds >= TARGET_SECONDS;
  const storage = Math.min(1000, 150 + state.storageBonusMb);
  const redeemable = Math.min(Math.floor(state.streak / 15), Math.floor((1000 - storage) / 100));
  const nextRewardDays = state.streak === 0 ? 15 : 15 - (state.streak % 15 || 15);
  const remaining = Math.max(0, TARGET_SECONDS - todaySeconds);
  const progress = Math.min(100, (todaySeconds / TARGET_SECONDS) * 100);
  const formatTime = (seconds: number) => `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m`;

  const redeemReward = () => {
    const current = readStreakState(studentId);
    const currentStorage = Math.min(1000, 150 + current.storageBonusMb);
    if (current.streak < 15 || currentStorage >= 1000) return;
    const next = { ...current, streak: current.streak - 15, storageBonusMb: Math.min(850, current.storageBonusMb + 100) };
    writeStreakState(studentId, next);
    setState(next);
    toast.success("100 MB added to your Library storage.");
    window.dispatchEvent(new CustomEvent("learnlens-streak-updated"));
  };

  return <div data-testid="learning-streak-view" className="animate-rise-in">
    <PageIntro eyebrow="Student / Learning Streak" title="Keep the flame alive." description="Complete 1.5 hours of active learning each day. The timer pauses when you are idle or leave LearnLens." action={<Badge className="border-0 bg-orange-600 text-white"><Flame size={14} fill="currentColor" /> {state.streak}</Badge>} />
    <div className="grid max-w-4xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card data-testid="streak-progress-card" className="border-[#E2D9CE] bg-white shadow-sm">
        <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="font-heading text-xl">Today's active learning</CardTitle><span className="font-mono text-sm text-slate-500">{formatTime(todaySeconds)} / 1h 30m</span></div></CardHeader>
        <CardContent>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progress}%`, background: "linear-gradient(to left, #c2410c, #991b1b)" }} /></div>
          <div className="mt-4 flex items-center justify-between text-sm"><span className={completed ? "font-semibold text-emerald-700" : "text-slate-600"}>{completed ? "Today's streak is complete. Come back tomorrow." : `${formatTime(remaining)} active learning remaining`}</span><span className="font-mono text-slate-500">{Math.round(progress)}%</span></div>
          <div data-testid="streak-live-timeline" className="mt-4 flex items-center gap-3 rounded-2xl border border-orange-200 bg-slate-50 px-3 py-2.5"><span className="shrink-0 font-mono text-[10px] text-slate-500">TODAY</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200 shadow-inner"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progress}%`, background: "linear-gradient(to left, #c2410c, #991b1b)" }} /></div><span className="shrink-0 font-mono text-[11px] text-slate-600">{formatTime(todaySeconds)} / 1h 30m</span></div>
          <p className="mt-5 text-sm leading-6 text-slate-500">Only active use counts. One streak day can be earned once per calendar day.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3"><Button data-testid="streak-details-button" variant="outline" onClick={() => setDetails((value) => !value)}>{details ? "Hide Details" : "Details"}</Button>{completed ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Day completed</Badge> : <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">In progress</Badge>}</div>
        </CardContent>
      </Card>
      <Card data-testid="streak-reward-card" className="border-orange-100 bg-orange-50/60">
        <CardContent className="p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-orange-700">Library storage</p>
          <p className="mt-2 font-heading text-4xl font-bold text-slate-900">{storage} MB</p>
          <p className="mt-1 text-sm text-slate-600">Current student Library capacity</p>
          <div className="mt-5 space-y-2 text-sm"><p><strong>{state.streak}</strong> streak{state.streak === 1 ? "" : "s"} available</p><p><strong>{nextRewardDays}</strong> streak{nextRewardDays === 1 ? "" : "s"} to next +100 MB</p><p><strong>1 GB</strong> maximum Library capacity</p></div>
          <Button data-testid="streak-redeem-button" className="mt-6 w-full bg-orange-600 hover:bg-orange-700" disabled={redeemable < 1} onClick={redeemReward}>{storage >= 1000 ? "Storage maximum reached" : redeemable > 0 ? "Add 100 MB to Library" : `${nextRewardDays} streaks to go`}</Button>
          {redeemable > 0 ? <p className="mt-2 text-center text-xs text-orange-800">Redeeming removes 15 streaks from your current count.</p> : null}
        </CardContent>
      </Card>
    </div>
    {details ? <Card data-testid="streak-details-panel" className="mt-6 max-w-4xl border-[#E2D9CE] bg-white"><CardContent className="p-7">
      <h2 className="font-heading text-2xl font-bold text-slate-900">🔥 STREAK COUNT : {state.streak} 🔥</h2>
      <p className="mt-3 text-lg font-semibold text-orange-700">{redeemable > 0 ? "🔥 Add 100 MB to your Library" : `🔥 ${nextRewardDays} Need to go`}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#F3EFEA] p-4"><p className="text-xs text-slate-500">Current streak</p><p className="mt-1 font-heading text-xl font-bold">{state.streak}</p></div><div className="rounded-xl bg-[#F3EFEA] p-4"><p className="text-xs text-slate-500">Library storage</p><p className="mt-1 font-heading text-xl font-bold">{storage} MB</p></div><div className="rounded-xl bg-[#F3EFEA] p-4"><p className="text-xs text-slate-500">Reward</p><p className="mt-1 font-heading text-xl font-bold">+100 MB</p></div></div>
      {redeemable > 0 ? <Button data-testid="streak-details-redeem-button" className="mt-5 bg-orange-600 hover:bg-orange-700" onClick={redeemReward}>Add 100 MB and use 15 streaks</Button> : null}
      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-5"><p className="font-semibold text-slate-900">Future upgraded access</p><p className="mt-2 text-sm leading-6 text-slate-600">Consistent Learning Streak progress can also help students unlock upgraded LearnLens versions and premium LLM-powered features as they become available.</p></div>
      <p className="mt-5 text-xs leading-5 text-slate-500">Student storage starts at 150 MB. Each redeemed 15-streak reward adds 100 MB, up to 1 GB.</p>
    </CardContent></Card> : null}
  </div>;
}

function StreakTopButton({ studentId, onOpen }: { studentId: string; onOpen: () => void }) {
  const [state, setState] = useState<StreakState>(() => readStreakState(studentId));
  useEffect(() => {
    const sync = () => setState(readStreakState(studentId));
    sync();
    window.addEventListener("learnlens-streak-updated", sync);
    const timer = window.setInterval(sync, 1000);
    return () => { window.removeEventListener("learnlens-streak-updated", sync); window.clearInterval(timer); };
  }, [studentId]);
  const progress = Math.min(100, ((state.today === getStreakToday() ? state.todaySeconds : 0) / (90 * 60)) * 100);
  return <button type="button" data-testid="streak-top-button" onClick={onOpen} title="Learning Streak" aria-label={`Learning Streak: ${state.streak} days`} className="group flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-full border border-orange-200 bg-white px-1.5 text-orange-600 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
    <Flame size={16} fill="currentColor" />
    <span className="h-1 w-7 overflow-hidden rounded-full bg-orange-100"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${progress}%`, background: "linear-gradient(to left, #c2410c, #991b1b)" }} /></span>
  </button>;
}

function SchedulePlannerView({ user }: { user: User }) {
  const studentId = user.student_id ?? "";
  const [step, setStep] = useState<"questions" | "result" | "time" | "schedule">("questions");
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [minutes, setMinutes] = useState("120");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    apiPost<AssessmentSession>("/assessment/start", { student_id: studentId })
      .then((data) => { setSession(data); setAnswers(Object.fromEntries(data.questions.map((q) => [q.id, ""]))); })
      .catch(() => setError("Unable to start the learning diagnosis."))
      .finally(() => setLoading(false));
  }, [studentId]);

  const current = session?.questions[index];
  const allAnswered = Boolean(session?.questions.length && session.questions.every((q) => answers[q.id]));
  const submitDiagnosis = async () => {
    if (!session || !allAnswered) return;
    setLoading(true); setError("");
    try {
      const data = await apiPost<AssessmentResult>("/assessment/submit", {
        student_id: studentId,
        answers: session.questions.map((q) => ({ question_id: q.id, selected_answer: answers[q.id] })),
      });
      setResult(data); setStep("result");
    } catch { setError("We could not save the diagnosis. Please try again."); }
    finally { setLoading(false); }
  };

  const gapName = result?.detected_gap?.root_gap ?? result?.detected_gap?.concept_id ?? "No active gap detected";
  const mastery = result?.detected_gap?.mastery ?? 1;
  const makeSchedule = () => {
    const total = Math.max(30, Math.min(720, Number(minutes) || 120));
    const secondary = result?.states?.find((s) => s.concept_id !== result?.detected_gap?.concept_id)?.concept_id;
    const first = Math.round(total * 0.5);
    const second = Math.round(total * 0.3);
    return [
      { topic: titleCase(gapName), activity: "Root-gap recovery", mins: first },
      { topic: secondary ? titleCase(secondary) : "Related concept revision", activity: "Focused practice", mins: second },
      { topic: "Recall + self-test", activity: "Retrieval practice", mins: Math.max(10, total - first - second) },
    ];
  };

  if (step === "questions") return <div data-testid="schedule-planner-view" className="animate-rise-in">
    <PageIntro eyebrow="06 / Study Planner" title="Let's find what needs your time." description="Answer a short learning diagnosis first. Your schedule will be built around the gaps we detect." action={<Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Step 1 · Diagnosis</Badge>} />
    <Card className="max-w-3xl border-0 bg-white shadow-sm ring-1 ring-slate-200/80">
      <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="font-heading text-xl">Question {session ? index + 1 : "—"} of {session?.question_count ?? "—"}</CardTitle><span className="text-xs text-slate-500">{session?.focus ?? "Learning diagnosis"}</span></div></CardHeader>
      <CardContent className="space-y-5">
        {loading && !session ? <p className="text-sm text-slate-500">Preparing your questions…</p> : current ? <>
          <p className="text-lg font-medium leading-8 text-slate-900">{current.text}</p>
          <div className="grid gap-2">{current.options.map((option) => <button type="button" key={option} onClick={() => setAnswers((a) => ({ ...a, [current.id]: option }))} className={`rounded-xl border p-4 text-left text-sm transition ${answers[current.id] === option ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white hover:border-blue-200"}`}>{option}</button>)}</div>
          <div className="flex flex-wrap justify-between gap-2 pt-2"><Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>Previous</Button>{index < session.questions.length - 1 ? <Button disabled={!answers[current.id]} onClick={() => setIndex((i) => i + 1)}>Next <ArrowRight size={15} /></Button> : <Button disabled={!allAnswered || loading} onClick={submitDiagnosis}>Find my learning gap <SearchCheck size={15} /></Button>}</div>
        </> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </CardContent>
    </Card>
  </div>;

  if (step === "result") return <div data-testid="schedule-planner-gap-result" className="animate-rise-in">
    <PageIntro eyebrow="06 / Study Planner" title="Your study time should follow your gap." description="This diagnosis identifies the concept that currently needs attention before we build your schedule." action={<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Step 2 · Gap found</Badge>} />
    <Card className="max-w-3xl border-0 bg-gradient-to-br from-white to-blue-50/60 shadow-sm ring-1 ring-blue-100"><CardContent className="p-7">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Detected learning gap</p>
      <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900">{titleCase(gapName)}</h2>
      <p className="mt-3 text-slate-600">Current mastery: <strong>{Math.round(mastery * 100)}%</strong>. The plan gives this gap the largest share of your available study time.</p>
      <Button className="mt-6" onClick={() => setStep("time")}>Set my available study time <ArrowRight size={16} /></Button>
    </CardContent></Card>
  </div>;

  if (step === "time") return <div data-testid="schedule-planner-time-step" className="animate-rise-in">
    <PageIntro eyebrow="06 / Study Planner" title="How much time can you study?" description="Give a specific amount of time. The schedule will fit inside that limit." action={<Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Step 3 · Time</Badge>} />
    <Card className="max-w-xl border-0 bg-white shadow-sm ring-1 ring-slate-200/80"><CardContent className="p-7">
      <label htmlFor="planner-minutes" className="text-sm font-semibold text-slate-700">Available study time today</label>
      <div className="mt-3 flex items-center gap-3"><Input id="planner-minutes" data-testid="planner-minutes" type="number" min="30" max="720" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="max-w-40" /><span className="text-sm text-slate-500">minutes</span></div>
      <Button className="mt-6" onClick={() => setStep("schedule")} disabled={Number(minutes) < 30}>Build my schedule <ArrowRight size={16} /></Button>
    </CardContent></Card>
  </div>;

  const total = Math.max(30, Math.min(720, Number(minutes) || 120));
  return <div data-testid="schedule-planner-schedule" className="animate-rise-in">
    <PageIntro eyebrow="06 / Study Planner" title="Your focused study schedule." description={`Built for exactly ${total} minutes, with ${titleCase(gapName)} receiving the highest priority.`} action={<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Step 4 · Ready</Badge>} />
    <div className="grid max-w-4xl gap-3">{makeSchedule().map((item, i) => <Card key={i} className="border-slate-200 bg-white"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-widest text-blue-600">Block 0{i + 1}</p><h3 className="mt-1 font-heading text-lg font-semibold text-slate-900">{item.topic}</h3><p className="mt-1 text-sm text-slate-500">{item.activity}</p></div><span className="font-mono text-lg font-semibold text-slate-700">{item.mins} min</span></CardContent></Card>)}</div>
    <p className="mt-4 max-w-3xl text-xs leading-5 text-slate-500">Prototype schedule: it uses the student's diagnosis and exact available time rather than a fixed timetable.</p>
  </div>;
}
function AdminView() {
  const studentFeatures = featureItems.filter((item) => item.studentOnly).map((item) => item.label);
  const teacherFeatures = ["Classroom Radar", "Prepare Question Paper", "Browse Existing Paper", "Question Paper X-Ray", "Publish Assessments", "Student Responses", "Individual Learning Gaps", "Classroom Learning Gaps", "Learning Recovery", "Progress & Results", "Assessment History"];
  return <section data-testid="admin-console" className="animate-rise-in">
    <PageIntro eyebrow="Admin workspace" title="LearnLens overview" description="Admin access lets you inspect the student and teacher feature set without creating a student or teacher account." />
    <div className="mb-5 flex justify-end"><Button data-testid="admin-logout-button" variant="outline" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => void endSession()}><LogOut size={17} /> Log Out</Button></div>
    <div className="grid gap-5 md:grid-cols-2">
      <Card className="border-blue-100 bg-white"><CardHeader><CardTitle>Student features</CardTitle></CardHeader><CardContent><div className="grid gap-2">{studentFeatures.map((name) => <div key={name} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">{name}</div>)}</div></CardContent></Card>
      <Card className="border-blue-100 bg-white"><CardHeader><CardTitle>Teacher features</CardTitle></CardHeader><CardContent><div className="grid gap-2">{teacherFeatures.map((name) => <div key={name} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">{name}</div>)}</div></CardContent></Card>
    </div>
  </section>;
}

function HomeLauncher({ user, onOpen, dashboard, dashboardLoading }: { user: User; onOpen: (view: View) => void; dashboard?: DashboardResponse; dashboardLoading?: boolean }) {
  const [subjectOpen, setSubjectOpen] = useState(false);
  const subjectsRef = useRef<HTMLDivElement | null>(null);

  if (user.role === "student") {
    const subjects = ["Data Structures", "Database Management Systems", "Operating Systems", "Computer Networks", "Object-Oriented Programming", "Mathematics", "Physics", "Chemistry"];
    const debuggerFeatures = featureItems.filter((item) => !["library", "schedule-planner", "dashboard", "classrooms"].includes(item.id) && !(item.teacherOnly && user.role !== "teacher"));
    const openSubjects = () => {
      setSubjectOpen(true);
      subjectsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    const independent = [
      { id: "library" as View, label: "Library", description: "Manage your personal notes and study resources.", icon: Library },
      { id: "library" as View, label: "Library X-Ray", description: "Analyze uploaded learning resources and question papers.", icon: SearchCheck },
      { id: "schedule-planner" as View, label: "Study Planner", description: "Plan study time independently of a selected subject.", icon: Clock3 },
    ];
    return <section data-testid="home-launcher" className="animate-rise-in py-2 sm:py-6">
      <div className="mx-auto max-w-4xl">
        <div data-testid="home-hero" className="relative overflow-hidden rounded-3xl border border-blue-400/25 bg-[#07111f] p-6 shadow-[0_30px_60px_-32px_rgba(2,6,23,0.85)] sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-28 size-72 rounded-full bg-blue-600/25 blur-3xl" />
            <div className="absolute -bottom-32 -right-16 size-72 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)", backgroundSize: "34px 34px", maskImage: "radial-gradient(ellipse at top left, black, transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at top left, black, transparent 70%)" }} />
          </div>
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
              <span className="size-1.5 rounded-full bg-blue-400" />
              Student workspace
            </span>
            <h1 className="mt-5 font-heading text-3xl font-bold leading-[1.06] tracking-[-0.03em] text-white sm:text-4xl">Select a subject to begin.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">LearnLens is currently connected to the Data Structures demo dataset. Other subjects are shown to demonstrate broader coverage.</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button data-testid="hero-choose-subject-button" onClick={openSubjects} className="h-10 rounded-xl bg-white px-5 text-slate-900 shadow-sm hover:bg-blue-50">Choose a subject <ArrowRight size={16} /></Button>
              <p className="hidden border-l border-white/15 pl-4 text-xs font-medium leading-5 text-slate-300 sm:block">Diagnose the gap. Recover what matters. Verify the improvement.</p>
            </div>
            <div data-testid="hero-stats" className="mt-7 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 sm:gap-6">
              {[
                { testId: "hero-stat-mastery", label: "Overall mastery", value: dashboard ? percent(dashboard.overall_mastery) : "—" },
                { testId: "hero-stat-gaps", label: "Active gaps", value: dashboard ? String(dashboard.active_gaps) : "—" },
                { testId: "hero-stat-recovered", label: "Recovered", value: dashboard ? String(dashboard.recovered_count) : "—" },
              ].map((stat) => (
                <div key={stat.testId} data-testid={stat.testId}>
                  <p className="min-h-8 text-[10px] font-semibold uppercase leading-4 tracking-[0.16em] text-blue-300/90">{stat.label}</p>
                  {dashboardLoading && !dashboard ? (
                    <div className="mt-1.5 h-7 w-14 animate-pulse rounded-md bg-white/10" />
                  ) : (
                    <p className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">{stat.value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div data-testid="subjects-block" ref={subjectsRef} className="relative mt-8">
          <div className={`flex min-h-16 items-center rounded-2xl border bg-white px-4 pr-2 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.7)] transition ${subjectOpen ? "border-blue-400 ring-4 ring-blue-500/10" : "border-slate-200 ring-1 ring-slate-100"}`}>
            <span className="mr-3 flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700"><SearchCheck size={17} /></span>
            <span className="flex-1 text-sm font-medium text-slate-500">Select subject</span>
            <button type="button" aria-label="Show subjects" aria-expanded={subjectOpen} onClick={() => setSubjectOpen((open) => !open)} className="flex size-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <ChevronDown size={18} className={`transition-transform ${subjectOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          {subjectOpen ? <div className="animate-rise-in mt-3 grid gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl ring-1 ring-slate-200/60">
            {subjects.map((subject) => {
              const available = subject === "Data Structures";
              return <button key={subject} type="button" onClick={() => available ? onOpen("dashboard") : toast.error("Select SUBJECT First")} data-testid={`subject-${subject.toLowerCase().replaceAll(" ", "-")}`} className={`flex min-h-12 items-center justify-between rounded-xl px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${available ? "bg-blue-50 text-blue-800 hover:bg-blue-100" : "cursor-not-allowed text-slate-400 hover:bg-slate-50"}`}>
                <span className="text-sm font-medium">{subject}</span>
                {available ? <Badge className="border-0 bg-blue-600 text-white">Available</Badge> : <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Coming later</span>}
              </button>;
            })}
          </div> : null}
        </div>

        {/* Learning Debugger — primary student feature */}
        <div data-testid="learning-debugger-card" className="mt-8 overflow-hidden rounded-3xl border border-blue-200/80 bg-blue-50/60 p-5 shadow-[0_26px_60px_-36px_rgba(37,99,235,0.7)] ring-1 ring-blue-500/10 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_14px_28px_-14px_rgba(37,99,235,0.95)]"><BrainCircuit size={22} /></span>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-blue-600">Core learning workflow</p>
                <h2 className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-slate-900">Learning Debugger</h2>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">Diagnose the gap, trace it to the root, recover it, then prove the improvement. Choose a subject to unlock the full loop.</p>
              </div>
            </div>
            <Button data-testid="debugger-choose-subject-button" variant="outline" onClick={openSubjects} className="rounded-xl bg-white text-slate-900 shadow-sm hover:border-blue-400 hover:bg-blue-50"><SearchCheck size={15} /> Choose subject</Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {debuggerFeatures.map((item, index) => {
              const Icon = item.icon;
              const assessmentDone = Boolean(dashboard?.assessment_count);
              const interventionStarted = Boolean(dashboard?.intervention_effectiveness.length);
              const recoveryDone = Boolean(dashboard?.intervention_effectiveness.some((entry) => entry.result && entry.result !== "IN PROGRESS"));
              const pathDone = Boolean(dashboard?.recovered_count);
              const stageState = item.id === "assessment" ? (assessmentDone ? "completed" : "unlocked")
                : item.id === "stuck" ? (interventionStarted ? "completed" : assessmentDone ? "unlocked" : "locked")
                : item.id === "recovery" ? (recoveryDone ? "completed" : interventionStarted ? "unlocked" : "locked")
                : item.id === "path" ? (pathDone ? "completed" : recoveryDone ? "unlocked" : "locked")
                : (pathDone ? "unlocked" : "locked");
              const stageLabel = index < 4 ? String(index + 1).padStart(2, "0") : "CYCLE";
              const statusText = stageState === "completed" ? "Completed" : stageState === "unlocked" ? "Unlocked" : "Locked";
              const canOpen = stageState !== "locked";
              return <button key={item.id} type="button" onClick={() => canOpen ? onOpen(item.id) : toast.error("Complete the previous stage first")} aria-disabled={!canOpen} data-testid={`debugger-stage-${item.id}`} className={`group relative flex min-h-40 w-full flex-col rounded-2xl border border-[#E2D9CE] bg-white p-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 ${canOpen ? "hover:border-blue-400" : "cursor-not-allowed"}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className={`flex size-10 items-center justify-center rounded-xl transition-colors duration-200 ${stageState === "completed" ? "bg-emerald-50 text-emerald-700" : stageState === "unlocked" ? "bg-blue-600/10 text-blue-700" : "bg-slate-100 text-slate-400"}`}><Icon size={18} /></span>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{stageLabel}</span>
                </div>
                <h3 className="mt-3 font-heading text-sm font-bold text-slate-900">{item.label}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                <span className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${stageState === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : stageState === "unlocked" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{stageState === "completed" ? <CheckCircle2 size={10} /> : stageState === "unlocked" ? <ArrowRight size={10} /> : <Lock size={10} strokeWidth={2.5} />} {statusText}</span>
              </button>;
            })}
          </div>
        </div>

        <div className="mt-9">
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Available independently of subjects</p>
            <span aria-hidden="true" className="h-px flex-1 bg-[#E2D9CE]" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {independent.map(({ id, label, description, icon: Icon }, index) => {
              const plannerAccent = label === "Study Planner";
              return <button key={`${label}-${index}`} type="button" onClick={() => onOpen(id)} data-testid={`independent-feature-${index}`} className={`group relative min-h-40 overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-[0_10px_28px_rgba(30,41,59,0.05)] transition-all duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${plannerAccent ? "border-amber-200 hover:border-amber-400 hover:shadow-[0_18px_36px_-20px_rgba(217,119,6,0.5)]" : "border-[#E2D9CE] hover:border-blue-400 hover:shadow-[0_18px_36px_-20px_rgba(37,99,235,0.55)]"}`}>
                <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-px -translate-y-full bg-gradient-to-r transition-transform duration-200 group-hover:translate-y-0 ${plannerAccent ? "from-amber-400 to-orange-500" : "from-blue-500 to-indigo-500"}`} />
                <span className={`flex size-11 items-center justify-center rounded-xl transition-colors duration-200 ${plannerAccent ? "bg-amber-50 text-amber-700 group-hover:bg-amber-500 group-hover:text-white" : "bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white"}`}><Icon size={19} /></span>
                <h2 className="mt-4 flex items-center gap-2 font-heading text-base font-bold text-slate-900">{label}<ArrowRight size={14} className={`-translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 ${plannerAccent ? "text-amber-600" : "text-blue-600"}`} /></h2>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
              </button>;
            })}
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Ready now · no subject needed</p>
            <span aria-hidden="true" className="h-px flex-1 bg-[#E2D9CE]" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {featureItems.filter((item) => ["dashboard", "classrooms"].includes(item.id)).map((item) => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => onOpen(item.id)} data-testid={`available-feature-${item.id}`} className="group relative min-h-36 overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50/70 to-white p-5 text-left shadow-[0_10px_30px_rgba(37,99,235,0.08)] transition-all duration-200 hover:-translate-y-1 hover:border-blue-400 hover:shadow-[0_20px_40px_-22px_rgba(37,99,235,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60">
                <span className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_12px_24px_-12px_rgba(37,99,235,0.9)] transition-transform duration-200 group-hover:scale-105"><Icon size={19} /></span>
                <h2 className="mt-4 flex items-center gap-2 font-heading text-base font-bold text-slate-900">{item.label}<ArrowRight size={14} className="-translate-x-1 text-blue-600 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" /></h2>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">{item.description}</p>
              </button>;
            })}
          </div>
        </div>
      </div>
    </section>;
  }

  return <section data-testid="home-launcher" aria-labelledby="home-launcher-title" className="animate-rise-in py-2 sm:py-6">
    <h1 id="home-launcher-title" className="sr-only">LearnLens Home</h1>
    <div data-testid="home-feature-grid" className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
      {featureItems.map((item) => { const Icon = item.icon; const roleLimited = item.studentOnly && user.role === "teacher"; if (item.teacherOnly && user.role !== "teacher") return null; return <button key={item.id} data-testid={`home-feature-${item.id}`} onClick={() => onOpen(item.id)} className="group min-h-40 rounded-2xl border border-[#E2D9CE] bg-white p-5 text-left shadow-[0_8px_24px_rgba(30,41,59,0.04)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_14px_30px_rgba(37,99,235,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:min-h-44 sm:p-6"><div className="flex items-start justify-between gap-2"><span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition-[background,color,transform] duration-200 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white"><Icon size={21} /></span>{roleLimited ? <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-500">Student</Badge> : null}</div><h2 className="mt-5 font-heading text-lg font-bold leading-tight text-slate-900 sm:text-xl">{item.label}</h2><p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm">{item.description}</p></button>; })}
    </div>
  </section>;
}

function StudentFeatureNotice({ feature, onClassroom }: { feature: string; onClassroom: () => void }) {
  return <Card data-testid="student-feature-role-notice" className="mx-auto mt-10 max-w-xl border-amber-200 bg-amber-50"><CardContent className="p-7"><Users size={23} className="text-amber-700" /><h1 className="mt-4 font-heading text-2xl font-bold text-slate-900">{feature} is a student workspace.</h1><p className="mt-2 leading-7 text-slate-600">Teacher permissions keep personal student learning data private. Open Classroom Radar to create links, publish questions, and review your roster.</p><Button data-testid="role-notice-classroom-button" className="mt-5" onClick={onClassroom}>Open Classroom Radar <ArrowRight size={16} /></Button></CardContent></Card>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div data-testid="page-intro" className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p data-testid="page-eyebrow" className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">{eyebrow}</p><h1 data-testid="page-title" className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1><p data-testid="page-description" className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{description}</p></div>{action ? <div data-testid="page-action">{action}</div> : null}</div>;
}

function DashboardView({ dashboard, gap, studentId, onStartAssessment, onStuck }: { dashboard?: DashboardResponse; gap: LearningGap | null; studentId: string; onStartAssessment: () => void; onStuck: () => void }) {
  const lifo = dashboard?.concept_mastery.find((item) => item.concept_id === "lifo");
  const intelligence = useQuery({
    queryKey: ["dashboard-intelligence", studentId],
    queryFn: () => apiGet<LearningIntelligenceOverview>(`/intelligence/overview/${studentId}`),
    enabled: Boolean(studentId),
  });
  return <div data-testid="student-dashboard" className="animate-rise-in"><PageIntro eyebrow="Student workspace / Demo Mode" title="Make the next concept make sense." description="Shows your current mastery, active learning gaps, progress, and the evidence behind what LearnLens recommends you learn next." action={<Button data-testid="dashboard-start-assessment-button" size="lg" onClick={onStartAssessment}><ClipboardCheck size={17} /> Start Assessment <ArrowRight size={16} /></Button>} />
    <div data-testid="dashboard-status-banner" className={`mb-7 flex flex-col gap-4 rounded-3xl border p-5 shadow-[0_22px_50px_-34px_rgba(37,99,235,0.45)] sm:flex-row sm:items-center sm:justify-between sm:p-6 ${gap ? "border-rose-200 bg-rose-50/70" : "border-blue-200 bg-blue-50/70"}`}><div className="flex items-start gap-4"><span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_12px_24px_-12px_rgba(37,99,235,0.85)] ${gap ? "bg-gradient-to-br from-rose-500 to-orange-500" : "bg-gradient-to-br from-blue-600 to-indigo-600"}`}>{gap ? <AlertTriangle size={20} /> : <BookOpen size={20} />}</span><div><p data-testid="dashboard-status-title" className="font-heading text-base font-bold tracking-tight text-slate-900 sm:text-lg">{gap ? "A learning gap needs your attention" : "Demo Mode is ready to run"}</p><p data-testid="dashboard-status-copy" className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">{gap ? `The debugger found a likely ${titleCase(gap.root_gap)} prerequisite gap blocking ${titleCase(gap.concept_id)}.` : "The seeded scenario starts with LIFO at 42% and Stack at 45%, ready for a repeatable recovery loop."}</p></div></div>{gap ? <Button data-testid="dashboard-review-gap-button" variant="outline" onClick={onStuck} className="shrink-0 rounded-xl bg-white shadow-sm hover:border-blue-400 hover:bg-blue-50">Review evidence <ArrowRight size={15} /></Button> : null}</div>
    <div className="mb-4 flex items-center gap-3"><p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Today at a glance</p><span aria-hidden="true" className="h-px flex-1 bg-[#E2D9CE]" /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard testId="overall-mastery-card" label="Overall mastery" value={dashboard ? percent(dashboard.overall_mastery) : "—"} note="Across tracked concepts" icon={<Target size={17} />} /><MetricCard testId="recovered-concepts-card" label="Recovered concepts" value={dashboard ? String(dashboard.recovered_count) : "—"} note="Proof, not completion" icon={<CheckCircle2 size={17} />} tone="green" /><MetricCard testId="active-gaps-card" label="Active gaps" value={dashboard ? String(dashboard.active_gaps) : "—"} note="Evidence-backed" icon={<AlertTriangle size={17} />} tone="rose" /><MetricCard testId="learning-time-card" label="Learning time" value={dashboard ? `${Math.max(1, Math.round(dashboard.learning_time_seconds / 60))}m` : "—"} note="This demo session" icon={<Clock3 size={17} />} /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]"><Card data-testid="mastery-overview-card" className="border-[#E2D9CE] shadow-[0_12px_36px_rgba(30,41,59,0.05)]"><CardHeader className="border-b border-[#E2D9CE]"><div className="flex items-center justify-between"><div><CardTitle data-testid="mastery-overview-title" className="font-heading text-xl text-slate-900">Concept mastery</CardTitle><p data-testid="mastery-overview-caption" className="mt-1 text-sm text-slate-500">Where your understanding stands today</p></div><Badge data-testid="prototype-threshold-badge" variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">80% = recovered</Badge></div></CardHeader><CardContent className="space-y-2 pt-4">{dashboard?.concept_mastery.slice(0, 7).map((item) => <div key={item.concept_id} data-testid={`concept-mastery-row-${item.concept_id}`} className="rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{item.name}</span><span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">{item.mastery}%</span></div><ProgressBar value={item.mastery / 100} tone={item.status.includes("recover") ? "green" : item.concept_id === "lifo" ? "amber" : "blue"} /></div>) ?? <div data-testid="mastery-loading-state" className="h-32 animate-pulse rounded-xl bg-slate-100" />}</CardContent></Card>
      <Card data-testid="current-focus-card" className="relative border border-blue-400/25 bg-[#07111f] text-white shadow-[0_28px_56px_-32px_rgba(2,6,23,0.85)]"><div aria-hidden="true" className="pointer-events-none absolute inset-0"><div className="absolute -right-16 -top-16 size-52 rounded-full bg-blue-600/25 blur-3xl" /><div className="absolute -bottom-20 -left-12 size-52 rounded-full bg-indigo-500/20 blur-3xl" /></div><CardContent className="relative flex h-full flex-col justify-between gap-8 p-6"><div><div className="flex items-center justify-between"><p data-testid="current-focus-label" className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-300">Current focus</p><Badge data-testid="current-focus-badge" className="border-0 bg-white/10 text-blue-100">{lifo ? `${lifo.mastery}% mastery` : "Demo"}</Badge></div><h2 data-testid="current-focus-title" className="mt-5 font-heading text-3xl font-bold">{gap ? titleCase(gap.root_gap) : "LIFO"}</h2><p data-testid="current-focus-copy" className="mt-3 text-sm leading-6 text-slate-300">{gap ? "Recover the prerequisite before pushing further into Stack." : "A seeded prerequisite gap is ready to be investigated."}</p></div><div><div className="mb-3 flex justify-between text-xs text-slate-400"><span>Recovery target</span><span>80%</span></div><div className="h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (lifo?.mastery ?? 0.42) * 100)}%` }} /></div><Button data-testid="current-focus-action" className="mt-6 w-full bg-white text-slate-900 hover:bg-blue-50" onClick={gap ? onStuck : onStartAssessment}>{gap ? "Open evidence" : "Begin diagnostic"} <ArrowRight size={16} /></Button></div></CardContent></Card></div>
    {intelligence.data ? <div className="mt-8">
      <div className="mb-4 flex items-center gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">Learning intelligence</p>
        <span aria-hidden="true" className="h-px flex-1 bg-[#E2D9CE]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard testId="planned-tasks-card" label="Study tasks" value={String(intelligence.data.metrics.planned_tasks)} note="Live from Learning Intelligence" icon={<CalendarClock size={17} />} />
      <MetricCard testId="completed-tasks-card" label="Completed tasks" value={String(intelligence.data.metrics.completed_tasks)} note="Persisted learning actions" icon={<CheckCircle2 size={17} />} tone="green" />
      <MetricCard testId="retention-schedule-card" label="Retrieval scheduled" value={String(intelligence.data.metrics.scheduled_revisions)} note="Retention Radar" icon={<RefreshCw size={17} />} />
      <MetricCard testId="xray-resources-card" label="Resources analyzed" value={String(intelligence.data.metrics.resources_analyzed)} note="Real Library X-Rays" icon={<SearchCheck size={17} />} />
      </div>
    </div> : null}
    <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><Card data-testid="recent-activity-card" className="shadow-[0_22px_50px_-36px_rgba(37,99,235,0.5)]"><CardHeader><CardTitle data-testid="recent-activity-title" className="font-heading text-xl text-slate-900">Recent activity</CardTitle></CardHeader><CardContent className="space-y-4">{dashboard?.recent_activity.length ? dashboard.recent_activity.slice(0, 5).map((event) => <div key={`${event.created_at}-${event.label}`} data-testid="activity-event" className="-mx-2 flex gap-3.5 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50"><span className="mt-1 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-blue-100"><span className="size-1.5 rounded-full bg-blue-600" /></span><div><p className="text-sm font-medium text-slate-700">{event.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{event.detail}</p></div></div>) : <p data-testid="activity-empty-state" className="text-sm leading-6 text-slate-500">Your assessment, interventions, and retests will appear here as you work.</p>}</CardContent></Card><Card data-testid="recovery-principles-card" className="border-[#E2D9CE] bg-[#F3EFEA]"><CardContent className="p-6"><p data-testid="recovery-principles-eyebrow" className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">How LearnLens decides</p><div className="mt-4 grid gap-4 sm:grid-cols-3"><Principle number="01" title="Evidence" copy="Question-level attempts reveal patterns." /><Principle number="02" title="Intervention" copy="The next lesson targets the root gap." /><Principle number="03" title="Proof" copy="A retest earns the recovered state." /></div></CardContent></Card></div>
  </div>;
}

function MetricCard({ testId, label, value, note, icon, tone = "blue" }: { testId: string; label: string; value: string; note: string; icon: ReactNode; tone?: "blue" | "green" | "rose" }) {
  const color = tone === "green" ? "text-emerald-600 bg-emerald-50" : tone === "rose" ? "text-rose-600 bg-rose-50" : "text-blue-600 bg-blue-50";
  return <Card data-testid={testId} className="border-[#E2D9CE]"><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><div className={`rounded-lg p-2 ${color}`}>{icon}</div></div><p className="mt-5 font-heading text-3xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></CardContent></Card>;
}

function Principle({ number, title, copy }: { number: string; title: string; copy: string }) { return <div data-testid={`principle-${number}`} className="rounded-2xl border border-[#E2D9CE] bg-white/70 p-4 transition-colors hover:border-blue-300"><span className="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 font-mono text-[11px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)]">{number}</span><p className="mt-3 font-heading font-bold text-slate-900">{title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{copy}</p></div>; }

function AssessmentView({ assessment, assessmentIndex, answers, result, loading, onAnswer, onPrevious, onNext, onStart, onDemoAnswers, onSubmit, onReview }: { assessment: AssessmentSession | null; assessmentIndex: number; answers: Record<string, string>; result: AssessmentResult | null; loading: boolean; onAnswer: (questionId: string, answer: string) => void; onPrevious: () => void; onNext: () => void; onStart: () => void; onDemoAnswers: () => void; onSubmit: () => void; onReview: () => void }) {
  if (!assessment) return <div data-testid="assessment-start-view" className="animate-rise-in"><PageIntro eyebrow="01 / Assess" title="Find the pattern." description="Assesses your understanding and uses question-level responses as evidence to identify concepts and prerequisites that need attention." /><Card data-testid="assessment-start-card" className="max-w-3xl bg-gradient-to-br from-blue-50/70 to-white shadow-[0_26px_60px_-36px_rgba(37,99,235,0.7)]"><CardContent className="p-7 sm:p-10"><div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_16px_30px_-16px_rgba(37,99,235,0.95)]"><ClipboardCheck size={26} /></div><h2 data-testid="assessment-start-title" className="mt-6 font-heading text-3xl font-bold tracking-tight text-slate-900">Diagnostic Assessment</h2><p data-testid="assessment-start-copy" className="mt-3 max-w-xl leading-7 text-slate-600">This demo is tuned to reveal a common LIFO/FIFO confusion pattern. Take your best guess — wrong answers are useful evidence, not a judgment.</p><div className="mt-7 flex flex-wrap items-center gap-3"><Button data-testid="start-assessment-button" size="lg" className="h-10 rounded-xl px-5 shadow-sm" onClick={onStart} disabled={loading}>{loading ? "Loading questions…" : "Start Assessment"} <ArrowRight size={16} /></Button><Badge data-testid="assessment-question-count" variant="outline" className="h-9 rounded-xl bg-white px-3">10 questions · about 4 minutes</Badge></div></CardContent></Card></div>;
  if (result) return <div data-testid="assessment-result-view" className="animate-rise-in"><PageIntro eyebrow="Assessment complete" title="The evidence is in." description="Your answers are now part of the learning state. The debugger looks for repeated patterns and prerequisite links before recommending a next step." /><div className="grid max-w-4xl gap-6 md:grid-cols-[0.7fr_1.3fr]"><Card data-testid="assessment-score-card" className="relative overflow-hidden border border-blue-400/25 bg-[#07111f] text-white shadow-[0_28px_56px_-32px_rgba(2,6,23,0.85)]"><div aria-hidden="true" className="pointer-events-none absolute inset-0"><div className="absolute -right-16 -top-16 size-52 rounded-full bg-blue-600/25 blur-3xl" /><div className="absolute -bottom-20 -left-12 size-52 rounded-full bg-indigo-500/20 blur-3xl" /></div><CardContent className="relative p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-blue-300">Assessment score</p><p data-testid="assessment-score" className="mt-6 font-heading text-6xl font-bold">{Math.round(result.score * 100)}<span className="text-3xl text-slate-400">%</span></p><p className="mt-3 text-sm text-slate-300">{result.correct} of {result.total} correct · {result.attempts_saved} attempts stored</p></CardContent></Card><Card data-testid="assessment-diagnosis-card" className="border-rose-200 bg-rose-50/70 shadow-[0_22px_50px_-34px_rgba(225,29,72,0.45)]"><CardContent className="p-7"><div className="flex items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-[0_12px_24px_-12px_rgba(225,29,72,0.85)]"><AlertTriangle size={20} /></span><div><p className="font-mono text-[10px] uppercase tracking-widest text-rose-700">Debugger signal</p><h2 data-testid="assessment-diagnosis-title" className="mt-2 font-heading text-2xl font-bold text-slate-900">{result.detected_gap ? `Likely ${titleCase(result.detected_gap.root_gap)} prerequisite gap` : "No active gap detected"}</h2><p className="mt-2 text-sm leading-6 text-slate-700">{result.detected_gap ? "The next screen will show the actual attempts and misconception evidence behind this inference." : "Try the seeded demo pattern if you want to explore the recovery loop."}</p>{result.detected_gap ? <Button data-testid="review-diagnosis-button" className="mt-5 h-10 rounded-xl" onClick={onReview}>Open Why Am I Stuck <ArrowRight size={16} /></Button> : null}</div></div></CardContent></Card></div></div>;
  const question = assessment.questions[assessmentIndex];
  const isLast = assessmentIndex === assessment.questions.length - 1;
  return <div data-testid="assessment-view" className="animate-rise-in"><PageIntro eyebrow="01 / Assess" title="Find the pattern." description="Assesses your understanding and uses each response as learning evidence to identify the concepts and prerequisites that need attention." action={<Button data-testid="load-demo-answer-pattern-button" variant="outline" onClick={onDemoAnswers}>Load demo pattern</Button>} /><div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2D9CE] bg-white px-4 py-3"><div><p data-testid="assessment-progress-label" className="font-mono text-xs uppercase tracking-wider text-slate-500">Question {assessmentIndex + 1} of {assessment.questions.length}</p><div className="mt-2 w-48"><ProgressBar value={(assessmentIndex + 1) / assessment.questions.length} /></div></div><Badge data-testid="assessment-focus-badge" variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{assessment.focus}</Badge></div><Card data-testid="question-card" className="max-w-4xl shadow-[0_26px_60px_-36px_rgba(37,99,235,0.55)]"><CardHeader className="border-b border-[#E2D9CE] bg-[#F3EFEA]/70 p-6"><div className="flex items-center justify-between"><Badge data-testid="question-difficulty-badge" variant="outline">{titleCase(question.difficulty)}</Badge><span data-testid="question-concept-label" className="font-mono text-xs uppercase tracking-wider text-slate-400">{titleCase(question.concept_id)}</span></div><CardTitle data-testid="question-prompt" className="pt-4 font-heading text-2xl leading-tight tracking-tight text-slate-900">{question.text}</CardTitle></CardHeader><CardContent className="space-y-2.5 p-6">{question.options.map((option, index) => { const selected = answers[question.id] === option; return <label key={option} data-testid={`assessment-option-${question.id}-${index}`} className={`group flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-22px_rgba(37,99,235,0.7)] focus-within:ring-2 focus-within:ring-blue-500/40 ${selected ? "border-blue-400 bg-blue-50/70" : "border-[#E2D9CE] bg-white hover:border-blue-400"}`}><span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] font-semibold transition-colors ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-[#E2D9CE] bg-slate-50 text-slate-500 group-hover:border-blue-300 group-hover:text-blue-700"}`}>{String.fromCharCode(65 + index)}</span><input aria-label={`Answer option ${index + 1}: ${option}`} type="radio" name={question.id} value={option} checked={selected} onChange={() => onAnswer(question.id, option)} className="mt-1 accent-blue-600" /><span className="text-sm leading-6 text-slate-700">{option}</span>{selected ? <Check size={16} className="ml-auto mt-1 text-blue-600" /> : null}</label>; })}</CardContent><div className="flex flex-col-reverse justify-between gap-3 border-t border-[#E2D9CE] bg-[#F3EFEA]/80 p-4 sm:flex-row sm:p-5"><Button data-testid="assessment-previous-button" variant="ghost" onClick={onPrevious} disabled={assessmentIndex === 0}><ChevronLeft size={16} /> Previous</Button>{isLast ? <Button data-testid="submit-answer-button" onClick={onSubmit} disabled={loading}>{loading ? "Saving evidence…" : "Submit assessment"} <ArrowRight size={16} /></Button> : <Button data-testid="assessment-next-button" onClick={onNext}>Next question <ChevronRight size={16} /></Button>}</div></Card></div>;
}

function StuckView({ gap, states, onAssessment, onStartRecovery, loading }: { gap: LearningGap | null; states: DashboardResponse["concept_mastery"]; onAssessment: () => void; onStartRecovery: () => void; loading: boolean }) {
  if (!gap) return <div data-testid="stuck-empty-view" className="animate-rise-in"><PageIntro eyebrow="02 / Evidence Engine" title="Why Am I Stuck?" description="Traces repeated mistakes and learning evidence to identify the underlying concept or prerequisite that may be blocking your progress." /><Card data-testid="stuck-empty-card" className="max-w-2xl bg-amber-50/70 shadow-[0_22px_50px_-34px_rgba(217,119,6,0.45)]"><CardContent className="p-7"><span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_14px_26px_-14px_rgba(217,119,6,0.9)]"><AlertTriangle size={22} /></span><h2 data-testid="stuck-empty-title" className="mt-5 font-heading text-2xl font-bold tracking-tight text-slate-900">No active gap yet</h2><p data-testid="stuck-empty-copy" className="mt-2 leading-6 text-slate-600">Start the diagnostic so the system can connect your actual answers to the prerequisite graph.</p><Button data-testid="stuck-start-assessment-button" className="mt-6 h-10 rounded-xl" onClick={onAssessment}>Start assessment <ArrowRight size={16} /></Button></CardContent></Card></div>;
  const stackMastery = states.find((item) => item.concept_id === "stack")?.mastery ?? 45;
  return <div data-testid="evidence-drawer" className="animate-rise-in"><PageIntro eyebrow="02 / Evidence Engine" title="Why Am I Stuck?" description="Traces repeated mistakes and learning evidence to identify the smallest underlying concept or prerequisite gap to recover next." action={<Button data-testid="start-intervention-button" size="lg" className="h-10 rounded-xl px-5 shadow-sm" onClick={onStartRecovery} disabled={loading}>{loading ? "Preparing recovery…" : "Start Recovery"} <ArrowRight size={16} /></Button>} /><div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]"><Card data-testid="diagnosis-summary-card" className="border-rose-200 bg-rose-50/70 shadow-[0_22px_50px_-34px_rgba(225,29,72,0.45)]"><CardContent className="p-7"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-rose-700"><span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 text-white"><AlertTriangle size={14} /></span> Problem detected</div><div className="mt-7 grid gap-6 sm:grid-cols-2"><div><p className="text-sm text-slate-500">Current concept</p><p data-testid="diagnosed-concept" className="mt-1 font-heading text-3xl font-bold text-slate-900">{titleCase(gap.concept_id)}</p></div><div><p className="text-sm text-slate-500">Root learning gap</p><p data-testid="diagnosed-root-gap" className="mt-1 font-heading text-3xl font-bold text-rose-700">{titleCase(gap.root_gap)}</p></div></div><div className="mt-8 border-t border-rose-200 pt-5"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-700">Current mastery</p><p data-testid="diagnosed-mastery" className="font-mono text-sm font-semibold text-rose-700">{percent(gap.mastery)}</p></div><div className="mt-3"><ProgressBar value={gap.mastery} tone="amber" /></div><p className="mt-3 text-sm leading-6 text-slate-600">Recover <strong className="text-slate-900">{titleCase(gap.root_gap)}</strong> before continuing with Stack.</p></div></CardContent></Card><Card data-testid="evidence-list-card" className="shadow-[0_22px_50px_-36px_rgba(37,99,235,0.5)]"><CardHeader><div className="flex items-center justify-between"><div><CardTitle data-testid="evidence-list-title" className="font-heading text-xl text-slate-900">Why we detected it</CardTitle><p data-testid="evidence-list-caption" className="mt-1 text-sm text-slate-500">Evidence from your stored attempts</p></div><Badge data-testid="diagnostic-confidence-badge" className="bg-amber-100 text-amber-800">{Math.round(gap.confidence * 100)}% confidence</Badge></div></CardHeader><CardContent className="space-y-4">{gap.evidence.map((item) => <div key={item.text} data-testid={`evidence-item-${item.kind}`} className="flex gap-3 rounded-2xl border border-[#E2D9CE] bg-[#FAF8F5] p-4 transition-colors hover:border-blue-300"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /><p className="text-sm leading-6 text-slate-700">{item.text}</p></div>)}<div data-testid="prerequisite-link" className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-slate-700"><GitBranch size={16} className="text-blue-600" /><span>LIFO</span><ArrowRight size={14} /><span className="font-semibold text-slate-900">Stack</span><span className="ml-auto text-xs text-slate-500">prerequisite edge</span></div><p data-testid="stack-mastery-note" className="mt-3 text-xs text-slate-500">Stack is currently at {stackMastery}% mastery, but its prerequisite rule needs reinforcement.</p></CardContent></Card></div></div>;
}

function RecoveryView({ intervention, questions, practiceAnswers, practiceResults, practiceCompleted, retest, retestAnswers, retestResult, onStart, onComplete, onPracticeAnswer, onPracticeSubmit, onStartRetest, onRetestAnswer, onRetestSubmit, onRetry, onOpenPath }: { intervention: Intervention | null; questions: Question[]; practiceAnswers: Record<string, string>; practiceResults: Record<string, PracticeResult>; practiceCompleted: number; retest: RetestSession | null; retestAnswers: Record<string, string>; retestResult: RetestResult | null; onStart: () => void; onComplete: () => void; onPracticeAnswer: (id: string, answer: string) => void; onPracticeSubmit: (id: string) => void; onStartRetest: () => void; onRetestAnswer: (id: string, answer: string) => void; onRetestSubmit: () => void; onRetry: () => void; onOpenPath: () => void }) {
  if (!intervention) return <div data-testid="recovery-start-view" className="animate-rise-in"><PageIntro eyebrow="03 / Recovery Center" title="Recover the root gap." description="Provides targeted learning and practice for the identified gap, then uses a focused retest to verify whether the concept has actually recovered." /><Card data-testid="recovery-start-card" className="max-w-3xl border-emerald-200 bg-emerald-50/70 shadow-[0_22px_50px_-34px_rgba(5,150,105,0.5)]"><CardContent className="p-8"><div className="flex items-center gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-[0_14px_26px_-14px_rgba(5,150,105,0.9)]"><RefreshCw size={22} /></span><div><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Current gap · LIFO</p><h2 data-testid="recovery-start-title" className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-900">A focused recovery is ready</h2></div></div><p data-testid="recovery-start-copy" className="mt-5 max-w-xl leading-7 text-slate-700">Start with a deterministic explanation and worked example sourced from the prototype knowledge layer. No external documents or LLM are connected.</p><Button data-testid="recovery-start-button" className="mt-6 h-10 rounded-xl" onClick={onStart}>Start targeted intervention <ArrowRight size={16} /></Button></CardContent></Card></div>;
  if (retestResult) return <div data-testid="retest-result-view" className="animate-rise-in"><PageIntro eyebrow="Recovery proof" title="Measure what changed." description="Uses retest evidence to verify recovery, update your learning state, and determine what becomes available next." /><Card data-testid="retest-result-card" className={`max-w-3xl border ${retestResult.status === "RECOVERED" ? "border-emerald-200 bg-emerald-50/70 shadow-[0_22px_50px_-34px_rgba(5,150,105,0.5)]" : "border-amber-200 bg-amber-50/70 shadow-[0_22px_50px_-34px_rgba(217,119,6,0.5)]"}`}><CardContent className="p-8"><div className="flex items-center gap-4"><span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-white ${retestResult.status === "RECOVERED" ? "bg-gradient-to-br from-emerald-600 to-teal-500" : "bg-gradient-to-br from-amber-500 to-orange-500"}`}><CheckCircle2 size={22} /></span><div><p data-testid="retest-status" className="font-mono text-xs uppercase tracking-widest text-slate-600">{titleCase(retestResult.status)}</p><h2 data-testid="retest-result-title" className="mt-1 font-heading text-3xl font-bold tracking-tight text-slate-900">{Math.round(retestResult.mastery_before * 100)}% <span className="text-slate-400">→</span> {Math.round(retestResult.mastery_after * 100)}%</h2></div></div><p data-testid="retest-improvement" className="mt-5 text-slate-700">Improvement: <strong>+{Math.round(retestResult.improvement * 100)} percentage points</strong> from {retestResult.correct} of {retestResult.total} correct.</p>{retestResult.unlocked_concept ? <div data-testid="unlocked-concept-message" className="mt-5 rounded-xl border border-emerald-200 bg-white/70 p-4 text-sm text-emerald-800"><strong>Stack unlocked.</strong> Your learning path has updated from the recovered prerequisite.</div> : <p className="mt-5 text-sm text-slate-600">The next intervention will adapt based on this result and will not simply repeat the same strategy.</p>}<div className="mt-6 flex flex-wrap items-center gap-3">{retestResult.status !== "RECOVERED" ? <Button data-testid="try-different-intervention-button" className="h-10 rounded-xl" onClick={onRetry}>Try a different intervention <RefreshCw size={16} /></Button> : null}<Button data-testid="open-learning-path-button" variant={retestResult.status === "RECOVERED" ? "default" : "outline"} className="h-10 rounded-xl" onClick={onOpenPath}>Open updated learning path <ArrowRight size={16} /></Button></div></CardContent></Card></div>;
  return <div data-testid="recovery-center" className="animate-rise-in"><PageIntro eyebrow="03 / Recovery Center" title="Make LIFO click." description="Provides targeted learning and practice for the identified gap, then verifies recovery through a focused retest with before-and-after evidence." action={<Badge data-testid="recovery-threshold-badge" className="h-9 rounded-xl bg-emerald-100 px-3 text-emerald-800">Target · 80% recovered</Badge>} /><div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><Card data-testid="intervention-content-card" className="shadow-[0_26px_60px_-36px_rgba(37,99,235,0.55)]"><CardHeader className="border-b border-[#E2D9CE]"><div className="flex items-center justify-between"><div><Badge data-testid="intervention-type-badge" variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{titleCase(intervention.type)}</Badge><CardTitle data-testid="intervention-title" className="mt-4 font-heading text-2xl tracking-tight text-slate-900">{intervention.content.title}</CardTitle></div><div data-testid="intervention-mastery-before" className="text-right"><p className="text-xs text-slate-500">Before</p><p className="font-mono text-xl font-semibold text-rose-600">{Math.round(intervention.mastery_before * 100)}%</p></div></div></CardHeader><CardContent className="space-y-6 p-6"><div data-testid="intervention-explanation"><p className="text-base leading-7 text-slate-700">{intervention.content.explanation}</p><p className="mt-3 text-sm leading-6 text-slate-600"><strong className="text-slate-900">Contrast:</strong> {intervention.content.contrast}</p></div><div data-testid="lifo-visual" className="rounded-2xl bg-[#07111f] p-5 font-mono text-sm leading-8 text-blue-100 shadow-[0_18px_40px_-28px_rgba(2,6,23,0.9)]"><p className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">Visual model</p>{intervention.content.visual.map((line) => <div key={line}>{line}</div>)}</div><div data-testid="worked-example" className="rounded-2xl border border-[#E2D9CE] bg-[#FAF8F5] p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Worked example</p><p className="mt-2 text-sm leading-6 text-slate-700">{intervention.content.example}</p></div><div data-testid="intervention-steps"><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Remember it in three moves</p><ol className="mt-3 space-y-2">{intervention.content.steps.map((step, index) => <li key={step} className="flex items-center gap-3 text-sm leading-6 text-slate-700"><span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 font-mono text-[11px] font-semibold text-blue-700">0{index + 1}</span>{step}</li>)}</ol></div>{!intervention.completed ? <Button data-testid="complete-intervention-button" className="h-10 rounded-xl" onClick={onComplete}>I’ve reviewed this — start practice <ArrowRight size={16} /></Button> : null}</CardContent></Card><div className="space-y-6"><Card data-testid="recovery-progress-card" className="shadow-[0_22px_50px_-36px_rgba(37,99,235,0.5)]"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Recovery progress</p><h2 data-testid="recovery-progress-title" className="mt-2 font-heading text-xl font-semibold text-slate-900">{practiceCompleted} / 3 practice</h2></div><div className={`rounded-full p-3 ${practiceCompleted >= 3 ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><Target size={20} /></div></div><div className="mt-5"><ProgressBar value={practiceCompleted / 3} tone={practiceCompleted >= 3 ? "green" : "amber"} /></div><p data-testid="retest-lock-copy" className="mt-3 text-sm leading-6 text-slate-500">{practiceCompleted >= 3 ? "Retest unlocked — now prove the recovery." : "Retest stays locked until all three targeted questions are attempted."}</p></CardContent></Card>{intervention.completed && !retest ? <Card data-testid="practice-card" className="shadow-[0_22px_50px_-36px_rgba(37,99,235,0.5)]"><CardHeader><div className="flex items-center justify-between"><CardTitle data-testid="practice-title" className="font-heading text-xl text-slate-900">Targeted practice</CardTitle></div></CardHeader><CardContent className="space-y-5">{questions.map((question, index) => { const answer = practiceAnswers[question.id] ?? ""; const submitted = practiceResults[question.id]; return <div key={question.id} data-testid={`practice-question-${index + 1}`} className="rounded-2xl border border-[#E2D9CE] bg-[#FAF8F5] p-4"><div className="flex gap-3"><span className="font-mono text-xs text-blue-600">0{index + 1}</span><p className="text-sm font-medium leading-6 text-slate-800">{question.text}</p></div><select data-testid={`practice-select-${index + 1}`} aria-label={`Practice answer ${index + 1}`} value={answer} onChange={(event) => onPracticeAnswer(question.id, event.target.value)} className="mt-3 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/15"><option value="">Select an answer</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select><div className="mt-3 flex items-center justify-between gap-2">{submitted ? <span data-testid={`practice-result-${index + 1}`} className={submitted.correct ? "text-xs font-medium text-emerald-700" : "text-xs font-medium text-rose-700"}>{submitted.correct ? "Correct" : `Correct answer: ${submitted.correct_answer}`}</span> : <span />}{!submitted ? <Button data-testid={`practice-submit-${index + 1}`} size="sm" onClick={() => onPracticeSubmit(question.id)} disabled={!answer}>Check answer</Button> : <Check size={16} className="text-emerald-600" />}</div></div>; })}</CardContent></Card> : null}{practiceCompleted >= 3 && !retest ? <Card data-testid="retest-unlock-card" className="border-emerald-200 bg-emerald-50/70 shadow-[0_22px_50px_-34px_rgba(5,150,105,0.5)]"><CardContent className="p-6"><div className="flex items-start gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white"><CheckCircle2 size={19} /></span><div><h2 data-testid="retest-unlock-title" className="font-heading text-lg font-bold text-slate-900">Retest unlocked</h2><p className="mt-1 text-sm leading-6 text-slate-700">You completed the targeted practice. Now measure whether LIFO recovered.</p><Button data-testid="start-retest-button" className="mt-4 h-10 rounded-xl" onClick={onStartRetest}>Start retest <ArrowRight size={16} /></Button></div></div></CardContent></Card> : null}{retest ? <Card data-testid="retest-card" className="shadow-[0_22px_50px_-36px_rgba(37,99,235,0.5)]"><CardHeader><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Retest · LIFO</p><CardTitle data-testid="retest-title" className="mt-2 font-heading text-xl text-slate-900">Prove the recovery</CardTitle></div></div><p data-testid="retest-before-label" className="mt-2 text-sm text-slate-500">Mastery before: {Math.round(retest.mastery_before * 100)}%</p></CardHeader><CardContent className="space-y-5">{retest.questions.map((question, index) => <div key={question.id} data-testid={`retest-question-${index + 1}`} className="rounded-2xl border border-[#E2D9CE] bg-[#FAF8F5] p-4"><p className="text-sm font-medium leading-6 text-slate-800">{question.text}</p><select data-testid={`retest-select-${index + 1}`} aria-label={`Retest answer ${index + 1}`} value={retestAnswers[question.id] ?? ""} onChange={(event) => onRetestAnswer(question.id, event.target.value)} className="mt-3 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/15"><option value="">Select an answer</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>)}<Button data-testid="submit-retest-button" className="h-10 rounded-xl" onClick={onRetestSubmit}>Submit retest <ArrowRight size={16} /></Button></CardContent></Card> : null}</div></div></div>;
}

function PathView({ path, onRecovery }: { path?: LearningPathResponse; onRecovery: () => void }) {
  return <div data-testid="learning-path-view" className="animate-rise-in"><PageIntro eyebrow="04 / Prerequisite Graph" title="Your learning path, unlocked in order." description="Maps prerequisite relationships and learning state to show the logical order in which concepts become available for learning." action={<Badge data-testid="path-source-badge" variant="outline" className="h-9 rounded-xl border-blue-200 bg-blue-50 px-3 text-blue-700">Live learning state</Badge>} /><Card data-testid="prerequisite-graph-card" className="shadow-[0_26px_60px_-36px_rgba(37,99,235,0.55)]"><CardHeader className="border-b border-[#E2D9CE]"><CardTitle data-testid="prerequisite-graph-title" className="font-heading text-xl tracking-tight text-slate-900">Data Structures graph</CardTitle><p data-testid="prerequisite-graph-caption" className="text-sm text-slate-500">Follow the arrows from a rule to the structure it enables.</p></CardHeader><CardContent className="p-6"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{path?.items.map((item) => <div key={item.concept_id} data-testid={`path-node-${item.concept_id}`} className={`relative rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_36px_-24px_rgba(37,99,235,0.7)] ${item.status === "recovered" ? "border-emerald-200 bg-emerald-50/70" : item.status === "in_recovery" ? "border-amber-200 bg-amber-50/70" : item.status === "locked" ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-blue-50/70"}`}><div className="flex items-center justify-between"><span className="font-mono text-[10px] text-slate-400">{String(item.order).padStart(2, "0")}</span>{item.status === "locked" ? <Lock size={14} className="text-slate-400" /> : item.status === "recovered" ? <CheckCircle2 size={15} className="text-emerald-600" /> : <span className="size-2 rounded-full bg-blue-500" />}</div><p className="mt-4 font-heading font-bold text-slate-900">{item.name}</p><div className="mt-3 flex items-center justify-between"><StatusPill status={item.status} /><span className="font-mono text-xs text-slate-500">{Math.round(item.mastery * 100)}%</span></div>{item.prerequisite_ids.length ? <p className="mt-3 text-xs text-slate-500">After {item.prerequisite_ids.map(titleCase).join(" + ")}</p> : <p className="mt-3 text-xs text-slate-500">Foundation concept</p>}</div>) ?? <div data-testid="path-loading-state" className="h-48 animate-pulse rounded-xl bg-slate-100" />}</div><div data-testid="path-legend" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#E2D9CE] pt-5 text-xs text-slate-600"><span><i className="mr-2 inline-block size-2 rounded-full bg-emerald-500" />Recovered</span><span><i className="mr-2 inline-block size-2 rounded-full bg-amber-500" />In recovery</span><span><i className="mr-2 inline-block size-2 rounded-full bg-blue-500" />Available</span><span><i className="mr-2 inline-block size-2 rounded-full bg-slate-400" />Locked</span></div></CardContent></Card>{path?.current_concept === "lifo" ? <Button data-testid="path-recovery-action" className="mt-6 h-10 rounded-xl" onClick={onRecovery}>Continue LIFO recovery <ArrowRight size={16} /></Button> : null}</div>;
}

function TeacherView({ radar, overview }: { radar?: RadarResponse; overview?: TeacherOverview }) {
  const [selectedGap, setSelectedGap] = useState<string | null>(null);
  const affectedStudents = selectedGap ? radar?.students_needing_attention.filter((student) => student.gap === selectedGap) : radar?.students_needing_attention;
  return <div data-testid="teacher-radar-view" className="animate-rise-in"><PageIntro eyebrow="05 / Teacher view" title="Classroom radar." description="Shows teachers class-level learning gaps, recurring evidence, and recovery progress while keeping private student Library files isolated." action={<Badge data-testid="teacher-data-badge" variant="outline">Owned classrooms · live state</Badge>} />
    <div data-testid="class-overview-section" className="mb-6"><p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-500">Class overview · live from database</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard testId="overview-students-enrolled" label="Students enrolled" value={overview ? String(overview.students_enrolled) : "—"} note="Joined your classrooms" icon={<Users size={17} />} /><MetricCard testId="overview-active-now" label="Active now" value={overview ? String(overview.active_now) : "—"} note={overview ? `Active in last ${overview.active_window_minutes} min` : "Recent activity window"} icon={<Clock3 size={17} />} tone="green" /><MetricCard testId="overview-assessments" label="Assessments" value={overview ? String(overview.assessments) : "—"} note="Created in your classrooms" icon={<ClipboardCheck size={17} />} /><MetricCard testId="overview-needs-attention" label="Students needing attention" value={overview ? String(overview.needs_attention) : "—"} note="Active root gaps" icon={<AlertTriangle size={17} />} tone="rose" /><MetricCard testId="overview-class-mastery" label="Class mastery" value={overview ? (overview.class_mastery === null ? "Not enough data" : percent(overview.class_mastery)) : "—"} note="Across enrolled students" icon={<Target size={17} />} /></div></div>
    <Card data-testid="student-activity-section" className="mb-6 border-[#E2D9CE]"><CardHeader className="border-b border-[#E2D9CE]"><CardTitle data-testid="student-activity-title" className="font-heading text-xl text-slate-900">Student activity</CardTitle><p data-testid="student-activity-caption" className="text-sm text-slate-500">Enrollment, recent activity, and learning status for students in your classrooms.</p></CardHeader><CardContent className="space-y-3 p-5">{overview?.students.length ? overview.students.map((student) => <div key={student.student_id} data-testid={`student-activity-${student.student_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2D9CE] p-4"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-blue-50 font-heading font-semibold text-blue-700">{student.name.split(" ").map((part) => part[0]).join("")}</div><div><p className="font-medium text-slate-800">{student.name}</p><p data-testid={`student-activity-latest-${student.student_id}`} className="mt-1 text-xs text-slate-500">{student.last_activity_label ?? "No recorded activity yet"}</p></div></div><div className="flex items-center gap-2"><Badge data-testid={`student-activity-status-${student.student_id}`} variant="outline" className={student.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}>{student.active ? `Active · last ${overview.active_window_minutes} min` : "Not recently active"}</Badge><StatusPill status={student.learning_status} /></div></div>) : <p data-testid="student-activity-empty" className="text-sm text-slate-500">{overview ? "No students have joined your classrooms yet." : "Loading student activity…"}</p>}</CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-3"><MetricCard testId="class-mastery-card" label="Class mastery" value={radar ? percent(radar.class_mastery) : "—"} note="Across enrolled students" icon={<Target size={17} />} /><MetricCard testId="attention-count-card" label="Needs attention" value={radar ? String(radar.students_needing_attention.length) : "—"} note="Active root gaps" icon={<AlertTriangle size={17} />} tone="rose" /><MetricCard testId="intervention-count-card" label="Interventions" value={radar ? String(radar.intervention_results.length) : "—"} note="Shared recovery history" icon={<RefreshCw size={17} />} tone="green" /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]"><Card data-testid="common-gaps-card" className="shadow-[0_22px_50px_-36px_rgba(37,99,235,0.5)]"><CardHeader><CardTitle data-testid="common-gaps-title" className="font-heading text-xl text-slate-900">Root gaps, not surface marks</CardTitle></CardHeader><CardContent className="space-y-4">{radar?.common_gaps.length ? radar.common_gaps.map((gap) => <button key={gap.concept_id} data-testid={`common-gap-${gap.concept_id}`} onClick={() => setSelectedGap(selectedGap === gap.concept_id ? null : gap.concept_id)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-[border,background] ${selectedGap === gap.concept_id ? "border-blue-300 bg-blue-50" : "border-[#E2D9CE] hover:border-blue-200"}`}><div><p className="font-medium text-slate-800">{gap.name}</p><p className="mt-1 text-xs text-slate-500">Surface: struggling with Stack · Root: {gap.label}</p></div><Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">{gap.students} students</Badge></button>) : <p data-testid="common-gaps-empty" className="text-sm text-slate-500">No active gaps yet.</p>}<div data-testid="misconception-summary" className="rounded-xl bg-[#F3EFEA] p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Repeated misconception</p><p className="mt-2 font-heading font-semibold text-slate-900">{radar?.misconceptions[0]?.label ?? "Awaiting evidence"}</p><p className="mt-1 text-xs text-slate-500">{radar?.misconceptions[0]?.occurrences ?? 0} observed pattern(s)</p></div>{radar?.recovery_comparison.map((item) => <div key={item.concept_id} data-testid={`recovery-comparison-${item.concept_id}`} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Before → after recovery</p><p className="mt-2 font-heading text-xl font-bold text-slate-900">{item.name}: {item.before} → {item.after}</p><p className="mt-1 text-xs text-emerald-800">{item.recovered} student gap(s) recovered after intervention and retest</p></div>)}</CardContent></Card>
      <Card data-testid="students-attention-card" className="shadow-[0_22px_50px_-36px_rgba(37,99,235,0.5)]"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle data-testid="students-attention-title" className="font-heading text-xl text-slate-900">Affected students</CardTitle><p data-testid="students-attention-caption" className="text-sm text-slate-500">{selectedGap ? `Filtered to ${titleCase(selectedGap)}.` : "Select a gap to filter the roster."}</p></div>{selectedGap ? <Button data-testid="clear-gap-filter-button" size="sm" variant="ghost" onClick={() => setSelectedGap(null)}>Clear</Button> : null}</div></CardHeader><CardContent className="space-y-3">{affectedStudents?.length ? affectedStudents.map((student) => <div key={student.student_id} data-testid={`student-attention-${student.student_id}`} className="flex items-center justify-between rounded-xl border border-[#E2D9CE] p-4"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-blue-50 font-heading font-semibold text-blue-700">{student.name.split(" ").map((part) => part[0]).join("")}</div><div><p className="font-medium text-slate-800">{student.name}</p><p className="mt-1 text-xs text-slate-500">{student.gap ? `${titleCase(student.gap)} root gap` : "Monitoring"}</p></div></div><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{student.priority}</Badge></div>) : <p data-testid="students-attention-empty" className="text-sm text-slate-500">No students match this gap.</p>}{radar?.intervention_results.length ? <div data-testid="intervention-results-table" className="mt-5 border-t border-[#E2D9CE] pt-5"><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Intervention results</p>{radar.intervention_results.slice(0, 4).map((item, index) => <div key={`${item.student_id}-${index}`} className="mt-3 flex items-center justify-between text-sm"><span className="text-slate-600">{titleCase(item.type)}</span><span className={item.improvement > 0 ? "font-mono text-emerald-700" : "font-mono text-slate-500"}>{item.improvement > 0 ? "+" : ""}{item.improvement} pts · {titleCase(item.result)}</span></div>)}</div> : null}</CardContent></Card></div>
  </div>;
}
