import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Playwright scraper is running.");
});

app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });

    const title = await page.title();
    const html = await page.content();

    res.json({
      url,
      title,
      length: html.length,
      html,
    });
  } catch (err) {
    res.status(500).json({ error: err.toString() });
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
