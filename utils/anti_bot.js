// utils/anti_bot.js

/**
 * Very simple bot-wall detection + “Pardon Our Interruption” detector.
 * Returns { blocked: boolean, reason?: string }
 */
export async function runAntiBotChecks(page) {
  let bodyText = "";
  try {
    bodyText = (await page.textContent("body")) || "";
  } catch {
    bodyText = "";
  }

  const lowered = bodyText.toLowerCase();

  if (lowered.includes("pardon our interruption")) {
    return { blocked: true, reason: "PARDON_OUR_INTERRUPTION" };
  }

  if (lowered.includes("security measure")
      || lowered.includes("unusual traffic")
      || lowered.includes("verify you are a human")) {
    return { blocked: true, reason: "SECURITY_MEASURE" };
  }

  return { blocked: false };
}

// default export so `import runAntiBot from "./utils/anti_bot.js"` also works
export default runAntiBotChecks;
