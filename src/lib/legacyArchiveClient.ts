"use client";

/**
 * Client-side "Legacy Archive" pillar: encrypt source files with AES-GCM, persist in IndexedDB.
 * In production, replace with server-side vault + KMS and audit trail; this documents the handoff.
 */

const DB_NAME = "parable_sovereign_legacy_v1";
const DB_VER = 1;
const STORE = "encrypted_blobs";

export type LegacyEntryMeta = {
  id: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  createdAt: string;
  kind: "qb_xlsx" | "qbo" | "csv" | "other";
};

type Stored = LegacyEntryMeta & { iv: string; keyJwk: string; ciphertext: string };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) {
        r.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function bufToB64(b: ArrayBuffer) {
  let s = "";
  const u = new Uint8Array(b);
  for (let i = 0; i < u.length; i += 1) s += String.fromCharCode(u[i]);
  return btoa(s);
}

function b64ToBuf(b64: string) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) u[i] = s.charCodeAt(i);
  return u.buffer;
}

function detectKind(name: string): LegacyEntryMeta["kind"] {
  const l = name.toLowerCase();
  if (l.endsWith(".xlsx") || l.endsWith(".xls")) return "qb_xlsx";
  if (l.endsWith(".qbo") || l.endsWith(".iif")) return "qbo";
  if (l.endsWith(".csv") || l.endsWith(".tsv") || l.endsWith(".txt")) return "csv";
  return "other";
}

/**
 * Seals a legacy source file: AES-256-GCM, key + ciphertext stored in-browser for this demo.
 * Production: server vault, separate encryption context, and immutable log row.
 */
export async function archiveLegacyFileClient(file: File): Promise<LegacyEntryMeta> {
  const ab = await file.arrayBuffer();
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, ab);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  const id = crypto.randomUUID();
  const meta: Stored = {
    id,
    filename: file.name,
    sizeBytes: file.size,
    contentType: file.type || "application/octet-stream",
    createdAt: new Date().toISOString(),
    kind: detectKind(file.name),
    iv: bufToB64(iv.buffer),
    keyJwk: JSON.stringify(jwk),
    ciphertext: bufToB64(ct),
  };
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).put(meta);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
  return {
    id: meta.id,
    filename: meta.filename,
    sizeBytes: meta.sizeBytes,
    contentType: meta.contentType,
    createdAt: meta.createdAt,
    kind: meta.kind,
  };
}

export async function listLegacyArchivesClient(): Promise<LegacyEntryMeta[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, "readonly");
    const q = t.objectStore(STORE).getAll();
    q.onsuccess = () => {
      const rows = (q.result as Stored[]).map(({ iv: _i, keyJwk: _k, ciphertext: _c, ...m }) => m);
      resolve(rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    };
    q.onerror = () => reject(q.error);
  });
}

export async function downloadLegacyDecryptedFile(id: string, suggestedName: string) {
  const db = await openDb();
  const rec = await new Promise<Stored>((resolve, reject) => {
    const t = db.transaction(STORE, "readonly");
    const g = t.objectStore(STORE).get(id);
    g.onsuccess = () => resolve(g.result);
    g.onerror = () => reject(g.error);
  });
  const key = await crypto.subtle.importKey("jwk", JSON.parse(rec.keyJwk), { name: "AES-GCM" }, true, [
    "decrypt",
  ]);
  const iv = new Uint8Array(b64ToBuf(rec.iv));
  const ct = b64ToBuf(rec.ciphertext);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  const blob = new Blob([dec], { type: rec.contentType || "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName || rec.filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
