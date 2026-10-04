import { useQuery } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import JoinClassroom from "@/pages/JoinClassroom";
import { fetchSession, sessionKey } from "@/lib/session";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  const session = useQuery({ queryKey: sessionKey, queryFn: fetchSession, retry: false });
  if (session.isLoading) return <div data-testid="session-loading" className="flex min-h-svh items-center justify-center bg-[#FAF8F5] font-mono text-xs uppercase tracking-widest text-slate-500">Opening LearnLens…</div>;
  if (!session.data) return <Login />;
  return (
    <Routes>
      <Route path="/" element={<Home user={session.data} />} />
      <Route path="/join/:code" element={<JoinClassroom user={session.data} />} />
    </Routes>
  );
}
