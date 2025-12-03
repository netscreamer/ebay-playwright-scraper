// utils/anti_bot.js

export function isBotBlock(text) {
  if (!text) return false;
  return text.includes("Pardon Our Interruption");
}

export function mobileFallback(url) {
  if (!url.includes("www.ebay.com")) return url;
  return url.replace("www.ebay.com", "m.ebay.com");
}

export function isCaptcha(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const patterns = [
    "verify you are a human",
    "enter the characters",
    "type the text you see",
    "security verification"
  ];
  return patterns.some((p) => lower.includes(p));
}
