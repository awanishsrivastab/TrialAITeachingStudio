import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar, Footer } from "@/components/Chrome";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !session) router.navigate({ to: "/auth", replace: true });
    if (!loading && session && profile?.role === "student" && window.location.pathname === "/generate") {
      router.navigate({ to: "/library", replace: true });
    }
  }, [session, profile, loading, router]);

  if (loading || !session || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[color:var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
