import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Brain, CalendarClock, CheckCircle2, FileText, RefreshCw, SearchCheck, Target, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api";
import type { LearningIntelligenceOverview, LibraryItem, ResourceXRay, User } from "@/lib/types";

type View = "assessment" | "recovery";

const statusClass = (status: string) => {
  if (status === "STABLE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "STARTING TO DECAY") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "AT RISK") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
};

export default function LearningIntelligenceView({ user, onOpen }: { user: User; onOpen: (view: View) => void }) {
  const queryClient = useQueryClient();
  const studentId = user.student_id ?? "";
  const [selectedResource, setSelectedResource] = useState("");
  const [xray, setXray] = useState<ResourceXRay | null>(null);

  const intelligence = useQuery({
    queryKey: ["learning-intelligence", studentId],
    queryFn: () => apiGet<LearningIntelligenceOverview>(`/intelligence/overview/${studentId}`),
    enabled: user.role === "student" && Boolean(studentId),
  });
  const library = useQuery({
    queryKey: ["learning-intelligence-library"],
    queryFn: () => apiGet<LibraryItem[]>("/library/items"),
    enabled: user.role === "student",
  });

  const runXray = useMutation({
    mutationFn: () => apiPost<ResourceXRay>(`/intelligence/resource-xray/${selectedResource}`, {}),
    onSuccess: (data) => {
      setXray(data);
      void queryClient.invalidateQueries({ queryKey: ["learning-intelligence", studentId] });
    },
  });

  const completeTask = useMutation({
    mutationFn: (conceptId: string) => apiPost("/intelligence/tasks/complete", { concept_id: conceptId, status: "completed" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["learning-intelligence", studentId] }),
  });

  const scheduleRetention = useMutation({
    mutationFn: (conceptId: string) => apiPost("/intelligence/retention/action", { concept_id: conceptId, action: "schedule" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["learning-intelligence", studentId] }),
  });

  if (user.role !== "student") {
    return <Card className="mx-auto mt-10 max-w-xl border-amber-200 bg-amber-50"><CardContent className="p-7"><Target size={23} className="text-amber-700" /><h1 className="mt-4 font-heading text-2xl font-bold text-slate-900">Learning Intelligence is a student workspace.</h1><p className="mt-2 leading-7 text-slate-600">Teacher accounts continue to use Classroom Radar for class-level learning evidence.</p></CardContent></Card>;
  }

  const data = intelligence.data;
  const loading = intelligence.isLoading;
  const error = intelligence.isError;

  return (
    <div data-testid="learning-intelligence-view" className="animate-rise-in">
      <div className="mb-8">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">Personal learning intelligence</p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Understand your learning. Then act on it.</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">Connects your resources, learning fingerprint, gaps, study priorities, recovery, and retention into one real-time learning cycle.</p>
      </div>

      {loading ? <Card><CardContent className="p-6 text-sm text-slate-500">Loading your learning intelligence from your account data…</CardContent></Card> : null}
      {error ? <Card className="border-rose-200 bg-rose-50"><CardContent className="p-6 text-sm text-rose-700">Learning Intelligence could not load. Your existing learning workspace is still available.</CardContent></Card> : null}

      {data ? <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Overall mastery", `${Math.round(data.metrics.overall_mastery * 100)}%`],
            ["Active gaps", String(data.metrics.active_gaps)],
            ["Completed tasks", String(data.metrics.completed_tasks)],
            ["Resources X-Rayed", String(data.metrics.resources_analyzed)],
          ].map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></CardContent></Card>)}
        </div>

        <Card className="border-[#E2D9CE]">
          <CardHeader><CardTitle className="flex items-center gap-2"><SearchCheck size={19} /> Resource X-Ray</CardTitle><p className="text-sm text-slate-500">Analyzes your uploaded resource content and stores the result against your account.</p></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select value={selectedResource} onChange={(e) => { setSelectedResource(e.target.value); setXray(null); }} className="h-10 flex-1 rounded-lg border bg-white px-3 text-sm">
                <option value="">Select a Library resource</option>
                {(library.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <Button disabled={!selectedResource || runXray.isPending} onClick={() => runXray.mutate()}><SearchCheck size={16} /> {runXray.isPending ? "Analyzing…" : "Run X-Ray"}</Button>
            </div>
            {xray ? <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Info title="Topics" value={xray.topics.join(" · ") || "No curriculum concepts detected"} />
              <Info title="Prerequisites" value={xray.prerequisites.join(" · ") || "No missing prerequisite detected"} />
              <Info title="Difficulty" value={Object.entries(xray.difficulty_distribution).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(" · ") || "No difficulty signals"} />
              <Info title="Question patterns" value={Object.entries(xray.question_patterns).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(" · ") || "No question-pattern signals"} />
            </div> : null}
            {xray?.extraction_warning ? <p className="mt-3 text-xs text-amber-700">{xray.extraction_warning}</p> : null}
          </CardContent>
        </Card>

        <Card className="border-[#E2D9CE]">
          <CardHeader><CardTitle className="flex items-center gap-2"><Brain size={19} /> Learning Fingerprint</CardTitle><p className="text-sm text-slate-500">A live profile built from your assessment, practice, recovery, and retest records.</p></CardHeader>
          <CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.fingerprint.map((item) => <div key={item.concept_id} className="rounded-xl border p-4"><div className="flex justify-between gap-2"><p className="font-medium">{item.topic}</p><span className="font-mono text-xs">{Math.round(item.mastery * 100)}%</span></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, item.mastery * 100))}%` }} /></div><p className="mt-2 text-xs text-slate-500">{item.attempts} attempts · {item.status.replaceAll("_", " ")}</p></div>)}
          </div></CardContent>
        </Card>

        <Card className="border-[#E2D9CE]">
          <CardHeader><CardTitle className="flex items-center gap-2"><TriangleAlert size={19} /> Root Gaps → Study Planner</CardTitle><p className="text-sm text-slate-500">Every priority is calculated from your stored mastery and active diagnostic gaps.</p></CardHeader>
          <CardContent><div className="space-y-3">
            {data.study_plan.length ? data.study_plan.map((task, index) => <div key={task.concept_id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs text-blue-700">{index + 1}</div><div className="min-w-0 flex-1"><p className="font-semibold">{task.topic}</p><p className="mt-1 text-sm text-slate-500">{task.reason} · {task.estimated_minutes} min · {task.activity}</p></div><Badge variant="outline">{task.priority}</Badge><Button size="sm" variant="outline" disabled={task.status === "completed" || completeTask.isPending} onClick={() => completeTask.mutate(task.concept_id)}>{task.status === "completed" ? "Completed" : "Mark complete"}</Button></div>) : <p className="text-sm text-slate-500">No study tasks are currently required.</p>}
          </div><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" onClick={() => onOpen("assessment")}>Run Diagnosis <ArrowRight size={16} /></Button><Button onClick={() => onOpen("recovery")}>Continue Recovery <RefreshCw size={16} /></Button></div></CardContent>
        </Card>

        <Card className="border-[#E2D9CE]">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock size={19} /> Retention Radar</CardTitle><p className="text-sm text-slate-500">Previously learned concepts remain connected to retrieval and revision instead of disappearing after recovery.</p></CardHeader>
          <CardContent><div className="grid gap-3 md:grid-cols-2">
            {data.retention.map((item) => <div key={item.concept_id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.topic}</p><p className="mt-1 text-xs text-slate-500">Mastery {Math.round(item.mastery * 100)}%</p></div><Badge variant="outline" className={statusClass(item.status)}>{item.status}</Badge></div><p className="mt-3 text-sm text-slate-600">{item.next_action}</p>{item.next_revision_at ? <p className="mt-2 text-xs font-medium text-blue-700">Scheduled: {new Date(item.next_revision_at).toLocaleString()}</p> : null}{item.status !== "STABLE" ? <Button className="mt-3" size="sm" variant="outline" disabled={scheduleRetention.isPending} onClick={() => scheduleRetention.mutate(item.concept_id)}><CalendarClock size={14} /> Schedule retrieval</Button> : <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={15} /> Stable for now</p>}</div>)}
          </div></CardContent>
        </Card>

        {data.resource_xrays.length ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18} /> Analyzed Resources</CardTitle></CardHeader><CardContent><div className="space-y-2">{data.resource_xrays.map((item) => <div key={item.item_id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{item.resource_name}</span><span className="text-slate-500">{item.extracted_text_chars.toLocaleString()} characters analyzed</span></div>)}</div></CardContent></Card> : null}
      </div> : null}
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-2 text-sm leading-6 text-slate-800">{value}</p></div>;
}
