const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ HLS Extractor running. Use /scrape?url=YOUR_URL");
});

// Scrape route
app.get("/scrape", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send("❌ Please provide ?url= parameter");
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    const captured = [];

    // Hook XHR and fetch
    await page.setRequestInterception(true);
    page.on("request", reqInt => {
      if (reqInt.resourceType() === "xhr" || reqInt.resourceType() === "fetch") {
        captured.push(reqInt.url());
      }
      reqInt.continue();
    });

    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait extra (player usually loads m3u8 within 5–10s)
    await page.waitForTimeout(10000);

    await browser.close();

    res.json({
      url: targetUrl,
      captured
    });
  } catch (err) {
    if (browser) await browser.close();
    console.error("Error:", err);
    res.status(500).send("❌ Scraping failed: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
