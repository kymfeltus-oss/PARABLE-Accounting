import { NextResponse } from "next/server";
import { getOfficialInboxAddress, isSmtpConfigured, sendOfficialMail } from "@/lib/email/zohoSmtp";

export const runtime = "nodejs";

type Body = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
};

/**
 * Server-side inquiry delivery via Zoho SMTP (port 465).
 * Falls back to client mailto when SMTP env is not set.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: "SMTP is not configured on the server" }, { status: 503 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const replyEmail = typeof body.email === "string" ? body.email.trim() : "";
  const subject = (typeof body.subject === "string" ? body.subject.trim() : "") || "PARABLE Accounting inquiry";

  const lines = [
    name && `Name: ${name}`,
    replyEmail && `Reply-To: ${replyEmail}`,
    "",
    message,
  ].filter(Boolean);

  try {
    await sendOfficialMail({
      to: getOfficialInboxAddress(),
      subject: `[www.parableaccountant.com] ${subject}`,
      text: lines.join("\n"),
      replyTo: replyEmail || undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
