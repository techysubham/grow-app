import moment from 'moment-timezone';
import {
  enrichOrderLikeAllOrdersSheet,
  prefetchExchangeRatesForOrders,
} from './allOrdersSheetEnrichment.js';

const PT = 'America/Los_Angeles';

export function getSellerAnalyticsPeriodKey(dateSold, groupBy) {
  if (!dateSold) return 'unknown';
  const d = moment(dateSold).tz(PT);
  if (groupBy === 'day') return d.format('YYYY-MM-DD');
  if (groupBy === 'week') return `${d.format('GGGG')}-W${String(d.isoWeek()).padStart(2, '0')}`;
  if (groupBy === 'month') return d.format('YYYY-MM');
  return 'unknown';
}

function createEmptyAnalyticsRow() {
  return {
    totalOrders: 0,
    totalSubtotal: 0,
    totalShipping: 0,
    totalSalesTax: 0,
    totalDiscount: 0,
    totalTransactionFees: 0,
    totalAdFees: 0,
    totalEarnings: 0,
    totalTds: 0,
    totalTid: 0,
    totalPBalanceINR: 0,
    totalAmazonCosts: 0,
    totalCreditCardFees: 0,
    totalProfit: 0,
  };
}

function round2(value) {
  return parseFloat((value || 0).toFixed(2));
}

/** Aggregate orders using the same P.Balance (INR) logic as All Orders Sheet (USD). */
export async function buildSellerAnalyticsFromOrders(orders = [], groupBy = 'day') {
  const rateCache = await prefetchExchangeRatesForOrders(orders);
  const buckets = new Map();

  for (const order of orders) {
    const orderObj = order.toObject ? order.toObject() : { ...order };
    const enriched = enrichOrderLikeAllOrdersSheet(orderObj, rateCache);
    const period = getSellerAnalyticsPeriodKey(enriched.dateSold || enriched.creationDate, groupBy);

    if (!buckets.has(period)) {
      buckets.set(period, createEmptyAnalyticsRow());
    }

    const row = buckets.get(period);
    row.totalOrders += 1;
    row.totalSubtotal += parseFloat(enriched.subtotal) || 0;
    row.totalShipping += parseFloat(enriched.shipping) || 0;
    row.totalSalesTax += parseFloat(enriched.salesTax) || 0;
    row.totalDiscount += parseFloat(enriched.discount) || 0;
    row.totalTransactionFees += parseFloat(enriched.transactionFees) || 0;
    row.totalAdFees += parseFloat(enriched.adFeeGeneral) || 0;
    row.totalEarnings += parseFloat(enriched.orderEarnings) || 0;
    row.totalTds += parseFloat(enriched.tds) || 0;
    row.totalTid += parseFloat(enriched.tid) || 0;
    row.totalPBalanceINR += parseFloat(enriched.pBalanceINR) || 0;
    row.totalAmazonCosts += parseFloat(enriched.amazonTotalINR) || 0;
    row.totalCreditCardFees += parseFloat(enriched.totalCC) || 0;
    row.totalProfit += parseFloat(enriched.profit) || 0;
  }

  return [...buckets.entries()]
    .map(([period, row]) => ({
      period,
      totalOrders: row.totalOrders,
      totalSubtotal: round2(row.totalSubtotal),
      totalShipping: round2(row.totalShipping),
      totalSalesTax: round2(row.totalSalesTax),
      totalDiscount: round2(row.totalDiscount),
      totalTransactionFees: round2(row.totalTransactionFees),
      totalAdFees: round2(row.totalAdFees),
      totalEarnings: round2(row.totalEarnings),
      totalTds: round2(row.totalTds),
      totalTid: round2(row.totalTid),
      totalPBalanceINR: round2(row.totalPBalanceINR),
      totalAmazonCosts: round2(row.totalAmazonCosts),
      totalCreditCardFees: round2(row.totalCreditCardFees),
      totalProfit: round2(row.totalProfit),
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}
