import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase, type Lesson } from "@/lib/supabase";
import { subjectColor, LANG_FLAG } from "@/lib/utils";
import { toast } from "@/components/Toast";
import { Eye, RefreshCw, Trash2, Search, UploadCloud } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/library")({
  head: () => ({ meta: [{ title: "Lessons - AI Teaching Studio" }] }),
  component: LibraryPage,
});

const lessonListColumns = "id,user_id,teacher_id,subject,grade,topic,duration,objectives,language,lesson_plan,worksheet,quiz,rubric,quiz_rubric,is_public,is_published,created_at,updated_at";

function LibraryPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [q, setQ] = useState("");
  const [subj, setSubj] = useState("All");
  const [gradeF, setGradeF] = useState("All");
  const [langF, setLangF] = useState("All");
  const [sort, setSort] = useState<"new" | "old" | "az">("new");

  useEffect(() => { load(); }, [profile?.id, profile?.grade]);

  const load = async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session || !profile) return;
    const query = profile.role === "student"
      ? supabase.from("lessons").select(lessonListColumns).eq("is_published", true).eq("grade", profile.grade).order("created_at", { ascending: false })
      : supabase.from("lessons").select(lessonListColumns).or(`teacher_id.eq.${s.session.user.id},user_id.eq.${s.session.user.id}`).order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) { toast({ type: "error", message: "Database error. Please refresh." }); setLessons([]); return; }
    setLessons((data as Lesson[]) ?? []);
  };

  const subjects = useMemo(() => Array.from(new Set((lessons ?? []).map((l) => l.subject))), [lessons]);
  const languages = useMemo(() => Array.from(new Set((lessons ?? []).map((l) => l.language))), [lessons]);

  const gradeBucket = (g: string) => {
    const m = g.match(/(\d+)/); const n = m ? parseInt(m[1]) : 0;
    if (g.toLowerCase().includes("college")) return "College";
    if (n <= 3) return "Grade 1-3"; if (n <= 6) return "Grade 4-6"; if (n <= 9) return "Grade 7-9"; return "Grade 10-12";
  };

  const filtered = useMemo(() => {
    let arr = (lessons ?? []).filter((l) => {
      if (q && !`${l.topic} ${l.subject}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (subj !== "All" && l.subject !== subj) return false;
      if (langF !== "All" && l.language !== langF) return false;
      if (gradeF !== "All" && gradeBucket(l.grade) !== gradeF) return false;
      return true;
    });
    if (sort === "new") arr = [...arr].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === "old") arr = [...arr].sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (sort === "az") arr = [...arr].sort((a, b) => a.topic.localeCompare(b.topic));
    return arr;
  }, [lessons, q, subj, gradeF, langF, sort]);

  const del = async (id: string) => {
    if (!confirm("Delete this lesson?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) return toast({ type: "error", message: error.message });
    setLessons((arr) => (arr ?? []).filter((l) => l.id !== id));
    toast({ type: "success", message: "Lesson deleted" });
  };

  const togglePublish = async (lesson: Lesson) => {
    const is_published = !lesson.is_published;
    const { error } = await supabase.from("lessons").update({ is_published }).eq("id", lesson.id);
    if (error) return toast({ type: "error", message: error.message });
    setLessons((arr) => (arr ?? []).map((l) => l.id === lesson.id ? { ...l, is_published } : l));
    toast({ type: "success", message: is_published ? "Lesson published to students" : "Lesson unpublished" });
  };

  const isStudent = profile?.role === "student";
  const openLesson = (id: string) => {
    window.location.assign(`/library/${encodeURIComponent(id)}`);
  };

  if (pathname !== "/library") {
    return <Outlet />;
  }

  return (
    <div>
      <header className="bg-white border-b border-[color:var(--border)] px-4 py-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2"><span aria-hidden>📚</span> {isStudent ? "Lessons" : "My Library"}</h1>
            <p className="text-sm text-[color:var(--muted)]">
              {isStudent ? `Published lessons for ${profile?.grade}` : "All your saved lesson kits - searchable and re-editable"}
            </p>
          </div>
          {lessons && <div className="mono text-xs bg-indigo-50 text-[color:var(--primary)] px-3 py-1.5 rounded-full">{lessons.length} lessons</div>}
        </div>
      </header>

      <div className="sticky top-16 z-20 bg-[color:var(--bg)]/95 backdrop-blur border-b border-[color:var(--border)] px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by topic or subject..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[color:var(--border)] bg-white text-sm focus:outline-none focus:border-[color:var(--primary)]" />
          </div>
          <FilterPill label="Subject" value={subj} setValue={setSubj} options={["All", ...subjects]} />
          {!isStudent && <FilterPill label="Grade" value={gradeF} setValue={setGradeF} options={["All","Grade 1-3","Grade 4-6","Grade 7-9","Grade 10-12","College"]} />}
          <FilterPill label="Language" value={langF} setValue={setLangF} options={["All", ...languages]} />
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-white text-sm">
            <option value="new">Newest First</option><option value="old">Oldest First</option><option value="az">A-Z by Topic</option>
          </select>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {lessons === null ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 rounded-lg animate-shimmer" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-bold mb-2">{lessons.length === 0 ? (isStudent ? "No lessons for your grade yet" : "Your library is empty") : "No lessons match your filters"}</h2>
            <p className="text-[color:var(--muted)] mb-6">{lessons.length === 0 ? (isStudent ? "Your teacher has not published matching lessons yet." : "Generate your first lesson kit to get started") : "Try adjusting your search or filters"}</p>
            {!isStudent && <Link to="/generate" className="inline-block px-5 py-2.5 bg-[color:var(--primary)] hover:bg-[color:var(--primary-dark)] text-white rounded-lg font-semibold">Generate a Lesson</Link>}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((l) => (
              <LessonCard key={l.id} lesson={l}
                isStudent={isStudent}
                onOpen={() => openLesson(l.id)}
                onPublish={isStudent ? undefined : () => togglePublish(l)}
                onDelete={isStudent ? undefined : () => del(l.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterPill({ label, value, setValue, options }: { label: string; value: string; setValue: (v: string) => void; options: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-[color:var(--muted)]">{label}:</span>
      <select value={value} onChange={(e) => setValue(e.target.value)} className="px-2.5 py-1.5 rounded-full border border-[color:var(--border)] bg-white text-xs">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function LessonCard({ lesson, onOpen, onDelete, onPublish, isStudent }: { lesson: Lesson; onOpen: () => void; onDelete?: () => void; onPublish?: () => void; isStudent: boolean }) {
  const dt = new Date(lesson.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const href = `/library/${encodeURIComponent(lesson.id)}`;
  return (
    <div
      className="card-base card-hover p-5 cursor-pointer group flex flex-col"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: subjectColor(lesson.subject) }}>{lesson.subject}</span>
        <span className="text-lg" aria-hidden>{LANG_FLAG[lesson.language] ?? "🌐"}</span>
      </div>
      <h3 className="text-lg font-bold leading-snug line-clamp-2 mb-2">{lesson.topic}</h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">{lesson.grade}</span>
        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">{lesson.duration}</span>
        {!isStudent && <span className={`text-xs px-2 py-0.5 rounded-full ${lesson.is_published ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{lesson.is_published ? "Published" : "Draft"}</span>}
      </div>
      <p className="text-sm text-[color:var(--muted)] line-clamp-2 flex-1">{lesson.objectives?.slice(0, 100)}{(lesson.objectives ?? "").length > 100 ? "..." : ""}</p>
      <div className="text-xs text-[color:var(--muted)] mono mt-3">{dt}</div>
      <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
        <a href={href} className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 bg-[color:var(--primary)] hover:bg-[color:var(--primary-dark)] text-white rounded-md"><Eye size={12} /> Open</a>
        {onPublish && (
          <button onClick={onPublish} type="button" className={`inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 border rounded-md ${lesson.is_published ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}>
            <UploadCloud size={12} /> {lesson.is_published ? "Unpublish" : "Publish"}
          </button>
        )}
        {!isStudent && <a href={href} className="inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 border border-[color:var(--border)] rounded-md hover:bg-gray-50"><RefreshCw size={12} /></a>}
        {onDelete && <button onClick={onDelete} type="button" className="inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 border border-red-200 text-[color:var(--danger)] rounded-md hover:bg-red-50"><Trash2 size={12} /></button>}
      </div>
    </div>
  );
}
