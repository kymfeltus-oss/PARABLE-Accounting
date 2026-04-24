import { NextResponse } from "next/server";
import { fetchAddedTransactions, mapPlaidToTransactionRow } from "@sovereign/lib/plaid.js";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getGeneralFundId } from "@/lib/ledgerDefaultFund";

export const runtime = "nodejs";

type Body = { tenantId: string; itemId?: string };

/**
 * Pulls new Plaid rows into `parable_ledger.transactions` (also visible via `erp_ledger` view).
 * Every row is `metadata.parable_verification_state = "unverified"` until Autonomous Close / controller clears it.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Set SUPABASE_SERVICE_ROLE_KEY to sync Plaid (server only)." },
      { status: 500 }
    );
  }
  const fundId = await getGeneralFundId(supabase, body.tenantId);
  if (!fundId) {
    return NextResponse.json({ error: "No GEN fund for tenant — run genesis / provision." }, { status: 500 });
  }

  let q = supabase
    .schema("parable_ledger")
    .from("plaid_items")
    .select("id, item_id, access_token, transactions_cursor")
    .eq("tenant_id", body.tenantId);
  if (body.itemId) {
    q = q.eq("item_id", body.itemId);
  }
  const { data: items, error: e1 } = await q;
  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }
  if (!items?.length) {
    return NextResponse.json({ error: "No Plaid items — connect a bank first." }, { status: 400 });
  }

  let inserted = 0;
  const errors: string[] = [];

  for (const row of items) {
    const access = row.access_token as string;
    let nextCur = (row.transactions_cursor as string | null) || undefined;
    let hasMore = true;
    let lastCur: string | null | undefined;
    while (hasMore) {
      const batch = await fetchAddedTransactions(access, nextCur);
      for (const tx of batch.added) {
        const ins = mapPlaidToTransactionRow({
          tx,
          tenantId: body.tenantId,
          fundId,
        });
        const { error: e2 } = await supabase.schema("parable_ledger").from("transactions").insert(ins);
        if (e2) {
          if (e2.message.includes("uq_transactions_tenant_plaid_id") || e2.message.includes("duplicate key")) {
            // idempotent
          } else {
            errors.push(e2.message);
          }
        } else {
          inserted += 1;
        }
      }
      lastCur = batch.nextCursor;
      hasMore = batch.hasMore;
      nextCur = batch.nextCursor;
    }
    const { error: e3 } = await supabase
      .schema("parable_ledger")
      .from("plaid_items")
      .update({ transactions_cursor: lastCur ?? null, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (e3) {
      errors.push(e3.message);
    }
  }

  return NextResponse.json({ inserted, errors: errors.length ? errors : undefined });
}
