// PARABLE: Ledger - Public statement & media monitor (stream titles, descriptions, metadata)
// Heuristics inspired by IRS Publication 1828 (political campaign intervention). Not legal advice.
//
// 2026+ product rule: "Public-facing" stream titles, YouTube descriptions, and social metadata are
// scanned strictly. **Internal-only** service transcripts or in-house notes can be marked
// `audience: 'internal'` so this module does not treat church-family discussion as a Johnson Amendment
// copy risk (contrast with published marketing / stream metadata, which remain strict).
//
// Board value (white-label): early warning on public copy before it ships; continuous oversight without
// in-house tax counsel; institutional-grade compliance posture for mid-size and large ministries.

/** Direct intervention style phrases — treat as highest priority. */
const PROHIBITED_PHRASES = [
  "vote for",
  "vote against",
  "support candidate",
  "oppose candidate",
  "re-elect",
  "reelect",
  "defeat the candidate",
  "defeat candidate",
  "political action committee",
  "contribute to the campaign of",
  "contribute to his campaign",
  "contribute to her campaign",
];

/**
 * Indicators of partisan / electioneering content — not automatic “hard fails” alone,
 * but they elevate risk when they appear in organizational communications.
 */
const HIGH_RISK_PHRASES = [
  "republican",
  "democrat",
  "libertarian",
  "green party",
  "independent candidate",
  "endorse", // "endorse" in religious sense exists — pair with other risk in app review
  "partisan",
  "election 2024",
  "election 2025",
  "election 2026",
  "get out the vote",
  "campaign rally",
  "stump speech",
  "on the ballot",
];

/**
 * @param {string} s
 * @returns {string}
 */
function safeLower(s) {
  if (s == null) return "";
  return String(s).toLowerCase().normalize("NFKC");
}

/**
 * @param {string} content — combined title, description, serialized metadata, etc.
 * @param {{ audience?: 'public' | 'internal' }} [opt] — `internal` skips heuristics (e.g. internal sermon transcript, not a stream title)
 * @returns {Array<{ severity: 'CRITICAL'|'HIGH', term: string, reason: string, action: string, layer: 'prohibited'|'high_risk' }>}
 */
export function scanPublicStatements(content, opt) {
  const aud = (opt && opt.audience) || "public";
  if (aud === "internal") {
    return [];
  }
  const violations = [];
  const lower = safeLower(content);
  if (!lower.trim()) {
    return violations;
  }

  for (const phrase of PROHIBITED_PHRASES) {
    const p = phrase.trim().toLowerCase();
    if (p && lower.includes(p)) {
      violations.push({
        severity: "CRITICAL",
        term: p,
        layer: "prohibited",
        reason: "Wording is consistent with political campaign intervention (or explicit PAC / candidate support). Section 501(c)(3) organizations may not participate in political campaigns on behalf of (or in opposition to) any candidate for public office.",
        action: "Remove, retract, or edit the statement immediately. Document the corrective step and retain a board-level record. Consult counsel for any repeat or broad distribution.",
      });
    }
  }

  for (const phrase of HIGH_RISK_PHRASES) {
    const p = phrase.trim().toLowerCase();
    if (p && lower.includes(p)) {
      violations.push({
        severity: "HIGH",
        term: p,
        layer: "high_risk",
        reason:
          "This language may indicate partisan, election, or “endorsement” tone in a public channel. Context matters (e.g. purely historical, internal Bible study) — the organization’s communications must not constitute campaign intervention when viewed in context.",
        action: "Have leadership or counsel review the full post/stream before it stays public. If it could be read as favoring or opposing a candidate, revise to nonpartisan ministry messaging.",
      });
    }
  }

  return dedupeByTerm(violations);
}

/**
 * Deduplicate by matched term, keeping the highest severity.
 * @param {any[]} list
 */
function dedupeByTerm(list) {
  const byTerm = new Map();
  for (const v of list) {
    const t = v.term;
    if (!byTerm.has(t) || (byTerm.get(t).severity === "HIGH" && v.severity === "CRITICAL")) {
      byTerm.set(t, v);
    }
  }
  return [...byTerm.values()];
}

/**
 * Scan a stream or upload bundle: title, long description, and any JSON metadata (tags, VOD fields, etc.).
 * @param {{ title?: string, description?: string, metadata?: object }} bundle
 * @param {{ includeKeys?: string[], audience?: 'public' | 'internal' }} [opt] — if provided, only stringify these keys from metadata; audience for internal vs public copy
 */
export function scanStreamMetadata(bundle, opt) {
  const b = bundle ?? {};
  const parts = [];
  if (b.title) parts.push(`TITLE: ${b.title}`);
  if (b.description) parts.push(`DESCRIPTION: ${b.description}`);

  let metaText = "";
  if (b.metadata && typeof b.metadata === "object") {
    if (opt?.includeKeys?.length) {
      for (const k of opt.includeKeys) {
        if (k in b.metadata) {
          parts.push(`META[${k}]: ${String((b.metadata)[k])}`);
        }
      }
    } else {
      try {
        metaText = JSON.stringify(b.metadata, null, 0);
        parts.push(`METADATA: ${metaText}`);
      } catch {
        parts.push("METADATA: (unserializable)");
      }
    }
  }
  const audience = opt?.audience || "public";
  return scanPublicStatements(parts.join("\n\n"), { audience });
}

/**
 * Merge multiple public channels into one scan (e.g. Vercel + LiveKit title fields).
 * @param {string[]} pieces
 */
export function scanContentBundle(pieces) {
  return scanPublicStatements(
    (pieces || [])
      .map((p) => (p == null ? "" : String(p)))
      .filter((p) => p.length > 0)
      .join("\n\n—\n\n")
  );
}

export default { scanPublicStatements, scanStreamMetadata, scanContentBundle };
