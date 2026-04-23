/** Client-side shape of `cfoReportEngine.js` `generateAnnualComplianceSummary` (advisory, modeled). */
export type CfoAnnualReport = {
  tenantId: string;
  fiscalYear: number;
  generatedAt: string;
  governanceScore: { label: string; percent: number; verifiedMandateCount: number; totalMandates: number };
  taxCompliance: {
    payrollStatus: string;
    ubiStatus: string;
    ubiYtd: number;
    form941Quarters: {
      quarter: number;
      label: string;
      isGenerated: boolean;
      eftpsDetected: number;
      eftpsMatchCount: number;
      liabilityModeled: number;
      computedAt: string | null;
    }[];
    nonProfitStanding: string;
  };
  transparency: { donorAck: string; fundSegregation: string };
  shieldSummary: { housingTotal: number; housingTotalLabel: string; taxSaved: number; taxSavedLabel: string };
  housing: { mandateId: string | null; amountUsd: number; documentUrl: string | null; boardLocked: boolean };
  financialPulse: {
    cashOnHand: number;
    estimatedMonthlyOpEx: number;
    daysCashOnHand: number | null;
    operatingReservesNote: string;
    liquidityRatio: number;
  };
  auditTrail: string;
  readiness: {
    irsReady: boolean;
    headline: string;
    pillars: {
      governance: { ok: boolean; label: string };
      transparency: { ok: boolean; label: string };
      tax: { ok: boolean; label: string };
      financial: { ok: boolean; label: string };
    };
  };
};
