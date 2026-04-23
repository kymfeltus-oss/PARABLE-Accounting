/**
 * "Safe zone" for demonstrations — not a cryptographically secure boundary.
 * When simulation is on, E-file / EFTPS / real bank should be no-ops or mock-only in UI.
 */
export const DEMO_SAFETY_COPY =
  "Simulation / demo mode: no IRS, bank, or e-file connections are used. All figures are illustrative.";

export function eftpsLinkWhenDemo(isDemo: boolean): { href: string; external: boolean; title: string } {
  if (isDemo) {
    return { href: "#", external: false, title: "MOCK: open EFTPS in live mode" };
  }
  return { href: "https://www.eftps.gov", external: true, title: "IRS EFTPS" };
}

export function workpaperIsSimulationOnly(isDemo: boolean): string {
  return isDemo
    ? " // SIMULATION — NOT A FILING — ILLUSTRATIVE ONLY // "
    : "";
}
