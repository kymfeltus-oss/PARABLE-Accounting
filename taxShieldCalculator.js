// PARABLE: Ledger — Tax Shield logic (Node / tooling copy)
// Calculates the portion of ministerial compensation modeled as shielded from Federal Income Tax
// by the housing allowance designation (illustrative only — not individualized tax advice).

/**
 * @param {number} annualSalary
 * @param {number} housingAllowance
 */
export const calculateTaxShield = (annualSalary, housingAllowance) => {
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
};
