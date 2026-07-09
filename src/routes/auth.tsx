import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Certificate Checker" },
      { name: "description", content: "Sign in to nominate products and back independent tests." },
      { property: "og:title", content: "Sign in — Certificate Checker" },
      { property: "og:description", content: "Sign in to nominate products and back independent tests." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/auth" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: next || "/board", replace: true });
    });
  }, [navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: next || "/board", replace: true });
    } catch (e: any) {
      setError(e.message ?? "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    setError(null);
    if (!email) {
      setError("Enter your email above first, then click reset.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setError("Password-reset email sent. Check your inbox.");
    } catch (e: any) {
      setError(e.message ?? "Reset failed");
    } finally {
      setBusy(false);
    }
  };


  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth" + (next ? `?next=${encodeURIComponent(next)}` : ""),
    });
    if (result.error) setError(String(result.error));
    if (!result.redirected && !result.error) navigate({ to: next || "/board", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
          Cooperative
        </div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight text-foreground">
          {mode === "signin" ? "Sign in." : "Create account."}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Nominate products, back tests, and view published results.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-sm border border-border bg-card px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-sm border border-border bg-card px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <button
            disabled={busy}
            className="w-full rounded-sm bg-foreground py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-background disabled:opacity-40"
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          {mode === "signin" && (
            <button
              type="button"
              onClick={sendReset}
              className="w-full text-center text-[11px] tracking-[0.18em] uppercase text-muted-foreground underline"
            >
              Forgot password?
            </button>
          )}
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Or</div>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={google}
          className="w-full rounded-sm border border-border bg-card py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-foreground hover:bg-secondary"
        >
          Continue with Google
        </button>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button className="text-foreground underline" onClick={() => setMode("signup")}>
                Create one
              </button>
            </>
          ) : (
            <>
              Have an account?{" "}
              <button className="text-foreground underline" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </div>

        <div className="mt-10 text-center">
          <Link to="/" className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
            ← Back to checker
          </Link>
        </div>
      </main>
    </div>
  );
}
