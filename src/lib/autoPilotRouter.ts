/**
 * PARABLE Ledger — Auto-pilot: immediate go-live classifiers for stream/gaming
 * (mirrors supabase stream-to-ledger classification; use from Edge, scripts, or UI).
 */

export const AUTOPILOT_STREAM_TAGS = {
  /** Treated as charitable / program-adjacent — default IRS: Contributions / program */
  programServiceRevenue: new Set([
    "bits",
    "cheer",
    "donation",
    "donations",
    "gift",
    "subs",
    "sub",
    "tithe",
    "raid",
  ]),
  /** 990-T / UBI-style lanes — auto audit awareness */
  ubi: new Set(["sponsorship", "ad", "ad_share", "sponsor", "merch", "tournament", "entry_fee", "game_fee"]),
} as const;

export type AutopilotRevenueClass = "PROGRAM_SERVICE" | "UBI_CANDIDATE" | "UNSPECIFIED";

export function classifyAutopilotRevenueType(raw: string | undefined | null): AutopilotRevenueClass {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!t) return "UNSPECIFIED";
  if (AUTOPILOT_STREAM_TAGS.ubi.has(t)) return "UBI_CANDIDATE";
  for (const k of AUTOPILOT_STREAM_TAGS.ubi) {
    if (t.includes(k)) return "UBI_CANDIDATE";
  }
  if (AUTOPILOT_STREAM_TAGS.programServiceRevenue.has(t)) return "PROGRAM_SERVICE";
  for (const k of AUTOPILOT_STREAM_TAGS.programServiceRevenue) {
    if (t.includes(k)) return "PROGRAM_SERVICE";
  }
  return "UNSPECIFIED";
}

export type InstantGoLiveResult = {
  status: string;
  tenantId: string;
  defaultIrsStance: string;
  classifiers: { tag: string; defaultLane: "Contributions" | "Unrelated Business Income" }[];
};

/**
 * Activates the default “Sovereign” stream compliance posture for a tenant
 * (logical hook — call after `provision_new_church` or tenant row exists).
 */
export async function setupInstantGoLive(tenantId: string): Promise<InstantGoLiveResult> {
  return {
    status: "Sovereign infrastructure activated",
    tenantId,
    defaultIrsStance:
      "Gifts, bits, and subs default to program/contribution lanes; ads & sponsorships route toward 990-T review (audit_flag may apply).",
    classifiers: [
      { tag: "bits, donations, subs, gifts", defaultLane: "Contributions" },
      { tag: "sponsorships, ad_share, pay_to_play", defaultLane: "Unrelated Business Income" },
    ],
  };
}
