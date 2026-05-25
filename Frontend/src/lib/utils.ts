import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: "#4F46E5",
  Maths: "#4F46E5",
  Math: "#4F46E5",
  Science: "#10B981",
  History: "#F59E0B",
  English: "#8B5CF6",
  Geography: "#06B6D4",
  Physics: "#3B82F6",
  Chemistry: "#EF4444",
  Biology: "#10B981",
};
export const subjectColor = (s: string) => SUBJECT_COLORS[s] ?? "#6B7280";

export const LANG_FLAG: Record<string, string> = {
  English: "🇬🇧",
  Hindi: "🇮🇳",
  Tamil: "🇮🇳",
  Telugu: "🇮🇳",
  Kannada: "🇮🇳",
  Marathi: "🇮🇳",
};
