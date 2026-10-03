import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Info, LogOut, Moon, Pencil, Sun, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiPatch, apiUpload } from "@/lib/api";
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
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
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

  const uploadAvatar = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPG, PNG, or WebP image.");
      return;
    }
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const updated = await apiUpload<User>("/auth/profile/avatar", formData);
      setAvatarUrl(updated.avatar_url ?? null);
      queryClient.setQueryData(sessionKey, updated);
      toast.success("Profile photo updated");
    } catch {
      toast.error("Profile photo could not be uploaded.");
    } finally {
      setAvatarUploading(false);
    }
  };

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
          <div className="relative w-fit">
            {avatarUrl ? <img data-testid="profile-picture" src={avatarUrl} alt={`${user.name} profile`} className="size-20 rounded-3xl object-cover shadow-sm" /> : <div data-testid="profile-picture" className="flex size-20 items-center justify-center rounded-3xl bg-blue-600 font-heading text-2xl font-bold text-white shadow-sm">{initials}</div>}
            <label data-testid="profile-photo-upload-label" htmlFor="profile-photo-upload" className="absolute -bottom-2 -right-2 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-md transition hover:bg-blue-600">
              <Camera size={14} />
              <span className="sr-only">Add profile photo</span>
            </label>
            <input id="profile-photo-upload" data-testid="profile-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={avatarUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.currentTarget.value = ""; }} />
          </div>
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
            <div data-testid="theme-section" className="mb-2 rounded-2xl border border-[#E2D9CE] bg-[#FAF8F5] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Appearance</p>
                  <p className="mt-1 text-xs text-slate-500">Change the learning workspace only.</p>
                </div>
                <button type="button" data-testid="theme-toggle" aria-label={theme === "light" ? "Switch to night mode" : "Switch to day mode"} aria-pressed={theme === "dark"} onClick={() => setTheme(theme === "light" ? "dark" : "light")} className={`relative h-12 w-[118px] shrink-0 overflow-hidden rounded-full border shadow-inner transition ${theme === "dark" ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-slate-100"}`}>
                  <span className={`absolute inset-y-1 flex size-10 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${theme === "dark" ? "translate-x-[70px]" : "translate-x-1"}`}>
                    {theme === "dark" ? <Moon size={18} className="text-blue-700" /> : <Sun size={18} className="text-amber-500" />}
                  </span>
                  <span className="absolute inset-y-0 left-3 flex items-center text-[10px] font-semibold text-slate-500">Day</span>
                  <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-semibold text-blue-700">Night</span>
                </button>
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