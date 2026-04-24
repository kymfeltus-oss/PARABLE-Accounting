/**
 * PARABLE: Plaid — Link + transactions → `parable_ledger.transactions` (Sovereign erp_ledger view).
 * Every imported row is flagged `parable_verification_state: "unverified"` until the Autonomous Close
 * Virtual Controller (or a human) clears it.
 */
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from "plaid";

let _plaid = null;

export const PLAID_IMPORT_SOURCE = "plaid";
export const VERIFICATION_UNVERIFIED = "unverified";

/**
 * @returns {PlaidApi}
 */
export function getPlaidClient() {
  const id = process.env.PLAID_CLIENT_ID;
  const sec = process.env.PLAID_SECRET;
  if (!id || !sec) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set");
  }
  if (!_plaid) {
    const basePath =
      process.env.PLAID_ENV === "production" ? PlaidEnvironments.production : PlaidEnvironments.sandbox;
    const config = new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": id,
          "PLAID-SECRET": sec,
        },
      },
    });
    _plaid = new PlaidApi(config);
  }
  return _plaid;
}

/**
 * @param {object} p
 * @param {string} p.tenantId
 * @param {string} p.userId — unique per end-user in your app (e.g. Supabase auth id)
 * @param {string} [p.clientName] — shown in Plaid
 */
export async function createLinkToken({ tenantId, userId, clientName = "PARABLE Sovereign" }) {
  const plaid = getPlaidClient();
  const { data } = await plaid.linkTokenCreate({
    user: { client_user_id: `${tenantId}:${userId}` },
    client_name: clientName,
    products: ["transactions"],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return { linkToken: data.link_token, expiration: data.expiration };
}

/**
 * @param {string} publicToken
 * @param {string} [language]
 */
export async function exchangePublicToken(publicToken) {
  const plaid = getPlaidClient();
  const { data } = await plaid.itemPublicTokenExchange({ public_token: publicToken });
  return {
    accessToken: data.access_token,
    itemId: data.item_id,
  };
}

/**
 * @param {string} accessToken
 * @param {string} [cursor] — for /transactions/sync
 */
export async function fetchAddedTransactions(accessToken, cursor) {
  const plaid = getPlaidClient();
  const { data } = await plaid.transactionsSync({
    access_token: accessToken,
    cursor: cursor || undefined,
    count: 100,
  });
  return {
    added: data.added,
    modified: data.modified,
    removed: data.removed,
    nextCursor: data.next_cursor,
    hasMore: data.has_more,
  };
}

/**
 * Map a Plaid transaction to a `parable_ledger.transactions` row shape (client/server insert object).
 * Plaid: positive amount = outflow; negative = inflow. We store positive `amount` for inflows with `tx_type: donation|revenue`.
 *
 * @param {object} p
 * @param {import("plaid").Transaction} p.tx
 * @param {string} p.tenantId
 * @param {string} p.fundId
 * @param {string} [p.defaultAccountCode] — e.g. "1010" operating until Auto-Book remaps
 */
export function mapPlaidToTransactionRow({ tx, tenantId, fundId, defaultAccountCode = "1010" }) {
  const raw = Number(tx.amount);
  const isInflow = raw < 0;
  const amount = Math.abs(raw);
  const name = [tx.name, tx.merchant_name].filter(Boolean).join(" — ") || "Plaid import";

  return {
    tenant_id: tenantId,
    fund_id: fundId,
    amount,
    tx_type: isInflow ? "revenue" : "expense",
    source: `plaid:${name}`,
    is_tax_deductible: isInflow,
    contribution_nature: isInflow ? "charitable_gift" : "exchange_transaction",
    irs_category: isInflow ? "Program Service Revenue" : "Nonprofit expense",
    metadata: {
      import_source: PLAID_IMPORT_SOURCE,
      parable_verification_state: VERIFICATION_UNVERIFIED,
      virtual_controller_approved: false,
      cfo_import_guard: "pending_autonomous_close",
      parable_account_code: defaultAccountCode,
      plaid_transaction_id: tx.transaction_id,
      plaid_account_id: tx.account_id,
      plaid_date: tx.date,
      plaid_pending: tx.pending,
      plaid_raw_amount: raw,
    },
  };
}

export default {
  getPlaidClient,
  createLinkToken,
  exchangePublicToken,
  fetchAddedTransactions,
  mapPlaidToTransactionRow,
  PLAID_IMPORT_SOURCE,
  VERIFICATION_UNVERIFIED,
};
