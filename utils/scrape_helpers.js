// utils/scrape_helpers.js

export function extractPrice(text) {
  // match $12.34 or "$1,299.99"
  const match = text.match(/\$([\d,]+\.\d{2})/);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ""));
}

export function extractSoldCount(text) {
  // matches: 123 sold, 1,234 sold
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

// detect if badly rendered or empty ebay page
export function isEmptyPage(text) {
  if (!text) return true;
  const patterns = [
    "This listing is unavailable",
    "We looked everywhere",
    "ended this listing",
    "This listing was ended",
  ];
  return patterns.some((p) => text.includes(p));
}
