-- AI Teaching Studio teacher/student schema and RLS.
-- Apply this in the Supabase SQL editor after reviewing it for your project.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('teacher', 'student');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.quiz_submission_status as enum ('submitted', 'graded');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'teacher',
  grade text,
  created_at timestamptz not null default now(),
  constraint student_grade_required check (role <> 'student' or nullif(trim(coalesce(grade, '')), '') is not null)
);

insert into public.profiles (id, email, full_name, role, grade)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  case when u.raw_user_meta_data->>'role' in ('teacher', 'student') then u.raw_user_meta_data->>'role' else 'teacher' end::public.user_role,
  case
    when u.raw_user_meta_data->>'role' = 'student'
      then coalesce(nullif(u.raw_user_meta_data->>'grade', ''), 'Grade 5')
    else nullif(u.raw_user_meta_data->>'grade', '')
  end
from auth.users u
on conflict (id) do nothing;

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete cascade,
  subject text not null,
  grade text not null,
  topic text not null,
  duration text,
  objectives text,
  language text,
  lesson_plan jsonb,
  worksheet jsonb,
  quiz jsonb,
  rubric jsonb,
  quiz_answer_key jsonb,
  quiz_rubric jsonb,
  is_public boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lessons'
      and column_name = 'user_id'
      and data_type <> 'uuid'
  ) then
    alter table public.lessons rename column user_id to legacy_user_id;
  end if;
end $$;

alter table public.lessons
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists teacher_id uuid references public.profiles(id) on delete cascade,
  add column if not exists quiz_answer_key jsonb,
  add column if not exists quiz_rubric jsonb,
  add column if not exists is_published boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lessons'
      and column_name = 'legacy_user_id'
  ) then
    update public.lessons
    set teacher_id = legacy_user_id::uuid
    where teacher_id is null
      and legacy_user_id is not null
      and legacy_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  else
    update public.lessons
    set teacher_id = user_id
    where teacher_id is null and user_id is not null;
  end if;
end $$;

update public.lessons
set user_id = teacher_id
where user_id is null and teacher_id is not null;

update public.lessons
set quiz_rubric = to_jsonb(rubric)
where quiz_rubric is null and rubric is not null;

update public.lessons
set is_published = true
where is_published = false and is_public = true;

create table if not exists public.quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status public.quiz_submission_status not null default 'submitted',
  score numeric,
  max_score numeric not null default 20,
  teacher_feedback text,
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  submitted_at timestamptz not null default now(),
  unique (lesson_id, student_id),
  constraint graded_score_required check (status <> 'graded' or score is not null)
);

create table if not exists public.lesson_answer_keys (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  quiz_answer_key jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.lesson_answer_keys (lesson_id, teacher_id, quiz_answer_key)
select id, teacher_id, quiz_answer_key
from public.lessons
where teacher_id is not null and quiz_answer_key is not null
on conflict (lesson_id) do update set
  teacher_id = excluded.teacher_id,
  quiz_answer_key = excluded.quiz_answer_key,
  updated_at = now();

update public.lessons
set quiz_answer_key = null
where quiz_answer_key is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_lessons_updated_at on public.lessons;
create trigger set_lessons_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, grade)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when new.raw_user_meta_data->>'role' in ('teacher', 'student') then new.raw_user_meta_data->>'role' else 'teacher' end::public.user_role,
    case
      when new.raw_user_meta_data->>'role' = 'student'
        then coalesce(nullif(new.raw_user_meta_data->>'grade', ''), 'Grade 5')
      else nullif(new.raw_user_meta_data->>'grade', '')
    end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    grade = excluded.grade;

  return new;
end;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_grade()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select grade from public.profiles where id = auth.uid()
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace view public.student_lessons
with (security_invoker = true) as
select
  id,
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
  quiz_rubric,
  is_published,
  created_at,
  updated_at
from public.lessons
where is_published = true;

alter table public.profiles enable row level security;
alter table public.lessons enable row level security;
alter table public.quiz_submissions enable row level security;
alter table public.lesson_answer_keys enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles teachers read students" on public.profiles;
create policy "profiles teachers read students"
on public.profiles for select
using (public.current_user_role() = 'teacher');

drop policy if exists "profiles update own basic fields" on public.profiles;
create policy "profiles update own basic fields"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles insert own fallback" on public.profiles;
create policy "profiles insert own fallback"
on public.profiles for insert
with check (id = auth.uid());

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
  teacher_id = auth.uid()
  and public.current_user_role() = 'teacher'
)
with check (
  teacher_id = auth.uid()
  and public.current_user_role() = 'teacher'
);

drop policy if exists "lessons students read grade published" on public.lessons;
create policy "lessons students read grade published"
on public.lessons for select
using (
  is_published = true
  and public.current_user_role() = 'student'
  and public.current_user_grade() = lessons.grade
);

drop policy if exists "quiz submissions student insert own" on public.quiz_submissions;
create policy "quiz submissions student insert own"
on public.quiz_submissions for insert
with check (
  student_id = auth.uid()
  and status = 'submitted'
  and exists (
    select 1
    from public.lessons l
    where l.id = lesson_id
      and l.is_published = true
      and public.current_user_role() = 'student'
      and l.grade = public.current_user_grade()
  )
);

drop policy if exists "quiz submissions student read own" on public.quiz_submissions;
create policy "quiz submissions student read own"
on public.quiz_submissions for select
using (student_id = auth.uid());

drop policy if exists "quiz submissions student update own before grading" on public.quiz_submissions;
create policy "quiz submissions student update own before grading"
on public.quiz_submissions for update
using (student_id = auth.uid() and status = 'submitted')
with check (
  student_id = auth.uid()
  and status = 'submitted'
  and score is null
  and graded_by is null
  and graded_at is null
);

drop policy if exists "quiz submissions teacher read owned lessons" on public.quiz_submissions;
create policy "quiz submissions teacher read owned lessons"
on public.quiz_submissions for select
using (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_id and l.teacher_id = auth.uid()
  )
);

drop policy if exists "quiz submissions teacher grade owned lessons" on public.quiz_submissions;
create policy "quiz submissions teacher grade owned lessons"
on public.quiz_submissions for update
using (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_id and l.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.lessons l
    where l.id = lesson_id and l.teacher_id = auth.uid()
  )
);

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
