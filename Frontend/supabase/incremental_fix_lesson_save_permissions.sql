-- Incremental fix for "permission denied for table lessons" during Save to Library.
--
-- This aligns grants with the app behavior:
-- - Teachers insert lessons into public.lessons using their authenticated Supabase JWT.
-- - The app returns only the inserted lesson id: .select("id").single().
-- - Quiz answer keys are stored in public.lesson_answer_keys, not returned from public.lessons.

grant usage on schema public to anon, authenticated;

-- Keep broad table mutations available to logged-in users; RLS policies still restrict rows.
grant insert, update, delete on public.lessons to authenticated;

-- Make sure authenticated users can read only safe lesson columns through PostgREST.
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

-- Teacher-only answer-key table used by the frontend after lesson insert/regeneration.
create table if not exists public.lesson_answer_keys (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  quiz_answer_key jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lesson_answer_keys enable row level security;

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

revoke all on public.lesson_answer_keys from anon;
grant select, insert, update, delete on public.lesson_answer_keys to authenticated;

-- Ensure teacher insert policy exists and is current.
drop policy if exists "lessons teacher insert own" on public.lessons;
create policy "lessons teacher insert own"
on public.lessons for insert
with check (
  teacher_id = auth.uid()
  and public.current_user_role() = 'teacher'
);

drop policy if exists "lessons teacher manage own" on public.lessons;
create policy "lessons teacher manage own"
on public.lessons for all
using (
  (teacher_id = auth.uid() or user_id = auth.uid())
  and public.current_user_role() = 'teacher'
)
with check (
  teacher_id = auth.uid()
  and public.current_user_role() = 'teacher'
);

-- Backfill teacher_id for any rows saved with user_id only.
update public.lessons
set teacher_id = user_id
where teacher_id is null
  and user_id is not null;

notify pgrst, 'reload schema';
