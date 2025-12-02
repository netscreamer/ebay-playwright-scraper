import express from "express";
import { chromium } from "playwright";
import runAntiBot from "./utils/anti_bot.js";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Playwright scraper is running.");
});

app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await runAntiBot(page);

    await page.goto(url, { waitUntil: "networkidle" });

    const title = await page.title();
    const html = await page.content();

    await browser.close();

    res.json({
      url,
      title,
      length: html.length,
      html,
    });

  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log("Server started on port " + port);
});
