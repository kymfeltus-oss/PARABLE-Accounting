/** Strip streaming / hype fields for Audit Mode display and exports. */
const HIDDEN_KEYS = new Set(
  [
    "twitch_emotes",
    "hype_train_level",
    "raid_id",
    "bits_total",
    "subscriber_gift_bomb",
    "channel_points",
    "emote_only_chat",
    "stream_segment",
    "game_skin_drop",
  ].map((k) => k.toLowerCase()),
);

export function sanitizeLedgerMetadataForAudit(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (HIDDEN_KEYS.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}
