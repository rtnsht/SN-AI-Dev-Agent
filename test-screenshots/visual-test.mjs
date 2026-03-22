import { chromium } from "playwright";
import { setTimeout as sleep } from "timers/promises";

const BASE = process.env.APP_URL ? `${process.env.APP_URL}/app` : "http://localhost:3000/app"; // pragma: allowlist secret
const DIR = "/workspace/test-screenshots";
const SN_URL = process.env.SN_INSTANCE_URL || "https://dev181312.service-now.com"; // pragma: allowlist secret
const SN_USER = process.env.SN_USERNAME || "admin";
const SN_PASS = process.env.SN_PASSWORD || "changeme"; // pragma: allowlist secret

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // ─── STEP 1: Load and connect ───
  console.log("\n=== STEP 1: Load /app, dismiss modal, connect ===");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(2000);

  // Dismiss welcome modal
  const welcomeBtn = page.locator("button", { hasText: /I understand/i });
  if (await welcomeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("  Welcome modal detected — clicking dismiss");
    await welcomeBtn.click();
    await sleep(1000);
  }
  await page.screenshot({ path: `${DIR}/step1a-page-loaded.png` });
  console.log("  Screenshot: step1a-page-loaded.png");

  // Fill credentials using React-compatible value setter
  await page.evaluate(({ url, user, pass }) => {
    window.__SN_URL = url;
    window.__SN_USER = user;
    window.__SN_PASS = pass;
  }, { url: SN_URL, user: SN_USER, pass: SN_PASS });

  await page.evaluate(() => {
    const inputs = document.querySelectorAll("input");
    const visible = Array.from(inputs).filter((i) => i.offsetParent !== null);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const urlInput = visible.find((i) => i.type === "url");
    const userInput = visible.find((i) => i.type === "text" && i.placeholder === "admin");
    const pwInput = visible.find((i) => i.type === "password" && i.placeholder === "••••••••");
    const vals = [window.__SN_URL, window.__SN_USER, window.__SN_PASS];
    [urlInput, userInput, pwInput].forEach((el, idx) => {
      if (!el) return;
      setter.call(el, vals[idx]);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
  console.log("  Filled credentials");
  await sleep(500);
  await page.screenshot({ path: `${DIR}/step1b-fields-filled.png` });
  console.log("  Screenshot: step1b-fields-filled.png");

  // Click Connect via JS (the visible non-disabled one; Playwright .click() fails because the first match is hidden)
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "Connect" && b.offsetParent !== null && !b.disabled
    );
    if (btns.length > 0) { btns[0].click(); return true; }
    return false;
  });
  console.log("  Connect clicked via JS:", clicked);

  // Wait for connection
  console.log("  Waiting for connection (up to 45s)...");
  try {
    await page.waitForFunction(
      () => document.body.innerText.includes("System Administrator") || document.body.innerText.includes("Connected"),
      { timeout: 45000 }
    );
    console.log("  Connection established!");
  } catch {
    console.log("  Connection status unclear after 45s");
  }
  await sleep(3000);
  await page.screenshot({ path: `${DIR}/step1c-connected.png` });
  console.log("  Screenshot: step1c-connected.png");

  // ─── STEP 2: Release/Changelog dropdown ───
  console.log("\n=== STEP 2: Release/Changelog dropdown ===");
  const releaseBtn = page.locator("button", { hasText: /Release/i }).first();
  if (await releaseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await releaseBtn.click();
    await sleep(1500);
    console.log("  Clicked Release button");
  }

  const bodyText = await page.locator("body").textContent();
  const recentOk = bodyText.includes("Focus Mode") && bodyText.includes("UI/UX elevation") && bodyText.includes("Header redesign");
  const upcomingOk = bodyText.includes("Multi-instance management") && bodyText.includes("Flow Designer");
  console.log("  DB released entries present:", recentOk);
  console.log("  DB upcoming entries present:", upcomingOk);

  await page.screenshot({ path: `${DIR}/step2-changelog-dropdown.png` });
  console.log("  Screenshot: step2-changelog-dropdown.png");
  await page.keyboard.press("Escape");
  await sleep(500);

  // ─── STEP 3: Send a chat message ───
  console.log("\n=== STEP 3: Send chat message ===");
  const chatArea = page.locator('textarea:not([disabled])').first();
  const chatEnabled = await chatArea.isVisible({ timeout: 5000 }).catch(() => false);
  console.log("  Chat textarea enabled:", chatEnabled);

  if (chatEnabled) {
    await chatArea.click();
    await chatArea.fill("List the custom tables on this instance");
    await sleep(300);
    await chatArea.press("Enter");
    console.log("  Sent: 'List the custom tables on this instance'");

    console.log("  Waiting for AI response (up to 120s)...");
    let responded = false;
    for (let i = 0; i < 24; i++) {
      await sleep(5000);
      const msgCount = await page.evaluate(() => document.querySelectorAll('[id^="msg-"]').length);
      const isStreaming = await page.locator('[class*="animate-spin"]').first().isVisible({ timeout: 500 }).catch(() => false);
      if (msgCount >= 2 && !isStreaming) {
        console.log("  Response complete. Messages:", msgCount);
        responded = true;
        break;
      }
      if (i % 4 === 0) console.log(`  Waiting... msgs=${msgCount} streaming=${isStreaming}`);
    }
    if (!responded) console.log("  Response timeout — taking screenshot of current state");
    await sleep(2000);
    await page.screenshot({ path: `${DIR}/step3-chat-response.png` });
    console.log("  Screenshot: step3-chat-response.png");
  } else {
    console.log("  Chat not available");
    await page.screenshot({ path: `${DIR}/step3-no-chat.png` });
  }

  // ─── STEP 4: Send second message ───
  console.log("\n=== STEP 4: Send second message for ChatTOC ===");
  const chatArea2 = page.locator('textarea:not([disabled])').first();
  const chat2Ok = await chatArea2.isVisible({ timeout: 3000 }).catch(() => false);

  if (chat2Ok) {
    await chatArea2.click();
    await chatArea2.fill("How many business rules are active on the incident table?");
    await sleep(300);
    await chatArea2.press("Enter");
    console.log("  Sent second message");

    console.log("  Waiting for AI response (up to 120s)...");
    let responded = false;
    for (let i = 0; i < 24; i++) {
      await sleep(5000);
      const msgCount = await page.evaluate(() => document.querySelectorAll('[id^="msg-"]').length);
      const isStreaming = await page.locator('[class*="animate-spin"]').first().isVisible({ timeout: 500 }).catch(() => false);
      if (msgCount >= 4 && !isStreaming) {
        console.log("  Response complete. Messages:", msgCount);
        responded = true;
        break;
      }
      if (i % 4 === 0) console.log(`  Waiting... msgs=${msgCount} streaming=${isStreaming}`);
    }
    if (!responded) console.log("  Response timeout");
    await sleep(2000);
    await page.screenshot({ path: `${DIR}/step4-more-messages.png` });
    console.log("  Screenshot: step4-more-messages.png");
  } else {
    console.log("  Chat not available");
    await page.screenshot({ path: `${DIR}/step4-no-chat.png` });
  }

  // ─── STEP 5: ChatTOC hover rail ───
  console.log("\n=== STEP 5: ChatTOC hover rail ===");
  const msgTotal = await page.evaluate(() => document.querySelectorAll('[id^="msg-"]').length);
  console.log("  Total messages:", msgTotal);

  // The TOC rail wrapper might be tiny — use evaluate to check
  const tocInfo = await page.evaluate(() => {
    const wrapper = document.querySelector(".chat-toc-rail-wrapper");
    const rail = document.querySelector(".chat-toc-rail");
    return {
      wrapperExists: !!wrapper,
      wrapperVisible: wrapper ? wrapper.offsetParent !== null : false,
      wrapperRect: wrapper ? wrapper.getBoundingClientRect() : null,
      railExists: !!rail,
      railVisible: rail ? rail.offsetParent !== null : false,
      railRect: rail ? rail.getBoundingClientRect() : null,
    };
  });
  console.log("  TOC info:", JSON.stringify(tocInfo));

  if (tocInfo.wrapperVisible && tocInfo.wrapperRect) {
    // Hover over the rail wrapper using coordinates
    const rect = tocInfo.wrapperRect;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await sleep(1500);

    const flyoutVis = await page.evaluate(() => {
      const f = document.querySelector(".chat-toc-flyout");
      return f ? f.offsetParent !== null : false;
    });
    console.log("  Flyout visible after hover:", flyoutVis);
    await page.screenshot({ path: `${DIR}/step5-toc-hover.png` });
    console.log("  Screenshot: step5-toc-hover.png");

    if (flyoutVis) {
      const entryCount = await page.locator(".chat-toc-flyout button").count();
      console.log("  TOC navigation entries:", entryCount);
      if (entryCount > 0) {
        await page.locator(".chat-toc-flyout button").first().click();
        await sleep(1000);
        await page.screenshot({ path: `${DIR}/step5b-after-nav.png` });
        console.log("  Screenshot: step5b-after-nav.png (after clicking TOC entry)");
      }
    }
  } else {
    console.log("  TOC rail not found or not visible (need 4+ messages, have", msgTotal, ")");
    await page.screenshot({ path: `${DIR}/step5-no-rail.png` });
  }

  // ─── STEP 6: SuggestionPanel tabs ───
  console.log("\n=== STEP 6: SuggestionPanel tabs ===");
  // Suggestion tabs are in the right panel sidebar — check if they're visible
  const tabInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.offsetParent !== null && /^(For you|Build|Explore|Quick|Latest Updates)$/i.test(b.textContent?.trim() || "")
    );
    return btns.map((b) => ({
      text: b.textContent?.trim(),
      rect: b.getBoundingClientRect(),
    }));
  });
  console.log("  Suggestion tabs found:", tabInfo.map((t) => t.text).join(", "));

  if (tabInfo.length > 0) {
    // Click each tab in the right sidebar (they appear as buttons in the Suggestions section)
    for (const label of ["Build", "Explore", "Quick", "Latest Updates", "For you"]) {
      const tab = await page.evaluate((lbl) => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => b.offsetParent !== null && b.textContent?.trim().startsWith(lbl)
        );
        if (btn) { btn.click(); return true; }
        return false;
      }, label);
      if (tab) {
        await sleep(600);
        console.log(`  Clicked "${label}" tab`);
      }
    }
    await page.screenshot({ path: `${DIR}/step6-suggestion-tabs.png` });
    console.log("  Screenshot: step6-suggestion-tabs.png");

    // Switch to a different tab for another screenshot
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.offsetParent !== null && b.textContent?.trim().startsWith("Build")
      );
      if (btn) btn.click();
    });
    await sleep(600);
    await page.screenshot({ path: `${DIR}/step6b-build-tab.png` });
    console.log("  Screenshot: step6b-build-tab.png");
  } else {
    console.log("  No suggestion tabs found");
    await page.screenshot({ path: `${DIR}/step6-no-tabs.png` });
  }

  console.log("\n=== All steps completed ===");
  await browser.close();
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
