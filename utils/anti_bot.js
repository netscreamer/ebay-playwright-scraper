// utils/anti_bot.js

export function isBotBlock(text) {
  if (!text) return false;
  return text.includes("Pardon Our Interruption");
}

// convert desktop → mobile ebay page
export function mobileFallback(url) {
  return url.replace("www.ebay.com", "m.ebay.com");
}

// optional Turing test detection
export function isCaptcha(text) {
  if (!text) return false;
  const patterns = [
    "verify you are a human",
    "enter the characters",
    "type the text you see",
    "security verification",
  ];
  return patterns.some((p) => text.toLowerCase().includes(p));
}
