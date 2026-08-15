import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe-client";

export type SubscriptionRow = {
  id: string;
  status: string;
  price_id: string;
  product_id: string;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
};

export function useSubscription(userId: string | null) {
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSub(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const env = (() => {
        try {
          return getStripeEnvironment();
        } catch {
          return "sandbox";
        }
      })();
      const { data } = await supabase
        .from("subscriptions")
        .select("id,status,price_id,product_id,cancel_at_period_end,current_period_end")
        .eq("user_id", userId)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setSub(data as SubscriptionRow | null);
        setLoading(false);
      }
    };
    load();
    const channel = supabase
      .channel(`sub-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const isActive =
    !!sub &&
    (["active", "trialing", "past_due"].includes(sub.status) ||
      (sub.status === "canceled" &&
        sub.current_period_end &&
        new Date(sub.current_period_end).getTime() > Date.now()));

  return { sub, loading, isActive: !!isActive, isPastDue: sub?.status === "past_due" };
}
