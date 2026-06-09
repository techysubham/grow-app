/**
 * Built-in keys on `amazonData` for Direct Mapping → Amazon Source Field dropdown.
 * Keep in sync with `Back/src/utils/asinAutofill.js` / `scraperApiProduct.js`.
 * Extra paths come from Amazon Product Info Columns (`amazonPiSourceOptions`).
 */
export const AMAZON_DIRECT_SOURCE_OPTIONS = [
  { value: 'title', label: 'Amazon Title' },
  { value: 'brand', label: 'Amazon Brand' },
  { value: 'description', label: 'Amazon Description' },
  { value: 'images', label: 'Amazon Images' },
];

/** Placeholders supported in AI prompts (subset of amazonData + joined images). */
export const AMAZON_AI_PLACEHOLDER_CHIPS = [
  '{title}',
  '{brand}',
  '{description}',
  '{review}',
  '{customerReviews}',
  '{price}',
  '{asin}',
  '{images}',
  '{color}',
  '{compatibility}',
  '{model}',
  '{material}',
  '{specialFeatures}',
  '{size}',
  '{screenSize}',
  '{formFactor}',
  '{bandMaterial}',
  '{bandWidth}',
  '{bandColor}',
  '{includedComponents}',
  '{productInformation}',
  '{productCategory}',
  '{itemDimensions}',
  '{waterResistanceLevel}',
  '{availabilityStatus}',
  '{soldBy}',
  '{bestSellersRank}'
];
