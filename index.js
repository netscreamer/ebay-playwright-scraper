import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Playwright eBay scraper is running.");
});

// POST /scrape { "urls": ["https://www.ebay.com/itm/...", ...] }
app.post("/scrape", async (req, res) => {
  const urls = Array.isArray(req.body.urls) ? req.body.urls : [];
  if (!urls.length) {
    return res.status(400).json({ error: "Provide JSON { \"urls\": [\"https://...\"] }" });
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    const results = [];
    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
        const title = (await page.title()) || "";
        const bodyText = (await page.textContent("body")) || "";
        results.push({
          url,
          ok: true,
          title: title.trim(),
          body_length: bodyText.length,
        });
      } catch (e) {
        results.push({
          url,
          ok: false,
          error: String(e),
        });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error("Fatal scraper error:", err);
    res.status(500).json({ error: String(err) });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
