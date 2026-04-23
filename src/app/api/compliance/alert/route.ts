import { NextResponse } from "next/server";
import { buildComplianceEmailBody } from "@/lib/complianceFromRoot.js";

type Body = {
  to: string;
  violation: { type: string; description: string; correction: string; code?: string; irsRef?: string; risk?: string };
};

/**
 * Server-only email dispatch. Set RESEND_API_KEY in production; otherwise returns { sent: false }.
 * Keeps the API key off the client bundle.
 */
export async function POST(request: Request) {
  let json: Body;
  try {
    json = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!json?.to || !json?.violation) {
    return NextResponse.json({ error: "Missing to or violation" }, { status: 400 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ sent: false, used: "no_key" });
  }
  const from = process.env.RESEND_FROM ?? "PARABLE Compliance <onboarding@resend.dev>";
  const text = buildComplianceEmailBody(json.violation);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [json.to],
      subject: `PARABLE // ${json.violation.code ?? "ALERT"} — ${json.violation.type}`,
      text,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return NextResponse.json({ sent: false, error: t }, { status: 502 });
  }
  return NextResponse.json({ sent: true, used: "resend" });
}
