import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setEmail(session?.user?.email ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 md:px-10">
        <Link to="/" className="font-serif text-2xl tracking-tight text-foreground">
          Cooperative<span className="text-muted-foreground">.</span>
        </Link>
        <nav className="flex items-center gap-6 text-[11px] font-medium tracking-[0.18em] uppercase">
          <Link to="/" className="text-muted-foreground hover:text-foreground" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>
            Checker
          </Link>
          <Link to="/board" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Board
          </Link>
          {email ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          ) : (
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
