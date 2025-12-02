# eBay Playwright Scraper (Leapcell)

Cloud browser worker for scraping eBay item pages using Playwright.
Provides JSON endpoint:

POST /scrape
{
  "urls": ["https://www.ebay.com/itm/..."]
}
