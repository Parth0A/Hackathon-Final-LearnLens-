import { BookOpen, BrainCircuit, ClipboardList, Home, LayoutDashboard, Library, Radar, ScanSearch, Sparkles } from "lucide-react";
import type { User } from "@/lib/types";

type Props = {
  user: User;
  view: string;
  onNavigate: (view: string) => void;
};

const teacherItems = [
  { id: "classrooms", label: "Classroom Radar", icon: Radar },
  { id: "teacher-student-dashboard", label: "Student Dashboard", icon: LayoutDashboard },
  { id: "teacher", label: "Teacher Dashboard", icon: ClipboardList },
  { id: "library", label: "Library", icon: Library },
  { id: "teacher-xray", label: "X-Ray", icon: ScanSearch, badge: "In Update" },
  { id: "teacher-create-paper", label: "Create Paper", icon: Sparkles, badge: "Coming Soon" },
];

const studentItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "assessment", label: "Learning Debugger", icon: BrainCircuit },
  { id: "recovery", label: "Recovery Center", icon: BookOpen },
  { id: "schedule-planner", label: "Study Planner", icon: ClipboardList },
  { id: "library", label: "Library", icon: Library },
  { id: "student-xray", label: "X-Ray", icon: ScanSearch, badge: "In Update" },
  { id: "student-create-paper", label: "Create Paper", icon: Sparkles, badge: "Coming Soon" },
];

export default function DesktopWorkspaceNav({ user, view, onNavigate }: Props) {
  const items = user.role === "teacher" ? teacherItems : studentItems;
  return (
    <aside data-testid="desktop-workspace-nav" className="hidden w-[178px] shrink-0 lg:block">
      <div className="sticky top-24 rounded-2xl border border-[#E2D9CE] bg-white p-2 shadow-[0_10px_28px_rgba(30,41,59,0.04)]">
        <div className="px-2.5 pb-2 pt-1">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">{user.role === "teacher" ? "Teacher" : "Student"}</p>
        </div>
        <nav className="space-y-1" aria-label="LearnLens desktop navigation">
          {items.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button key={item.id} type="button" data-testid={\`desktop-nav-\${item.id}\`} onClick={() => onNavigate(item.id)}
                className={\`flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-[11px] font-medium transition-colors \${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}\`}>
                <Icon size={15} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[7px] font-semibold text-blue-600">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
