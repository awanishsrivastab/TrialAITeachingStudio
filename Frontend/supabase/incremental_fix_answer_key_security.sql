-- Incremental fix after anon-key Supabase REST review.
-- Purpose:
-- 1. Keep quiz answer keys teacher-only in lesson_answer_keys.
-- 2. Prevent PostgREST clients from selecting lessons.quiz_answer_key.
-- 3. Preserve app access to safe lesson columns, quiz submissions, profiles, and student_lessons.

create table if not exists public.lesson_answer_keys (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  quiz_answer_key jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lesson_answer_keys enable row level security;

insert into public.lesson_answer_keys (lesson_id, teacher_id, quiz_answer_key)
select id, teacher_id, quiz_answer_key
from public.lessons
where teacher_id is not null
  and quiz_answer_key is not null
on conflict (lesson_id) do update set
  teacher_id = excluded.teacher_id,
  quiz_answer_key = excluded.quiz_answer_key,
  updated_at = now();

update public.lessons
set quiz_answer_key = null
where quiz_answer_key is not null;

drop policy if exists "lesson answer keys teacher manage owned" on public.lesson_answer_keys;
create policy "lesson answer keys teacher manage owned"
on public.lesson_answer_keys for all
using (
  teacher_id = auth.uid()
  and public.current_user_role() = 'teacher'
)
with check (
  teacher_id = auth.uid()
  and public.current_user_role() = 'teacher'
);

-- Remove broad SELECT on lessons, then grant only safe lesson columns.
-- RLS policies still decide which rows each user can see.
revoke select on public.lessons from anon, authenticated;

grant select (
  id,
  user_id,
  teacher_id,
  subject,
  grade,
  topic,
  duration,
  objectives,
  language,
  lesson_plan,
  worksheet,
  quiz,
  rubric,
  quiz_rubric,
  is_public,
  is_published,
  created_at,
  updated_at
) on public.lessons to anon, authenticated;

grant insert, update, delete on public.lessons to authenticated;

revoke all on public.lesson_answer_keys from anon;
grant select, insert, update, delete on public.lesson_answer_keys to authenticated;

grant select, insert, update on public.quiz_submissions to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.student_lessons to anon, authenticated;

notify pgrst, 'reload schema';
