import express from "express";
import { chromium } from "playwright";
import fs from "fs";
import fetch from "node-fetch";
import { PDFDocument } from "pdf-lib";
import path from "path";
import bodyParser from "body-parser";

const PAGE_WIDTH = 1080;
const PAGE_HEIGHT = 1350;
const OUTPUT_DIR = "output";
// const WEBHOOK_URL =
//   "http://localhost:5680/webhook-test/3424fbc1-1cbb-43a4-8da5-e1759e44a2bc";
const WEBHOOK_URL =
  "http://localhost:5680/webhook/3424fbc1-1cbb-43a4-8da5-e1759e44a2bc";

let webhookDataStore = [];

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Helpers (same as before)...

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return await response.arrayBuffer();
}

function calculateDimensions(imgWidth, imgHeight) {
  const widthRatio = PAGE_WIDTH / imgWidth;
  const heightRatio = PAGE_HEIGHT / imgHeight;
  const scale = Math.min(widthRatio, heightRatio);
  return { width: imgWidth * scale, height: imgHeight * scale };
}

async function createPdfFromImages(urls, outputPath) {
  const pdfDoc = await PDFDocument.create();

  for (const url of urls) {
    try {
      const imageBytes = await downloadImage(url);
      const isJpg =
        url.toLowerCase().includes("jpg") || url.toLowerCase().includes("jpeg");
      const isPng = url.toLowerCase().includes("png");

      let image;
      if (isJpg) image = await pdfDoc.embedJpg(imageBytes);
      else if (isPng) image = await pdfDoc.embedPng(imageBytes);
      else continue;

      const { width, height } = calculateDimensions(image.width, image.height);
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawImage(image, {
        x: (PAGE_WIDTH - width) / 2,
        y: (PAGE_HEIGHT - height) / 2,
        width,
        height,
      });
    } catch (err) {
      console.error("Error processing image:", url, err);
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

async function saveSingleImage(url, outputPath) {
  try {
    const imageBytes = await downloadImage(url);
    fs.writeFileSync(outputPath, Buffer.from(imageBytes));
    console.log(`✅ Image saved: ${outputPath}`);
  } catch (err) {
    console.error(`Error saving single image: ${url}`, err);
  }
}

// ? dffdf

async function scrapeAndCreatePDF(instaUrls) {
  const batchData = [];
  let pdfCreated = false;
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  for (const instaPostURL of instaUrls) {
    console.log(`Processing: ${instaPostURL}`);
    await page.goto("https://iqsaved.com/", { waitUntil: "domcontentloaded" });

    await page.fill("input[name='url']", instaPostURL.trim());
    await page.click("button.js__search-submit");

    try {
      await page.waitForSelector(".results__actions a.button__blue", {
        timeout: 15000,
      });
    } catch {
      console.warn(`⚠ Timeout waiting for results on ${instaPostURL}`);
      batchData.push({
        username: "Unknown",
        description: "No results",
        pdfExist: false,
      });
      continue;
    }

    const result = await page.evaluate(() => {
      const urls = Array.from(
        document.querySelectorAll(".results__actions a.button__blue")
      ).map((link) => link.href);

      const usernameEl = document.querySelector(".results__username");
      const username = usernameEl ? usernameEl.innerText.trim() : "";

      const descEl = document.querySelector(".results__text");
      const desc = descEl ? descEl.innerText.trim() : "";

      return { urls, name: username, disc: desc };
    });

    if (!result.urls.length) {
      console.warn(`⚠ No image URL found for: ${instaPostURL}`);
      batchData.push({
        username: result.name || "Unknown",
        description: result.disc || "No images",
        pdfExist: false,
      });
      continue;
    }

    const safeDesc = (result.disc || "post")
      .replace(/[^\w\d-_]+/g, "_")
      .slice(0, 50);
    const safeName = (result.name || "user").replace(/[^\w\d-_]+/g, "_");

    if (result.urls.length === 1) {
      const imageUrl = result.urls[0];
      const ext = imageUrl.toLowerCase().includes("png") ? "png" : "jpg";
      const imagePath = path.join(OUTPUT_DIR, `${safeName}_${safeDesc}.${ext}`);
      await saveSingleImage(imageUrl, imagePath);
      batchData.push({
        username: result.name,
        description: result.disc,
        pdfExist: false,
      });
    } else {
      const pdfFileName = `${safeName}_${safeDesc}.pdf`;
      const pdfPath = path.join(OUTPUT_DIR, pdfFileName);
      await createPdfFromImages(result.urls, pdfPath);
      pdfCreated = true;
      batchData.push({
        username: result.name,
        description: result.disc,
        pdfExist: true,
      });
    }
  }

  await browser.close();

  return batchData;
}

async function sendWebhookBatch() {
  if (!webhookDataStore.length) return { status: "no_data" };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookDataStore),
    });

    let responseBody;
    try {
      responseBody = await res.json();
    } catch (jsonErr) {
      const text = await res.text();
      console.log("Webhook response text:", text);
      responseBody = text;
    }

    webhookDataStore = []; // clear after sending

    return { status: "sent", httpStatus: res.status, responseBody };
  } catch (err) {
    console.error("Webhook send error:", err);
    return { status: "error", error: err.message };
  }
}

app.get("/", (req, res) => {
  res.render("index", {
    message: null,
    scrapedData: webhookDataStore,
  });
});

app.post("/create-pdfs", async (req, res) => {
  try {
    const urls = req.body.urls;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "Invalid or empty URLs array." });
    }

    const resultData = await scrapeAndCreatePDF(urls);

    // Store the data in webhook store (optional)
    webhookDataStore = resultData;

    return res.json({
      message: "Processing complete. Files saved in output folder.",
      scrapedData: resultData,
    });
  } catch (err) {
    console.error("Error in /create-pdfs:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/send-webhook", async (req, res) => {
  try {
    const result = await sendWebhookBatch();

    let displayMessage;
    let generatedPost = null;

    if (
      result.status === "sent" &&
      result.httpStatus >= 200 &&
      result.httpStatus < 300
    ) {
      displayMessage = `✅ Webhook sent successfully! Response ${result.status}`;

      // Assuming your webhook response contains the Generated-post inside result.responseBody
      if (result.responseBody && result.responseBody.generatedPost) {
        generatedPost = result.responseBody.generatedPost;
      }
    } else if (result.status === "no_data") {
      displayMessage = "⚠ No data to send.";
    } else {
      displayMessage = `❌ Something went wrong while sending the webhook. Error: ${
        result.error || "Unknown"
      }`;
    }
    res.json({
      message: displayMessage,
      scrapedData: webhookDataStore,
      generatedPost,
    });
  } catch (err) {
    console.error("Error in /send-webhook:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
