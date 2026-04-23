// PARABLE: Green Room — mobile instant honorarium (PIN + 7100 ledger + watchdog)
// Aesthetic: consumed by a full-screen client; this file stays provider-agnostic.

import { evaluateHonorariumGates } from "./instantHonorarium.js";
import { NEC_TRACKING_THRESHOLD_USD } from "./contractorTracker.js";
import { triggerW9RequestEmail } from "./w9RequestAutomation.js";

export const GUEST_HONORARIUM_ACCOUNT_CODE = 7100;
export const PAYOUT_PIN_LENGTH = 6;

/**
 * @param {string} pin
 */
export function isSixDigitPin(pin) {
  const s = String(pin || "").replace(/\D/g, "");
  return s.length === PAYOUT_PIN_LENGTH;
}

/**
 * @param {object} m
 * @param {string} m.pin
 * @param {string} m.storedPin
 */
export function requireUnlockedPayout({ pin, storedPin }) {
  const a = String(pin || "").replace(/\D/g, "");
  if (a.length !== PAYOUT_PIN_LENGTH) {
    return { ok: false, error: "Use a 6-digit PIN" };
  }
  const s = String(storedPin || "").replace(/\D/g, "");
  if (s.length !== PAYOUT_PIN_LENGTH) {
    return { ok: false, error: "Save a 6-digit device PIN in settings first" };
  }
  if (a !== s) {
    return { ok: false, error: "Wrong PIN" };
  }
  return { ok: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} args
 * @param {string} args.tenantId
 * @param {string} args.fundId — ministry_fund.id to post expense
 * @param {string} args.contractorId
 * @param {number} args.ytd
 * @param {boolean} args.w9OnFile
 * @param {number} args.amount
 * @param {string} [args.holdMetadataJson] — if payee has metadata with payout_held, block
 */
export function assertNotOnHold(maybeMeta) {
  if (!maybeMeta || typeof maybeMeta !== "object") return { ok: true };
  if (maybeMeta.payout_held && maybeMeta.payout_held !== "cleared") {
    return { ok: false, error: "Payout hold active — W-9 path required (1099 / vault)." };
  }
  if (maybeMeta.next_payout_blocked) {
    return { ok: false, error: "This payee is on W-9 hold from a prior $2,000 watch crossing. File W-9, then clear in contractor dashboard." };
  }
  return { ok: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} p
 * @param {string} p.tenantId
 * @param {string} p.fundId
 * @param {string} p.contractorPayeeId
 * @param {number} p.ytd
 * @param {boolean} p.w9OnFile
 * @param {string} p.displayName
 * @param {Record<string, unknown> | null} p.payeeMetadata
 * @param {number} p.amount
 * @param {string} p.pin
 * @param {string} p.storedDevicePin
 */
export async function executeGreenRoomPayout(supabase, p) {
  const pin = requireUnlockedPayout({ pin: p.pin, storedPin: p.storedDevicePin });
  if (!pin.ok) {
    return { status: "PIN", error: pin.error };
  }
  const h = assertNotOnHold(p.payeeMetadata);
  if (!h.ok) {
    return { status: "HOLD", error: h.error };
  }
  const a = Math.abs(Number(p.amount) || 0);
  if (a < 0.01) {
    return { status: "INVALID", error: "Amount required" };
  }
  const g = evaluateHonorariumGates(p.ytd, a, p.w9OnFile, NEC_TRACKING_THRESHOLD_USD);
  if (!g.allow) {
    return { status: "BLOCKED", error: g.reason, gate: g };
  }
  const { error } = await supabase.schema("parable_ledger").from("transactions").insert({
    tenant_id: p.tenantId,
    fund_id: p.fundId,
    amount: Math.round(a * 100) / 100,
    tx_type: "expense",
    source: `Instant honorarium: ${p.displayName || p.contractorPayeeId} (Green Room)`,
    is_tax_deductible: true,
    contribution_nature: "charitable_gift",
    irs_category: "Ministry - 1099 Tracking (honoraria)",
    metadata: {
      contractor_payee_id: p.contractorPayeeId,
      account_code: String(GUEST_HONORARIUM_ACCOUNT_CODE),
      coa_label: "Guest Speakers / Honorariums",
      green_room: true,
      instant_honorarium: true,
    },
  });
  if (error) {
    return { status: "ERR", error: error.message };
  }
  if (g.crossingThreshold && !p.w9OnFile) {
    await triggerW9RequestEmail({ reason: "spend_at_or_over_2000", payee: { display_name: p.displayName } });
    const merged = {
      ...(p.payeeMetadata && typeof p.payeeMetadata === "object" ? p.payeeMetadata : {}),
      w9_request_queued_at: new Date().toISOString(),
      next_payout_blocked: true,
      last_crossing_2000: new Date().toISOString(),
    };
    const { error: u2 } = await supabase
      .schema("parable_ledger")
      .from("contractor_payees")
      .update({ updated_at: new Date().toISOString(), metadata: merged })
      .eq("id", p.contractorPayeeId)
      .eq("tenant_id", p.tenantId);
    if (u2) {
      return { status: "OK_LEDGER_WARN", w9: true, detail: u2.message };
    }
  }
  return { status: "OK", w9: !!g.crossingThreshold && !p.w9OnFile, nextTotal: g.nextTotal };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} tenantId
 */
export async function pickDefaultOperatingFundId(supabase, tenantId) {
  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("ministry_funds")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("fund_code", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return { fundId: null, error: error.message };
  return { fundId: (data && data.id) || null, error: null };
}

export default {
  GUEST_HONORARIUM_ACCOUNT_CODE,
  PAYOUT_PIN_LENGTH,
  isSixDigitPin,
  requireUnlockedPayout,
  assertNotOnHold,
  executeGreenRoomPayout,
  pickDefaultOperatingFundId,
  NEC_TRACKING_THRESHOLD_USD,
};
