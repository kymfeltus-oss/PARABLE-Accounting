"use client";

import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useBrand } from "@/components/branding/BrandProvider";

export type LinkedMember = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type AuthUser = { id: string; email: string | null } | null;

type Ctx = {
  supabase: ReturnType<typeof getSupabaseBrowser>;
  tenantId: string | null;
  /** Brand / tenant row (Supabase) — demo giving needs this. */
  brandReady: boolean;
  brandError: string | null;
  tenantSlugEnv: string | undefined;
  user: AuthUser;
  sessionReady: boolean;
  linkedMember: LinkedMember | null;
  /** Demo: first roster row — uses anon RLS; production uses magic link + auth_user_id. */
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  signInWithEmail: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  loadDemoMember: () => Promise<{ ok: boolean; reason?: string }>;
};

const MemberCtx = createContext<Ctx | null>(null);

export function MemberPortalProvider({ children }: { children: ReactNode }) {
  const { tenant, ready: brandReady, error: brandError } = useBrand();
  const supabase = getSupabaseBrowser();
  const [user, setUser] = useState<AuthUser>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkedMember, setLinkedMember] = useState<LinkedMember | null>(null);
  const [demoMode, setDemoMode] = useState(true);

  const loadLinked = useCallback(async () => {
    if (!supabase || !brandReady) return;
    const { data: s } = await supabase.auth.getUser();
    const u = s.user;
    if (!u) {
      // Do not clear linkedMember: anon demo uses loadDemoMember() while auth session is empty.
      return;
    }
    setUser({ id: u.id, email: u.email ?? null });
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("congregation_members")
      .select("id, full_name, email, phone")
      .eq("auth_user_id", u.id)
      .maybeSingle();
    if (!error && data) {
      setLinkedMember(data as LinkedMember);
      return;
    }
    if (u.email && tenant?.id) {
      const { data: byEmail } = await supabase
        .schema("parable_ledger")
        .from("congregation_members")
        .select("id, full_name, email, phone")
        .eq("tenant_id", tenant.id)
        .ilike("email", u.email)
        .maybeSingle();
      if (byEmail) {
        setLinkedMember(byEmail as LinkedMember);
        return;
      }
    }
    setLinkedMember(null);
  }, [supabase, brandReady, tenant]);

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      return;
    }
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? null });
        await loadLinked();
      }
      setSessionReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setLinkedMember(null);
        return;
      }
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? null });
        void loadLinked();
        return;
      }
      setUser(null);
      // No session (e.g. INITIAL_SESSION): keep linkedMember so anon "Demo" roster stays visible.
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadLinked]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!supabase) return "Supabase not configured";
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: origin ? `${origin}/member-portal` : undefined },
      });
      return error ? error.message : null;
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setLinkedMember(null);
  }, [supabase]);

  const loadDemoMember = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (!supabase) {
      return { ok: false, reason: "Supabase is not configured (env keys)." };
    }
    if (!brandReady) {
      return {
        ok: false,
        reason: "Still loading your church. Wait a moment, then tap Demo again.",
      };
    }
    if (!tenant?.id) {
      const slug = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_TENANT_SLUG : undefined;
      const parts = [
        "No tenant row for this app.",
        slug ? `NEXT_PUBLIC_TENANT_SLUG is "${slug}"` : "NEXT_PUBLIC_TENANT_SLUG is not set in .env.local",
        "— it must match parable_ledger.tenants.slug (e.g. parable-master).",
      ];
      if (brandError) parts.push(`Brand: ${brandError}`);
      return { ok: false, reason: parts.join(" ") };
    }
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("congregation_members")
      .select("id, full_name, email, phone")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return { ok: false, reason: error.message };
    }
    if (!data) {
      return {
        ok: false,
        reason: "No congregation_members for this tenant. Seed the roster (Member hub) first.",
      };
    }
    setLinkedMember(data as LinkedMember);
    return { ok: true };
  }, [supabase, tenant?.id, brandReady, brandError]);

  const value = useMemo<Ctx>(
    () => ({
      supabase,
      tenantId: tenant?.id ?? null,
      brandReady,
      brandError,
      tenantSlugEnv: typeof process !== "undefined" ? process.env.NEXT_PUBLIC_TENANT_SLUG : undefined,
      user,
      sessionReady,
      linkedMember,
      demoMode,
      setDemoMode,
      signInWithEmail,
      signOut,
      loadDemoMember,
    }),
    [
      supabase,
      tenant?.id,
      brandReady,
      brandError,
      user,
      sessionReady,
      linkedMember,
      demoMode,
      signInWithEmail,
      signOut,
      loadDemoMember,
    ]
  );

  return <MemberCtx.Provider value={value}>{children}</MemberCtx.Provider>;
}

export function useMemberPortalSession() {
  const c = useContext(MemberCtx);
  if (!c) throw new Error("useMemberPortalSession requires MemberPortalProvider");
  return c;
}
