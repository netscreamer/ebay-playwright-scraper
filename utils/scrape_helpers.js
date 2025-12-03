// utils/scrape_helpers.js

export function extractPrice(text) {
  if (!text) return null;
  const match = text.match(/\$([\d,]+\.\d{2})/);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ""));
}

export function extractSoldCount(text) {
  if (!text) return null;
  // e.g. "123 sold" or "1,234 sold"
  const match = text.match(/([\d,]+)\s+sold/i);
  if (!match) return null;
  return parseInt(match[1].replace(/,/g, ""));
}

export function cleanTitle(rawTitle) {
  if (!rawTitle) return "";
  return rawTitle.replace(/\s+/g, " ").trim();
}

export function estimateRevenue(price, sold) {
  if (price == null || sold == null) return null;
  return price * sold;
}
