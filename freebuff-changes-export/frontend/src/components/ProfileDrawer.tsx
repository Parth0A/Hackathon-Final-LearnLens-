import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, LogOut, Moon, Pencil, Sun, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiPatch } from "@/lib/api";
import { endSession, sessionKey } from "@/lib/session";
import type { User } from "@/lib/types";

export default function ProfileDrawer({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [className, setClassName] = useState(user.class_name ?? "");
  const [about, setAbout] = useState(user.about);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return localStorage.getItem("learnlens-theme") === "dark" ? "dark" : "light"; } catch { return "light"; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("learnlens-theme", theme); } catch { /* storage unavailable */ }
  }, [theme]);

  const updateProfile = useMutation({
    mutationFn: () => apiPatch<User>("/auth/profile", { name, class_name: className || null, about }),
    onSuccess: (updated) => { queryClient.setQueryData(sessionKey, updated); setEditing(false); toast.success("Profile updated"); },
    onError: () => toast.error("Profile changes could not be saved."),
  });

  const logout = async () => {
    await endSession();
    window.location.assign("/");
  };

  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return <>
    <Button data-testid="profile-drawer-open-button" variant="ghost" size="icon" aria-label="Open profile" onClick={() => setOpen(true)} className="shrink-0 rounded-xl border border-[#E2D9CE] bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700"><UserRound size={18} /></Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent data-testid="profile-drawer" side="left" showCloseButton={false} overlayClassName="bg-black/35 backdrop-blur-xl" style={{ width: "48vw", maxWidth: "24rem" }} className="rounded-r-3xl border-[#E2D9CE] p-0">
        <SheetHeader className="border-b border-[#E2D9CE] p-5 pr-14">
          <SheetTitle data-testid="profile-drawer-title" className="font-heading text-xl font-bold text-slate-900">Profile</SheetTitle>
          <SheetDescription>Manage only your LearnLens identity here.</SheetDescription>
          <SheetClose data-testid="profile-drawer-close-button" render={<Button variant="ghost" size="icon-sm" className="absolute right-4 top-4" aria-label="Close profile" />}><X size={17} /></SheetClose>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5">
          <div data-testid="profile-picture" className="flex size-20 items-center justify-center rounded-3xl bg-blue-600 font-heading text-2xl font-bold text-white shadow-sm">{initials}</div>
          <h2 data-testid="profile-name" className="mt-4 font-heading text-2xl font-bold text-slate-900">{user.name}</h2>
          <p data-testid="profile-role-status" className="mt-1 text-sm font-medium capitalize text-blue-700">{user.role}</p>
          <p data-testid="profile-class" className="mt-1 text-sm text-slate-500">{user.class_name || "No class set"}</p>

          {editing ? <div data-testid="manage-profile-form" className="mt-6 space-y-4 rounded-2xl border border-[#E2D9CE] bg-[#FAF8F5] p-4">
            <div><Label htmlFor="profile-name-input">Name</Label><Input id="profile-name-input" data-testid="profile-name-input" className="mt-2" value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div><Label htmlFor="profile-class-input">Status / class</Label><Input id="profile-class-input" data-testid="profile-class-input" className="mt-2" value={className} onChange={(event) => setClassName(event.target.value)} /></div>
            <div><Label htmlFor="profile-about-input">About</Label><Textarea id="profile-about-input" data-testid="profile-about-input" className="mt-2" value={about} onChange={(event) => setAbout(event.target.value)} /></div>
            <div className="flex gap-2"><Button data-testid="profile-save-button" size="sm" onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>Save</Button><Button data-testid="profile-cancel-button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div>
          </div> : null}

          <div className="mt-7 space-y-2">
            <div data-testid="theme-section" className="mb-2 rounded-2xl border border-[#E2D9CE] bg-[#FAF8F5] p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">THEME</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" data-testid="theme-light-button" aria-pressed={theme === "light"} onClick={() => setTheme("light")} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${theme === "light" ? "border-blue-200 bg-white text-blue-700 shadow-sm" : "border-transparent text-slate-500 hover:bg-white/70"}`}><Sun size={15} /> LIGHT</button>
                <button type="button" data-testid="theme-dark-button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${theme === "dark" ? "border-slate-600 bg-slate-800 text-white shadow-sm" : "border-transparent text-slate-500 hover:bg-white/70"}`}><Moon size={15} /> DARK</button>
              </div>
            </div>
            <button data-testid="about-us-button" onClick={() => setAboutOpen((value) => !value)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-[background,color] hover:bg-slate-50"><Info size={17} className="text-slate-400" /> About Us</button>
            {aboutOpen ? <p data-testid="about-us-content" className="rounded-xl bg-[#F3EFEA] p-4 text-sm leading-6 text-slate-600">LearnLens finds learning gaps from assessment evidence, targets the prerequisite, and measures recovery with a retest.</p> : null}
            <button data-testid="manage-profile-button" onClick={() => setEditing((value) => !value)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-[background,color] hover:bg-slate-50"><Pencil size={17} className="text-slate-400" /> Manage Profile</button>
          </div>
        </div>
        <div className="border-t border-[#E2D9CE] p-5"><Button data-testid="profile-logout-button" variant="outline" className="w-full justify-start text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => void logout()}><LogOut size={17} /> Log Out</Button></div>
      </SheetContent>
    </Sheet>
  </>;
}