/** Status values written by eBay sync and legacy rows. */
export const ACTIVE_LISTING_STATUS_VALUES = ['Active', 'ACTIVE', 'active'];

/**
 * Mongo match for rows that should appear on Store Listings.
 * eBay uses "Active"; some code paths used "ACTIVE".
 */
export function activeListingStatusFilter() {
  return { listingStatus: { $in: ACTIVE_LISTING_STATUS_VALUES } };
}

/** Match seller field stored as ObjectId or legacy string. */
export function sellerIdsInMatch(sellerIds) {
  const ids = Array.isArray(sellerIds) ? sellerIds : [sellerIds];
  return { $in: [...new Set(ids.flatMap((id) => [id, String(id)]))] };
}
