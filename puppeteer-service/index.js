const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// ================================
// DUMMY SITE PATH
// ================================
const DUMMY_SITE_PATH = "C:/Users/Dell/OneDrive/Desktop/Government_Document_Assistant/dummy-site/index.html";

// ================================
// AUTOFILL ROUTE
// ================================
app.post("/autofill", async (req, res) => {
  const data = req.body;
  console.log("📥 Received data:", data);

  let browser;

  try {
    // Check file exists before launching browser
    if (!fs.existsSync(DUMMY_SITE_PATH)) {
      throw new Error("Dummy site file not found at: " + DUMMY_SITE_PATH);
    }

    const dummySiteUrl = "file:///" + DUMMY_SITE_PATH;

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--start-maximized"]
    });

    const page = await browser.newPage();

    // Open dummy site
    console.log("🌐 Opening:", dummySiteUrl);
    await page.goto(dummySiteUrl, { waitUntil: "domcontentloaded" });

    // Wait for page to fully render
    await new Promise(r => setTimeout(r, 1500));
    console.log("✅ Page loaded");

    // Close popup if visible
    const popup = await page.$("#referencePopup");
    if (popup) {
      await page.click("#referencePopup button");
      await new Promise(r => setTimeout(r, 500));
      console.log("✅ Popup closed");
    }

    // Autofill all fields using built-in window.autofillForm
    await page.evaluate((d) => window.autofillForm(d), data);
    console.log("✅ Fields filled");

    // Navigate through all steps
    await new Promise(r => setTimeout(r, 600));
    await page.click("#step1 .btn-primary");
    console.log("✅ Step 1 → 2");

    await new Promise(r => setTimeout(r, 600));
    await page.click("#step2 .btn-primary");
    console.log("✅ Step 2 → 3");

    await new Promise(r => setTimeout(r, 600));
    await page.click("#step3 .btn-primary");
    console.log("✅ Step 3 → 4");

    await new Promise(r => setTimeout(r, 600));
    await page.click("#step4 .btn-primary");
    console.log("✅ Step 4 → 5");

    await new Promise(r => setTimeout(r, 600));
    await page.click("#step5 .btn-primary");
    console.log("✅ Step 5 → 6");

    await new Promise(r => setTimeout(r, 600));
    await page.click("#step6 .btn-primary");
    console.log("🎉 Reached payment page — user takes over");

    res.json({ status: "success", message: "Form filled. User is now on payment page." });

  } catch (err) {
    console.error("❌ Puppeteer error:", err.message);
    res.status(500).json({ status: "error", message: err.message });
    if (browser) await browser.close();
  }
});

// ================================
// START SERVER
// ================================
app.listen(4000, () => {
  console.log("🚀 Puppeteer service running on port 4000");
  console.log(
    fs.existsSync(DUMMY_SITE_PATH)
      ? "✅ Dummy site found at: " + DUMMY_SITE_PATH
      : "❌ Dummy site NOT found at: " + DUMMY_SITE_PATH
  );
});