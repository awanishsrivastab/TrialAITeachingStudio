import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "your-supabase-anon-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const N8N_GENERATE_URL =
  import.meta.env.VITE_N8N_GENERATE_URL ?? "https://YOUR_N8N_HOST/webhook/generate-lesson";
export const N8N_REGEN_URL =
  import.meta.env.VITE_N8N_REGEN_URL ?? "https://YOUR_N8N_HOST/webhook/regenerate-section";

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type Lesson = {
  id: string;
  user_id?: string;
  teacher_id: string;
  subject: string;
  grade: string;
  topic: string;
  duration: string;
  objectives: string;
  language: string;
  lesson_plan: any;
  worksheet: any;
  quiz: any;
  rubric?: any;
  quiz_answer_key?: any;
  quiz_rubric?: any;
  is_public?: boolean;
  is_published?: boolean;
  created_at: string;
  updated_at?: string;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "teacher" | "student";
  grade: string | null;
  created_at: string;
};

export type QuizSubmission = {
  id: string;
  lesson_id: string;
  student_id: string;
  answers: any;
  status: "submitted" | "graded";
  score: number | null;
  max_score: number;
  teacher_feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
  submitted_at: string;
};

export function stripQuizAnswers(quiz: any) {
  if (!quiz || typeof quiz !== "object") return quiz;
  return {
    ...quiz,
    mcq: (quiz.mcq ?? quiz.multiple_choice ?? []).map((q: any) => {
      const { correct, answer, ...rest } = q ?? {};
      return rest;
    }),
    short_answer: (quiz.short_answer ?? quiz.short ?? []).map((q: any) => {
      const { answer, model_answer, correct, ...rest } = q ?? {};
      return rest;
    }),
  };
}

export function extractQuizAnswerKey(quiz: any) {
  if (!quiz || typeof quiz !== "object") return null;
  return {
    mcq: (quiz.mcq ?? quiz.multiple_choice ?? []).map((q: any, index: number) => ({
      index,
      question: q?.question ?? "",
      correct: q?.correct ?? q?.answer ?? "",
    })),
    short_answer: (quiz.short_answer ?? quiz.short ?? []).map((q: any, index: number) => ({
      index,
      question: q?.question ?? "",
      answer: q?.answer ?? q?.model_answer ?? "",
      points: q?.points ?? 2,
    })),
  };
}
