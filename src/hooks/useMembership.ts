import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";

/**
 * Membership = $5/month supporter. Anyone who backs a funding pool with $5
 * or more is granted the `supporter` role automatically by the payments
 * webhook, so both paths resolve to the same check here.
 */
export function useMembership() {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setSessionLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { isSupporter, isRegistryMember, isAdmin, loading } = useUserRoles(userId);

  return {
    userId,
    signedIn: !!userId,
    isMember: isSupporter || isRegistryMember || isAdmin,
    loading: sessionLoading || (!!userId && loading),
  };
}
