/**
 * INR profit from sold (USD) using the same settlement model as Back/src/utils/pricingCalculator.js.
 */

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveSellParams(breakdown, pricingConfig) {
  const saleTaxPct =
    breakdown.saleTax !== undefined && breakdown.saleTax !== null
      ? num(breakdown.saleTax)
      : pricingConfig?.saleTax !== undefined && pricingConfig?.saleTax !== null
        ? num(pricingConfig.saleTax)
        : 10;
  const ebayFeePct =
    breakdown.ebayFee !== undefined && breakdown.ebayFee !== null
      ? num(breakdown.ebayFee)
      : pricingConfig?.ebayFee !== undefined && pricingConfig?.ebayFee !== null
        ? num(pricingConfig.ebayFee)
        : 13.95;
  const adsFeePct =
    breakdown.adsFee !== undefined && breakdown.adsFee !== null
      ? num(breakdown.adsFee)
      : pricingConfig?.adsFee !== undefined && pricingConfig?.adsFee !== null
        ? num(pricingConfig.adsFee)
        : 15;
  const tdsFeePct =
    breakdown.tdsFee !== undefined && breakdown.tdsFee !== null
      ? num(breakdown.tdsFee)
      : pricingConfig?.tdsFee !== undefined && pricingConfig?.tdsFee !== null
        ? num(pricingConfig.tdsFee)
        : 1;
  const ebayFixedUsd =
    breakdown.ebayFixedUsd !== undefined && breakdown.ebayFixedUsd !== null
      ? num(breakdown.ebayFixedUsd)
      : pricingConfig?.ebayFixedUsd !== undefined && pricingConfig?.ebayFixedUsd !== null
        ? num(pricingConfig.ebayFixedUsd)
        : 0.4;
  const transactionContUsd =
    breakdown.transactionContUsd !== undefined && breakdown.transactionContUsd !== null
      ? num(breakdown.transactionContUsd)
      : pricingConfig?.transactionContUsd !== undefined && pricingConfig?.transactionContUsd !== null
        ? num(pricingConfig.transactionContUsd)
        : 0.24;

  const mult = 1 + saleTaxPct / 100;
  return { saleTaxPct, ebayFeePct, adsFeePct, tdsFeePct, ebayFixedUsd, transactionContUsd, mult };
}

/**
 * Legacy fee-multiplier inverse (old API breakdowns before settlement_v1).
 */
function calcInrFromLegacyFeeMultiplier(breakdown, pricingConfig, soldUsd) {
  const payoutRate =
    num(breakdown.payoutRate, 0) ||
    num(pricingConfig?.payoutRate, 0) ||
    (num(breakdown.payoutUSD, 0) > 0
      ? num(breakdown.profitComponent, 0) / num(breakdown.payoutUSD, 0)
      : 0);

  const feeMultiplier = num(breakdown.feeMultiplier, 0);
  const fixedFee = num(breakdown.fixedFee, 0);
  const buyingPriceINR = num(breakdown.buyingPriceINR, 0);

  if (!payoutRate || payoutRate <= 0 || !feeMultiplier || feeMultiplier <= 0) return null;

  const profitComponent = soldUsd * feeMultiplier * payoutRate - fixedFee;
  const profitINR = profitComponent - buyingPriceINR;

  return {
    mode: 'legacy_fee_multiplier',
    profitINR: Math.round(profitINR * 100) / 100,
    profitComponent: Math.round(profitComponent * 100) / 100,
    buyingPriceINR: Math.round(buyingPriceINR * 100) / 100,
    feeMultiplier,
    payoutRate,
    spentRate: breakdown.spentRate ?? pricingConfig?.spentRate,
    targetProfitINR: breakdown.applicableProfit ?? breakdown.desiredProfit,
    saleTax: breakdown.saleTax ?? pricingConfig?.saleTax ?? 0,
    ebayFee: breakdown.ebayFee ?? pricingConfig?.ebayFee ?? 12.9,
    adsFee: breakdown.adsFee ?? pricingConfig?.adsFee ?? 3,
    tdsFee: breakdown.tdsFee ?? pricingConfig?.tdsFee ?? 1,
    fixedFee: num(breakdown.fixedFee, 0),
    buyingPriceUSD: breakdown.buyingPriceUSD,
    cost: breakdown.cost
  };
}

/**
 * @param {object} breakdown - pricingCalculation.breakdown from API
 * @param {object} [pricingConfig] - optional template config
 * @param {number} soldUsd - current start price (USD)
 * @returns {null | object}
 */
export function calcInrProfitFromPricingCalculator(breakdown, pricingConfig, soldUsd) {
  if (!breakdown || soldUsd == null || Number.isNaN(soldUsd) || soldUsd <= 0) return null;

  if (breakdown.pricingModel !== 'settlement_v1') {
    return calcInrFromLegacyFeeMultiplier(breakdown, pricingConfig, soldUsd);
  }

  const spent =
    num(breakdown.spentRate, 0) || num(pricingConfig?.spentRate, 0);
  const payout =
    num(breakdown.payoutRate, 0) || num(pricingConfig?.payoutRate, 0);
  const buyingInr =
    num(breakdown.buyingPriceINR, 0) ||
    (() => {
      const c = num(breakdown.buyingPriceUSD, 0);
      return c > 0 ? c * spent : 0;
    })();

  if (!spent || spent <= 0 || !payout || payout <= 0) return null;

  const p = resolveSellParams(breakdown, pricingConfig);
  const A = soldUsd * p.mult;
  const eBay = A * (p.ebayFeePct / 100) + p.ebayFixedUsd;
  const ads = A * (p.adsFeePct / 100);
  const tds = A * (p.tdsFeePct / 100);
  const net = soldUsd - eBay - ads - tds - p.transactionContUsd;
  const payoneerInr = net * payout;
  const profitINR = payoneerInr - buyingInr;

  return {
    mode: 'settlement_v1',
    profitINR: Math.round(profitINR * 100) / 100,
    targetProfitINR: breakdown.applicableProfit ?? breakdown.desiredProfit,
    spentRate: spent,
    payoutRate: payout,
    buyingPriceINR: Math.round(buyingInr * 100) / 100,
    buyingPriceUSD: breakdown.buyingPriceUSD,
    cost: breakdown.cost,
    soldPlusTax: Math.round(A * 100) / 100,
    saleTax: p.saleTaxPct,
    ebayFee: p.ebayFeePct,
    adsFee: p.adsFeePct,
    tdsFee: p.tdsFeePct,
    ebayFixedUsd: p.ebayFixedUsd,
    transactionContUsd: p.transactionContUsd,
    eBayFeeUsd: Math.round(eBay * 100) / 100,
    adsFeeUsd: Math.round(ads * 100) / 100,
    tdsFeeUsd: Math.round(tds * 100) / 100,
    netUsd: Math.round(net * 100) / 100,
    payoneerInr: Math.round(payoneerInr * 100) / 100
  };
}
