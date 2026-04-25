import { NextResponse } from "next/server";
import { createTrialSetupCheckoutSession } from "@sovereign/lib/stripe.js";

export const runtime = "nodejs";

type Body = {
  email: string;
  successUrl: string;
  cancelUrl: string;
  planId?: string;
  planName?: string;
};

/**
 * Stripe Checkout **setup** mode — $0.00, saves payment method for future subscription billing.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!body.successUrl || !body.cancelUrl) {
    return NextResponse.json({ error: "successUrl and cancelUrl are required" }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not configured" }, { status: 503 });
  }
  const extraMeta: Record<string, string> = {};
  if (body.planId) extraMeta.plan_id = String(body.planId);
  if (body.planName) extraMeta.plan_name = String(body.planName);

  try {
    const { url, sessionId } = await createTrialSetupCheckoutSession({
      customerEmail: email,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      metadata: extraMeta,
    });
    if (!url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
    }
    return NextResponse.json({ url, sessionId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
