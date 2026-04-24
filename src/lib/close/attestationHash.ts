/**
 * SHA-256 (hex) over canonical `tenant_id|reporting_period|task_name` — audit-chain fingerprint for `close_checklists`.
 */
export async function computeCloseAttestationSha256(
  tenantId: string,
  reportingPeriod: string,
  taskName: string
): Promise<string> {
  const msg = `${tenantId}|${reportingPeriod}|${taskName}`;
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return "";
  }
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(msg));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
