// PARABLE: Ledger - Digital succession & emergency access (dead man's switch)
// Tiered release: successor request → 72h cooling period → board "second" signature. Not legal advice.

export const COOLING_OFF_MS = 72 * 60 * 60 * 1000;

/**
 * @typedef {'PENDING_COOLING'|'AWAITING_BOARD_SECOND'|'UNLOCKED'|'DENIED'} SuccessionState
 */

/**
 * Start a successor access request. In production, persist the row in Supabase (tenant, successor_id, started_at, unlock_at, board_attestor_id, status).
 *
 * @param {string} successorId
 * @param {string} boardMemberId
 * @param {{ reason?: string, now?: number }} [opt]
 */
export async function initiateEmergencyAccess(successorId, boardMemberId, opt) {
  const now = opt?.now ?? Date.now();
  const unlockTime = now + COOLING_OFF_MS;

  return {
    status: "PENDING_VERIFICATION",
    state: "PENDING_COOLING",
    successorId,
    boardMemberId,
    requirement: "Board member digital attestation required after cooling period to confirm emergency / incapacity context.",
    unlockAt: new Date(unlockTime).toISOString(),
    coolingOffHours: 72,
    alertNote: "Primary admin receives a notification (read-only) that a request was started.",
  };
}

/**
 * Record that a board member provided the "second" after the cooling window.
 *
 * @param {object} request — persisted request row
 * @param {string} boardMemberId
 * @param {number} [at]
 */
export function canApplyBoardSecond(request, boardMemberId, at) {
  if (!request || !request.unlockAt) return { ok: false, reason: "Invalid request" };
  const t = at ?? Date.now();
  if (t < new Date(request.unlockAt).getTime()) {
    return { ok: false, reason: "Cooling period not complete", unlockAt: request.unlockAt };
  }
  if (String(boardMemberId) !== String(request.boardMemberId)) {
    return { ok: false, reason: "Board attestation must come from the designated second signer" };
  }
  return { ok: true, nextState: "UNLOCKED" };
}

/**
 * @param {object} request
 * @param {number} [at]
 * @returns {{ state: 'pending'|'ready_for_second'|'unlocked' }}
 */
export function describeSuccessionState(request, at) {
  const t = at ?? Date.now();
  if (!request?.unlockAt) return { state: "pending" };
  if (t >= new Date(request.unlockAt).getTime() && request.boardSecondAt) {
    return { state: "unlocked" };
  }
  if (t >= new Date(request.unlockAt).getTime()) {
    return { state: "ready_for_second" };
  }
  return { state: "pending" };
}

export default { initiateEmergencyAccess, canApplyBoardSecond, describeSuccessionState, COOLING_OFF_MS };
