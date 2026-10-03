import { useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Lock, SearchCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, apiPut } from "@/lib/api";
import type { AssessmentResult, Intervention, RetestResult, User } from "@/lib/types";

type Progress = {
  student_id: string;
  subject: string;
  current_stage: number;
  completed_stages: number[];
  updated_at: string;
};

type Props = {
  user: User;
  onOpen: (view: "home" | "assessment" | "stuck" | "recovery" | "path" | "library") => void;
  assessmentResult: AssessmentResult | null;
  intervention: Intervention | null;
  practiceCompleted: number;
  retestResult: RetestResult | null;
};

const subjects = [
  "Data Structures",
  "Database Management Systems",
  "Operating Systems",
  "Computer Networks",
  "Object-Oriented Programming",
  "Mathematics",
  "Physics",
  "Chemistry",
];

const stages = [
  { id: 1, title: "Detect Learning Gap", description: "Use evidence to identify the concept that needs attention.", action: "Start Diagnosis" },
  { id: 2, title: "Find Root Cause", description: "Trace the visible difficulty to the prerequisite concept behind it.", action: "Review Root Cause" },
  { id: 3, title: "Targeted Intervention", description: "Work through an intervention built around the diagnosed gap.", action: "Open Intervention" },
  { id: 4, title: "Adaptive Practice", description: "Practice the exact concept until the targeted practice requirement is met.", action: "Continue Practice" },
  { id: 5, title: "Verify Recovery", description: "Retest the concept and verify whether recovery has occurred.", action: "Verify Recovery" },
];

export default function LearningDebugger({ user, onOpen, assessmentResult, intervention, practiceCompleted, retestResult }: Props) {
  const studentId = user.student_id ?? "";
  const subject = "Data Structures";

  const progressQuery = useQuery({
    queryKey: ["learning-debugger-progress", studentId, subject],
    queryFn: () => apiGet<Progress>(`/learning-debugger/progress/${studentId}?subject=${encodeURIComponent(subject)}`),
    enabled: Boolean(studentId),
  });

  const saveProgress = useMutation({
    mutationFn: (payload: { current_stage: number; completed_stages: number[] }) =>
      apiPut<Progress>(`/learning-debugger/progress/${studentId}`, { subject, ...payload }),
    onSuccess: (data) => progressQuery.refetch().catch(() => undefined),
  });

  const saved = progressQuery.data;
  const completed = saved?.completed_stages ?? [];
  const currentStage = saved?.current_stage ?? 1;

  const evidenceStage = useMemo(() => {
    if (retestResult) return 5;
    if (practiceCompleted >= 3) return 4;
    if (intervention?.completed) return 3;
    if (intervention) return 2;
    if (assessmentResult) return 1;
    return 0;
  }, [assessmentResult, intervention, practiceCompleted, retestResult]);

  useEffect(() => {
    if (!studentId || !saved || evidenceStage === 0) return;

    const nextCompleted = Array.from(
      new Set([...completed, ...Array.from({ length: evidenceStage }, (_, index) => index + 1)]),
    ).filter((stage) => stage <= 5);
    const nextStage = Math.min(5, nextCompleted.length + 1);

    if (
      nextCompleted.length !== completed.length ||
      nextCompleted.some((stage) => !completed.includes(stage)) ||
      currentStage !== nextStage
    ) {
      saveProgress.mutate({ current_stage: nextStage, completed_stages: nextCompleted });
    }
  }, [evidenceStage, saved, studentId]); // progress is persisted only when evidence advances

  const unlocks = (stageId: number) =>
    stageId === 1 || completed.includes(stageId - 1);

  const openStage = (stageId: number) => {
    if (!unlocks(stageId)) return;
    if (stageId === 1) onOpen("assessment");
    if (stageId === 2) onOpen("stuck");
    if (stageId === 3 || stageId === 4) onOpen("recovery");
    if (stageId === 5) onOpen("recovery");
  };

  return (
    <section data-testid="learning-debugger" className="mx-auto max-w-5xl animate-rise-in py-2 sm:py-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          data-testid="learning-debugger-back-button"
          onClick={() => onOpen("home")}
          className="inline-flex size-9 items-center justify-center rounded-full border border-[#E2D9CE] bg-white text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          aria-label="Back to home"
        >
          <ChevronLeft size={17} />
        </button>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          Progress saved
        </Badge>
      </div>

      <Card className="overflow-hidden border-[#E2D9CE] shadow-[0_12px_36px_rgba(30,41,59,0.05)]">
        <CardHeader className="border-b border-[#E2D9CE] bg-white p-5 sm:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-600">Learning system</p>
          <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <CardTitle className="font-heading text-2xl font-bold text-slate-900 sm:text-3xl">Learning Debugger</CardTitle>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Diagnose the gap, trace its cause, recover the missing concept, and verify the recovery.
              </p>
            </div>
            <div className="min-w-52 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Current subject</p>
              <p className="mt-1 font-medium text-slate-800">{subject}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-7">
          <div data-testid="debugger-subject-selector" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <SearchCheck size={17} className="text-slate-500" />
              <p className="text-sm font-semibold text-slate-800">Subject</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {subjects.map((item) => {
                const available = item === "Data Structures";
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={!available}
                    onClick={() => undefined}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${available ? "border-blue-200 bg-white font-semibold text-blue-700 ring-2 ring-blue-100" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}
                  >
                    {item}
                    {!available ? <span className="ml-2 text-[9px] uppercase tracking-wider">Locked</span> : <span className="ml-2 text-[9px] uppercase tracking-wider">Active</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">Debugger workflow</p>
                <h2 className="mt-1 font-heading text-xl font-bold text-slate-900">Progressive learning recovery</h2>
              </div>
              <p className="text-xs text-slate-500">Stage {Math.min(currentStage, 5)} of 5</p>
            </div>

            <div className="space-y-3">
              {stages.map((stage) => {
                const done = completed.includes(stage.id);
                const unlocked = unlocks(stage.id);
                return (
                  <div
                    key={stage.id}
                    data-testid={`debugger-stage-${stage.id}`}
                    className={`rounded-2xl border p-4 transition sm:p-5 ${done ? "border-emerald-200 bg-emerald-50/60" : unlocked ? "border-blue-200 bg-white shadow-sm" : "border-slate-200 bg-slate-50/70"}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold ${done ? "bg-emerald-100 text-emerald-700" : unlocked ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-400"}`}>
                        {done ? <Check size={18} /> : unlocked ? String(stage.id).padStart(2, "0") : <Lock size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-heading text-base font-bold text-slate-900">{stage.title}</h3>
                          <Badge variant="outline" className={done ? "border-emerald-200 bg-white text-emerald-700" : unlocked ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-400"}>
                            {done ? "Completed" : unlocked ? "Unlocked" : "Locked"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{stage.description}</p>
                        <div className="mt-3">
                          <Button
                            type="button"
                            size="sm"
                            variant={unlocked && !done ? "default" : "outline"}
                            disabled={!unlocked || done}
                            onClick={() => openStage(stage.id)}
                            data-testid={`debugger-stage-action-${stage.id}`}
                          >
                            {done ? "Completed" : stage.action}
                            {!done && unlocked ? <ArrowRight size={15} /> : null}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
              <span>{completed.length} of 5 stages completed</span>
              <span>{saveProgress.isPending ? "Saving…" : "Saved to your learning record"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
