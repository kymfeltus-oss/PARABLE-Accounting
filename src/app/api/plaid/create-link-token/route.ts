import { NextResponse } from "next/server";
import { createLinkToken } from "@sovereign/lib/plaid.js";

export const runtime = "nodejs";

type Body = { tenantId: string; userId: string };

/**
 * Plaid Link token for `react-plaid-link`. `userId` should be a stable in-app id (e.g. Supabase auth `sub`).
 */
export async function POST(request: Request) {
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    return NextResponse.json({ error: "Plaid is not configured (PLAID_*)" }, { status: 500 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.tenantId || !body.userId) {
    return NextResponse.json({ error: "Missing tenantId or userId" }, { status: 400 });
  }
  try {
    const { linkToken, expiration } = await createLinkToken({
      tenantId: body.tenantId,
      userId: body.userId,
    });
    return NextResponse.json({ link_token: linkToken, expiration });
  } catch (e) {
    const m = e instanceof Error ? e.message : "Plaid error";
    return NextResponse.json({ error: m }, { status: 502 });
  }
}
