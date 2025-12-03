// index.js
import { chromium } from "playwright";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import runAntiBotChecks from "./utils/anti_bot.js";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
];

function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Extracts basic data from an eBay item page.
 * This is deliberately simple; we can tune selectors later.
 */
async function extractEbayData(page) {
  // Title
  let title = "";
  try {
    const titleLocator = page.locator("h1").first();
    if (await titleLocator.count()) {
      title = (await titleLocator.innerText()).trim();
    } else {
      title = (await page.title()) || "";
    }
  } catch {
    title = "";
  }

  // Use full body text for regex matching
  let text = "";
  try {
    text = (await page.textContent("body")) || "";
  } catch {
    text = "";
  }

  // Price: first $xx.xx we see
  const priceMatch = text.match(/\$([\d,]+\.\d{2})/);
  const price = priceMatch
    ? parseFloat(priceMatch[1].replace(/,/g, ""))
    : null;

  // "123 sold" or "123 sold in last 24 hours"
  const soldMatch = text.match(/([\d,]+)\s+sold(?! listings)/i);
  const soldCount = soldMatch
    ? parseInt(soldMatch[1].replace(/,/g, ""), 10)
    : null;

  const estimatedRevenue =
    price !== null && soldCount !== null ? price * soldCount : null;

  return {
    title,
    price,
    currency: price !== null ? "USD" : "",
    sold_count: soldCount,
    estimated_revenue: estimatedRevenue
  };
}

/**
 * Scrape a single URL with Playwright.
 */
async function scrapeUrl(url) {
  const ua = pickUserAgent();
  let browser;

  // Try to launch Chromium safely
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
  } catch (err) {
    console.error("Failed to launch Chromium:", err);
    return {
      url,
      title: "",
      price: null,
      currency: "",
      sold_count: null,
      estimated_revenue: null,
      ok: false,
      blocked: false,
      error: "CHROMIUM_LAUNCH_FAILED: " + String(err)
    };
  }

  const context = await browser.newContext({
    userAgent: ua,
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 45000
    });

    const botResult = await runAntiBotChecks(page);
    if (botResult.blocked) {
      return {
        url,
        title: botResult.reason || "",
        price: null,
        currency: "",
        sold_count: null,
        estimated_revenue: null,
        ok: false,
        blocked: true,
        error: botResult.reason
      };
    }

    const data = await extractEbayData(page);

    return {
      url,
      ...data,
      ok: true,
      blocked: false
    };
  } catch (err) {
    console.error("Error scraping", url, err);
    return {
      url,
      title: "",
      price: null,
      currency: "",
      sold_count: null,
      estimated_revenue: null,
      ok: false,
      blocked: false,
      error: String(err)
    };
  } finally {
    await browser.close();
  }
}

const app = new Hono();

app.get("/", (c) => c.text("eBay Playwright scraper is running."));

app.post("/scrape", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const urls = Array.isArray(body.urls) ? body.urls : [];

  if (!urls.length) {
    return c.json(
      { error: 'Provide JSON body: { "urls": ["https://..."] }' },
      400
    );
  }

  const results = [];

  // Sequential for now (more stable, less likely to trigger WAF)
  for (const url of urls) {
    console.log("Scraping:", url);
    // Filter to /itm/ URLs only – optional but wise
    if (!url.includes("ebay.com/itm/")) {
      results.push({
        url,
        title: "Skipped (not an item URL)",
        price: null,
        currency: "",
        sold_count: null,
        estimated_revenue: null,
        ok: false,
        blocked: false
      });
      continue;
    }
    results.push(await scrapeUrl(url));
  }

  return c.json({ results });
});

const port = Number(process.env.PORT) || 8080;
console.log(`Starting eBay Playwright scraper on port ${port}`);
serve({ fetch: app.fetch, port });
