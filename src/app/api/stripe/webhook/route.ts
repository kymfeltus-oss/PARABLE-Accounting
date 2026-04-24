import { NextResponse } from "next/server";
import { getStripe, readParableMetadataFromCheckoutSession, TITHE_ACCOUNT_CODE } from "@sovereign/lib/stripe.js";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getGeneralFundId } from "@/lib/ledgerDefaultFund";

export const runtime = "nodejs";

type WebhookSession = {
  id: string;
  amount_total: number | null;
  payment_intent: string | { id: string } | null;
  metadata: Record<string, string> | null;
};

/**
 * `checkout.session.completed` → one `parable_ledger.transactions` row (card-network path; not Plaid “unverified” guard).
 * Configure STRIPE_WEBHOOK_SECRET in Vercel / .env; forward events from Stripe CLI in dev.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 500 });
  }
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  const stripe = getStripe();
  let event: { type: string; data: { object: WebhookSession } };
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret) as { type: string; data: { object: WebhookSession } };
  } catch (e) {
    const m = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json({ error: m }, { status: 400 });
  }
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: event.type });
  }
  const session = event.data.object;
  const meta = readParableMetadataFromCheckoutSession(session);
  if (!meta.parable_tenant_id) {
    return NextResponse.json({ error: "Session missing parable_tenant_id" }, { status: 400 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY; cannot post donation row." },
      { status: 500 }
    );
  }
  const fundId = await getGeneralFundId(supabase, meta.parable_tenant_id);
  if (!fundId) {
    return NextResponse.json(
      { error: "No GEN fund for tenant — run parable_ledger.provision or seed ministry_funds." },
      { status: 500 }
    );
  }
  const amountUsd = (session.amount_total ?? 0) / 100;
  if (amountUsd <= 0) {
    return NextResponse.json({ error: "Zero or missing amount_total" }, { status: 400 });
  }
  const { error: ins } = await supabase.schema("parable_ledger").from("transactions").insert({
    tenant_id: meta.parable_tenant_id,
    fund_id: fundId,
    amount: amountUsd,
    tx_type: "donation",
    source: "stripe_checkout:tithes",
    is_tax_deductible: true,
    contribution_nature: "charitable_gift",
    irs_category: "Contributions and grants",
    metadata: {
      import_source: "stripe_checkout",
      parable_account_code: meta.parable_account_code || TITHE_ACCOUNT_CODE,
      parable_purpose: meta.parable_purpose,
      parable_verification_state: "card_network_settled",
      virtual_controller_approved: true,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent:
        session.payment_intent && typeof session.payment_intent === "object"
          ? (session.payment_intent as { id: string }).id
          : String(session.payment_intent ?? ""),
      parable_member_id: meta.parable_member_id,
    },
  });
  if (ins) {
    return NextResponse.json({ error: ins.message }, { status: 500 });
  }
  return NextResponse.json({ received: true, sessionId: session.id });
}
