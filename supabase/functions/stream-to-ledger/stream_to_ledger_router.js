/**
 * PARABLE Ledger — stream / gaming → ledger router
 * Classification for 990-T (UBI) vs mission-related lanes.
 *
 * Deploy with Supabase Edge (Deno): imported from index.ts in this folder.
 * Payload shape (webhook body from streaming/gaming module):
 *   { amount, source, metadata?, userId?, fundId? }
 * metadata.type examples:
 *   Mission-exempt lane: tithe, offering, support, gift, raid_hype (if documented as gift)
 *   UBI lane: ad_share, sponsorship, pay_to_play, game_entry_fee, merch_sale
 */

/** @param {Record<string, unknown> | undefined} metadata */
export function classifyStreamRevenue(metadata) {
  const raw = metadata && typeof metadata === "object" ? metadata : {};
  const type = String(raw.type ?? "").toLowerCase();
  const forceUbi = raw.force_ubi === true;

  const UBI_TYPES = new Set([
    "ad_share",
    "ad_revenue",
    "sponsorship",
    "pay_to_play",
    "game_entry_fee",
    "paid_tournament_entry",
    "merch_sale",
    "subscription_non_gift", // paid tier that is not a donation — facts matter
  ]);

  const isUBI = forceUbi || UBI_TYPES.has(type);
  const taxLane = isUBI ? "990-T_UBI" : "mission_exempt";
  const contributionNature = isUBI ? "ubit_candidate" : "charitable_gift";
  const txType = isUBI ? "revenue" : "donation";

  let irsCategory = "Program Service Revenue";
  if (isUBI) irsCategory = "Unrelated Business Income";
  else if (txType === "donation") irsCategory = "Contributions";

  const auditFlag = raw.require_review === true || raw.auto_flag === true;

  return { isUBI, taxLane, contributionNature, txType, irsCategory, auditFlag };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   amount: number;
 *   source: string;
 *   metadata?: Record<string, unknown>;
 *   userId?: string;
 *   fundId?: string;
 *   fundCode?: string;
 *   fundCodeDefault?: string;
 *   tenantId?: string;
 *   tenantSlug?: string;
 * }} payload
 */
export async function handleStreamRevenue(supabase, payload) {
  const { amount, source, metadata = {}, userId } = payload;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount === 0) {
    throw new Error("Invalid amount");
  }

  const { isUBI, taxLane, contributionNature, txType, irsCategory, auditFlag } = classifyStreamRevenue(
    /** @type {Record<string, unknown>} */ (metadata),
  );

  const fundCode =
    payload.fundCode ?? (isUBI ? "UBI" : payload.fundCodeDefault ?? "GEN");

  let tenantId = payload.tenantId;
  if (!tenantId) {
    const tenantSlug =
      payload.tenantSlug ??
      (typeof Deno !== "undefined" ? Deno.env.get("DEFAULT_TENANT_SLUG") : undefined) ??
      "parable-master";
    const { data: tenantRow, error: tenantErr } = await supabase
      .schema("parable_ledger")
      .from("tenants")
      .select("id")
      .eq("slug", tenantSlug)
      .maybeSingle();
    if (tenantErr) throw new Error(`Tenant lookup failed: ${tenantErr.message}`);
    if (!tenantRow?.id) {
      throw new Error(`No parable_ledger.tenants row for slug=${tenantSlug}. Run white_label_schema.sql.`);
    }
    tenantId = tenantRow.id;
  }

  let fundId = payload.fundId;
  if (!fundId) {
    const { data: fundRow, error: fundErr } = await supabase
      .schema("parable_ledger")
      .from("ministry_funds")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("fund_code", fundCode)
      .maybeSingle();

    if (fundErr) throw new Error(`Fund lookup failed: ${fundErr.message}`);
    if (!fundRow?.id) {
      throw new Error(
        `No ministry_funds for tenant_id=${tenantId} fund_code=${fundCode}. Run genesis provisioning (provision_new_church) or pass fundId.`,
      );
    }
    fundId = fundRow.id;
  }

  const enrichedMeta = {
    ...metadata,
    tax_lane: taxLane,
    processed_at: new Date().toISOString(),
    stream_router_version: 1,
    ...(userId ? { donor_user_id: userId, parable_user_id: userId } : {}),
  };

  const row = {
    tenant_id: tenantId,
    fund_id: fundId,
    amount: numericAmount,
    tx_type: txType,
    source: `PARABLE_STREAM:${source}`,
    is_tax_deductible: !isUBI,
    contribution_nature: contributionNature,
    is_ubi: isUBI,
    irs_category: irsCategory,
    audit_flag: auditFlag,
    metadata: enrichedMeta,
  };

  const { data, error } = await supabase.schema("parable_ledger").from("transactions").insert(row).select("id").single();

  if (error) throw new Error(`Ledger insertion failed: ${error.message}`);

  return {
    status: "audit_trail_created",
    transactionId: data?.id,
    category: taxLane,
    isUBI,
    contributionNature,
    irsCategory,
    auditFlag,
  };
}
