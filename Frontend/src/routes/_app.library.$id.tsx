import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase, stripQuizAnswers, type Lesson, type QuizSubmission } from "@/lib/supabase";
import { LessonOutput, RubricOnlyView } from "@/components/LessonOutput";
import { toast } from "@/components/Toast";
import { ArrowLeft, Trash2, Save, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/library/$id")({
  head: () => ({ meta: [{ title: "Lesson - AI Teaching Studio" }] }),
  component: LessonDetail,
});

const lessonDetailColumns = "id,user_id,teacher_id,subject,grade,topic,duration,objectives,language,lesson_plan,worksheet,quiz,rubric,quiz_rubric,is_public,is_published,created_at,updated_at";

function asArray(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x == null) return [];
  return [x];
}

function asString(x: any): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object") return JSON.stringify(x, null, 2);
  return String(x);
}

function LessonDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { profile } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [submission, setSubmission] = useState<QuizSubmission | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [answerKey, setAnswerKey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [meta, setMeta] = useState({ subject: "", grade: "", topic: "", duration: "", objectives: "", language: "" });

  useEffect(() => { load(); }, [id, profile?.id]);

  const load = async () => {
    if (!profile) return;
    const query = profile.role === "student"
      ? supabase.from("lessons").select(lessonDetailColumns).eq("id", id).eq("is_published", true).eq("grade", profile.grade).single()
      : supabase.from("lessons").select(lessonDetailColumns).eq("id", id).or(`teacher_id.eq.${profile.id},user_id.eq.${profile.id}`).single();
    const { data, error } = await query;
    if (error) toast({ type: "error", message: "Could not load lesson" });
    const row = data as Lesson | null;
    setLesson(row);
    if (row) setMeta({
      subject: row.subject,
      grade: row.grade,
      topic: row.topic,
      duration: row.duration,
      objectives: row.objectives ?? "",
      language: row.language,
    });
    if (row && profile.role === "student") await loadStudentSubmission(row.id);
    if (row && profile.role === "teacher") {
      await loadTeacherAnswerKey(row.id);
      await loadTeacherSubmissions(row.id);
    }
    setLoading(false);
  };

  const loadTeacherAnswerKey = async (lessonId: string) => {
    const { data } = await supabase.from("lesson_answer_keys").select("quiz_answer_key").eq("lesson_id", lessonId).maybeSingle();
    setAnswerKey(data?.quiz_answer_key ?? null);
  };

  const loadStudentSubmission = async (lessonId: string) => {
    const { data } = await supabase.from("quiz_submissions").select("*").eq("lesson_id", lessonId).eq("student_id", profile?.id).maybeSingle();
    setSubmission((data as QuizSubmission | null) ?? null);
  };

  const loadTeacherSubmissions = async (lessonId: string) => {
    const { data, error } = await supabase
      .from("quiz_submissions")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("submitted_at", { ascending: false });
    if (error) {
      toast({ type: "error", message: "Could not load quiz submissions" });
      setSubmissions([]);
      return;
    }
    const studentIds = Array.from(new Set((data ?? []).map((s: any) => s.student_id)));
    const { data: profiles } = studentIds.length
      ? await supabase.from("profiles").select("id,full_name,email,grade").in("id", studentIds)
      : { data: [] as any[] };
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setSubmissions((data ?? []).map((s: any) => ({ ...s, student_profile: byId.get(s.student_id) })));
  };

  const del = async () => {
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) return toast({ type: "error", message: error.message });
    toast({ type: "success", message: "Lesson deleted" });
    nav({ to: "/library" });
  };

  const saveMeta = async () => {
    if (!lesson) return;
    const { error } = await supabase.from("lessons").update(meta).eq("id", lesson.id);
    if (error) return toast({ type: "error", message: error.message });
    setLesson({ ...lesson, ...meta });
    toast({ type: "success", message: "Lesson details saved" });
  };

  const togglePublish = async () => {
    if (!lesson) return;
    const is_published = !lesson.is_published;
    const { error } = await supabase.from("lessons").update({ is_published }).eq("id", lesson.id);
    if (error) return toast({ type: "error", message: error.message });
    setLesson({ ...lesson, is_published });
    toast({ type: "success", message: is_published ? "Lesson published to students" : "Lesson unpublished" });
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-10 h-10 border-4 border-[color:var(--primary)] border-t-transparent rounded-full animate-spin" /></div>;
  if (!lesson) return (
    <div className="text-center py-20"><h2 className="text-xl font-bold">Lesson not found</h2><Link to="/library" className="text-[color:var(--primary)] mt-3 inline-block">Back to Lessons</Link></div>
  );

  const isTeacher = profile?.role === "teacher";
  const rubric = lesson.quiz_rubric ?? lesson.rubric;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to="/library" className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--ink)]"><ArrowLeft size={14} /> Back to Lessons</Link>
        {isTeacher && (
          <div className="flex gap-2">
            <button onClick={togglePublish} className={`inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md text-white ${lesson.is_published ? "bg-amber-600" : "bg-[color:var(--success)]"}`}>
              {lesson.is_published ? "Unpublish" : "Publish"}
            </button>
            <button onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-1 text-sm text-[color:var(--danger)] border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50"><Trash2 size={14} /> Delete</button>
          </div>
        )}
      </div>

      {isTeacher && (
        <div className="card-base p-5 mb-6 grid md:grid-cols-2 gap-4">
          {(["subject", "grade", "topic", "duration", "language"] as const).map((k) => (
            <label key={k} className="text-sm font-semibold capitalize">
              {k.replace("_", " ")}
              <input value={meta[k]} onChange={(e) => setMeta({ ...meta, [k]: e.target.value })} className="mt-1 w-full px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm" />
            </label>
          ))}
          <label className="text-sm font-semibold md:col-span-2">
            Objectives
            <textarea value={meta.objectives} onChange={(e) => setMeta({ ...meta, objectives: e.target.value })} className="mt-1 w-full px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm" rows={3} />
          </label>
          <button onClick={saveMeta} className="md:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[color:var(--primary)] text-white rounded-lg font-semibold"><Save size={16} /> Save Lesson Details</button>
        </div>
      )}

      <div className="text-xs text-[color:var(--muted)] mono mb-4">Last saved {new Date(lesson.updated_at ?? lesson.created_at).toLocaleString()}</div>
      <LessonOutput
        data={{
          subject: lesson.subject, grade: lesson.grade, topic: lesson.topic, duration: lesson.duration,
          objectives: lesson.objectives, language: lesson.language,
          lesson_plan: lesson.lesson_plan, worksheet: lesson.worksheet, quiz: stripQuizAnswers(lesson.quiz), rubric,
          quiz_rubric: rubric, quiz_answer_key: isTeacher ? answerKey : undefined,
        }}
        onUpdate={async (p) => {
          const { quiz_answer_key, ...lessonPatch } = p as any;
          setLesson({ ...lesson, ...lessonPatch });
          if (Object.keys(lessonPatch).length) await supabase.from("lessons").update(lessonPatch).eq("id", lesson.id);
          if (quiz_answer_key) {
            setAnswerKey(quiz_answer_key);
            await supabase.from("lesson_answer_keys").upsert({
              lesson_id: lesson.id,
              teacher_id: lesson.teacher_id,
              quiz_answer_key,
            });
          }
        }}
        savedId={lesson.id}
        readOnly={!isTeacher}
        hideAnswerKey={!isTeacher}
        studentQuizSlot={!isTeacher ? <StudentQuiz lesson={lesson} submission={submission} onSubmitted={(s) => setSubmission(s)} /> : undefined}
      />

      {isTeacher && (
        <TeacherSubmissions lesson={lesson} submissions={submissions} onChanged={() => loadTeacherSubmissions(lesson.id)} />
      )}

      {confirmDel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <div className="text-3xl mb-2">⚠️</div>
            <h3 className="text-lg font-bold">Delete this lesson?</h3>
            <p className="text-sm text-[color:var(--muted)] mt-2"><strong>{lesson.topic}</strong> will be permanently removed.</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setConfirmDel(false)} className="flex-1 py-2 border border-[color:var(--border)] rounded-md text-sm">Cancel</button>
              <button onClick={del} className="flex-1 py-2 bg-[color:var(--danger)] text-white rounded-md text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentQuiz({ lesson, submission, onSubmitted }: { lesson: Lesson; submission: QuizSubmission | null; onSubmitted: (s: QuizSubmission) => void }) {
  const { profile } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const mcq = asArray(lesson.quiz?.mcq ?? lesson.quiz?.multiple_choice);
  const short = asArray(lesson.quiz?.short_answer ?? lesson.quiz?.short);

  const submit = async () => {
    if (!profile) return;
    setSaving(true);
    const { data, error } = await supabase.from("quiz_submissions").upsert({
      lesson_id: lesson.id,
      student_id: profile.id,
      answers,
      status: "submitted",
      score: null,
      teacher_feedback: null,
      graded_by: null,
      graded_at: null,
    }, { onConflict: "lesson_id,student_id" }).select("*").single();
    setSaving(false);
    if (error) return toast({ type: "error", message: error.message });
    onSubmitted(data as QuizSubmission);
    toast({ type: "success", message: "Quiz submitted" });
  };

  return (
    <section className="space-y-5">
      <RubricOnlyView rubric={lesson.quiz_rubric ?? lesson.rubric} />
      {submission ? (
        <div className="mt-5 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
          <div className="font-semibold">{submission.status === "graded" ? `Score: ${submission.score} / ${submission.max_score}` : "Not yet graded by Teacher"}</div>
          {submission.teacher_feedback && <p className="text-sm mt-2 whitespace-pre-wrap">{submission.teacher_feedback}</p>}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {mcq.map((q: any, i: number) => (
            <div key={i} className="border border-[color:var(--border)] rounded-lg p-4">
              <div className="font-semibold text-sm mb-3">{i + 1}. {q.question}</div>
              <div className="grid gap-2">
                {asArray(q.options ?? q.choices).map((opt: any, j: number) => {
                  const letter = String.fromCharCode(65 + j);
                  return <label key={j} className="flex items-center gap-2 text-sm"><input type="radio" name={`mcq-${i}`} value={letter} onChange={() => setAnswers({ ...answers, [`mcq_${i}`]: letter })} /> {asString(opt)}</label>;
                })}
              </div>
            </div>
          ))}
          {short.map((q: any, i: number) => (
            <label key={i} className="block border border-[color:var(--border)] rounded-lg p-4">
              <div className="font-semibold text-sm mb-2">Short Answer {i + 1}. {q.question}</div>
              <textarea rows={4} className="w-full border border-[color:var(--border)] rounded p-2 text-sm" value={answers[`short_${i}`] ?? ""} onChange={(e) => setAnswers({ ...answers, [`short_${i}`]: e.target.value })} />
            </label>
          ))}
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-[color:var(--primary)] text-white rounded-lg font-semibold disabled:opacity-60"><Send size={16} /> {saving ? "Submitting..." : "Submit Quiz"}</button>
        </div>
      )}
    </section>
  );
}

function TeacherSubmissions({ lesson, submissions, onChanged }: { lesson: Lesson; submissions: any[]; onChanged: () => void }) {
  const [grading, setGrading] = useState<Record<string, { score: string; feedback: string }>>({});

  const saveGrade = async (s: any) => {
    const g = grading[s.id] ?? { score: String(s.score ?? ""), feedback: s.teacher_feedback ?? "" };
    const score = Number(g.score);
    if (Number.isNaN(score)) return toast({ type: "error", message: "Enter a valid score" });
    const { error } = await supabase.from("quiz_submissions").update({
      score,
      teacher_feedback: g.feedback,
      status: "graded",
      graded_at: new Date().toISOString(),
      graded_by: lesson.teacher_id,
    }).eq("id", s.id);
    if (error) return toast({ type: "error", message: error.message });
    toast({ type: "success", message: "Grade saved" });
    onChanged();
  };

  return (
    <section className="mt-10 card-base p-5">
      <h2 className="text-xl font-bold mb-4">Submitted Quizzes</h2>
      {submissions.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">No student submissions yet.</p>
      ) : (
        <div className="space-y-4">
          {submissions.map((s) => {
            const state = grading[s.id] ?? { score: String(s.score ?? ""), feedback: s.teacher_feedback ?? "" };
            return (
              <div key={s.id} className="border border-[color:var(--border)] rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="font-semibold">{s.student_profile?.full_name || s.student_profile?.email || "Student"}</div>
                    <div className="text-xs text-[color:var(--muted)]">Submitted {new Date(s.submitted_at).toLocaleString()} · {s.status}</div>
                  </div>
                  {s.status === "graded" && <span className="text-sm font-semibold text-[color:var(--success)]">{s.score} / {s.max_score}</span>}
                </div>
                <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(s.answers, null, 2)}</pre>
                <div className="grid md:grid-cols-[160px_1fr_auto] gap-3 mt-3">
                  <input type="number" min="0" max={s.max_score ?? 20} value={state.score} onChange={(e) => setGrading({ ...grading, [s.id]: { ...state, score: e.target.value } })} className="px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm" placeholder="Score" />
                  <input value={state.feedback} onChange={(e) => setGrading({ ...grading, [s.id]: { ...state, feedback: e.target.value } })} className="px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm" placeholder="Teacher feedback" />
                  <button onClick={() => saveGrade(s)} className="px-4 py-2 bg-[color:var(--primary)] text-white rounded-lg text-sm font-semibold">Save Grade</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
