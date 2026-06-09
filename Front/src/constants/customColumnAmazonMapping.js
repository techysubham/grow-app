/**
 * Map eBay custom column names (e.g. C:Color) → amazonData keys for direct ASIN auto-fill.
 * Keep in sync with Back/src/utils/customColumnAmazonMapping.js
 */
const CUSTOM_COLUMN_TO_AMAZON_FIELD = {
  color: 'color',
  compatibility: 'compatibility',
  model: 'model',
  material: 'material',
  size: 'size',
  screensize: 'screenSize',
  'screen size': 'screenSize',
  features: 'specialFeatures',
  'special features': 'specialFeatures',
  type: 'productCategory',
  category: 'productCategory',
  'item includes': 'includedComponents',
  'included components': 'includedComponents',
  'form factor': 'formFactor',
  'band material': 'bandMaterial',
  'band width': 'bandWidth',
  'band color': 'bandColor',
  brand: 'brand',
};

export function normalizeCustomColumnKey(ebayField) {
  return String(ebayField || '')
    .replace(/^C:/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function inferAmazonFieldForCustomColumn(ebayField) {
  const key = normalizeCustomColumnKey(ebayField);
  if (!key) return null;
  return CUSTOM_COLUMN_TO_AMAZON_FIELD[key] || null;
}

export function buildCustomColumnFieldConfig(column) {
  const name = column?.name || '';
  const label = column?.displayName || name;
  const inferred = inferAmazonFieldForCustomColumn(name);

  if (inferred) {
    return {
      fieldType: 'custom',
      ebayField: name,
      source: 'direct',
      promptTemplate: '',
      amazonField: inferred,
      transform: inferred === 'compatibility' || inferred === 'specialFeatures' ? 'truncate80' : 'none',
      enabled: true,
      defaultValue: '',
    };
  }

  return {
    fieldType: 'custom',
    ebayField: name,
    source: 'ai',
    promptTemplate: [
      `Output ONLY the value for eBay custom field "${label}" (one short line, max 60 characters).`,
      'Use facts from the Amazon data below. If unknown, output "Does Not Apply".',
      '',
      'Title: {title}',
      'Brand: {brand}',
      'Color: {color}',
      'Compatibility: {compatibility}',
      'Model: {model}',
      'Material: {material}',
      'Size: {size}',
      'Features: {specialFeatures}',
      'Description: {description}',
    ].join('\n'),
    amazonField: '',
    transform: 'none',
    enabled: true,
    defaultValue: '',
  };
}
