const express = require("express");
const { chromium } = require("playwright");
const path = require("path");

// === CONFIG ===
const userDataDir = path.join(__dirname, "whatsapp_session");

const app = express();
app.use(express.json()); // to parse JSON body

// === HELPER FUNCTION ===
async function sendMessage(page, number, message) {
  let sentStatus = false;

  try {
    console.log(`[INFO] Sending message to ${number}...`);

    const url = `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(
      message
    )}`;
    await page.goto(url);

    // Wait for either message box or invalid number notice
    const result = await Promise.race([
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
      console.log(`[WARN] Number ${number} is invalid`);
      sentStatus = false;
    } else {
      const sendButton = await page.$('button[data-tab="11"]');
      if (sendButton) {
        await sendButton.click();
        console.log(`[SUCCESS] Message sent to ${number}`);
        sentStatus = true;
      } else {
        console.log(`[WARN] Send button not found for ${number}`);
        sentStatus = false;
      }
    }
  } catch (err) {
    console.error(`[ERROR] Failed to send message to ${number}:`, err.message);
    sentStatus = false;
  }

  return { success: true, sentStatus };
}

// Launch browser once and reuse it
let browserContext;
let page;

(async () => {
  browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
  });
  page = await browserContext.newPage();
  await page.goto("https://web.whatsapp.com");

  console.log("[INFO] Waiting for WhatsApp Web to load...");
  await page.waitForSelector('img[alt][draggable="false"][class*="x1n2onr6"]', {
    timeout: 0,
  });
  console.log("[INFO] WhatsApp Web loaded!");
})();

// === EXPRESS ROUTE ===
app.post("/accept", async (req, res) => {
  let { number, message } = req.body;

  if (!number || !message) {
    return res
      .status(400)
      .json({ success: false, error: "Missing number or message" });
  }

  // Keep only the last 10 digits
  number = number.replace(/\D/g, "");
  if (number.length > 10) number = number.slice(-10);

  console.log(`[INFO] Received request for number: ${number}`);

  const result = await sendMessage(page, number, message);
  res.json(result);
});

// Start Express server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
