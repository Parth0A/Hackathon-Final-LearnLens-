import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  Layers3,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { ApiError, apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

type Mode = "login" | "register";
type AuthPanel = "user" | "admin";
type Role = "student" | "teacher";

function errorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === "object" &&
    "detail" in error.body
  ) {
    return String((error.body as { detail: unknown }).detail);
  }
  return "Unable to connect to LearnLens.";
}

const roleOptions: Array<{
  value: Role;
  label: string;
  description: string;
  icon: typeof GraduationCap;
}> = [
  {
    value: "student",
    label: "Student",
    description: "Learn, recover & track progress",
    icon: GraduationCap,
  },
  {
    value: "teacher",
    label: "Teacher",
    description: "Diagnose class-wide learning gaps",
    icon: Users,
  },
];

export default function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [authPanel, setAuthPanel] = useState<AuthPanel>("user");
  const [adminStep, setAdminStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [className, setClassName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [educationType, setEducationType] = useState<"school" | "college">("college");
  const [demoBranch, setDemoBranch] = useState("Computer Science & Engineering");
  const [academicSelection, setAcademicSelection] = useState("");
  const [teacherDesignation, setTeacherDesignation] = useState("Professor");
  const [teacherInstitute, setTeacherInstitute] = useState("");

  const auth = useMutation({
    mutationFn: () =>
      authPanel === "admin"
        ? adminStep === "request" ? apiPost<{ message: string }>("/auth/admin/request-verification", {}) : apiPost<AuthResponse>("/auth/admin/verify", { code: adminCode })
        : mode === "login"
        ? apiPost<AuthResponse>("/auth/login", { email, password, role })
        : apiPost<AuthResponse>("/auth/register", {
            email,
            password,
            name,
            role,
            class_name: role === "teacher" ? [teacherDesignation, teacherInstitute.trim()].filter(Boolean).join(" · ") || null : className || academicSelection || null,
            teacher_verification_code: role === "teacher" ? verificationCode : null,
          }),
    onSuccess: (data) => { if (authPanel === "admin" && adminStep === "request") { setAdminStep("verify"); auth.reset(); return; } beginSession((data as AuthResponse).user); },
  });

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    auth.reset();
    setShowPassword(false);
  };

  return (
    <main
      data-testid="login-page"
      className="relative min-h-svh overflow-x-hidden bg-[#f7f9fc] text-slate-950 scroll-smooth"
    >
      <div aria-hidden="true" className="login-geometry-layer pointer-events-none absolute inset-0 overflow-hidden">
        <span className="login-geo login-geo-diamond" />
        <span className="login-geo login-geo-square login-geo-square-a" />
        <span className="login-geo login-geo-square login-geo-square-b" />
        <span className="login-geo login-geo-triangle" />
        <span className="login-geo login-geo-ring" />
        <span className="login-geo login-geo-line login-geo-line-a" />
        <span className="login-geo login-geo-line login-geo-line-b" />
        <span className="login-geo login-geo-dot login-geo-dot-a" />
        <span className="login-geo login-geo-dot login-geo-dot-b" />
      </div>

      <div className="mx-auto flex min-h-svh w-full max-w-[1440px] p-0 lg:p-5">
        <div className="grid min-h-svh w-full overflow-hidden bg-white shadow-none lg:min-h-[calc(100svh-2.5rem)] lg:grid-cols-2 lg:rounded-[30px] lg:shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
          {/* Product side */}
          <section className="relative hidden overflow-hidden bg-[#07111f] text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0">
              <div className="absolute -left-28 -top-28 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
              <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-500/10 blur-3xl" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
            </div>

            <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
                    <img src="/LearnLens_logo.svg" alt="LearnLens" className="h-9 w-9 object-contain" />
                  </div>
                  <div>
                    <div className="font-heading text-xl font-bold tracking-tight">LearnLens</div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-300">The Learning Debugger</div>
                  </div>
                </div>

                <div className="mt-24 max-w-xl xl:mt-28">
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Personal learning intelligence</p>
                  <h1 className="font-heading text-5xl font-semibold leading-[1.03] tracking-[-0.045em] xl:text-6xl">
                    One Size Doesn’t Fit All.
                  </h1>
                  <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">
                    Every learner has a different gap, pace, pattern and path. LearnLens finds the difference and turns it into a focused learning cycle.
                  </p>
                </div>
              </div>

              <div className="relative mt-16 max-w-xl border-l border-white/15 pl-5">
                <p className="text-sm font-medium leading-6 text-slate-200">Diagnose the gap.</p>
                <p className="text-sm font-medium leading-6 text-slate-400">Recover what matters.</p>
                <p className="text-sm font-medium leading-6 text-slate-500">Verify the improvement.</p>
              </div>
            </div>
          </section>

          {/* Auth side */}
          <section className="flex min-h-svh items-center justify-center bg-white px-5 py-8 sm:px-10 lg:min-h-0 lg:px-12 xl:px-20">
            <div className="w-full max-w-[470px]">
              <div className="mb-9 flex items-center justify-between lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950">
                    <img src="/LearnLens_logo.svg" alt="LearnLens" className="h-8 w-8 object-contain" />
                  </div>
                  <div>
                    <div className="font-heading text-lg font-bold">LearnLens</div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Learning Debugger
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  {mode === "login" ? "Welcome back" : "Create your workspace"}
                </div>
                <h2
                  data-testid="auth-title"
                  className="font-heading text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-[36px]"
                >
                  {mode === "login" ? "Continue your learning." : "Start with LearnLens."}
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                  {mode === "login"
                    ? "Sign in to continue your personalized learning cycle."
                    : "Create an account to diagnose gaps, plan learning and verify recovery."}
                </p>
              </div>

              <div className="mb-5 flex justify-end">
                <button type="button" data-testid="admin-login-option" onClick={() => { setAuthPanel("admin"); auth.reset(); }} className="text-[11px] font-semibold text-slate-400 hover:text-blue-700">
                  Admin
                </button>
              </div>
              {authPanel === "admin" ? (
                <form data-testid="admin-auth-form" className="space-y-5" onSubmit={(event) => { event.preventDefault(); auth.mutate(); }}>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">Admin verification</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{adminStep === "request" ? "A verification code will be sent to the configured admin email." : "Enter the 6-digit code sent to the admin email."}</p>
                  </div>
                  {adminStep === "verify" ? (
                    <div>
                      <label htmlFor="admin-code" className="mb-2 block text-sm font-semibold text-slate-800">Verification code</label>
                      <input id="admin-code" data-testid="admin-code-input" inputMode="numeric" maxLength={6} autoComplete="one-time-code" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-center text-lg tracking-[0.35em] outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} placeholder="000000" required />
                    </div>
                  ) : null}
                  {auth.isError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage(auth.error)}</p> : null}
                  <button type="submit" disabled={auth.isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b5cff] px-5 text-sm font-semibold text-white disabled:opacity-60">{auth.isPending ? "Please wait…" : adminStep === "request" ? "Send verification code" : "Verify and continue"} <ArrowRight size={16} /></button>
                  <button type="button" className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => { setAuthPanel("user"); auth.reset(); }}>Back to student / teacher login</button>
                </form>
              ) : (
              <>
              <div className="mb-7 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  data-testid="login-mode-button"
                  onClick={() => switchMode("login")}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    mode === "login"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  data-testid="register-mode-button"
                  onClick={() => switchMode("register")}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    mode === "register"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Create account
                </button>
              </div>

              <form
                data-testid="auth-form"
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  auth.mutate();
                }}
              >
                {role === "student" ? (
                  <div className="space-y-3">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Education level</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["school", "college"] as const).map((type) => (
                        <button key={type} type="button" data-testid={`education-type-${type}`} onClick={() => { setEducationType(type); setAcademicSelection(""); }} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition ${
                          educationType === type ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}>
                          {type === "school" ? "School" : "College"}
                        </button>
                      ))}
                    </div>
                    {educationType === "school" ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">School standards · preview capability</div>
                        <div className="grid grid-cols-4 gap-2">
                          {["3rd","4th","5th","6th","7th","8th","9th","10th"].map((grade) => (
                            <button key={grade} type="button" disabled className="cursor-default rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-400">{grade}</button>
                          ))}
                        </div>
                        <p className="mt-2 text-[10px] text-slate-400">Displayed to show supported school standards; account setup does not depend on a selected grade.</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">College course / branch</div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {["MCA","Computer Science & Engineering","Information Technology","Electronics & Telecommunication","Electrical Engineering","Mechanical Engineering","Civil Engineering","Artificial Intelligence & Data Science","Artificial Intelligence & Machine Learning","Chemical Engineering","Biotechnology","Biomedical Engineering","Aerospace Engineering","Automobile Engineering","Instrumentation Engineering"].map((branch) => (
                            <button key={branch} type="button" onClick={() => { setDemoBranch(branch); setAcademicSelection(branch); setClassName(branch); }} className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                              branch === demoBranch ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100 shadow-sm" : "border-slate-200 bg-white text-slate-400"
                            }`}>{branch}</button>
                          ))}
                        </div>
                        <p className="mt-2 text-[10px] text-slate-400">Choose the course or branch that describes your learning path.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                      <div className="text-sm font-semibold text-slate-900">Professional educator access</div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Use your institutional role and institute context. LearnLens keeps the teacher experience focused on classroom learning evidence.</p>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Professional role</label>
                      <div className="grid grid-cols-2 gap-2">
                        {["Professor","Assistant Professor","Lecturer / Teacher","HOD"].map((designation) => (
                          <button key={designation} type="button" onClick={() => setTeacherDesignation(designation)} className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                            teacherDesignation === designation ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          }`}>{designation}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="teacher-institute" className="mb-2 block text-sm font-semibold text-slate-800">Institute</label>
                      <input id="teacher-institute" data-testid="teacher-institute-input" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" value={teacherInstitute} onChange={(event) => setTeacherInstitute(event.target.value)} placeholder="School, college or university" />
                    </div>
                  </div>
                )}

                {mode === "login" ? (
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Continue as
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {roleOptions.map(({ value, label, description, icon: Icon }) => {
                        const selected = role === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            data-testid={`login-role-${value}`}
                            onClick={() => setRole(value)}
                            className={`group rounded-2xl border p-3 text-left transition-all ${
                              selected
                                ? "border-blue-500 bg-blue-50/70 shadow-[0_8px_25px_rgba(37,99,235,0.10)]"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                                selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                              }`}>
                                <Icon size={16} />
                              </div>
                              {selected ? (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                                  <Check size={12} strokeWidth={3} />
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">{label}</div>
                            <div className="mt-0.5 text-[11px] leading-4 text-slate-500">{description}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="register-name" className="mb-2 block text-sm font-semibold text-slate-800">
                        Full name
                      </label>
                      <input
                        id="register-name"
                        data-testid="register-name-input"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Your name"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-800">Account type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {roleOptions.map(({ value, label, icon: Icon }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setRole(value)}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              role === value
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <Icon size={16} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {role === "student" ? (
                      <div>
                        <label htmlFor="register-class" className="mb-2 block text-sm font-semibold text-slate-800">Class / status <span className="font-normal text-slate-400">(optional)</span></label>
                        <input id="register-class" data-testid="register-class-input" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" value={className} onChange={(event) => setClassName(event.target.value)} placeholder="e.g. Undergraduate · CSE-A" />
                      </div>
                    ) : null}

                    {role === "teacher" ? (
                      <div>
                        <label htmlFor="teacher-code" className="mb-2 block text-sm font-semibold text-slate-800">
                          Teacher verification code
                        </label>
                        <input
                          id="teacher-code"
                          data-testid="teacher-verification-input"
                          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                          value={verificationCode}
                          onChange={(event) => setVerificationCode(event.target.value)}
                          placeholder="Enter verification code"
                          required
                        />
                      </div>
                    ) : null}
                  </>
                )}

                <div>
                  <label htmlFor="auth-email" className="mb-2 block text-sm font-semibold text-slate-800">
                    Email address
                  </label>
                  <input
                    id="auth-email"
                    data-testid="auth-email-input"
                    type="email"
                    autoComplete="email"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="auth-password" className="text-sm font-semibold text-slate-800">
                      Password
                    </label>
                    {mode === "login" ? (
                      <span className="text-[11px] text-slate-400">Minimum 8 characters</span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      data-testid="auth-password-input"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 pr-12 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      data-testid="password-visibility-toggle"
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-700"
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {auth.isError ? (
                  <p
                    data-testid="auth-error"
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
                  >
                    {errorMessage(auth.error)}
                  </p>
                ) : null}

                <button
                  data-testid="auth-submit-button"
                  type="submit"
                  disabled={auth.isPending}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b5cff] px-5 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(11,92,255,0.22)] transition hover:bg-[#074fdc] hover:shadow-[0_14px_30px_rgba(11,92,255,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {auth.isPending
                    ? "Please wait…"
                    : mode === "login"
                      ? "Continue to LearnLens"
                      : "Create my LearnLens account"}
                  {!auth.isPending ? (
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  ) : null}
                </button>

                <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-slate-400">
                  <ShieldCheck size={14} />
                  Your learning data is protected by your account role.
                </div>
              </form>
              </>
              )}

              <p className="mt-8 text-center text-sm text-slate-500">
                {mode === "login" ? "New to LearnLens?" : "Already using LearnLens?"}{" "}
                <button
                  data-testid="auth-mode-toggle"
                  type="button"
                  className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                  onClick={() => switchMode(mode === "login" ? "register" : "login")}
                >
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
