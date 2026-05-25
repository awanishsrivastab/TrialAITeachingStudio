import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { N8N_GENERATE_URL, authHeaders, supabase, stripQuizAnswers, extractQuizAnswerKey } from "@/lib/supabase";
import { LessonOutput, type LessonData } from "@/components/LessonOutput";
import { toast } from "@/components/Toast";
import { Rocket } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/generate")({
  head: () => ({ meta: [{ title: "Generate · AI Teaching Studio" }] }),
  component: GeneratePage,
});

const GRADES = ["Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12","College / University"];
const DURATIONS = [
  { v: "30 minutes", d: "Short session" },
  { v: "45 minutes", d: "Standard class" },
  { v: "60 minutes", d: "Extended class" },
  { v: "90 minutes", d: "Double period" },
];
const LANGS = ["🇬🇧 English","🇮🇳 Hindi (हिंदी)","🇮🇳 Tamil (தமிழ்)","🇮🇳 Telugu (తెలుగు)","🇮🇳 Kannada (ಕನ್ನಡ)","🇮🇳 Marathi (मराठी)"];
const LOAD_MSG = ["📋 Writing your lesson plan...","📝 Creating the worksheet...","❓ Building the quiz...","✅ Compiling the answer key...","💾 Almost ready..."];
const TYPING = ["Photosynthesis...","The French Revolution...","Quadratic Equations...","Supply and Demand..."];

function parseGeneratedLesson(json: any) {
  if (typeof json === "string") {
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  }
  if (typeof json?.data === "string") {
    try {
      return JSON.parse(json.data);
    } catch {
      return {};
    }
  }
  return json?.data ?? json;
}

function GeneratePage() {
  const { profile } = useAuth();
  const [form, setForm] = useState({ subject: "", grade: "Grade 5", topic: "", duration: "45 minutes", objectives: "", language: "🇬🇧 English" });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [typingIdx, setTypingIdx] = useState(0);
  const [output, setOutput] = useState<LessonData | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setTypingIdx((x) => (x + 1) % TYPING.length), 3000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    if (!loading) return;
    const i = setInterval(() => setMsgIdx((x) => (x + 1) % LOAD_MSG.length), 2000);
    return () => clearInterval(i);
  }, [loading]);

  const setField = (k: string, v: string) => { setForm({ ...form, [k]: v }); if (errors[k]) setErrors({ ...errors, [k]: false }); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, boolean> = {};
    (["subject","grade","topic","duration","objectives","language"] as const).forEach((k) => { if (!form[k].trim()) err[k] = true; });
    setErrors(err);
    if (Object.keys(err).length) return;
    setLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const lang = form.language.replace(/^[^\s]+\s/, "").replace(/\s*\(.+\)$/, "");
      const res = await fetch(N8N_GENERATE_URL, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          subject: form.subject, grade: form.grade, topic: form.topic, duration: form.duration,
          objectives: form.objectives, language: lang, userId: s.session?.user.id,
        }),
      });
      if (!res.ok) throw new Error(`Generation failed (${res.status})`);
      const json = await res.json();
      const payload = parseGeneratedLesson(json);
      const quiz = payload.quiz;
      setOutput({
        subject: form.subject, grade: form.grade, topic: form.topic, duration: form.duration, language: lang,
        objectives: form.objectives,
        lesson_plan: payload.lesson_plan ?? payload.lessonPlan,
        worksheet: payload.worksheet,
        quiz: stripQuizAnswers(quiz),
        quiz_answer_key: payload.quiz_answer_key ?? payload.answer_key ?? payload.answerKey ?? extractQuizAnswerKey(quiz),
        quiz_rubric: payload.quiz_rubric ?? payload.rubric,
        rubric: payload.quiz_rubric ?? payload.rubric,
      });
      setSavedId(null);
      if (!localStorage.getItem("ats_tip_shown")) setShowTip(true);
      setTimeout(() => document.getElementById("output-anchor")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err: any) {
      toast({ type: "error", message: err.message ?? "Generation failed", action: { label: "Retry", onClick: () => submit(e) } });
    } finally { setLoading(false); }
  };

  const inputCls = (k: string) => `w-full px-3 py-2.5 border rounded-lg text-sm transition focus:border-[color:var(--primary)] focus:outline-none ${errors[k] ? "border-[color:var(--danger)]" : "border-[color:var(--border)]"}`;

  if (profile?.role === "student") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Student accounts can view lessons and take quizzes.</h1>
        <p className="text-[color:var(--muted)] mt-2">Open Lessons from the navigation to see published topics for your grade.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="gradient-hero text-white pt-12 pb-32 px-4 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold">What will you teach today?</h1>
        <p className="mt-3 text-white/90 max-w-xl mx-auto">Fill in the details below and get a complete lesson kit in seconds.</p>
        <p className="mt-2 mono text-sm text-white/80">
          Try: <span key={typingIdx} className="animate-fade-up inline-block">{TYPING[typingIdx]}</span>
        </p>
      </section>

      {/* Form card */}
      <div className="max-w-3xl mx-auto px-4 -mt-20 relative">
        <div className="card-base p-6 md:p-8 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/85 backdrop-blur-sm z-10 rounded-lg flex flex-col items-center justify-center p-6">
              <div className="w-12 h-12 border-4 border-[color:var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
              <div className="text-sm font-medium" key={msgIdx}>{LOAD_MSG[msgIdx]}</div>
              <div className="w-full max-w-xs mt-6 h-1.5 bg-gray-200 rounded overflow-hidden">
                <div className="h-full bg-[color:var(--primary)] transition-all" style={{ width: "90%", transitionDuration: "15s" }} />
              </div>
            </div>
          )}
          <div className="mono text-xs uppercase tracking-wider text-[color:var(--primary)] mb-4">Lesson Details</div>
          <form onSubmit={submit} className="grid md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="subject" className="text-sm font-semibold flex items-center gap-1.5">📚 Subject</label>
              <input id="subject" className={inputCls("subject") + " mt-1.5"} placeholder="e.g. Mathematics, Biology, History" value={form.subject} onChange={(e) => setField("subject", e.target.value)} />
              <p className="text-xs text-[color:var(--muted)] mt-1">What subject area does this lesson fall under?</p>
            </div>
            <div>
              <label htmlFor="grade" className="text-sm font-semibold flex items-center gap-1.5">🎓 Grade Level</label>
              <select id="grade" className={inputCls("grade") + " mt-1.5"} value={form.grade} onChange={(e) => setField("grade", e.target.value)}>
                {GRADES.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="topic" className="text-sm font-semibold flex items-center gap-1.5">🔍 Topic</label>
              <input id="topic" className={inputCls("topic") + " mt-1.5"} placeholder="e.g. Fractions, Photosynthesis, World War II" value={form.topic} onChange={(e) => setField("topic", e.target.value)} />
              <p className="text-xs text-[color:var(--muted)] mt-1">Be specific — the more precise, the better the output</p>
            </div>
            <div>
              <label htmlFor="duration" className="text-sm font-semibold flex items-center gap-1.5">⏱️ Duration</label>
              <select id="duration" className={inputCls("duration") + " mt-1.5"} value={form.duration} onChange={(e) => setField("duration", e.target.value)}>
                {DURATIONS.map((d) => <option key={d.v} value={d.v}>{d.v} ({d.d})</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="obj" className="text-sm font-semibold flex items-center gap-1.5">🎯 Learning Objectives</label>
              <textarea id="obj" rows={4} maxLength={500} className={inputCls("objectives") + " mt-1.5 resize-y"}
                placeholder={`e.g. Students will be able to:\n• Identify the main stages of photosynthesis\n• Explain the role of chlorophyll in energy conversion`}
                value={form.objectives} onChange={(e) => setField("objectives", e.target.value)} />
              <div className="text-xs text-[color:var(--muted)] text-right mt-1 mono">{form.objectives.length} / 500</div>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="lang" className="text-sm font-semibold flex items-center gap-1.5">🌐 Language</label>
              <select id="lang" className={inputCls("language") + " mt-1.5"} value={form.language} onChange={(e) => setField("language", e.target.value)}>
                {LANGS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <button type="submit" disabled={loading} className="md:col-span-2 h-14 rounded-lg text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}>
              <Rocket size={18} /> Generate Lesson Kit
            </button>
          </form>
        </div>
      </div>

      {/* Output */}
      <div id="output-anchor" className="max-w-5xl mx-auto px-4 my-12">
        {output && (
          <LessonOutput
            data={output}
            onUpdate={(p) => setOutput({ ...output, ...p })}
            savedId={savedId}
            onSaved={setSavedId}
            showFirstSaveTip={showTip}
          />
        )}
      </div>
    </div>
  );
}
