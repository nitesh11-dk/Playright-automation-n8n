# ⚡ Browser Automation (Testing Purposes Only)

This repository contains **automation scripts for multiple platforms** (e.g., Instagram, WhatsApp, Facebook, YouTube, etc.) built using **Express + Playwright**.  
They are intended **only for testing, research, and educational use**.  

⚠️ **Important:** Do not use this for spamming or bulk messaging. Doing so may result in your account getting banned. All flows are designed to simulate **human-like behavior**.

---

## 📦 Dependencies

Install once using `pnpm`:

```json
{
  "name": "browser-automation",
  "version": "1.0.0",
  "main": "index.js",
  "license": "ISC",
  "packageManager": "pnpm@10.14.0",
  "dependencies": {
    "express": "^5.1.0",
    "playwright": "^1.54.2"
  }
}
```

---

## 🚀 Setup & Installation

1. Install project dependencies:
   ```bash
   pnpm install
   ```

2. Download required browsers (first run may take 5–8 minutes):
   ```bash
   npx playwright install
   ```

3. Each platform has its own `app.js` file. Run the desired file to start the server:
   ```bash
   node app.js
   ```

---

## 🧩 Sessions & Templates

- Each automation uses a **persistent session folder** so you don’t need to log in every time.  
- Example: `./platform_session` (replace `platform` with Instagram/WhatsApp/etc.).  
- You can also customize **message templates** for testing.  

---

## ⚠️ Disclaimer

- ❌ Do **not** use this for bulk or spam activities.  
- ✅ Use responsibly for **testing, demos, and automation research**.  
- 🚫 Misuse may result in **account restrictions or bans**.  

---

## 📈 SEO Keywords

- Browser Automation with Playwright  
- Express.js Automation Scripts  
- WhatsApp / Instagram / Facebook / YouTube Automation (Testing Only)  
- Browser Automation with Persistent Sessions  
- Human-like Messaging Bot (Educational Use)  

---

## ✅ Summary

- One repository for **multiple social platform automations**.  
- Separate `app.js` files for each platform.  
- Uses **Express + Playwright**.  
- Persistent sessions + editable templates.  
- Designed strictly for **testing purposes only**.  
