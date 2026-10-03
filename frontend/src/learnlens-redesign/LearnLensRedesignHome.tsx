import { useMemo, useState } from "react";
import {
  Activity, ArrowRight, BarChart3, BookOpen, BrainCircuit, CalendarClock, CheckCircle2,
  ClipboardCheck, FolderOpen, Gauge, Library, Search, Settings2, ShieldCheck, Sparkles,
  Target, Users, X
} from "lucide-react";
import type { User } from "@/lib/types";
import AsciiLearnLensLogo from "./AsciiLearnLensLogo";

type DashboardView = "home" | "dashboard" | "assessment" | "stuck" | "recovery" | "path" | "library" | "schedule-planner" | "streak" | "classrooms" | "teacher" | "learning-intelligence" | "admin";

type Feature = {
  id: DashboardView;
  label: string;
  description: string;
  icon: typeof Activity;
  tone: string;
  roles: User["role"][];
};

const features: Feature[] = [
  { id: "dashboard", label: "Learning Dashboard", description: "See mastery, active gaps, progress and your next learning priorities.", icon: Gauge, tone: "blue", roles: ["student"] },
  { id: "assessment", label: "Assessments", description: "Check understanding and turn performance evidence into learning actions.", icon: ClipboardCheck, tone: "emerald", roles: ["student", "teacher"] },
  { id: "stuck", label: "Learning Debugger", description: "Trace repeated mistakes to the prerequisite or concept blocking progress.", icon: BrainCircuit, tone: "violet", roles: ["student"] },
  { id: "recovery", label: "Recovery Center", description: "Practice a targeted intervention, then verify recovery with a focused retest.", icon: Sparkles, tone: "cyan", roles: ["student"] },
  { id: "path", label: "Learning Path", description: "Follow prerequisite relationships and unlock concepts in logical order.", icon: Target, tone: "indigo", roles: ["student"] },
  { id: "schedule-planner", label: "Study Planner", description: "Turn learning priorities and available time into a focused study plan.", icon: CalendarClock, tone: "amber", roles: ["student"] },
  { id: "classrooms", label: "Classroom Radar", description: "Connect classes, shared assessments, question-paper analysis and learning evidence.", icon: Users, tone: "yellow", roles: ["student", "teacher"] },
  { id: "teacher", label: "Teacher Radar", description: "View class-level gaps, activity and recovery evidence across your classroom.", icon: BarChart3, tone: "pink", roles: ["teacher"] },
  { id: "library", label: "Library", description: "Organize notes and resources and keep study material close to the learning loop.", icon: Library, tone: "teal", roles: ["student", "teacher", "admin"] },
  { id: "learning-intelligence", label: "Learning Intelligence", description: "Connect learning fingerprint, gaps, resources, priorities and retention.", icon: Activity, tone: "sky", roles: ["student"] },
  { id: "admin", label: "Admin Console", description: "Review system capabilities, role controls and LearnLens administration tools.", icon: ShieldCheck, tone: "slate", roles: ["admin"] },
];

const toneClasses: Record<string, string> = { blue: "bg-blue-500/15 text-blue-300", emerald: "bg-emerald-500/15 text-emerald-300", violet: "bg-violet-500/15 text-violet-300", cyan: "bg-cyan-500/15 text-cyan-300", indigo: "bg-indigo-500/15 text-indigo-300", amber: "bg-amber-500/15 text-amber-300", yellow: "bg-yellow-500/15 text-yellow-300", pink: "bg-pink-500/15 text-pink-300", teal: "bg-teal-500/15 text-teal-300", sky: "bg-sky-500/15 text-sky-300", slate: "bg-slate-500/15 text-slate-300" };

const subjects = ["Data Structures", "Database Management Systems", "Operating Systems", "Computer Networks", "Object-Oriented Programming", "Mathematics", "Physics", "Chemistry"];

export default function LearnLensRedesignHome({ user, onOpen }: { user: User; onOpen: (view: DashboardView) => void }) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState(subjects[0]);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const roleFeatures = useMemo(() => {
    const query = search.trim().toLowerCase();
    return features.filter((item) => item.roles.includes(user.role) && (!query || `${item.label} ${item.description}`.toLowerCase().includes(query)));
  }, [search, user.role]);

  const openPrimary = () => {
    if (user.role === "student") onOpen("assessment");
    else if (user.role === "teacher") onOpen("teacher");
    else onOpen("admin");
  };

  const navItems: { label: string; view: DashboardView }[] = user.role === "student"
    ? [{ label: "Home", view: "home" }, { label: "Learn", view: "dashboard" }, { label: "Assess", view: "assessment" }, { label: "Progress", view: "learning-intelligence" }, { label: "Library", view: "library" }]
    : user.role === "teacher"
      ? [{ label: "Home", view: "home" }, { label: "Radar", view: "teacher" }, { label: "Assess", view: "classrooms" }, { label: "Progress", view: "teacher" }, { label: "Library", view: "library" }]
      : [{ label: "Home", view: "home" }, { label: "Admin", view: "admin" }, { label: "Library", view: "library" }];

  return (
    <div className="learnlens-redesign min-h-screen bg-[#03060d] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#03060d]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-6 px-4 py-3 sm:px-7">
          <button type="button" onClick={() => onOpen("home")} className="flex shrink-0 items-center gap-3" aria-label="LearnLens home">
            <div className="grid size-10 place-items-center rounded-xl border border-blue-400/30 bg-blue-500/10 shadow-[0_0_30px_rgba(95,156,255,.16)]">
              <BrainCircuit className="text-blue-300" size={22} />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight">LearnLens</span>
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <button key={item.label} type="button" onClick={() => onOpen(item.view)} className={`rounded-full px-4 py-2 text-sm font-medium transition hover:bg-white/10 ${item.label === "Home" ? "bg-blue-500/20 text-blue-200" : "text-slate-400"}`}>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-100">{user.name}</p>
              <p className="text-[11px] capitalize text-slate-500">{user.role}</p>
            </div>
            <div className="grid size-9 place-items-center rounded-full border border-blue-300/30 bg-blue-500/15 text-sm font-bold text-blue-200">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 pb-14 pt-5 sm:px-7 lg:pt-7">
        <section className="mb-5">
          <AsciiLearnLensLogo />
        </section>

        <section className="rounded-2xl border border-blue-400/25 bg-[#071122] p-2 shadow-[0_18px_70px_rgba(0,0,0,.25)]">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-white/[.035] px-4 py-3">
              <Search size={20} className="shrink-0 text-blue-300" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anything… topics, questions, concepts" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" aria-label="Search LearnLens" />
              {search ? <button type="button" onClick={() => setSearch("")} className="text-slate-500 hover:text-white" aria-label="Clear search"><X size={16} /></button> : null}
            </div>
            <div className="relative border-t border-white/10 px-2 pt-2 lg:border-l lg:border-t-0 lg:pt-0">
              <button type="button" onClick={() => setSubjectOpen((value) => !value)} className="flex w-full items-center justify-between gap-6 rounded-xl px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 lg:w-64" aria-expanded={subjectOpen}>
                <span><span className="mr-2 text-xs text-slate-500">Subject</span>{subject}</span>
                <span className="text-blue-300">⌄</span>
              </button>
              {subjectOpen ? (
                <div className="absolute right-2 top-full z-20 mt-2 max-h-64 w-[calc(100%-1rem)] overflow-auto rounded-xl border border-white/10 bg-[#0a1324] p-1 shadow-2xl lg:w-64">
                  {subjects.map((item) => <button key={item} type="button" onClick={() => { setSubject(item); setSubjectOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-blue-500/15 hover:text-white">{item}</button>)}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={openPrimary} className="flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-[0_0_28px_rgba(95,156,255,.2)] transition hover:bg-blue-400">
              {user.role === "student" ? `Start ${subject}` : user.role === "teacher" ? "Open Teacher Radar" : "Open Admin Console"} <ArrowRight size={17} />
            </button>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.24em] text-blue-300">Role-aware workspace / {user.role}</p>
              <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight sm:text-3xl">Explore LearnLens</h1>
              <p className="mt-1 text-sm text-slate-400">Everything you need to learn, practice, recover and grow.</p>
            </div>
            {search ? <p className="text-xs text-slate-500">{roleFeatures.length} matching tools</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {roleFeatures.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="group min-h-[165px] rounded-2xl border border-blue-400/20 bg-[#071122]/80 p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-blue-400/50 hover:bg-[#0a172b] hover:shadow-[0_20px_55px_rgba(0,0,0,.25)]">
                  <div className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ring-white/10 ${toneClasses[item.tone]}`}><Icon size={22} /></div>
                  <div className="mt-5 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-heading text-base font-bold text-white">{item.label}</h2>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{item.description}</p>
                    </div>
                    <ArrowRight size={17} className="mt-1 shrink-0 text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-300" />
                  </div>
                </button>
              );
            })}
          </div>

          {roleFeatures.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-10 text-center">
              <Search size={26} className="mx-auto text-slate-600" />
              <p className="mt-3 font-medium text-slate-300">No LearnLens tools match “{search}”.</p>
              <button type="button" onClick={() => setSearch("")} className="mt-3 text-sm text-blue-300 hover:text-blue-200">Clear search</button>
            </div>
          ) : null}
        </section>

        <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-white/10 pt-5 text-[11px] text-slate-600 sm:flex-row">
          <span>LearnLens · Learn · Debug · Recover · Grow</span>
          <span className="flex items-center gap-2"><CheckCircle2 size={13} className="text-blue-400" /> Learning evidence stays connected to the intervention loop.</span>
        </footer>
      </main>
    </div>
  );
}
