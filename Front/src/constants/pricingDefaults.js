/** Matches Back/src/utils/pricingCalculator.js DEFAULT_PROFIT_TIERS */
export const DEFAULT_PROFIT_TIERS = [
  { minCost: 0, maxCost: 20, profit: 500 },
  { minCost: 20, maxCost: 40, profit: 900 },
  { minCost: 40, maxCost: null, profit: 1500 },
];

export const DEFAULT_TEMPLATE_PRICING_CONFIG = {
  enabled: true,
  spentRate: 95,
  payoutRate: 87,
  desiredProfit: null,
  saleTax: 10,
  ebayFee: 13.95,
  adsFee: 15,
  tdsFee: 1,
  ebayFixedUsd: 0.4,
  transactionContUsd: 0.24,
  shippingCost: 0,
  taxRate: 10,
  profitTiers: {
    enabled: true,
    tiers: DEFAULT_PROFIT_TIERS.map((t) => ({ ...t })),
  },
};
