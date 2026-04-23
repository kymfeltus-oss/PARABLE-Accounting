"use client";

import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { applyTenantCssVars } from "@/lib/brandCss";
import type { TenantRow } from "@/types/tenant";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type { TenantRow };

export type BrandContextValue = {
  tenant: TenantRow | null;
  error: string | null;
  ready: boolean;
  reload: () => void;
};

const BrandContext = createContext<BrandContextValue | null>(null);

const DEFAULT_SLUG = "parable-main";

function defaultTenantCss() {
  if (typeof document === "undefined") return;
  applyTenantCssVars(document.documentElement, "#22d3ee", "#050505", "#00f2ff");
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  const reload = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    defaultTenantCss();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const slug =
      (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TENANT_SLUG?.trim()) || DEFAULT_SLUG;

    const run = async () => {
      const supabase = getSupabaseBrowser();
      if (!supabase) {
        if (!cancelled) {
          setError("Supabase is not configured; using default PARABLE palette only.");
          setTenant(null);
          setReady(true);
        }
        return;
      }

      const { data, error: qErr } = await supabase
        .schema("parable_ledger")
        .from("tenants")
        .select(
          "id,slug,display_name,legal_name,primary_color,accent_color,logo_url,custom_domain,tax_id_ein,fiscal_year_start",
        )
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;

      if (qErr) {
        setError(
          `${qErr.message} — run white_label_schema.sql (or migrations) and ensure schema parable_ledger is exposed.`,
        );
        setTenant(null);
        setReady(true);
        return;
      }

      if (!data) {
        setError(`No tenant row for slug "${slug}". Seed parable_ledger.tenants or set NEXT_PUBLIC_TENANT_SLUG.`);
        setTenant(null);
        setReady(true);
        return;
      }

      const row = data as TenantRow;
      setTenant(row);
      setError(null);
      setReady(true);
      applyTenantCssVars(document.documentElement, row.primary_color, row.accent_color, row.primary_color);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  const value = useMemo<BrandContextValue>(
    () => ({ tenant, error, ready, reload }),
    [tenant, error, ready, reload],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error("useBrand must be used within BrandProvider");
  }
  return ctx;
}
