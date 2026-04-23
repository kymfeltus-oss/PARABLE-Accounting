// PARABLE: Ledger - Automated compliance alerts
// Plugs into Resend / SendGrid / SES; defaults to dev logging. Not legal advice.

/**
 * @param {object} violation - { type, description, correction, code?, irsRef? }
 * @param {string} tenantEmail - board / compliance inbox
 * @param {object} [options] - { resendKey?, from?, dryRun? }
 * @returns { Promise<{ sent: boolean, used: 'resend'|'log' }> }
 */
export async function sendComplianceAlert(violation, tenantEmail, options) {
  const o = options ?? {};
  const body = buildComplianceEmailBody(violation);

  if (o.dryRun) {
    console.log("[compliance: dry run]", { to: tenantEmail, subject: subjectLine(violation) });
    return { sent: false, used: "log" };
  }

  if (o.resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${o.resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: o.from ?? "PARABLE Compliance <alerts@parable.finance>",
          to: [tenantEmail],
          subject: subjectLine(violation),
          text: body,
        }),
      });
      if (res.ok) {
        return { sent: true, used: "resend" };
      }
      const t = await res.text();
      console.error("[compliance: Resend error]", res.status, t);
    } catch (e) {
      console.error("[compliance: Resend]", e);
    }
  }

  console.log(`[compliance] Would send to ${tenantEmail}:\n${body}`);

  return { sent: false, used: "log" };
}

/**
 * @param {object} violation
 */
function subjectLine(violation) {
  return `PARABLE // ${violation.code || "ALERT"} — ${violation.type} — action required`;
}

/**
 * @param {object} violation
 */
export function buildComplianceEmailBody(violation) {
  return `
PARABLE // COMPLIANCE BREACH DETECTED
----------------------------------------
Violation: ${violation.type}
Code: ${violation.code ?? "—"}
Risk: ${violation.risk ?? "REVIEW"}
Reference: ${violation.irsRef ? `IRS / Pub 1828 (see in-app) — key: ${violation.irsRef}` : "See IRS Publication 1828 (churches) and 990/990-T instructions for applicable forms."}

DESCRIPTION
${violation.description}

CORRECTIVE ACTION
${violation.correction}

— PARABLE: Ledger  ·  do not forward credentials or bank info by email
`.trim();
}

export default { sendComplianceAlert, buildComplianceEmailBody };
