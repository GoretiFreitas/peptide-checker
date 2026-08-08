import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "supporter" | "registry_member";

export function useUserRoles(userId: string | null) {
  const [roles, setRoles] = useState<Set<AppRole>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRoles(new Set());
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (!cancelled) {
        setRoles(new Set(((data ?? []) as { role: AppRole }[]).map((r) => r.role)));
        setLoading(false);
      }
    };
    load();
    // Unique topic per hook instance: several components use this hook at once,
    // and reusing a topic that is already subscribed throws
    // "cannot add `postgres_changes` callbacks ... after `subscribe()`".
    const ch = supabase
      .channel(`roles-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [userId]);

  return {
    roles,
    loading,
    isSupporter: roles.has("supporter"),
    isRegistryMember: roles.has("registry_member"),
    isAdmin: roles.has("admin"),
  };
}
