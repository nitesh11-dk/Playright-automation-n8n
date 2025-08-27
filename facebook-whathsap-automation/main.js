const express = require("express");
const { chromium } = require("playwright");
const path = require("path");

const userDataDir = path.join(__dirname, "facebook_session");

const app = express();
app.use(express.json());

// === HELPERS ===

// random delay between actions
function randomDelay(min = 1000, max = 3000) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min)
  );
}

// human-like typing
async function humanType(textbox, message) {
  for (const char of message) {
    const delay = 80 + Math.floor(Math.random() * 120); // 80–200ms
    await textbox.type(char, { delay });
  }
}

// === FACEBOOK MESSAGE FUNCTION ===
async function sendFacebookMessage(page, url, message) {
  let sentStatus = false;
  let whatsappLink = null;

  try {
    console.log(`[INFO] Opening Facebook page: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 4000);

    // === 1. Check for WhatsApp button ===
    console.log("[INFO] Checking for WhatsApp button...");
    const waBtn = await page.$('a[aria-label="WhatsApp"]');
    if (waBtn) {
      whatsappLink = await waBtn.getAttribute("href");
      console.log(`[INFO] WhatsApp link found: ${whatsappLink}`);
    }

    // === 2. Click "Message" button ===
    console.log("[INFO] Looking for 'Message' button...");
    const messageBtn = await page.waitForSelector(
      'div[aria-label="Message"][role="button"]',
      { timeout: 15000 }
    );
    await messageBtn.click();
    await randomDelay(2000, 5000);
    console.log("[INFO] Clicked 'Message' button");

    // === 3. Type message ===
    console.log("[INFO] Waiting for message composer...");
    const textbox = await page.waitForSelector(
      'div[role="textbox"][contenteditable="true"][aria-label="Message"]',
      { timeout: 15000 }
    );

    await textbox.fill("");
    await randomDelay(1000, 2000);
    await humanType(textbox, message);
    await randomDelay(500, 1500);
    await page.keyboard.press("Enter");

    console.log(`[SUCCESS] FB message sent to ${url}`);
    sentStatus = true;

    // === 4. Close the chat ===
    console.log("[INFO] Closing chat window...");
    await randomDelay(2000, 4000);

    let closeBtn = await page.$('div[role="button"][aria-label="Close chat"]');
    if (!closeBtn) {
      closeBtn = await page.$('div[role="button"] svg[viewBox="0 0 12 13"]');
    }

    if (closeBtn) {
      await closeBtn.click();
      await randomDelay(1500, 3000);
      console.log("[INFO] Chat window closed.");
    } else {
      console.log("[WARN] Close button not found.");
    }
  } catch (err) {
    console.error(`[ERROR] Failed to send FB message:`, err.message);
    sentStatus = false;
  }

  return { success: true, sentStatus, whatsappLink };
}

// === WHATSAPP MESSAGE FUNCTION ===
async function sendWhatsappMessage(page, rawLink, message) {
  let sentStatus = false;
  let number = null;

  try {
    // Extract phone from raw link (Facebook redirect → api.whatsapp.com)
    const urlParams = new URLSearchParams(new URL(rawLink).search);
    const apiLink = urlParams.get("u") || rawLink;
    const apiParams = new URLSearchParams(new URL(apiLink).search);
    number = apiParams.get("phone") || "";
    number = number.replace("+", "").replace(/\s/g, "");

    console.log(`[INFO] Extracted WhatsApp number: ${number}`);

    if (!number) throw new Error("Could not extract number");

    const waWebUrl = `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(
      message
    )}`;
    console.log(`[INFO] Opening WhatsApp Web: ${waWebUrl}`);

    await page.goto(waWebUrl);
    await randomDelay(2000, 5000);

    await Promise.race([
      page.waitForSelector('[contenteditable="true"][data-tab="10"]', {
        timeout: 15000,
      }),
      page.waitForSelector(
        'div:has-text("Phone number shared via url is invalid.")',
        { timeout: 15000 }
      ),
    ]);

    const invalidDiv = await page.$(
      'div:has-text("Phone number shared via url is invalid.")'
    );
    if (invalidDiv) {
      console.log(`[WARN] Invalid WhatsApp number: ${number}`);
      sentStatus = false;
    } else {
      const sendButton = await page.$('button[data-tab="11"]');
      await randomDelay(2000, 4000);
      if (sendButton) {
        await sendButton.click();
        console.log(`[SUCCESS] WhatsApp message sent to ${number}`);
        sentStatus = true;
      } else {
        console.log(`[WARN] Send button not found for ${number}`);
      }
    }
  } catch (err) {
    console.error(`[ERROR] Failed to send WhatsApp message:`, err.message);
    sentStatus = false;
  }

  return { success: true, sentStatus, number };
}

// === Browser launch once ===
let browserContext;
let page;

(async () => {
  browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: {
      width: 1280 + Math.floor(Math.random() * 100),
      height: 720 + Math.floor(Math.random() * 100),
    },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36",
  });

  page = await browserContext.newPage();
  await page.goto("https://facebook.com");

  console.log("[INFO] Waiting for Facebook to load...");
  await page.waitForTimeout(15000);
  console.log("[INFO] Facebook loaded (login if needed).");
})();

// === ROUTES ===

// Facebook route
app.post("/facebook", async (req, res) => {
  let { url, message } = req.body;
  if (!url || !message) {
    return res
      .status(400)
      .json({ success: false, error: "Missing url or message" });
  }

  console.log(`[INFO] /facebook request for url: ${url}`);
  const result = await sendFacebookMessage(page, url, message);
  res.json(result);
});

// WhatsApp route
app.post("/whatsapp", async (req, res) => {
  let { link, message } = req.body;
  if (!link || !message) {
    return res
      .status(400)
      .json({ success: false, error: "Missing link or message" });
  }

  console.log(`[INFO] /whatsapp request for link: ${link}`);
  const result = await sendWhatsappMessage(page, link, message);
  res.json(result);
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Bot server running at http://localhost:${PORT}`);
});
