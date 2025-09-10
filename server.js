const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();

app.get("/extract", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    let found = [];

    // Intercept requests
    page.on("request", request => {
      const rurl = request.url();
      if (rurl.includes(".m3u8")) {
        found.push(rurl);
      }
    });

    // Inject hook for fetch + XHR
    await page.evaluateOnNewDocument(() => {
      const origFetch = window.fetch;
      window.fetch = async (...args) => {
        const res = await origFetch(...args);
        try {
          if (args[0] && args[0].toString().includes(".m3u8")) {
            console.log("🔗 fetch m3u8:", args[0]);
          }
        } catch (e) {}
        return res;
      };

      const origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) {
        try {
          if (url && url.includes(".m3u8")) {
            console.log("🔗 xhr m3u8:", url);
          }
        } catch (e) {}
        return origOpen.apply(this, arguments);
      };
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // wait for requests to happen
    await new Promise(r => setTimeout(r, 8000));

    const unique = [...new Set(found)];
    await browser.close();

    res.json({ page: url, m3u8: unique });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
