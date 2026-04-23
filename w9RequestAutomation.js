// PARABLE: W-9 request automation — wire to Resend; producer logs + returns channel for now.

/**
 * @param {object} opts
 * @param {string} [opts.reason] — e.g. "spend_at_or_over_2000"
 * @param {{ id?: string, display_name?: string, email?: string } | null} [opts.payee]
 */
export async function triggerW9RequestEmail(opts) {
  const who = (opts && opts.payee && opts.payee.display_name) || "Payee";
  if (typeof console !== "undefined" && console.log) {
    console.log(
      `[W-9 automation] Nudge: collect W-9 for “${who}” (${(opts && opts.reason) || "compliance"}) — replace stub with email provider.`,
    );
  }
  return { sent: true, channel: "stub" };
}

export default { triggerW9RequestEmail };
