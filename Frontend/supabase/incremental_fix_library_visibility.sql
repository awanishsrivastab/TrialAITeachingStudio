-- Incremental fix for saved lessons not showing in My Library.
--
-- This patch is intentionally compatible with both:
-- - updated code that selects explicit safe columns, and
-- - older Lovable/GitHub code that still uses select("*").
--
-- Security approach:
-- - Never keep quiz answer keys in public.lessons.
-- - Move any attempted lessons.quiz_answer_key writes into public.lesson_answer_keys.
-- - Restore normal SELECT on public.lessons for authenticated users so My Library can load.
-- - RLS still controls which rows each user can read.

grant usage on schema public to anon, authenticated;

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

create or replace function public.move_lesson_answer_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quiz_answer_key is not null then
    insert into public.lesson_answer_keys (lesson_id, teacher_id, quiz_answer_key, updated_at)
    values (new.id, new.teacher_id, new.quiz_answer_key, now())
    on conflict (lesson_id) do update set
      teacher_id = excluded.teacher_id,
      quiz_answer_key = excluded.quiz_answer_key,
      updated_at = now();

    new.quiz_answer_key = null;
  end if;

  return new;
end;
$$;

drop trigger if exists move_lesson_answer_key_before_write on public.lessons;
create trigger move_lesson_answer_key_before_write
before insert or update of quiz_answer_key on public.lessons
for each row execute function public.move_lesson_answer_key();

insert into public.lesson_answer_keys (lesson_id, teacher_id, quiz_answer_key, updated_at)
select id, teacher_id, quiz_answer_key, now()
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

-- Restore table-level SELECT compatibility for authenticated users.
-- Because quiz_answer_key is always moved/null, older select("*") code can work safely.
grant select on public.lessons to authenticated;
grant insert, update, delete on public.lessons to authenticated;

-- Keep anonymous users limited to safe lesson reads via RLS/published policies.
grant select on public.lessons to anon;

revoke all on public.lesson_answer_keys from anon;
grant select, insert, update, delete on public.lesson_answer_keys to authenticated;

-- Make teacher policies tolerant of older rows that may have user_id but missing teacher_id.
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

drop policy if exists "lessons teacher insert own" on public.lessons;
create policy "lessons teacher insert own"
on public.lessons for insert
with check (
  teacher_id = auth.uid()
  and public.current_user_role() = 'teacher'
);

-- Backfill owner columns for any saved rows that only have one owner column set.
update public.lessons
set teacher_id = user_id
where teacher_id is null
  and user_id is not null;

update public.lessons
set user_id = teacher_id
where user_id is null
  and teacher_id is not null;

notify pgrst, 'reload schema';
