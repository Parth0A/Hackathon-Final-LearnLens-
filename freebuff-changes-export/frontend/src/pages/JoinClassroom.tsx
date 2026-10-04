import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, School } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, apiPost } from "@/lib/api";
import type { Classroom, User } from "@/lib/types";

export default function JoinClassroom({ user }: { user: User }) {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const join = useMutation({ mutationFn: () => apiPost<Classroom>("/classrooms/join", { code }) });
  const error = join.error instanceof ApiError && join.error.body && typeof join.error.body === "object" && "detail" in join.error.body ? String((join.error.body as { detail: unknown }).detail) : "Unable to join this classroom.";
  return <div data-testid="join-classroom-page" className="flex min-h-svh items-center justify-center bg-[#FAF8F5] p-5"><Card className="w-full max-w-lg border-[#E2D9CE]"><CardContent className="p-8"><div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><School size={23} /></div><p className="mt-6 font-mono text-xs uppercase tracking-widest text-blue-600">Classroom invite · {code}</p><h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">Join this LearnLens classroom</h1><p className="mt-3 leading-7 text-slate-600">Signed in as {user.name}. Your teacher will see you in the roster after you join.</p>{user.role !== "student" ? <p data-testid="join-role-error" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Only student accounts can join a classroom link.</p> : null}{join.isError ? <p data-testid="join-error" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}{join.data ? <div data-testid="join-success" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mb-2" size={19} /><strong>Joined {join.data.name}.</strong><br />You now have access to its published assessments.</div> : null}<div className="mt-7 flex gap-3">{!join.data && user.role === "student" ? <Button data-testid="join-classroom-button" onClick={() => join.mutate()} disabled={join.isPending}>{join.isPending ? "Joining…" : "Join Classroom"}</Button> : null}<Button data-testid="join-back-button" variant="outline" onClick={() => navigate("/")}><ArrowLeft size={16} /> Back to LearnLens</Button></div></CardContent></Card></div>;
}