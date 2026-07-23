export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatCompactCurrency(amount: number): string {
  if (amount === 0) return "$0";
  return `$${Math.round(amount / 1000)}K`;
}
