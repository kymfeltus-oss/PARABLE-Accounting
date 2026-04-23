// PARABLE: Ledger — Auto-Pilot (Immediate Go-Live) for new churches
// Also published as TypeScript: src/lib/autoPilotRouter.ts (canonical for the app)

export const AUTOPILOT_STREAM_TAGS = {
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
  ubi: new Set(["sponsorship", "ad", "ad_share", "sponsor", "merch", "tournament", "entry_fee", "game_fee"]),
};

/**
 * @param {string | null | undefined} raw
 * @returns {"PROGRAM_SERVICE" | "UBI_CANDIDATE" | "UNSPECIFIED"}
 */
export function classifyAutopilotRevenueType(raw) {
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

/**
 * @param {string} tenantId
 */
export const setupInstantGoLive = async (tenantId) => {
  return {
    status: "Sovereign infrastructure activated",
    tenantId,
    defaultIrsStance:
      "Gifts, bits, and subs default to program/contribution lanes; ads and sponsorships route toward 990-T review.",
    rules: {
      mapToProgramService: ["bits", "donations", "subs", "gifts", "tithe", "cheer", "raid"],
      mapToUbiReview: ["sponsorships", "ad_share", "pay_to_play", "merch_sale", "tournament", "entry_fee"],
    },
  };
};
