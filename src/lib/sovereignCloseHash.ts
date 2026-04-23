/**
 * SHA-256 over a stable JSON string of the close snapshot (tamper evidence).
 */
export function stableStringify(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return `[${v.map(stableStringify).join(",")}]`;
  }
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    const k = Object.keys(o).sort();
    return `{${k.map((key) => JSON.stringify(key) + ":" + stableStringify(o[key])).join(",")}}`;
  }
  return JSON.stringify(v);
}

export async function hashPayloadJsonStable(obj: unknown): Promise<string> {
  const body = stableStringify(obj);
  if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
    return `nohash:${btoa(encodeURIComponent(body).slice(0, 200))}`;
  }
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
