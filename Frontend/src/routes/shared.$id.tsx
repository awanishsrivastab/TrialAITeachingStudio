import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase, type Lesson } from "@/lib/supabase";
import { LessonOutput } from "@/components/LessonOutput";

export const Route = createFileRoute("/shared/$id")({
  head: () => ({ meta: [{ title: "Shared Lesson · AI Teaching Studio" }] }),
  component: SharedView,
});

function SharedView() {
  const { id } = Route.useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("lessons")
        .select("id,subject,grade,topic,duration,objectives,language,lesson_plan,worksheet,quiz,quiz_rubric,is_published,created_at")
        .eq("id", id)
        .eq("is_published", true)
        .single();
      setLesson(data ?? null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-[color:var(--primary)] border-t-transparent rounded-full animate-spin" /></div>;
  if (!lesson) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <div className="text-5xl mb-3">🔒</div>
      <h1 className="text-2xl font-bold">This lesson is not available</h1>
      <p className="text-[color:var(--muted)] mt-2">It may have been removed or set to private.</p>
      <Link to="/" className="mt-5 px-4 py-2 bg-[color:var(--primary)] text-white rounded-lg">Go home</Link>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b border-[color:var(--border)] h-16 flex items-center px-4">
        <Link to="/" className="flex items-center gap-2 font-bold"><span>🎓</span> AI Teaching Studio</Link>
      </nav>
      <div className="bg-[color:var(--primary)] text-white text-center text-sm py-2">📖 Shared Lesson Kit — View only</div>
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <div className="card-base p-5 mb-6">
          <div className="flex flex-wrap gap-2 mb-2">
            {[lesson.subject, lesson.grade, lesson.topic, lesson.duration, lesson.language].map((p) => (
              <span key={p} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-[color:var(--primary)]">{p}</span>
            ))}
          </div>
          <p className="text-xs text-[color:var(--muted)]">Generated with <Link to="/" className="underline">AI Teaching Studio</Link></p>
        </div>
        <LessonOutput
          data={{
            subject: lesson.subject, grade: lesson.grade, topic: lesson.topic, duration: lesson.duration,
            objectives: lesson.objectives, language: lesson.language,
            lesson_plan: lesson.lesson_plan, worksheet: lesson.worksheet, quiz: lesson.quiz, rubric: lesson.quiz_rubric,
            quiz_rubric: lesson.quiz_rubric,
          }}
          onUpdate={() => {}}
          readOnly
          hideAnswerKey
        />
      </div>
      <footer className="bg-[#111827] text-white text-center py-8">
        <p className="mb-3">Want to create your own lesson kits for free?</p>
        <Link to="/auth" className="inline-block px-5 py-2.5 bg-[color:var(--primary)] hover:bg-[color:var(--primary-dark)] rounded-lg font-semibold">Try AI Teaching Studio →</Link>
      </footer>
    </div>
  );
}
