import express from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const app = express();
const PORT = process.env.PORT || 10000;

puppeteer.use(StealthPlugin());

app.get("/scrape", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("❌ Missing url parameter");

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: puppeteer.executablePath() // ✅ picks Chrome installed by postinstall
    });

    const page = await browser.newPage();

    let m3u8Urls = [];

    // ✅ Intercept XHR + fetch requests
    await page.setRequestInterception(true);
    page.on("request", (reqIntercept) => {
      reqIntercept.continue();
    });
    page.on("response", async (response) => {
      try {
        const url = response.url();
        if (url.includes(".m3u8")) {
          m3u8Urls.push(url);
        }
      } catch (err) {
        console.error("Response error:", err);
      }
    });

    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // wait for video requests
    await page.waitForTimeout(15000);

    await browser.close();

    if (m3u8Urls.length === 0) {
      return res.send("⚠️ No m3u8 links found.");
    }

    res.json({ m3u8: [...new Set(m3u8Urls)] }); // unique urls
  } catch (err) {
    res.status(500).send(`❌ Scraping failed: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
