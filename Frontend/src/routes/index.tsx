import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    router.navigate({ to: session ? (profile?.role === "student" ? "/library" : "/generate") : "/auth", replace: true });
  }, [session, profile, loading, router]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[color:var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
