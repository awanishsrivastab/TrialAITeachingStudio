import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drop, setDrop] = useState(false);

  const initials =
    session?.user.email?.slice(0, 2).toUpperCase() ?? "?";

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  const linkCls = "px-3 py-2 text-sm font-medium text-[color:var(--ink)] hover:text-[color:var(--primary)] transition";
  const activeCls = "text-[color:var(--primary)] border-b-2 border-[color:var(--primary)]";

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-[color:var(--border)] h-16 no-print">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link to="/generate" className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>🎓</span>
          <span className="font-bold text-lg">AI Teaching Studio</span>
        </Link>

        {session && profile?.role === "teacher" && (
          <div className="hidden md:flex items-center gap-2">
            <Link to="/generate" className={linkCls} activeProps={{ className: `${linkCls} ${activeCls}` }}>
              Generate
            </Link>
            <Link to="/library" className={linkCls} activeProps={{ className: `${linkCls} ${activeCls}` }}>
              My Library
            </Link>
          </div>
        )}
        {session && profile?.role === "student" && (
          <div className="hidden md:flex items-center gap-2">
            <Link to="/library" className={linkCls} activeProps={{ className: `${linkCls} ${activeCls}` }}>
              Lessons
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3">
          {session ? (
            <div className="relative">
              <button
                onClick={() => setDrop(!drop)}
                aria-label="User menu"
                className="w-10 h-10 rounded-full bg-[color:var(--primary)] text-white font-semibold text-sm flex items-center justify-center hover:bg-[color:var(--primary-dark)] transition"
              >
                {initials}
              </button>
              {drop && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-[color:var(--border)] py-2">
                  <div className="px-4 py-2 text-xs text-[color:var(--muted)] truncate">{session.user.email}</div>
                  <div className="px-4 py-1 text-xs capitalize text-[color:var(--primary)]">{profile?.role}{profile?.grade ? ` · ${profile.grade}` : ""}</div>
                  <Link to="/library" onClick={() => setDrop(false)} className="block px-4 py-2 text-sm hover:bg-gray-50">{profile?.role === "student" ? "Lessons" : "My Library"}</Link>
                  <button onClick={signOut} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-[color:var(--danger)]">Sign Out</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/auth" className="text-sm font-semibold text-[color:var(--primary)]">Sign In</Link>
          )}
          {session && (
            <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          )}
        </div>
      </div>
      {menuOpen && session && (
        <div className="md:hidden bg-white border-t border-[color:var(--border)] px-4 py-3 flex flex-col gap-2">
          {profile?.role === "teacher" && <Link to="/generate" onClick={() => setMenuOpen(false)} className="py-2">Generate</Link>}
          <Link to="/library" onClick={() => setMenuOpen(false)} className="py-2">{profile?.role === "student" ? "Lessons" : "My Library"}</Link>
        </div>
      )}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#111827] text-white mt-16 no-print border-t-2 border-[color:var(--primary)]">
      <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6 items-center text-center md:text-left">
        <div className="font-bold text-lg flex items-center gap-2 justify-center md:justify-start">
          <span aria-hidden>🎓</span> AI Teaching Studio
        </div>
        <div className="text-sm text-gray-300">
          Empowering educators with AI · Built for teachers, by technology
        </div>
        <div className="text-xs text-gray-400 md:text-right">
          Powered by Gemini AI · Built with Lovable
        </div>
      </div>
    </footer>
  );
}
