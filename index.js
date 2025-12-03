// index.js — Bright Data Web Unlocker version (no Playwright)

// Hono HTTP server
import { Hono } from "hono";
import { serve } from "@hono/node-server";

// --- Bright Data config from environment ------------------------

const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY || "";
const BRIGHTDATA_ZONE = process.env.BRIGHTDATA_ZONE || "web_unlocker1";

if (!BRIGHTDATA_API_KEY) {
  console.warn(
    "[WARN] BRIGHTDATA_API_KEY is not set. All requests will fail until it is configured."
  );
}

// --- Helper: simple HTML text extraction & parsing ---------------

/**
 * Strip scripts/styles and collapse whitespace to get a text-y body.
 */
function htmlToText(html) {
  if (!html) return "";
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " "); // remove all tags
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/**
 * Try to extract a reasonable title from HTML.
 */
function extractTitle(html) {
  if (!html) return "";

  // 1) <title> tag
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }

  // 2) first <h1>
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    return h1Match[1].replace(/<[^>]+>/g, "").trim();
  }

  return "";
}

/**
 * Extract price, sold_count, and derived revenue from the HTML.
 * This is deliberately simple and regex-based.
 */
function extractEbayMetrics(html) {
  const text = htmlToText(html);

  // Price like $12.34
  const priceMatch = text.match(/\$([\d,]+\.\d{2})/);
  const price = priceMatch
    ? parseFloat(priceMatch[1].replace(/,/g, ""))
    : null;

  // "<number> sold"
  const soldMatch = text.match(/([\d,]+)\s+sold/i);
  const soldCount = soldMatch
    ? parseInt(soldMatch[1].replace(/,/g, ""), 10)
    : null;

  const estimatedRevenue =
    price !== null && soldCount !== null ? price * soldCount : null;

  const currency = price !== null ? "USD" : "";

  return { price, sold_count: soldCount, estimated_revenue: estimatedRevenue, currency };
}

/**
 * Detect eBay bot-block page.
 */
function isPardonOurInterruption(html) {
  if (!html) return false;
  return /pardon our interruption/i.test(html);
}

// --- Bright Data Web Unlocker call -------------------------------

/**
 * Fetch a URL via Bright Data Web Unlocker and return raw HTML.
 */
async function fetchViaBrightData(url) {
  if (!BRIGHTDATA_API_KEY) {
    throw new Error("BRIGHTDATA_API_KEY is not configured");
  }

  const body = {
    zone: BRIGHTDATA_ZONE,
    url,
    method: "GET",  // 👈 THIS is what Bright Data expects
    format: "raw",  // return raw HTML
  };

  const resp = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Bright Data error: HTTP ${resp.status} ${resp.statusText} – ${text.slice(
        0,
        500
      )}`
    );
  }

  const html = await resp.text();
  return html;
}

  // For format: "raw", response body is the target site's HTML.
  const html = await resp.text();
  return html;
}

/**
 * Scrape a single eBay item URL via Bright Data,
 * returning the same shape that the old Playwright version used.
 */
async function scrapeUrl(url) {
  try {
    console.log(`[scrape] Requesting via Bright Data: ${url}`);

    const html = await fetchViaBrightData(url);

    if (!html) {
      return {
        url,
        title: "",
        price: null,
        currency: "",
        sold_count: null,
        estimated_revenue: null,
        ok: false,
        error: "Empty response from Bright Data",
      };
    }

    if (isPardonOurInterruption(html)) {
      return {
        url,
        title: "",
        price: null,
        currency: "",
        sold_count: null,
        estimated_revenue: null,
        ok: false,
        error: "Pardon Our Interruption / bot-block page detected",
      };
    }

    const title = extractTitle(html);
    const { price, sold_count, estimated_revenue, currency } =
      extractEbayMetrics(html);

    return {
      url,
      title: title || "",
      price,
      currency,
      sold_count,
      estimated_revenue,
      ok: true,
    };
  } catch (err) {
    console.error(`[scrape] Error for ${url}:`, err);
    return {
      url,
      title: "",
      price: null,
      currency: "",
      sold_count: null,
      estimated_revenue: null,
      ok: false,
      error: String(err),
    };
  }
}

// --- Hono app / HTTP API -----------------------------------------

const app = new Hono();

app.get("/", (c) =>
  c.text("eBay Bright Data scraper is running. POST /scrape with { urls: [...] }")
);

app.post("/scrape", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const urls = Array.isArray(body.urls) ? body.urls : [];
  if (!urls.length) {
    return c.json(
      { error: 'Provide JSON body like: { "urls": ["https://www.ebay.com/itm/..."] }' },
      400
    );
  }

  // For stability, scrape sequentially.
  const results = [];
  for (const url of urls) {
    const result = await scrapeUrl(url);
    results.push(result);
  }

  return c.json({ results });
});

// --- Start server ------------------------------------------------

const port = Number(process.env.PORT || 8080);

serve(
  {
    fetch: app.fetch,
    port,
  },
  () => {
    console.log(`Starting eBay Bright Data scraper on port ${port}`);
  }
);
