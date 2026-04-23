// PARABLE: Ledger — adaptive onboarding (engagement → pivot tracks)
// Feed memberActivity from open/click analytics (email pixels, app events).

/** @typedef {'DEFAULT' | 'STEWARDSHIP_PARTNER' | 'INREACH_RECOVERY' | 'ACCELERATED_DISCOVERY'} OnboardingTrack */

/**
 * @typedef {{
 *   days_since_join: number;
 *   emails_opened: number;
 *   emails_sent?: number;
 *   vision_pdf_opened?: boolean;
 *   clicked_links?: string[];
 *   last_activity_at?: string;
 *   building_fund_page_views?: number;
 * }} MemberActivity
 */

const LINKS = {
  VISION: "vision_pdf",
  BUILDING: "building_fund_report",
  BUILDING_ALT: "building_fund", // common short id
  STEWARDSHIP_VIDEO: "stewardship_video",
};

/**
 * 0–100: higher = more ready for stewardship / depth.
 * @param {MemberActivity} a
 * @returns {number}
 */
export function computeEngagementScore(a) {
  const links = a.clicked_links || [];
  let s = 0;
  s += Math.min(40, (a.emails_opened || 0) * 12);
  if (a.vision_pdf_opened) s += 20;
  if (links.includes(LINKS.BUILDING) || links.includes(LINKS.BUILDING_ALT)) s += 30;
  if (links.includes(LINKS.VISION) || a.vision_pdf_opened) s += 5;
  if (links.includes(LINKS.STEWARDSHIP_VIDEO)) s += 15;
  s += Math.min(15, (a.building_fund_page_views || 0) * 5);
  return Math.min(100, Math.round(s));
}

/**
 * True when both vision content and building-fund intent are observed (Clever path).
 * @param {MemberActivity} a
 */
export function isStewardshipPivotEligibility(a) {
  const links = a.clicked_links || [];
  const hasVision = !!(a.vision_pdf_opened || links.includes(LINKS.VISION));
  const hasBuilding = links.includes(LINKS.BUILDING) || links.includes(LINKS.BUILDING_ALT) || (a.building_fund_page_views || 0) > 0;
  return hasVision && hasBuilding;
}

/**
 * @param {MemberActivity} memberActivity
 * @param {{ min_days_for_inreach?: number, min_unopened?: number } | undefined} [options]
 * @returns {{
 *   track: string;
 *   next_action: string;
 *   ai_note: string;
 *   priority?: 'normal' | 'high';
 *   engagementScore?: number;
 * }}
 */
export function getNextOnboardingStep(memberActivity, options) {
  const a = memberActivity && typeof memberActivity === "object" ? memberActivity : {};
  const score = computeEngagementScore(/** @type {MemberActivity} */ (a));

  if (isStewardshipPivotEligibility(/** @type {MemberActivity} */ (a))) {
    return {
      track: "STEWARDSHIP_PARTNER",
      next_action: "SEND_IMPACT_REPORT",
      priority: "high",
      engagementScore: score,
      ai_note: "Member engaged with the vision pack and building fund—prioritize project transparency and YTD fund split.",
    };
  }

  const hasBuildingOnly = (a.clicked_links || []).some((k) => k === LINKS.BUILDING || k === LINKS.BUILDING_ALT);
  if (hasBuildingOnly) {
    return {
      track: "STEWARDSHIP_PARTNER",
      next_action: "SEND_STEWARDSHIP_DEEP_DIVE",
      priority: "normal",
      engagementScore: score,
      ai_note: "High infrastructure interest. Pivot toward Building Fund + audit-ready story without waiting for the day-3 mail.",
    };
  }

  const d = typeof a.days_since_join === "number" ? a.days_since_join : 0;
  const unopened = (a.emails_opened || 0) === 0;
  const minDays = options && options.min_days_for_inreach != null ? options.min_days_for_inreach : 5;
  if (unopened && d > minDays) {
    return {
      track: "INREACH_RECOVERY",
      next_action: "NOTIFY_PASTORAL_CARE",
      priority: "high",
      engagementScore: score,
      ai_note: "Low digital engagement. Suggest a personal connection (Inreach) before the discovery call.",
    };
  }

  if (score >= 60 && d >= 3) {
    return {
      track: "ACCELERATED_DISCOVERY",
      next_action: "ALERT_ADMIN_EARLY_DISCOVERY",
      priority: "normal",
      engagementScore: score,
      ai_note: "Engagement is strong; consider moving discovery / activation earlier than day 7/14.",
    };
  }

  return {
    track: "DEFAULT",
    next_action: "CONTINUE_SOVEREIGN_SEQUENCE",
    priority: "normal",
    engagementScore: score,
    ai_note: "Run standard day-based onboarding; keep monitoring email opens and link clicks.",
  };
}

/**
 * Suggested `onboarding_track` / automation metadata for the CRM row (optional display).
 * @param {MemberActivity} memberActivity
 */
export function getAdaptiveTrackId(memberActivity) {
  return getNextOnboardingStep(memberActivity).track;
}

export default {
  getNextOnboardingStep,
  computeEngagementScore,
  isStewardshipPivotEligibility,
  getAdaptiveTrackId,
  LINKS,
};
