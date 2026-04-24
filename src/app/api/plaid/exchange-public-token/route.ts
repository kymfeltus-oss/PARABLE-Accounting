import { NextResponse } from "next/server";
import { CountryCode } from "plaid";
import { exchangePublicToken, getPlaidClient } from "@sovereign/lib/plaid.js";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

type Body = { publicToken: string; tenantId: string };

/**
 * Exchanges a Link `public_token` and stores `access_token` in `parable_ledger.plaid_items` (server-only).
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.publicToken || !body.tenantId) {
    return NextResponse.json({ error: "Missing publicToken or tenantId" }, { status: 400 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Set SUPABASE_SERVICE_ROLE_KEY to persist Plaid items (server only)." },
      { status: 500 }
  );
  }
  try {
    const { accessToken, itemId } = await exchangePublicToken(body.publicToken);
    const plaid = getPlaidClient();
    const { data: idata } = await plaid.itemGet({ access_token: accessToken });
    const pi = idata.item;
    let institutionName = "Linked institution";
    if (pi.institution_id) {
      try {
        const ir = await plaid.institutionsGetById({ country_codes: [CountryCode.Us], institution_id: pi.institution_id });
        institutionName = ir.data.institution?.name ?? pi.institution_id;
      } catch {
        institutionName = pi.institution_id;
      }
    }

    const { error } = await supabase.schema("parable_ledger").from("plaid_items").upsert(
      {
        tenant_id: body.tenantId,
        item_id: itemId,
        access_token: accessToken,
        institution_name: institutionName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,item_id" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ item_id: itemId, institution: name, ok: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : "Plaid exchange failed";
    return NextResponse.json({ error: m }, { status: 502 });
  }
}
