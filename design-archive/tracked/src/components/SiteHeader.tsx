import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { SupporterBadge } from "@/components/SupporterBadge";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { isSupporter, isRegistryMember, isAdmin } = useUserRoles(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setEmail(session?.user?.email ?? null);
        setUserId(session?.user?.id ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const linkClass =
    "text-muted-foreground hover:text-foreground transition-colors font-medium hover:-translate-y-0.5 transform duration-150";
  const activeProps = { className: "text-foreground font-semibold" };

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(212,175,135,0.22)] bg-[oklch(0.985_0.008_80/0.88)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3.5 md:px-10">
        <Link
          to="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <BrandLogo size="md" />
        </Link>

        <nav className="hidden items-center gap-7 text-[11px] font-medium tracking-[0.18em] uppercase md:flex">
          <Link
            to="/"
            className={linkClass}
            activeOptions={{ exact: true }}
            activeProps={activeProps}
          >
            Checker
          </Link>
          <Link to="/verify" search={{}} className={linkClass} activeProps={activeProps}>
            Verify
          </Link>
          <Link to="/fund" className={linkClass} activeProps={activeProps}>
            Fund
          </Link>
          <Link to="/support" search={{}} className={linkClass} activeProps={activeProps}>
            Support
          </Link>
          {email && (
            <span className="flex items-center gap-1.5">
              {isAdmin && <SupporterBadge variant="admin" />}
              {isSupporter && <SupporterBadge variant="supporter" />}
              {isRegistryMember && <SupporterBadge variant="registry_member" />}
            </span>
          )}
          {email ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-full border border-[rgba(200,165,125,0.3)] bg-white/80 px-3.5 py-1.5 text-[10px] tracking-[0.16em] uppercase text-muted-foreground transition-all hover:border-foreground hover:text-foreground hover:shadow-sm"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/auth"
              search={{}}
              className="rounded-full border border-[rgba(200,165,125,0.35)] bg-white px-4 py-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase text-foreground shadow-xs transition-all hover:bg-foreground hover:text-background"
            >
              Sign in
            </Link>
          )}
        </nav>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-[rgba(200,165,125,0.3)] bg-white/80 p-2 text-muted-foreground transition-colors hover:text-foreground md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-[rgba(212,175,135,0.2)] bg-[oklch(0.985_0.008_80/0.95)] backdrop-blur-lg md:hidden">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-6 py-4 text-[11px] font-medium tracking-[0.18em] uppercase">
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className={`${linkClass} py-2.5`}
              activeOptions={{ exact: true }}
              activeProps={activeProps}
            >
              Checker
            </Link>
            <Link
              to="/verify"
              search={{}}
              onClick={() => setOpen(false)}
              className={`${linkClass} py-2.5`}
              activeProps={activeProps}
            >
              Verify
            </Link>
            <Link
              to="/fund"
              onClick={() => setOpen(false)}
              className={`${linkClass} py-2.5`}
              activeProps={activeProps}
            >
              Fund
            </Link>
            <Link
              to="/support"
              search={{}}
              onClick={() => setOpen(false)}
              className={`${linkClass} py-2.5`}
              activeProps={activeProps}
            >
              Support
            </Link>
            {email ? (
              <button
                onClick={() => {
                  setOpen(false);
                  supabase.auth.signOut();
                }}
                className={`${linkClass} py-2.5 text-left text-red-700`}
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/auth"
                search={{}}
                onClick={() => setOpen(false)}
                className={`${linkClass} py-2.5 font-semibold text-foreground`}
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
