import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { PARABLE_DEFAULT_DB_SCHEMA } from "@sovereign/supabaseClient.js";

/**
 * @deprecated use the message from `verifyParableLedgerReachable` (it includes the PostgREST code and server text).
 */
export const PARABLE_SCHEMA_SETUP_MESSAGE =
  "Sovereign link: parable_ledger is not reachable (PostgREST). Expose the schema in the Supabase Data API, run white_label_schema.sql (or repo migrations), then reload the schema cache.";

const SOVEREIGN_LINK_ERR = PARABLE_SCHEMA_SETUP_MESSAGE;

/**
 * Probes `parable_ledger.tenants` with an explicit `.schema("parable_ledger")` (same as `BrandProvider` and the SQL editor),
 * so this check is not affected by a misconfigured `db` option on the client.
 */
export function isParableSchemaAccessError(err: PostgrestError | null | undefined): boolean {
  if (!err) {
    return false;
  }
  const s = (err.message || "").toLowerCase();
  const c = (err.code || "").toUpperCase();
  return (
    c === "PGRST106" ||
    c === "PGRST205" ||
    c === "PGRST301" ||
    s.includes("invalid schema") ||
    s.includes("schema must be one of") ||
    s.includes("schema cache") ||
    s.includes("exposed") ||
    (s.includes("schema") && s.includes("does not exist")) ||
    s.includes("not found in schema") ||
    (s.includes("parable_ledger") && s.includes("could not"))
  );
}

/**
 * @returns { ok: true } | { ok: false; message: string }
 */
export async function verifyParableLedgerReachable(
  supabase: SupabaseClient
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .schema(PARABLE_DEFAULT_DB_SCHEMA)
    .from("tenants")
    .select("id,slug")
    .limit(1);

  if (!error) {
    return { ok: true };
  }
  if (isPermissionish(error)) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: buildParableConnectGuidance(error) };
}

function isPermissionish(err: PostgrestError) {
  const t = (err.message || "").toLowerCase();
  return t.includes("permission denied") || t.includes("row-level") || t.includes("jwt");
}

function buildParableConnectGuidance(err: PostgrestError): string {
  const code = (err.code || "").toUpperCase();
  const raw = (err.message || "").trim() || "unknown";
  const schema = PARABLE_DEFAULT_DB_SCHEMA;
  const docs = "https://supabase.com/docs/guides/api/using-custom-schemas";

  if (code === "PGRST106" || raw.toLowerCase().includes("schema must be one of")) {
    return [
      "The Supabase Data API (PostgREST) cannot use the ledger schema (PGRST106 / schema not in the allow list).",
      "",
      `1) Supabase Dashboard → Project Settings → Data API (or “API” on older UIs) → “Exposed schemas” — set exactly:  public, ${schema}  — then save at the bottom of the page.`,
      "2) In SQL, run: NOTIFY pgrst, 'reload schema';  or wait a few minutes for the API to reload its schema cache.",
      "3) Confirm the `parable_ledger` objects exist: run repo migrations (or `white_label_schema.sql`) on this same database project.",
      "",
      `Full reference: ${docs}`,
      "",
      `PostgREST: [${code}] ${raw}`,
    ].join("\n");
  }
  if (isTenantsOrRelationMissing(err)) {
    return [
      "The `parable_ledger` schema is reachable, but a required object is missing in the database (often relation `tenants` or migrations not applied).",
      "Apply the repo’s Supabase migrations (or `white_label_schema.sql`) to this project, then retry.",
      "",
      `[${code || "SQL"}] ${raw}`,
    ].join("\n");
  }
  if (code === "PGRST205" || code === "PGRST301") {
    return [
      "The API rejected the request for the ledger schema. Check exposed schemas, grants (USAGE on schema), and PostgREST reload.",
      "",
      `PostgREST: [${code}] ${raw}`,
    ].join("\n");
  }
  return [PARABLE_SCHEMA_SETUP_MESSAGE, "", `PostgREST: [${code || "?"}] ${raw}`].join("\n");
}

function isTenantsOrRelationMissing(err: PostgrestError) {
  const s = (err.message || "").toLowerCase();
  return s.includes("42p01") || (s.includes("tenants") && s.includes("does not exist")) || s.includes("does not exist");
}

export { SOVEREIGN_LINK_ERR };
