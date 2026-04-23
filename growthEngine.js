// PARABLE: Ledger — growth analytics & restricted-fund / CapEx journal helpers
// UCOA: 3100 = temporarily restricted building, 3010 = unrestricted net assets (see unified_coa_template)

/**
 * Journal lines to record a *release from restriction* when building fund cash is spent on a capital project.
 * Pair with the expense + cash line elsewhere in the same JE batch. Not tax or legal advice.
 *
 * @param {number} amountUsd — positive: move restriction from 3100 → 3010 (release)
 * @param {{ restrictedAccountCode?: string, unrestrictedAccountCode?: string, memo?: string, projectId?: string }} [meta]
 * @returns {{ accountCode: string, debit: number, credit: number, memo: string }[]}
 */
export function buildRestrictedReleaseJournalLines(amountUsd, meta) {
  const a = Math.abs(Number(amountUsd) || 0);
  if (a <= 0) return [];
  const d3100 = (meta && meta.restrictedAccountCode) || "3100";
  const c3010 = (meta && meta.unrestrictedAccountCode) || "3010";
  const memo =
    (meta && meta.memo) || `Release from restriction — building / CapEx project${meta && meta.projectId ? ` (${meta.projectId})` : ""}`;
  // Dr restricted NA 3100, Cr unrestricted NA 3010 (decrease 3100, increase 3010 in standard equity presentation)
  return [
    { accountCode: d3100, debit: a, credit: 0, memo: `${memo} (release from restriction)` },
    { accountCode: c3010, debit: 0, credit: a, memo: `${memo} (increase unrestricted)` },
  ];
}

/**
 * @param {number} buildingFundBalance - restricted building cash / NA available (from system of record)
 * @param {number} projectSpentYtd
 * @param {number} retainageHeld
 * @param {number} proposedExpense
 * @returns {{ ok: boolean, available: number, message: string }}
 */
export function canCoverCapExFromBuildingFund(buildingFundBalance, projectSpentYtd, retainageHeld, proposedExpense) {
  const b = Math.max(0, Number(buildingFundBalance) || 0);
  const spent = Math.max(0, Number(projectSpentYtd) || 0);
  const ret = Math.max(0, Number(retainageHeld) || 0);
  const p = Math.max(0, Number(proposedExpense) || 0);
  const available = b - spent - ret;
  const after = available - p;
  if (after < -0.0001) {
    return {
      ok: false,
      available: round2(available),
      message: `Proposed $${p.toFixed(2)} exceeds available building fund (after this project’s spend/retainage: $${round2(available).toFixed(2)}).`,
    };
  }
  return { ok: true, available: round2(available), message: "Within available restricted building fund." };
}

/**
 * @typedef {{ id?: string, created_at: string }} MemberRow
 */

/**
 * Compares headcount of members with created_at in current month vs same calendar month one year ago.
 * @param {MemberRow[]} members
 * @param {Date} [now]
 * @returns {{ thisMonth: number, sameMonthLastYear: number, yoyPercent: number | null }}
 */
export function calculateMemberYOY(members, now) {
  const d = now ? new Date(now) : new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const startThis = new Date(Date.UTC(y, m, 1));
  const endThis = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  const yPrev = y - 1;
  const startPrev = new Date(Date.UTC(yPrev, m, 1));
  const endPrev = new Date(Date.UTC(yPrev, m + 1, 0, 23, 59, 59, 999));

  const inRange = (iso, a, b) => {
    const t = new Date(iso).getTime();
    return t >= a.getTime() && t <= b.getTime();
  };

  const list = Array.isArray(members) ? members : [];
  const thisM = list.filter((r) => r && r.created_at && inRange(r.created_at, startThis, endThis)).length;
  const lastM = list.filter((r) => r && r.created_at && inRange(r.created_at, startPrev, endPrev)).length;

  let yoyPercent = null;
  if (lastM > 0) yoyPercent = ((thisM - lastM) / lastM) * 100;
  else if (thisM > 0) yoyPercent = 100;

  return { thisMonth: thisM, sameMonthLastYear: lastM, yoyPercent: yoyPercent == null ? null : round2(yoyPercent) };
}

/**
 * @param {Array<{ member_id: string, ytd_giving: string | number }>} rows - from v_member_stewardship_giving or app aggregate
 * @param {number} currentMonth1to12
 * @param {number} activeCount
 * @returns {number}
 */
export function averageMonthlyGivingPerActiveMemberYTD(rows, currentMonth1to12, activeCount) {
  const n = Math.max(1, Math.min(12, currentMonth1to12 || 1));
  const act = Math.max(1, Number(activeCount) || 1);
  const totalYtd = (rows || []).reduce((s, r) => s + (Number(r.ytd_giving) || 0), 0);
  if (rows && rows.length > 0 && (Number(activeCount) > 0 || act > 0)) {
    return round2((totalYtd / n) / act);
  }
  return 0;
}

/**
 * Simpler: total YTD giving and active members → Avg = (totalYtd / monthsElapsed) / activeCount
 * @param {number} ytdTotalGiving
 * @param {number} monthNumber1to12
 * @param {number} activeMemberCount
 */
export function averageMonthlyGivingSustainability(ytdTotalGiving, monthNumber1to12, activeMemberCount) {
  const m = Math.max(1, Math.min(12, monthNumber1to12 || 1));
  const act = Math.max(1, Number(activeMemberCount) || 1);
  return round2(ytdTotalGiving / m / act);
}

function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

export default {
  buildRestrictedReleaseJournalLines,
  canCoverCapExFromBuildingFund,
  calculateMemberYOY,
  averageMonthlyGivingPerActiveMemberYTD,
  averageMonthlyGivingSustainability,
};
