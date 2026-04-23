// PARABLE: Ledger - Member onboarding & activation (Sovereign journey)
// Drives: welcome, stewardship, discovery, activation. Wire email (Resend/SendGrid) in a worker.

/** Day offsets from join date (calendar-day math in consumers). */
export const ONBOARDING_TIMELINE = {
  WELCOME_EMAIL: 1,
  STEWARDSHIP_INTRO: 3,
  DISCOVERY_CALL: 7,
  ACTIVATION: 14,
};

export const DEFAULT_SEQUENCE = [
  { day: 1, action: "SEND_WELCOME_EMAIL", template: "vision_2026", detail: "Digital welcome + Church Vision PDF from Sovereign vault" },
  { day: 3, action: "SEND_STEWARDSHIP_VIDEO", template: "integrity_seal", detail: "Building fund & audit-ready integrity" },
  { day: 7, action: "ALERT_ADMIN_FOR_CALL", template: "discovery_call", priority: "High", detail: "Member hub admin: schedule 1:1 new member intro" },
  { day: 14, action: "ACTIVATION_INVITE", template: "ministry_or_volunteer", detail: "Invite to a ministry project or volunteer team" },
];

const STAGES = new Set(["welcome", "stewardship", "discovery", "active"]);

/**
 * @param {{ name?: string, full_name?: string, id?: string } | null | undefined} member
 * @param {object[] | undefined} [sequence] — same shape as DEFAULT_SEQUENCE
 */
export async function triggerOnboardingSequence(member, sequence) {
  const s = sequence && sequence.length ? sequence : DEFAULT_SEQUENCE;
  const label = member && (member.full_name || member.name) || (member && member.id) || "new member";
  if (typeof console !== "undefined" && console.log) {
    console.log(`[Sovereign onboarding] Init journey for: ${label}`);
  }
  return s.map((row) => ({ ...row }));
}

/** @param {string | null | undefined} joinDateIso */
export function daysSinceJoin(joinDateIso, now) {
  if (!joinDateIso) return 0;
  const t0 = new Date(joinDateIso);
  if (Number.isNaN(t0.getTime())) return 0;
  const n = now ? new Date(now) : new Date();
  return Math.max(0, Math.floor((n.getTime() - t0.getTime()) / 86400000));
}

/**
 * Suggested pipeline stage from tenure when DB `onboarding_stage` is missing or invalid.
 * @param {string | null} joinDateIso
 * @param {Date} [now]
 * @returns {'welcome' | 'stewardship' | 'discovery' | 'active'}
 */
export function suggestedStageFromTenure(joinDateIso, now) {
  const d = daysSinceJoin(joinDateIso, now);
  if (d < ONBOARDING_TIMELINE.STEWARDSHIP_INTRO) return "welcome";
  if (d < ONBOARDING_TIMELINE.DISCOVERY_CALL) return "stewardship";
  if (d < ONBOARDING_TIMELINE.ACTIVATION) return "discovery";
  return "active";
}

/**
 * @param {string} joinDateIso
 * @param {Date} [onDate] — "today" for the job
 */
export function getActionsDueOnDate(joinDateIso, onDate) {
  const d0 = new Date(joinDateIso);
  if (Number.isNaN(d0.getTime())) return [];
  const t = onDate ? new Date(onDate) : new Date();
  const dJoin = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
  const dToday = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const dayNum = Math.round((dToday.getTime() - dJoin.getTime()) / 86400000) + 1;
  return DEFAULT_SEQUENCE.filter((row) => row.day === dayNum);
}

/**
 * @param {Array<{ joined_at?: string, created_at?: string }>} members
 * @param {Date} [now]
 */
export function getPendingTouchpoints(members, now) {
  const t = now ? new Date(now) : new Date();
  const out = [];
  for (const m of members || []) {
    const j = m.joined_at || m.created_at;
    if (!j) continue;
    const due = getActionsDueOnDate(j, t);
    for (const a of due) {
      out.push({ member: m, action: a });
    }
  }
  return out;
}

/**
 * @param {Array<{ onboarding_stage?: string, joined_at?: string, created_at?: string }>} members
 * @param {Date} [now]
 * @returns {Record<string, number>}
 */
export function computeFunnelCounts(members, now) {
  const m = { welcome: 0, stewardship: 0, discovery: 0, active: 0 };
  for (const row of members || []) {
    const st = STAGES.has(row.onboarding_stage)
      ? row.onboarding_stage
      : suggestedStageFromTenure(row.joined_at || row.created_at, now);
    if (st) m[st] += 1;
  }
  return m;
}

/**
 * @param {object} m
 * @param {string | null | undefined} m.onboarding_stage
 * @param {string | null | undefined} m.joined_at
 * @param {string} [m.created_at]
 * @param {Date} [now]
 */
export function effectiveOnboardingStage(m, now) {
  if (m && STAGES.has(m.onboarding_stage)) return m.onboarding_stage;
  return suggestedStageFromTenure(m.joined_at || m.created_at, now);
}

// --- Staff: Sovereignty Gates & Ministerial Tax Shield (housing before first payroll) — not legal advice. ---

/** @type {readonly { id: string; name: string; who: string; cfo: string; gate: number }[]} */
export const STAFF_SOVEREIGNTY_GATES = Object.freeze([
  { id: "1_legal_dna", gate: 1, name: "Legal DNA", who: "All", cfo: "Collect W-4, I-9, and direct-deposit (where applicable) before any pay run." },
  { id: "2_housing_shield", gate: 2, name: "The Shield", who: "Ministers", cfo: "Housing Allowance board resolution; upload to Sovereign vault before the first housing-designated check." },
  { id: "3_contractor_shield", gate: 3, name: "The Role", who: "Contractors (e.g. musicians)", cfo: "Classify entity (C/S vs sole/LLC) to drive 1099-NEC / $2,000 internal watchdog nudge." },
  { id: "4_vision_culture", gate: 4, name: "Culture", who: "All", cfo: "Automated “vision cast” from the Pastor (source doc in the vault)." },
]);

/**
 * @param {object} row - sovereign_vault row
 * @returns {boolean}
 */
export function isVaultRowHousingAllowanceResolution(row) {
  if (!row) return false;
  const cat = String(row.category || "").toUpperCase();
  const sub = String(row.subcategory || "").toLowerCase();
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  if (meta.housing_allowance_resolution === true || meta.staff_housing === true) return true;
  if (sub.includes("housing") && (sub.includes("allowance") || sub.includes("minister"))) return true;
  if (cat === "GOVERNANCE" && (sub.includes("housing") || sub.includes("ministe"))) return true;
  if (cat === "IRS_TAX" && sub.includes("housing")) return true;
  return false;
}

/**
 * True = block first **minister** payroll in product until a housing resolution is present (row flag and/or vault doc).
 * @param {{ role_type?: string, has_housing_resolution?: boolean }} staff
 * @param {boolean} [vaultHasHousingResolution] — at least one matching vault document for tenant
 */
export function isMinisterialFirstPayrollBlocked(staff, vaultHasHousingResolution) {
  if (!staff || staff.role_type !== "Minister") return false;
  if (staff.has_housing_resolution === true) return false;
  if (vaultHasHousingResolution === true) return false;
  return true;
}

/**
 * @param {object} staff
 * @param {boolean} [vaultHasHousingResolution]
 */
export function assessHousingShield(staff, vaultHasHousingResolution) {
  const blocked = isMinisterialFirstPayrollBlocked(staff, vaultHasHousingResolution);
  return {
    housingShieldActive: true,
    ministerOnboardingBlocked: blocked,
    message: blocked
      ? "First minister payroll is on hold: board-adopted housing allowance resolution must be in the vault (or mark has_housing_resolution) — a nudge, not tax advice."
      : "Housing shield clear for this minister in product logic — still verify with counsel.",
    cfoAction: blocked
      ? "CFO: route board resolution to Sovereign vault; run payroll only after file + documentation trail."
      : "CFO: retain documentation with payroll packet.",
  };
}

/**
 * @param {string} roleType — 'Minister' | 'Secular Staff' | 'Contractor'
 */
export function expectedTaxFormsForRole(roleType) {
  if (roleType === "Minister") {
    return { w4: true, i9: true, directDeposit: true, housingBoardResolution: true, fica: "SECA/Minister rules — route via payroll" };
  }
  if (roleType === "Secular Staff") {
    return { w4: true, i9: true, directDeposit: true, fica: "FICA match (OASDI + HI) for employer side — Financial Hub" };
  }
  return { w9: true, contractorWatchdog: "Entity type drives $2,000 NEC nudge" };
}

/**
 * Simplistic annual employer FICA (OASDI+HI) placeholder for secular wages for hub display — not payroll tax software.
 * @param {number} ytdGrossWages
 */
export function estimateEmployerFicaMatchYtd(ytdGrossWages) {
  const g = Math.max(0, Number(ytdGrossWages) || 0);
  return Math.round(g * 0.0765 * 100) / 100;
}

/**
 * Draft text for a board resolution (paste into body + edit). Same disclaimer as `boardResolutionTemplate` in the app.
 * @param {object} tenantLike — { legal_name, display_name, tax_id_ein? }
 * @param {{ proposedAnnualHousingUsd?: number, assemblyDate: string, fiscalYear: number }} vars
 */
export function draftHousingAllowanceBoardResolution(tenantLike, vars) {
  const org = (tenantLike && (tenantLike.legal_name || tenantLike.display_name)) || "[Church legal name]";
  const ein = (tenantLike && tenantLike.tax_id_ein) || "[EIN on file in tenants row]";
  const y = (vars && vars.fiscalYear) || new Date().getFullYear();
  const housing = (vars && vars.proposedAnnualHousingUsd) != null ? `up to $${Number(vars.proposedAnnualHousingUsd).toFixed(0)}` : "an amount not exceeding FRV and qualifying expenses (document separately)";
  const d = (vars && vars.assemblyDate) || "[adoption date]";
  return `BOARD RESOLUTION — MINISTER HOUSING ALLOWANCE (Section 107 nudge; not legal or tax advice)

${org}  ·  EIN ${ein}  ·  Fiscal year ${y}

BE IT RESOLVED that the board designates a ministerial housing allowance in writing as required before amounts are paid or treated as excludable, in ${housing}, effective for the ${y} tax year; and the treasurer will retain this resolution, payroll records, and a matching vault file.

Adopted: ${d}

____________________________________          ____________________________________
Chair                                              Secretary
`;
}

export default {
  ONBOARDING_TIMELINE,
  DEFAULT_SEQUENCE,
  triggerOnboardingSequence,
  daysSinceJoin,
  suggestedStageFromTenure,
  getActionsDueOnDate,
  getPendingTouchpoints,
  computeFunnelCounts,
  effectiveOnboardingStage,
  STAFF_SOVEREIGNTY_GATES,
  isVaultRowHousingAllowanceResolution,
  isMinisterialFirstPayrollBlocked,
  assessHousingShield,
  expectedTaxFormsForRole,
  estimateEmployerFicaMatchYtd,
  draftHousingAllowanceBoardResolution,
};
