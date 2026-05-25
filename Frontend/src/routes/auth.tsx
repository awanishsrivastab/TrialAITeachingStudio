import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/Toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign In · AI Teaching Studio" }] }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [grade, setGrade] = useState("Grade 5");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifySent, setVerifySent] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && session) router.navigate({ to: "/generate", replace: true });
  }, [session, authLoading, router]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "Invalid email";
    if (password.length < 6) e.password = "Min 6 characters";
    if (mode === "signup") {
      if (!name.trim()) e.name = "Required";
      if (role === "student" && !grade.trim()) e.grade = "Required";
      if (password !== confirm) e.confirm = "Passwords don't match";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.navigate({ to: "/generate" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: name, role, grade: role === "student" ? grade : null },
            emailRedirectTo: window.location.origin + "/generate",
          },
        });
        if (error) throw error;
        setVerifySent(email);
      }
    } catch (err: any) {
      toast({ type: "error", message: err.message ?? "Authentication failed" });
    } finally { setLoading(false); }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/generate" },
    });
    if (error) toast({ type: "error", message: error.message });
  };

  const inputCls = (k: string) =>
    `w-full px-4 py-2.5 border rounded-lg text-sm transition focus:border-[color:var(--primary)] focus:outline-none ${
      errors[k] ? "border-[color:var(--danger)]" : "border-[color:var(--border)]"
    }`;

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-[45%] relative overflow-hidden text-white p-12 flex-col justify-center gradient-hero">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[
            { top: "10%", left: "60%", rot: "-8deg", text: "📋 Photosynthesis", delay: "0s" },
            { top: "45%", left: "10%", rot: "5deg", text: "📝 5 worksheet Qs", delay: "1.2s" },
            { top: "70%", left: "55%", rot: "-3deg", text: "❓ MCQ ready", delay: "2.4s" },
          ].map((c, i) => (
            <div key={i} className="absolute bg-white/15 backdrop-blur rounded-lg px-4 py-3 text-sm text-white animate-float"
              style={{ top: c.top, left: c.left, ["--rot" as any]: c.rot, transform: `rotate(${c.rot})`, animationDelay: c.delay }}>
              {c.text}
            </div>
          ))}
        </div>
        <div className="relative z-10 max-w-md">
          <div className="text-7xl mb-6" aria-hidden>🎓</div>
          <h1 className="text-4xl font-extrabold leading-tight">The lesson kit that writes itself.</h1>
          <p className="mt-4 text-lg text-white/90">Generate lesson plans, worksheets, quizzes & answer keys in 30 seconds.</p>
          <ul className="mt-8 space-y-3 text-white/95">
            <li className="flex gap-2"><span>✓</span> AI-powered, curriculum-aligned content</li>
            <li className="flex gap-2"><span>✓</span> 6 languages including Hindi & regional scripts</li>
            <li className="flex gap-2"><span>✓</span> Save, share, and regenerate any section</li>
          </ul>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          <div className="mono text-xs uppercase tracking-wider text-[color:var(--primary)] mb-6">AI Teaching Studio</div>

          {verifySent ? (
            <div className="card-base p-6">
              <div className="text-4xl mb-3">📧</div>
              <h2 className="text-xl font-bold mb-2">Check your email!</h2>
              <p className="text-sm text-[color:var(--muted)]">We sent a confirmation link to <strong>{verifySent}</strong>. Click it to activate your account.</p>
              <button onClick={() => { setVerifySent(null); setMode("signin"); }} className="mt-4 text-sm text-[color:var(--primary)] font-semibold">← Back to sign in</button>
            </div>
          ) : (
            <>
              <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
                {(["signin", "signup"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${mode === m ? "bg-white shadow text-[color:var(--ink)]" : "text-[color:var(--muted)]"}`}>
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <>
                    <div>
                      <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Full Name</label>
                      <input id="name" className={inputCls("name")} value={name} onChange={(e) => setName(e.target.value)} />
                      {errors.name && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.name}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Account Type</label>
                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        {(["teacher", "student"] as const).map((r) => (
                          <button
                            type="button"
                            key={r}
                            onClick={() => setRole(r)}
                            className={`py-2 rounded-lg border text-sm font-semibold capitalize ${
                              role === r ? "border-[color:var(--primary)] bg-indigo-50 text-[color:var(--primary)]" : "border-[color:var(--border)]"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    {role === "student" && (
                      <div>
                        <label htmlFor="grade" className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Student Grade</label>
                        <select id="grade" className={inputCls("grade")} value={grade} onChange={(e) => setGrade(e.target.value)}>
                          {["Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12","College / University"].map((g) => <option key={g}>{g}</option>)}
                        </select>
                        {errors.grade && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.grade}</p>}
                      </div>
                    )}
                  </>
                )}
                <div>
                  <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Email</label>
                  <input id="email" type="email" className={inputCls("email")} value={email} onChange={(e) => setEmail(e.target.value)} />
                  {errors.email && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="pw" className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Password</label>
                  <div className="relative">
                    <input id="pw" type={showPw ? "text" : "password"} className={inputCls("password")} value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPw(!showPw)} aria-label="Toggle password" className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.password}</p>}
                </div>
                {mode === "signup" && (
                  <div>
                    <label htmlFor="confirm" className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Confirm Password</label>
                    <input id="confirm" type="password" className={inputCls("confirm")} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                    {errors.confirm && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.confirm}</p>}
                  </div>
                )}
                {mode === "signin" && (
                  <div className="text-right">
                    <button type="button" className="text-xs text-[color:var(--primary)] font-semibold">Forgot password?</button>
                  </div>
                )}
                <button type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-[color:var(--primary)] hover:bg-[color:var(--primary-dark)] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition">
                  {loading && <Loader2 className="animate-spin" size={16} />}
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-[color:var(--muted)]">
                <div className="flex-1 h-px bg-[color:var(--border)]" /> or continue with <div className="flex-1 h-px bg-[color:var(--border)]" />
              </div>
              <button onClick={google} className="w-full border border-[color:var(--border)] py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 text-sm font-medium">
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5 17.7 35.5 12.5 30.3 12.5 24S17.7 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.9l5.7-5.7C33.6 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.9l5.7-5.7C33.6 6.4 29.1 4.5 24 4.5c-7.2 0-13.4 4.1-16.7 10.2z"/><path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13-5l-6-5.1c-1.9 1.4-4.4 2.1-7 2.1-5.1 0-9.5-3.1-11.3-7.4l-6.5 5C9 39.3 16 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.3 5.4l6 5.1c-.4.4 6.5-4.7 6.5-14.5 0-1.2-.1-2.4-.4-3.5z"/></svg>
                Continue with Google
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
