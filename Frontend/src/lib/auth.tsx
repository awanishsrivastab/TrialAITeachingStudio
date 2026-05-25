import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile } from "./supabase";

type AuthCtx = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (s?: Session | null) => {
    const current = s ?? session;
    if (!current) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", current.user.id).single();
    if (data) {
      setProfile(data as Profile);
      return;
    }
    const meta = current.user.user_metadata ?? {};
    const fallback = {
      id: current.user.id,
      email: current.user.email ?? null,
      full_name: meta.full_name ?? "",
      role: meta.role === "student" ? "student" : "teacher",
      grade: meta.role === "student" ? meta.grade ?? "Grade 5" : null,
    };
    const { data: created } = await supabase.from("profiles").insert(fallback).select("*").single();
    setProfile((created as Profile | null) ?? (fallback as Profile));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      loadProfile(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={{ session, profile, loading, refreshProfile: () => loadProfile() }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
