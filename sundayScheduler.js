// PARABLE: 24/7 Scheduler — Sunday 23:59 "dry run" for Monday morning CFO health.
// Run with: `node ./sundayScheduler.js` (keep process alive) or use PM2 / Windows Task Scheduler.

import cron from "node-cron";
import { runVirtualController, stageReportForVault } from "./autonomousExecution.js";

const tenantId = process.env.DEFAULT_TENANT_ID;
if (!tenantId) {
  console.warn(
    "[sundayScheduler] DEFAULT_TENANT_ID is not set. Set it in the environment (e.g. .env for the host) so the dry run targets a real tenant."
  );
}

// 23:59 every Sunday
cron.schedule(
  "59 23 * * 0",
  async () => {
    console.log("Triggering Sunday Night Sovereign Health Check...");
    const id = tenantId || "00000000-0000-0000-0000-000000000000";
    const report = await runVirtualController(id, {
      yearMonth: new Date().toISOString().slice(0, 7),
      autoBook: {
        bankLines: [
          { description: "ACH Tithe / offering aggregate", amount: 4200 },
          { description: "Utilities — city electric", amount: 512 },
        ],
        coa: [{ account_code: 4010 }, { account_code: 6050 }, { account_code: 4020 }, { account_code: 7100 }],
      },
      compliance: { openViolationCount: 0, criticalCount: 0 },
      reconcile: { recState: { perfectMatches: 2, fuzzyMatches: 0 } },
      stewardship: { noDeficitLeak: true, releaseMatchesExpense: true },
    });
    const staged = await stageReportForVault(report);
    if (staged.ok) {
      console.log(`[sundayScheduler] Staged for CFO path: ${staged.file}`);
    } else {
      console.error(`[sundayScheduler] Staging failed: ${staged.error}`);
    }
  },
  { timezone: process.env.SUNDAY_CRON_TZ || "America/Chicago" }
);

console.log("[sundayScheduler] Active — next window: 23:59 every Sunday (", process.env.SUNDAY_CRON_TZ || "America/Chicago", ")");
