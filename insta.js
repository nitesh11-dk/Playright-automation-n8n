import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

const userDataDir = "./instagram_session"; // persistent profile

// Helper function to send Instagram message
// Helper function to send Instagram message
async function sendInstagramMessage(page, username, message) {
  try {
    console.log(`[INFO] Sending message to @${username}...`);

    // Go to the user's profile
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "domcontentloaded",
    });

    // Wait and click "Message" button
    await page.waitForSelector("text=Message", { timeout: 10000 });
    await page.click("text=Message");

    // Type the message
    const messageBox = page.locator(
      'div[aria-label="Message"][contenteditable="true"]'
    );
    await messageBox.click();

    for (const char of message) {
      await page.keyboard.type(char, { delay: 80 + Math.random() * 120 });
    }

    // Press Enter to send the message instead of clicking a button
    await page.keyboard.press("Enter");

    console.log(`[SUCCESS] Message sent to @${username}`);
    return { success: true };
  } catch (err) {
    console.error(
      `[ERROR] Failed to send message to @${username}:`,
      err.message
    );
    return { success: false, error: err.message };
  }
}

// Launch browser once
let browserContext;
let page;

(async () => {
  browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: null,
  });
  page = await browserContext.newPage();
  await page.goto("https://www.instagram.com");
  console.log("[INFO] Instagram loaded! Please login if needed.");
})();

// Express route
app.post("/instagram", async (req, res) => {
  const { username, message } = req.body;

  if (!username || !message) {
    return res
      .status(400)
      .json({ success: false, error: "Missing username or message" });
  }

  const result = await sendInstagramMessage(page, username, message);

  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(500).json(result);
  }
});

// Start Express server
const PORT = 3001; // different port to avoid clash with WhatsApp
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Instagram server running on http://localhost:${PORT}`);
});
