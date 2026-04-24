import { NextResponse } from "next/server";
import { createTitheCheckoutSession, TITHE_ACCOUNT_CODE } from "@sovereign/lib/stripe.js";

export const runtime = "nodejs";

type Body = {
  tenantId: string;
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
  /** UCOA code for Auto-Book; default 4010 (Tithes & offerings) */
  accountCode?: string;
  memberId?: string;
  customerEmail?: string;
  purpose?: string;
};

/**
 * Server-only Stripe Checkout. Session + PaymentIntent metadata always include `parable_account_code`.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.tenantId || !body.successUrl || !body.cancelUrl) {
    return NextResponse.json({ error: "Missing tenantId, successUrl, or cancelUrl" }, { status: 400 });
  }
  if (typeof body.amountCents !== "number" || body.amountCents < 50) {
    return NextResponse.json({ error: "amountCents must be a number >= 50" }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not configured" }, { status: 500 });
  }
  try {
    const { url, sessionId, metadata } = await createTitheCheckoutSession({
      tenantId: body.tenantId,
      amountCents: body.amountCents,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      accountCode: body.accountCode ?? TITHE_ACCOUNT_CODE,
      memberId: body.memberId,
      customerEmail: body.customerEmail,
      purpose: body.purpose ?? "tithes",
    });
    if (!url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
    }
    return NextResponse.json({ url, sessionId, metadata });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
