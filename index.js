// index.js — Bright Data Web Unlocker version

import { Hono } from "hono";
import { serve } from "@hono/node-server";

// --- Environment ----------------------------------------------------

const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY || "";
const BRIGHTDATA_ZONE = process.env.BRIGHTDATA_ZONE || "web_unlocker1";

if (!BRIGHTDATA_API_KEY) {
  console.warn("[WARN] BRIGHTDATA_API_KEY is not set.");
}

// --- Helpers ---------------------------------------------------------

function htmlToText(html) {
  if (!html) return "";
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function extractTitle(html) {
  if (!html) return "";
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return h1Match[1].replace(/<[^>]+>/g, "").trim();
  return "";
}

function extractEbayMetrics(html) {
  const text = htmlToText(html);
  const priceMatch = text.match(/\$([\d,]+\.\d{2})/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, "")) : null;
  const soldMatch = text.match(/([\d,]+)\s+sold/i);
  const soldCount = soldMatch ? parseInt(soldMatch[1].replace(/,/g, ""), 10) : null;

  return {
    price,
    sold_count: soldCount,
    estimated_revenue: price && soldCount ? price * soldCount : null,
    currency: price ? "USD" : "",
  };
}

function isPardonOurInterruption(html) {
  return /pardon our interruption/i.test(html || "");
}

// --- Bright Data Request --------------------------------------------

async function fetchViaBrightData(url) {
  if (!BRIGHTDATA_API_KEY) throw new Error("BRIGHTDATA_API_KEY not set");

  const body = {
    zone: BRIGHTDATA_ZONE,
    url,
    product: "unlocker",
    method: "api",
    format: "raw",
  };

  const resp = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BRIGHTDATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Bright Data error ${resp.status}: ${errText}`);
  }

  return await resp.text();
}

// --- Scraper ---------------------------------------------------------

async function scrapeUrl(url) {
  try {
    console.log(`[scrape] ${url}`);

    const html = await fetchViaBrightData(url);

    if (!html) {
      return { url, ok: false, error: "Empty response" };
    }

    if (isPardonOurInterruption(html)) {
      return { url, ok: false, error: "Bot-block page detected" };
    }

    const title = extractTitle(html);
    const { price, sold_count, estimated_revenue, currency } =
      extractEbayMetrics(html);

    return {
      url,
      title,
      price,
      currency,
      sold_count,
      estimated_revenue,
      ok: true,
    };
  } catch (e) {
    return {
      url,
      ok: false,
      error: e.message || String(e),
    };
  }
}

// --- HTTP API --------------------------------------------------------

const app = new Hono();

app.get("/", (c) =>
  c.text("Bright Data eBay scraper is running. POST /scrape")
);

app.post("/scrape", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const urls = Array.isArray(body.urls) ? body.urls : [];
  if (!urls.length) {
    return c.json({ error: "Expected { urls: [] }" }, 400);
  }

  const results = [];
  for (const url of urls) {
    results.push(await scrapeUrl(url));
  }

  return c.json({ results });
});

// --- Server ----------------------------------------------------------

const port = Number(process.env.PORT || 8080);

serve(
  { fetch: app.fetch, port },
  () => console.log(`Bright Data scraper running on port ${port}`)
);
