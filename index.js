import express from "express";
import { chromium } from "playwright";

import { pickUserAgent } from "./utils/user_agents.js";
import {
  extractPrice,
  extractSoldCount,
  cleanTitle,
  estimateRevenue
} from "./utils/scrape_helpers.js";
import { isBotBlock, mobileFallback, isCaptcha } from "./utils/anti_bot.js";

const app = express();
app.use(express.json());

// Simple health check
app.get("/", (req, res) => {
  res.send("eBay Playwright stealth scraper is running.");
});

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeOne(url) {
  const ua = pickUserAgent();
  let finalUrl = url;
  let blocked = false;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({
    userAgent: ua,
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const page = await context.newPage();

  try {
    await page.goto(finalUrl, { waitUntil: "networkidle", timeout: 45000 });

    let bodyText = (await page.textContent("body")) || "";

    // Try mobile fallback once if we hit "Pardon Our Interruption"
    if (isBotBlock(bodyText) || isCaptcha(bodyText)) {
      const mobileUrl = mobileFallback(finalUrl);
      if (mobileUrl !== finalUrl) {
        finalUrl = mobileUrl;
        await sleep(1500 + Math.random() * 1500);
        await page.goto(finalUrl, { waitUntil: "networkidle", timeout: 45000 });
        bodyText = (await page.textContent("body")) || "";
        blocked = isBotBlock(bodyText) || isCaptcha(bodyText);
      } else {
        blocked = true;
      }
    }

    const rawTitle =
      (await page.textContent("h1").catch(() => "")) ||
      (await page.title().catch(() => "")) ||
      "";

    const title = cleanTitle(rawTitle);
    const price = extractPrice(bodyText);
    const soldCount = extractSoldCount(bodyText);
    const estimatedRevenue = estimateRevenue(price, soldCount);

    return {
      url,
      final_url: finalUrl,
      ok: !blocked,
      blocked,
      title,
      price,
      currency: price != null ? "USD" : "",
      sold_count: soldCount,
      estimated_revenue: estimatedRevenue
    };
  } catch (err) {
    return {
      url,
      final_url: finalUrl,
      ok: false,
      blocked,
      title: "",
      price: null,
      currency: "",
      sold_count: null,
      estimated_revenue: null,
      error: String(err)
    };
  } finally {
    await browser.close();
  }
}

// POST /scrape  { "urls": ["https://www.ebay.com/itm/...", ...] }
app.post("/scrape", async (req, res) => {
  const urls = Array.isArray(req.body.urls) ? req.body.urls : [];
  if (!urls.length) {
    return res
      .status(400)
      .json({ error: 'Provide JSON body: { "urls": ["https://..."] }' });
  }

  const results = [];
  for (const url of urls) {
    // small random delay between requests (stealth)
    await sleep(500 + Math.random() * 1000);
    results.push(await scrapeOne(url));
  }

  res.json({ results });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
