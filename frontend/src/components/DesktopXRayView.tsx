import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FileSearch, FolderOpen, ScanSearch, UploadCloud } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import type { LibraryItem, User } from "@/lib/types";

type Props = { user: User; createPaper?: boolean; onBack: () => void };

export default function DesktopXRayView({ user, createPaper = false, onBack }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState("");
  const [preview, setPreview] = useState(false);
  const library = useQuery({ queryKey: ["desktop-xray-library", user.id], queryFn: () => apiGet<LibraryItem[]>("/library/items"), enabled: Boolean(user.id), retry: 1 });
  const libraryFiles = useMemo(() => (library.data ?? []).filter((item) => item.kind === "file"), [library.data]);
  const selectedLibrary = libraryFiles.find((item) => item.id === selectedLibraryId);
  const selectedName = selectedFile?.name ?? selectedLibrary?.name ?? "";
  const ready = Boolean(selectedName);

  if (createPaper) return (
    <div data-testid="desktop-create-paper-view" className="animate-rise-in">
      <div className="mb-6 flex items-center gap-3"><Button variant="ghost" size="icon-sm" aria-label="Back" onClick={onBack}><ArrowLeft size={17} /></Button><div><div className="flex items-center gap-2"><h1 className="font-heading text-2xl font-bold text-slate-900">Create Paper With LearnLens</h1><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Coming Soon</Badge></div><p className="mt-1 text-sm text-slate-500">Build a paper from subject, topic, question count and difficulty requirements.</p></div></div>
      <Card className="border-[#E2D9CE]"><CardHeader><CardTitle className="font-heading text-lg">Paper setup</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Subject<select className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option>Select subject</option></select></label>
        <label className="text-sm font-medium text-slate-700">Topic<select className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option>Select topic</option></select></label>
        <label className="text-sm font-medium text-slate-700">Number of questions<Input className="mt-2" type="number" min="1" placeholder="e.g. 10" /></label>
        <label className="text-sm font-medium text-slate-700">Difficulty<select className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option>Select level</option><option>Easy</option><option>Moderate</option><option>Difficult</option></select></label>
        <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-slate-600">This paper-generation workspace is marked Coming Soon here. The existing classroom paper-generation flow remains unchanged.</div>
        <Button disabled className="sm:col-span-2">Generate Paper</Button>
      </CardContent></Card>
    </div>
  );

  return (
    <div data-testid="desktop-xray-view" className="animate-rise-in">
      <div className="mb-6 flex items-center gap-3">{preview ? <Button variant="ghost" size="icon-sm" aria-label="Back to X-Ray" onClick={() => setPreview(false)}><ArrowLeft size={17} /></Button> : null}<div><div className="flex items-center gap-2"><h1 className="font-heading text-2xl font-bold text-slate-900">{preview ? "X-Ray Analysis Preview" : "X-Ray"}</h1><Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">In Update</Badge></div><p className="mt-1 text-sm text-slate-500">Scan and analyze question papers to understand difficulty, concepts and question distribution.</p></div></div>
      {!preview ? <Card className="border-[#E2D9CE]"><CardHeader><CardTitle className="flex items-center gap-2 font-heading text-lg"><FileSearch size={19} /> Add Paper For X-Ray</CardTitle><p className="text-sm text-slate-500">Choose a paper from your LearnLens Library or browse from this device.</p></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#E2D9CE] p-5"><div className="flex items-center gap-2 text-sm font-semibold"><FolderOpen size={17} className="text-blue-600" /> Select from Library</div><p className="mt-2 text-xs leading-5 text-slate-500">Choose a file already stored in your private Library.</p><select data-testid="xray-library-select" value={selectedLibraryId} onChange={(e) => { setSelectedLibraryId(e.target.value); setSelectedFile(null); setPreview(false); }} className="mt-4 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Choose a file…</option>{libraryFiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="rounded-2xl border border-[#E2D9CE] p-5"><div className="flex items-center gap-2 text-sm font-semibold"><UploadCloud size={17} className="text-blue-600" /> Browse / Upload</div><p className="mt-2 text-xs leading-5 text-slate-500">Choose a question paper from your device.</p><Input data-testid="xray-file-input" type="file" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" className="mt-4" onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setSelectedLibraryId(""); setPreview(false); }} /></div>
        </div>
        {selectedName ? <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4"><div className="min-w-0"><p className="text-xs uppercase tracking-wider text-blue-600">Paper selected</p><p className="mt-1 truncate text-sm font-semibold text-slate-800">{selectedName}</p></div><CheckCircle2 size={19} className="shrink-0 text-blue-600" /></div> : null}
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-800">X-Ray is currently in update.</span> It will analyze paper difficulty, concept coverage, question distribution and more.</div>
        <Button data-testid="xray-preview-button" className="w-full sm:w-auto" disabled={!ready} onClick={() => setPreview(true)}><ScanSearch size={16} /> {ready ? "X-Ray Paper" : "Select a paper first"}</Button>
      </CardContent></Card> :
      <div className="space-y-4">
        {selectedName ? <Card className="border-[#E2D9CE]"><CardContent className="flex items-center gap-3 p-4"><FileSearch size={19} className="text-blue-600" /><div><p className="font-medium text-slate-800">{selectedName}</p><p className="text-xs text-slate-500">Preview workflow · no analysis result is being fabricated</p></div></CardContent></Card> : null}
        <Card className="border-[#E2D9CE]"><CardContent className="p-6"><div className="mx-auto max-w-2xl text-center"><div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ScanSearch size={30} /></div><h2 className="mt-5 font-heading text-2xl font-bold text-slate-900">X-Ray is in Update</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">This feature will analyze your paper and provide insights on difficulty, concept coverage and more.</p></div><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{["Difficulty distribution", "Concept coverage", "Topic coverage", "Question distribution", "Cognitive / skill level"].map((item) => <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs font-medium text-slate-600">{item}</div>)}</div><div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-center text-xs text-slate-600">Intended paper diagnosis: Easy · Moderate · Difficult · concept balance · prerequisite coverage.</div></CardContent></Card>
      </div>}
    </div>
  );
}
