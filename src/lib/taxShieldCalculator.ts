export type TaxShieldResult = {
  totalComp: number;
  shieldPercentage: string;
  taxableBasis: number;
  secaBasis: number;
};

/**
 * Illustrative model: housing as a share of total cash compensation.
 * Real ministerial tax outcomes depend on facts, dual status, and professional advice.
 */
export function calculateTaxShield(annualSalary: number, housingAllowance: number): TaxShieldResult {
  const salary = Number(annualSalary) || 0;
  const housing = Number(housingAllowance) || 0;
  const totalComp = salary + housing;

  if (totalComp <= 0) {
    return { totalComp: 0, shieldPercentage: "0.0", taxableBasis: 0, secaBasis: 0 };
  }

  const shieldPercentage = ((housing / totalComp) * 100).toFixed(1);

  return {
    totalComp,
    shieldPercentage,
    taxableBasis: salary,
    secaBasis: totalComp,
  };
}
