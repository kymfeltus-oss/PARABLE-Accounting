/** Parse #RRGGBB or #RGB into space-separated R G B for Tailwind / CSS `rgb(var(--x) / a)`. */
export function hexToRgbSpace(hex: string): string | null {
  const raw = hex.trim().replace(/^#/, "");
  if (!raw) return null;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (full.length !== 6) return null;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r} ${g} ${b}`;
}

export function applyTenantCssVars(root: HTMLElement, primaryHex: string, accentHex: string, cyberHex?: string) {
  const glowRgb = hexToRgbSpace(primaryHex);
  const accentRgb = hexToRgbSpace(accentHex);
  const cyber = cyberHex ?? primaryHex;
  const cyberRgb = hexToRgbSpace(cyber) ?? glowRgb;
  root.style.setProperty("--brand-glow", primaryHex);
  if (glowRgb) root.style.setProperty("--brand-glow-rgb", glowRgb);
  root.style.setProperty("--brand-surface", accentHex);
  if (accentRgb) root.style.setProperty("--brand-surface-rgb", accentRgb);
  root.style.setProperty("--brand-cyber", cyber);
  if (cyberRgb) root.style.setProperty("--brand-cyber-rgb", cyberRgb);
}
