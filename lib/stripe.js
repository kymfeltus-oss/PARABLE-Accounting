/**
 * PARABLE: Stripe — Checkout for giving (e.g. Tithes / 4010).
 * The Checkout Session and PaymentIntent metadata always carry the UCOA account code for Auto-Book.
 */
import Stripe from "stripe";

/** @type {InstanceType<typeof Stripe> | null} */
let _stripe = null;

/** Default UCOA for tithes & offerings (Sovereign chart). */
export const TITHE_ACCOUNT_CODE = "4010";

/**
 * @returns {import('stripe').default}
 */
export function getStripe() {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!_stripe) {
    _stripe = new Stripe(k);
  }
  return _stripe;
}

/**
 * Create a hosted Checkout Session. Metadata is duplicated on the session and payment_intent
 * so webhooks and reconciliation always see the PARABLE account code.
 *
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {number} opts.amountCents — e.g. 5000 = $50.00
 * @param {string} [opts.accountCode] — UCOA integer as string, default 4010 (Tithes)
 * @param {string} [opts.purpose] — e.g. "tithes"
 * @param {string} opts.successUrl
 * @param {string} opts.cancelUrl
 * @param {string} [opts.memberId]
 * @param {string} [opts.customerEmail]
 */
export async function createTitheCheckoutSession({
  tenantId,
  amountCents,
  accountCode = TITHE_ACCOUNT_CODE,
  purpose = "tithes",
  successUrl,
  cancelUrl,
  memberId,
  customerEmail,
}) {
  if (!Number.isInteger(amountCents) || amountCents < 50) {
    throw new Error("amountCents must be an integer >= 50 (minimum charge)");
  }
  const stripe = getStripe();
  const meta = {
    parable_account_code: String(accountCode),
    parable_tenant_id: String(tenantId),
    parable_purpose: purpose,
    sovereign_product: "parable_erp",
  };
  if (memberId) {
    meta.parable_member_id = String(memberId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Tithes & offerings",
            description: `PARABLE UCOA ${accountCode} (Tithes & offerings) — Auto-Book routing key`,
            metadata: {
              parable_account_code: String(accountCode),
            },
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_intent_data: {
      metadata: { ...meta },
    },
    metadata: { ...meta },
  });

  return { sessionId: session.id, url: session.url, metadata: meta };
}

/**
 * @param {import('stripe').Stripe.CheckoutSession} session
 * @returns { { parable_account_code: string, parable_tenant_id: string, parable_purpose: string, parable_member_id?: string } }
 */
export function readParableMetadataFromCheckoutSession(session) {
  return {
    parable_account_code: String(session.metadata?.parable_account_code ?? TITHE_ACCOUNT_CODE),
    parable_tenant_id: String(session.metadata?.parable_tenant_id ?? ""),
    parable_purpose: String(session.metadata?.parable_purpose ?? "tithes"),
    parable_member_id: session.metadata?.parable_member_id
      ? String(session.metadata.parable_member_id)
      : undefined,
  };
}

/**
 * Hosted Checkout in **setup** mode: collects a card for future off-session charges ($0 today).
 * Use after account creation when billing should be authorized without an immediate payment.
 *
 * @param {object} opts
 * @param {string} opts.customerEmail
 * @param {string} opts.successUrl — must include `{CHECKOUT_SESSION_ID}` if you need the session id
 * @param {string} opts.cancelUrl
 * @param {Record<string, string>} [opts.metadata]
 */
export async function createTrialSetupCheckoutSession({ customerEmail, successUrl, cancelUrl, metadata = {} }) {
  const stripe = getStripe();
  const baseMeta = {
    sovereign_product: "parable_erp",
    parable_purpose: "trial_payment_method",
  };
  const sessionMeta = { ...baseMeta, ...metadata };
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    currency: "usd",
    payment_method_types: ["card"],
    customer_email: customerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: sessionMeta,
    setup_intent_data: {
      metadata: sessionMeta,
    },
  });
  return { sessionId: session.id, url: session.url };
}

export default {
  getStripe,
  createTitheCheckoutSession,
  createTrialSetupCheckoutSession,
  TITHE_ACCOUNT_CODE,
  readParableMetadataFromCheckoutSession,
};
