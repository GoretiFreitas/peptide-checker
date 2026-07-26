import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { SupporterBadge } from "@/components/SupporterBadge";
import logoAsset from "@/assets/peptides-check.svg.asset.json";

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

  const linkClass = "text-muted-foreground hover:text-foreground";
  const activeProps = { className: "text-foreground" };

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4 md:px-10">
        <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 font-serif text-lg tracking-tight text-foreground sm:text-xl">
          <img src={logoAsset.url} alt="PeptidesCheck" className="h-7 w-auto sm:h-8" />
          PeptidesCheck<span className="text-muted-foreground">.</span>
        </Link>

        <nav className="hidden items-center gap-6 text-[11px] font-medium tracking-[0.18em] uppercase md:flex">
          <Link to="/" className={linkClass} activeOptions={{ exact: true }} activeProps={activeProps}>Checker</Link>
          <Link to="/verify" search={{}} className={linkClass} activeProps={activeProps}>Verify</Link>
          <Link to="/board" className={linkClass} activeProps={activeProps}>Board</Link>
          <Link to="/support" search={{}} className={linkClass} activeProps={activeProps}>Support</Link>
          {email && (
            <span className="flex items-center gap-1.5">
              {isAdmin && <SupporterBadge variant="admin" />}
              {isSupporter && <SupporterBadge variant="supporter" />}
              {isRegistryMember && <SupporterBadge variant="registry_member" />}
            </span>
          )}
          {email ? (
            <button onClick={() => supabase.auth.signOut()} className={linkClass}>Sign out</button>
          ) : (
            <Link to="/auth" search={{}} className={linkClass}>Sign in</Link>
          )}
        </nav>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden text-muted-foreground hover:text-foreground"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-border bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-6 py-4 text-[11px] font-medium tracking-[0.18em] uppercase">
            <Link to="/" onClick={() => setOpen(false)} className={`${linkClass} py-2`} activeOptions={{ exact: true }} activeProps={activeProps}>Checker</Link>
            <Link to="/verify" search={{}} onClick={() => setOpen(false)} className={`${linkClass} py-2`} activeProps={activeProps}>Verify</Link>
            <Link to="/board" onClick={() => setOpen(false)} className={`${linkClass} py-2`} activeProps={activeProps}>Board</Link>
            <Link to="/support" search={{}} onClick={() => setOpen(false)} className={`${linkClass} py-2`} activeProps={activeProps}>Support</Link>
            {email ? (
              <button onClick={() => { setOpen(false); supabase.auth.signOut(); }} className={`${linkClass} py-2 text-left`}>Sign out</button>
            ) : (
              <Link to="/auth" search={{}} onClick={() => setOpen(false)} className={`${linkClass} py-2`}>Sign in</Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
