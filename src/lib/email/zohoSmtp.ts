import nodemailer from "nodemailer";

const OFFICIAL_DOMAIN = "parableaccountant.com";
const DEFAULT_LOCAL_PART = "info";

/**
 * Zoho Mail (or compatible) SMTP — port 465, TLS implicit.
 * Env: `EMAIL_SERVER_HOST`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD`, `EMAIL_FROM`.
 */
export function createZohoTransport() {
  const host = process.env.EMAIL_SERVER_HOST?.trim();
  const user = process.env.EMAIL_SERVER_USER?.trim();
  const pass = process.env.EMAIL_SERVER_PASSWORD?.trim();
  if (!host || !user || !pass) {
    throw new Error("Missing EMAIL_SERVER_HOST, EMAIL_SERVER_USER, or EMAIL_SERVER_PASSWORD");
  }
  return nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

/**
 * RFC5322 From header. All sends use `EMAIL_FROM` after validation — address must be @{parableaccountant.com}.
 * Default: `PARABLE Accounting <info@parableaccountant.com>`.
 */
export function getOfficialFromHeader(): string {
  const raw = process.env.EMAIL_FROM?.trim();
  const fallback = `${DEFAULT_LOCAL_PART}@${OFFICIAL_DOMAIN}`;
  const display = "PARABLE Accounting";

  if (!raw) {
    return `${display} <${fallback}>`;
  }

  const angle = raw.match(/^(.+?)\s*<([^>]+)>$/);
  const emailPart = (angle ? angle[2] : raw).trim().toLowerCase();
  const localDisplay = angle ? angle[1].trim().replace(/^["']|["']$/g, "") : display;

  if (!emailPart.endsWith(`@${OFFICIAL_DOMAIN}`)) {
    throw new Error(
      `EMAIL_FROM must use @${OFFICIAL_DOMAIN} (official domain: www.${OFFICIAL_DOMAIN}). Got: ${emailPart}`,
    );
  }

  if (angle) {
    return `${localDisplay} <${emailPart}>`;
  }
  return `${display} <${emailPart}>`;
}

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export async function sendOfficialMail(input: SendMailInput): Promise<void> {
  const transport = createZohoTransport();
  const from = getOfficialFromHeader();
  await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    replyTo: input.replyTo,
  });
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.EMAIL_SERVER_HOST?.trim() &&
      process.env.EMAIL_SERVER_USER?.trim() &&
      process.env.EMAIL_SERVER_PASSWORD?.trim(),
  );
}

/** Inbound mailbox for website inquiries (defaults to official info address). */
export function getOfficialInboxAddress(): string {
  const raw = process.env.EMAIL_FROM?.trim();
  if (raw) {
    const m = raw.match(/<([^>]+)>/);
    const email = (m ? m[1] : raw).trim().toLowerCase();
    if (email.endsWith(`@${OFFICIAL_DOMAIN}`)) return email;
  }
  return `${DEFAULT_LOCAL_PART}@${OFFICIAL_DOMAIN}`;
}
