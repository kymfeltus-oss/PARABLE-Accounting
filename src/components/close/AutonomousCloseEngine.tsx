"use client";

/**
 * Autonomous (sovereign) month-end close — 4-gate workflow, IRS Guardian + ledger lock, gate_audit_log, Certificate of Financial Integrity.
 * All layout, Tailwind, and “tech-noir” shell live in SovereignCloseWizard.tsx; this file is the public entry for the app route.
 * After the DB has parable_ledger.tenants, a test fetch runs in `load` and a cyan check (✓) may appear next to the “Month-end close” title.
 * Tenant `primary_color` / `accent_color` from BrandProvider → `applyTenantCssVars` sets `--tenant-glow` and `--brand-surface` on `:root`; the interactive 4-gate audit checklist (CloseLedgerAccordion) uses them for glows and accent-styled attestation controls.
 * @see ./SovereignCloseWizard
 */
export { default } from "./SovereignCloseWizard";
