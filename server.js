import express from "express";
import puppeteer from "puppeteer";

const app = express();

app.get("/scrape", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing ?url=" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: puppeteer.executablePath("chrome") // ✅ proper chrome path
    });

    const page = await browser.newPage();

    // Intercept network requests to grab m3u8
    let m3u8Links = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes(".m3u8")) {
        m3u8Links.push(url);
      }
    });

    page.on("response", async (resp) => {
      const url = resp.url();
      if (url.includes(".m3u8") && !m3u8Links.includes(url)) {
        m3u8Links.push(url);
      }
    });

    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForTimeout(5000); // give it time to load

    await browser.close();

    if (m3u8Links.length === 0) {
      return res.status(404).json({ error: "No m3u8 links found" });
    }

    res.json({ m3u8: [...new Set(m3u8Links)] }); // remove duplicates
  } catch (err) {
    console.error("Scraping failed:", err.message);
    res.status(500).json({ error: "❌ Scraping failed: " + err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
