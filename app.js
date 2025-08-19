const { chromium } = require("playwright");
const path = require("path");

// Folder to save the session
const userDataDir = path.join(__dirname, "whatsapp_session");

(async () => {
  // Launch browser with user data directory
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // false to see the browser
  });

  const page = await browser.newPage();
  await page.goto("https://web.whatsapp.com");

  console.log("Please scan the QR code if needed...");

  // Wait for chat list to appear (means login successful)
  await page.waitForSelector("._1XkO3", { timeout: 0 });
  console.log("WhatsApp Web loaded and session saved!");

  // Keep browser open
  // await browser.close(); // optional if you want to close automatically
})();
