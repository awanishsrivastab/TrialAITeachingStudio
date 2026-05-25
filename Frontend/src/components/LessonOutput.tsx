import { useState, useRef } from "react";
import { Printer, Copy, Share2, Check, RefreshCw, ChevronDown, Lock } from "lucide-react";
import { supabase, N8N_REGEN_URL, authHeaders, stripQuizAnswers, extractQuizAnswerKey, type Lesson } from "@/lib/supabase";
import { LANG_FLAG } from "@/lib/utils";
import { toast } from "./Toast";

export type LessonData = {
  subject: string;
  grade: string;
  topic: string;
  duration: string;
  language: string;
  objectives?: string;
  lesson_plan?: any;
  worksheet?: any;
  quiz?: any;
  rubric?: any;
  quiz_answer_key?: any;
  quiz_rubric?: any;
};

type Props = {
  data: LessonData;
  onUpdate: (patch: Partial<LessonData>) => void;
  savedId?: string | null;
  onSaved?: (id: string) => void;
  readOnly?: boolean;
  hideAnswerKey?: boolean;
  showFirstSaveTip?: boolean;
  studentQuizSlot?: React.ReactNode;
};

const tabs = [
  { id: "lesson_plan", label: "Lesson Plan", emoji: "📋" },
  { id: "worksheet", label: "Worksheet", emoji: "📝" },
  { id: "quiz", label: "Quiz", emoji: "❓" },
  { id: "quiz_rubric", label: "Quiz Rubric", emoji: "✅" },
  { id: "quiz_answer_key", label: "Answer Key", emoji: "🔐" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const Pill = ({ children, color = "var(--primary)" }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: color }}>
    {children}
  </span>
);

function asArray(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x == null) return [];
  return [x];
}

function asString(x: any): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(asString).join("\n");
  if (typeof x === "object") {
    if (typeof x.content === "string") return x.content;
    if (typeof x.text === "string") return x.text;
    return JSON.stringify(x, null, 2);
  }
  return String(x);
}

function parseGeneratedSection(json: any) {
  if (typeof json === "string") {
    try {
      return JSON.parse(json);
    } catch {
      return json;
    }
  }
  if (typeof json?.data === "string") {
    try {
      return JSON.parse(json.data);
    } catch {
      return json.data;
    }
  }
  return json?.data ?? json;
}

function LessonPlanView({ plan }: { plan: any }) {
  if (!plan) return <Empty label="No lesson plan yet" />;
  const sections = [
    { key: "warm_up", title: "Warm-Up", emoji: "🌅", color: "#F59E0B", badge: "5 min" },
    { key: "concepts", fallbackKey: "key_concepts", title: "Key Concepts", emoji: "💡", color: "#3B82F6" },
    { key: "activity", title: "Classroom Activity", emoji: "🔬", color: "#10B981" },
    { key: "recap", title: "Recap & Summary", emoji: "🔁", color: "#8B5CF6" },
    { key: "homework", title: "Homework", emoji: "🏠", color: "#F59E0B", badge: "Take Home" },
  ];
  return (
    <div className="space-y-4">
      {sections.map((s) => {
        const v = plan[s.key] ?? plan[(s as any).fallbackKey] ?? plan[s.title?.toLowerCase().replace(/\W+/g, "_")];
        return (
          <div key={s.key} className="bg-white rounded-lg border border-[color:var(--border)] p-5 relative" style={{ borderLeft: `4px solid ${s.color}` }}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-bold flex items-center gap-2"><span aria-hidden>{s.emoji}</span>{s.title}</h3>
              {s.badge && <Pill color={s.color}>{s.badge}</Pill>}
            </div>
            {Array.isArray(v) ? (
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                {v.map((it, i) => <li key={i}>{asString(it)}</li>)}
              </ol>
            ) : (
              <div className="text-sm whitespace-pre-wrap">{asString(v) || <span className="text-[color:var(--muted)] italic">—</span>}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuestionCard({ q, idx, answer, color }: { q: any; idx: number; answer?: string; color: string }) {
  const [show, setShow] = useState(false);
  const qText = typeof q === "string" ? q : (q.question ?? q.q ?? asString(q));
  const a = answer ?? (typeof q === "object" ? (q.answer ?? q.a) : undefined);
  return (
    <div className="bg-white rounded-lg border border-[color:var(--border)] p-4" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex items-start gap-3">
        <span className="mono text-xs font-bold text-[color:var(--primary)] mt-0.5">Q{idx + 1}</span>
        <div className="flex-1 text-sm">{qText}</div>
      </div>
      {a && (
        <>
          <button onClick={() => setShow(!show)} className="text-xs mt-2 text-[color:var(--primary)] font-semibold inline-flex items-center gap-1">
            <ChevronDown size={14} className={`transition ${show ? "rotate-180" : ""}`} /> {show ? "Hide" : "Show"} Answer
          </button>
          {show && (
            <div className="mt-2 pt-2 border-t border-dashed border-[color:var(--border)] text-sm text-[color:var(--success)] whitespace-pre-wrap">
              {asString(a)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WorksheetView({ ws }: { ws: any }) {
  if (!ws) return <Empty label="No worksheet yet" />;
  const levels: { key: string; label: string; color: string; pillColor: string; emoji: string }[] = [
    { key: "easy", label: "Easy", color: "#10B981", pillColor: "#10B981", emoji: "🟢" },
    { key: "medium", label: "Medium", color: "#F59E0B", pillColor: "#F59E0B", emoji: "🟡" },
    { key: "hard", label: "Hard", color: "#EF4444", pillColor: "#EF4444", emoji: "🔴" },
  ];
  return (
    <div className="space-y-6">
      {levels.map((l) => {
        const qs = asArray(ws[l.key]);
        return (
          <details open key={l.key} className="bg-gray-50 rounded-lg p-4">
            <summary className="cursor-pointer flex items-center gap-2 font-bold">
              <span aria-hidden>{l.emoji}</span> <Pill color={l.pillColor}>{l.label}</Pill>
              <span className="text-xs text-[color:var(--muted)] font-normal">({qs.length} questions)</span>
            </summary>
            <div className="mt-3 space-y-2">
              {qs.length === 0 ? <p className="text-sm text-[color:var(--muted)]">No questions</p>
                : qs.map((q, i) => <QuestionCard key={i} q={q} idx={i} color={l.color} />)}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function QuizView({ quiz, showAnswers, hideAll }: { quiz: any; showAnswers: boolean; hideAll?: boolean }) {
  if (!quiz) return <Empty label="No quiz yet" />;
  const mcq = asArray(quiz.mcq ?? quiz.multiple_choice);
  const sa = asArray(quiz.short_answer ?? quiz.short);
  return (
    <div className="space-y-6">
      {showAnswers && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm">
          <Lock size={16} /> <strong>Answer Key — For Teacher Use Only</strong>
        </div>
      )}
      <section>
        <h3 className="font-semibold mb-3">Part A: Multiple Choice Questions</h3>
        <div className="space-y-3">
          {mcq.map((q: any, i: number) => {
            const opts = q.options ?? q.choices ?? [];
            const correct = q.answer ?? q.correct;
            return (
              <div key={i} className="bg-white border border-[color:var(--border)] rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-7 h-7 rounded-full bg-[color:var(--primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <p className="font-medium text-sm">{q.question ?? asString(q)}</p>
                </div>
                <div className="grid gap-2 pl-10">
                  {(Array.isArray(opts) ? opts : Object.entries(opts).map(([k, v]) => `${k}. ${v}`)).map((opt: any, j: number) => {
                    const letter = String.fromCharCode(65 + j);
                    const optText = typeof opt === "string" ? opt.replace(/^[A-D]\.\s*/, "") : asString(opt);
                    const isCorrect = showAnswers && (correct === letter || correct === optText || String(correct).startsWith(letter));
                    return (
                      <div key={j} className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition ${
                        isCorrect ? "bg-[color:var(--success)] text-white border-transparent" : "border-[color:var(--border)] hover:bg-indigo-50"
                      }`}>
                        <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${isCorrect ? "bg-white/30" : "bg-gray-100"}`}>{letter}</span>
                        <span className="flex-1">{optText}</span>
                        {isCorrect && <Check size={16} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h3 className="font-semibold mb-3">Part B: Short Answer Questions</h3>
        <div className="space-y-3">
          {sa.map((q: any, i: number) => (
            <div key={i} className="bg-white border border-[color:var(--border)] rounded-lg p-4 relative">
              <Pill color="#F59E0B">2 pts</Pill>
              <p className="font-medium text-sm mt-2 mb-3">{q.question ?? asString(q)}</p>
              {showAnswers ? (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm whitespace-pre-wrap">{asString(q.answer ?? q)}</div>
              ) : !hideAll ? (
                <textarea className="w-full border border-[color:var(--border)] rounded p-2 text-sm" rows={4} placeholder="Write your answer here..." />
              ) : (
                <div className="border border-dashed border-[color:var(--border)] rounded h-20" />
              )}
            </div>
          ))}
        </div>
      </section>
      <div className="text-center text-sm text-[color:var(--muted)] mono pt-2 border-t">
        Total: {mcq.length} MCQ + {sa.length * 2} Short Answer = {mcq.length + sa.length * 2} marks
      </div>
    </div>
  );
}

function AnswerKeyView({ answerKey, quiz }: { answerKey: any; quiz: any }) {
  const key = answerKey ?? extractQuizAnswerKey(quiz);
  const mcq = asArray(key?.mcq);
  const short = asArray(key?.short_answer);
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm">
        <Lock size={16} /> <strong>Answer Key - For Teacher Use Only</strong>
      </div>
      <section className="bg-white border border-[color:var(--border)] rounded-lg p-5">
        <h3 className="font-bold mb-3">MCQ Answers</h3>
        <ol className="list-decimal pl-5 text-sm space-y-2">
          {mcq.map((q: any, i) => <li key={i}><strong>{q.correct}</strong>{q.question ? ` - ${q.question}` : ""}</li>)}
        </ol>
      </section>
      <section className="bg-white border border-[color:var(--border)] rounded-lg p-5">
        <h3 className="font-bold mb-3">Short Answer Key</h3>
        <ol className="list-decimal pl-5 text-sm space-y-3">
          {short.map((q: any, i) => <li key={i}><div className="font-semibold">{q.question}</div><div className="text-[color:var(--success)] whitespace-pre-wrap">{asString(q.answer)}</div></li>)}
        </ol>
      </section>
    </div>
  );
}

export function RubricOnlyView({ rubric }: { rubric: any }) {
  if (!rubric) return <Empty label="No quiz rubric yet" />;
  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-5">
      <h3 className="font-bold flex items-center gap-2 mb-3"><Lock size={16} /> Quiz Grading Rubric</h3>
      {Array.isArray(rubric) ? (
        <ul className="list-disc pl-5 text-sm space-y-1">{rubric.map((r, i) => <li key={i}>{asString(r)}</li>)}</ul>
      ) : typeof rubric === "object" ? (
        <ul className="text-sm space-y-1">
          {Object.entries(rubric).map(([k, v]) => <li key={k}><strong>{k}:</strong> {asString(v)}</li>)}
        </ul>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{asString(rubric)}</p>
      )}
    </div>
  );
}

const Empty = ({ label }: { label: string }) => (
  <div className="text-center py-12 text-[color:var(--muted)]">
    <div className="text-4xl mb-2">📭</div>{label}
  </div>
);

export function LessonOutput({ data, onUpdate, savedId, onSaved, readOnly, hideAnswerKey, showFirstSaveTip, studentQuizSlot }: Props) {
  const [tab, setTab] = useState<TabId>("lesson_plan");
  const [regen, setRegen] = useState<TabId | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!savedId);
  const [tip, setTip] = useState(!!showFirstSaveTip);
  const ref = useRef<HTMLDivElement>(null);

  const availableTabs = hideAnswerKey ? tabs.filter((t) => t.id !== "quiz_answer_key") : tabs;
  const rubric = data.quiz_rubric ?? data.rubric;

  const handleRegen = async (section: TabId) => {
    setRegen(section);
    try {
      const res = await fetch(N8N_REGEN_URL, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ section: section === "quiz_rubric" ? "rubric" : section, subject: data.subject, grade: data.grade, topic: data.topic, language: data.language }),
      });
      if (!res.ok) throw new Error("Regenerate failed");
      const json = await res.json();
      const parsed = parseGeneratedSection(json);
      const sectionData = parsed[section] ?? parsed.rubric ?? parsed.quiz_rubric ?? parsed;
      const patch: any = {};
      if (section === "quiz") {
        patch.quiz = stripQuizAnswers(sectionData.quiz ?? sectionData);
        patch.quiz_answer_key = extractQuizAnswerKey(sectionData.quiz ?? sectionData);
      } else if (section === "quiz_rubric") {
        patch.quiz_rubric = sectionData.quiz_rubric ?? sectionData.rubric ?? sectionData;
        patch.rubric = patch.quiz_rubric;
      } else {
        patch[section] = sectionData;
      }
      onUpdate(patch);
      toast({ type: "success", message: "Section regenerated successfully" });
      ref.current?.classList.add("flash-highlight");
      setTimeout(() => ref.current?.classList.remove("flash-highlight"), 1000);
    } catch (e: any) {
      toast({ type: "error", message: e.message ?? "Regeneration failed" });
    } finally {
      setRegen(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { toast({ type: "error", message: "Not signed in" }); setSaving(false); return; }
    const { data: row, error } = await supabase.from("lessons").insert({
      subject: data.subject, grade: data.grade, topic: data.topic, duration: data.duration,
      objectives: data.objectives ?? "", language: data.language,
      teacher_id: s.session.user.id,
      user_id: s.session.user.id,
      lesson_plan: data.lesson_plan,
      worksheet: data.worksheet,
      quiz: stripQuizAnswers(data.quiz),
      quiz_rubric: rubric,
      rubric,
    }).select("id").single();
    setSaving(false);
    if (error) { toast({ type: "error", message: error.message }); return; }
    const answerKey = data.quiz_answer_key ?? extractQuizAnswerKey(data.quiz);
    if (answerKey) {
      const { error: keyError } = await supabase.from("lesson_answer_keys").upsert({
        lesson_id: row.id,
        teacher_id: s.session.user.id,
        quiz_answer_key: answerKey,
      });
      if (keyError) { toast({ type: "error", message: keyError.message }); return; }
    }
    setSaved(true);
    onSaved?.(row.id);
    toast({ type: "success", message: "Lesson saved to your library!" });
  };

  const handleShare = async () => {
    if (!savedId) { toast({ type: "warning", message: "Save the lesson first to share it." }); return; }
    const { error } = await supabase.from("lessons").update({ is_published: true }).eq("id", savedId);
    if (error) { toast({ type: "error", message: error.message }); return; }
    const url = `${window.location.origin}/shared/${savedId}`;
    await navigator.clipboard.writeText(url);
    toast({ type: "info", message: "Share link copied! 🔗" });
  };

  const handleCopy = async () => {
    const text = JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(text);
    toast({ type: "info", message: "Lesson copied to clipboard" });
  };

  return (
    <div ref={ref} className="animate-fade-up">
      <div className="bg-white border border-[color:var(--border)] rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-center justify-between no-print">
        <div className="flex flex-wrap gap-2">
          <Pill>{data.subject}</Pill>
          <Pill color="#8B5CF6">{data.grade}</Pill>
          <Pill color="#6B7280">{data.topic}</Pill>
          <Pill color="#F59E0B">{data.duration}</Pill>
          <Pill color="#06B6D4">{LANG_FLAG[data.language] ?? "🌐"} {data.language}</Pill>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-[color:var(--primary)] text-[color:var(--primary)] rounded-md hover:bg-indigo-50"><Printer size={14} /> Export PDF</button>
            <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-[color:var(--border)] rounded-md hover:bg-gray-50"><Copy size={14} /> Copy All</button>
            <button onClick={handleShare} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-[color:var(--border)] rounded-md hover:bg-gray-50"><Share2 size={14} /> Share</button>
            <div className="relative">
              <button
                onClick={handleSave}
                disabled={saved || saving}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md text-white transition ${saved ? "bg-[color:var(--success)]" : "bg-[color:var(--primary)] hover:bg-[color:var(--primary-dark)]"} disabled:opacity-70`}
              >
                <Check size={14} /> {saved ? "Saved!" : saving ? "Saving..." : "Save to Library"}
              </button>
              {tip && !saved && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[color:var(--ink)] text-white text-xs p-3 rounded-lg shadow-lg z-10">
                  💡 Pro tip: Save this lesson to your library to access it anytime.
                  <button onClick={() => { setTip(false); localStorage.setItem("ats_tip_shown", "1"); }} className="absolute top-1 right-2">×</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-[color:var(--border)] rounded-lg p-4 flex flex-wrap gap-2 mb-4 no-print">
        {availableTabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${tab === t.id ? "bg-[color:var(--primary)] text-white shadow-sm" : "bg-gray-100 text-[color:var(--ink)] hover:bg-gray-200"}`}>
            <span aria-hidden className="mr-1">{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="bg-transparent">
        <div className="flex justify-end mb-2 no-print">
          {!readOnly && tab !== "quiz_answer_key" && (
            <button onClick={() => handleRegen(tab)} disabled={!!regen} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[color:var(--border)] rounded-md hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw size={12} className={regen === tab ? "animate-spin" : ""} /> Regenerate this section
            </button>
          )}
        </div>

        <>
          {tab === "lesson_plan" && <LessonPlanView plan={data.lesson_plan} />}
          {tab === "worksheet" && <WorksheetView ws={data.worksheet} />}
          {tab === "quiz" && (studentQuizSlot ?? <QuizView quiz={data.quiz} showAnswers={false} hideAll={readOnly} />)}
          {tab === "quiz_rubric" && <RubricOnlyView rubric={rubric} />}
          {tab === "quiz_answer_key" && !hideAnswerKey && <AnswerKeyView answerKey={data.quiz_answer_key} quiz={data.quiz} />}
        </>
      </div>
    </div>
  );
}

export type { Lesson };
