export function parseAmazonPriceToNumber(priceValue) {
  const numeric = parseFloat(String(priceValue || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function attachAmazonScrapedPrice(listingPayload, amazonData) {
  if (!listingPayload || typeof listingPayload !== 'object') return listingPayload;
  const amazonScrapedPrice = parseAmazonPriceToNumber(amazonData?.price);
  if (amazonScrapedPrice != null) {
    listingPayload.amazonScrapedPrice = amazonScrapedPrice;
  }
  return listingPayload;
}
