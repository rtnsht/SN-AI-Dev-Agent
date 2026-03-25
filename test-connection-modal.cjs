const puppeteer = require("puppeteer");

(async () => {
  const results = {
    test: "Connection Modal",
    steps: [],
    pass: true,
  };

  function log(step, status, detail = "") {
    const entry = { step, status, detail };
    results.steps.push(entry);
    console.log(`[${status}] ${step}${detail ? " — " + detail : ""}`);
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1400,900",
      ],
      defaultViewport: { width: 1400, height: 900 },
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    // Intercept network to hold the test-connection request
    let delayResolve = null;
    const delayPromise = new Promise((resolve) => { delayResolve = resolve; });
    let interceptActive = false;

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (interceptActive && (url.includes("/api/test-connection") || url.includes("/api/session-start"))) {
        console.log(`  [intercept] Holding: ${url}`);
        delayPromise.then(() => { try { req.continue(); } catch {} });
        return;
      }
      try { req.continue(); } catch {}
    });

    // Step 1: Navigate to /app
    const baseUrl = process.env.APP_URL || ("http://localhost:" + "3000"); // pragma: allowlist secret
    console.log(`\n=== Step 1: Open ${baseUrl}/app ===`);
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle2", timeout: 30000 });
    log("Navigate to /app", "PASS", "Page loaded");

    await new Promise((r) => setTimeout(r, 1000));

    // Dismiss Welcome Modal
    const welcomeDismissed = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find(b => b.textContent.includes("I understand"));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (welcomeDismissed) {
      console.log("  Dismissed Welcome Modal");
      await new Promise((r) => setTimeout(r, 500));
    }

    // Step 2: Fill connection form
    console.log("\n=== Step 2: Fill connection form ===");

    const formFilled = await page.evaluate(() => {
      const result = { url: false, username: false, password: false };
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const visibleInputs = [...document.querySelectorAll("input")].filter(i => i.offsetParent !== null);

      const urlInput = visibleInputs.find(i => i.type === "url");
      if (urlInput) {
        nativeSetter.call(urlInput, 'https://dev99999.service-now.com');
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        urlInput.dispatchEvent(new Event('change', { bubbles: true }));
        result.url = true;
      }

      const usernameInput = visibleInputs.find(i => i.placeholder === "admin");
      if (usernameInput) {
        nativeSetter.call(usernameInput, 'admin');
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
        usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
        result.username = true;
      }

      const pwInput = visibleInputs.find(i => i.type === "password" && i.placeholder === "••••••••");
      if (pwInput) {
        nativeSetter.call(pwInput, 'test');
        pwInput.dispatchEvent(new Event('input', { bubbles: true }));
        pwInput.dispatchEvent(new Event('change', { bubbles: true }));
        result.password = true;
      }

      return result;
    });

    log("Enter Instance URL", formFilled.url ? "PASS" : "FAIL", "https://dev99999.service-now.com");
    log("Enter Username", formFilled.username ? "PASS" : "WARN", formFilled.username ? "admin" : "Not found");
    log("Enter Password", formFilled.password ? "PASS" : "WARN", formFilled.password ? "test" : "Not found");

    if (!formFilled.url) { results.pass = false; throw new Error("URL input not found"); }
    await new Promise((r) => setTimeout(r, 500));

    // Step 3: Click Connect
    console.log("\n=== Step 3: Click Connect ===");

    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Connect" && !b.disabled && b.offsetParent !== null),
      { timeout: 5000 }
    ).catch(() => {});

    interceptActive = true;

    const clickResult = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].filter(b => b.offsetParent !== null).find(b => b.textContent.trim() === "Connect" && !b.disabled);
      if (btn) { btn.click(); return { clicked: true, text: btn.textContent.trim() }; }
      return { clicked: false };
    });

    if (clickResult.clicked) {
      log("Click Connect", "PASS", `Clicked: "${clickResult.text}"`);
    } else {
      log("Click Connect", "FAIL", "No Connect button found");
      results.pass = false;
      throw new Error("Connect button not found");
    }

    // Step 4: Screenshot the connecting modal (request is held by interceptor)
    console.log("\n=== Step 4: Screenshot connecting modal ===");

    let modalFound = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      modalFound = await page.evaluate(() => {
        const els = document.querySelectorAll("div.fixed.inset-0");
        for (const el of els) { if (el.querySelector("svg.animate-spin")) return true; }
        return false;
      });
      if (modalFound) break;
    }

    const modalCheck = await page.evaluate(() => {
      const els = document.querySelectorAll("div.fixed.inset-0");
      for (const el of els) {
        if (!el.querySelector("svg.animate-spin")) continue;
        const box = el.querySelector("div.rounded-xl");
        if (box) {
          const text = box.textContent || "";
          const rect = box.getBoundingClientRect();
          const vw = window.innerWidth, vh = window.innerHeight;
          const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
          return {
            found: true,
            hasSpinner: true,
            stageLabel: /Connecting|Authenticating|Verifying|Waiting/.test(text) ? text.split("...")[0] + "..." : "",
            hasInstanceUrl: text.includes("dev99999"),
            isCentered: Math.abs(cx - vw/2) < 100 && Math.abs(cy - vh/2) < 150,
            text: text.trim(),
          };
        }
      }
      return { found: false };
    });

    await page.screenshot({ path: "/opt/cursor/artifacts/modal-test-connecting.png", fullPage: false });

    if (modalCheck.found) {
      log("Screenshot connecting modal", "PASS", "/opt/cursor/artifacts/modal-test-connecting.png");
      log("Modal has spinner", "PASS");
      log("Modal has stage label", modalCheck.stageLabel ? "PASS" : "FAIL", `"${modalCheck.stageLabel}" (text: "${modalCheck.text}")`);
      log("Modal shows instance URL", modalCheck.hasInstanceUrl ? "PASS" : "FAIL");
      log("Modal is centered overlay", modalCheck.isCentered ? "PASS" : "FAIL");
      if (!modalCheck.stageLabel) results.pass = false;
      if (!modalCheck.hasInstanceUrl) results.pass = false;
    } else {
      log("Screenshot connecting modal", "FAIL", "Modal not detected");
      results.pass = false;
    }

    // Release intercepted request
    interceptActive = false;
    if (delayResolve) delayResolve();

    // Step 5: Wait for connection failure
    console.log("\n=== Step 5: Wait for connection failure ===");
    try {
      await page.waitForFunction(() => {
        const els = document.querySelectorAll("div.fixed.inset-0");
        for (const el of els) { if (el.querySelector("svg.animate-spin")) return false; }
        return true;
      }, { timeout: 60000 });
      log("Connection attempt failed", "PASS", "Modal dismissed");
    } catch {
      log("Connection attempt failed", "FAIL", "Timed out");
      results.pass = false;
    }

    await new Promise((r) => setTimeout(r, 2000));

    // Step 6: Screenshot error state — scroll the error element into view
    console.log("\n=== Step 6: Screenshot error state ===");

    await page.evaluate(() => {
      const alert = document.querySelector('[role="alert"]');
      if (alert) alert.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 300));

    await page.screenshot({ path: "/opt/cursor/artifacts/modal-test-error.png", fullPage: false });
    log("Screenshot error state", "PASS", "/opt/cursor/artifacts/modal-test-error.png");

    // Step 7: Verify modal gone + error in sidebar
    console.log("\n=== Step 7: Verify results ===");

    const finalState = await page.evaluate(() => {
      let modalGone = true;
      for (const el of document.querySelectorAll("div.fixed.inset-0")) {
        if (el.querySelector("svg.animate-spin")) { modalGone = false; break; }
      }

      const alertEl = document.querySelector('[role="alert"]');
      const errorText = alertEl ? alertEl.textContent.substring(0, 300) : "";
      const errorFound = !!alertEl || document.body.innerText.includes("Connection Failed");

      return { modalGone, errorFound, errorText };
    });

    log("Modal GONE after failure", finalState.modalGone ? "PASS" : "FAIL", finalState.modalGone ? "Properly dismissed" : "Still visible!");
    log("Error shows in sidebar", finalState.errorFound ? "PASS" : "FAIL", finalState.errorText || "No error found");

    if (!finalState.modalGone) results.pass = false;
    if (!finalState.errorFound) results.pass = false;

  } catch (err) {
    log("Unexpected error", "FAIL", err.message);
    results.pass = false;
    console.error(err.stack);
  } finally {
    if (browser) await browser.close();
  }

  console.log("\n" + "=".repeat(60));
  console.log(`OVERALL RESULT: ${results.pass ? "PASS" : "FAIL"}`);
  console.log("=".repeat(60));
  for (const s of results.steps) {
    console.log(`  [${s.status}] ${s.step}${s.detail ? " — " + s.detail : ""}`);
  }
  console.log("=".repeat(60));

  process.exit(results.pass ? 0 : 1);
})();
