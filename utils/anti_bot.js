// utils/anti_bot.js

// You can rename this however you want; the *default* is what matters
async function runAntiBot(page) {
  const text = (await page.textContent("body")) || "";

  // Super simple bot check — you can expand this later
  if (text.includes("Pardon Our Interruption")) {
    return {
      blocked: true,
      reason: "PARDON_OUR_INTERRUPTION"
    };
  }

  if (text.includes("To continue, please verify")) {
    return {
      blocked: true,
      reason: "CAPTCHA_OR_VERIFICATION"
    };
  }

  return {
    blocked: false,
    reason: ""
  };
}

// *** This is the key line ***
export default runAntiBot;
