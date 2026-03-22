import { chromium } from 'playwright';
import { setTimeout } from 'timers/promises';

const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || './visual-test-screenshots';
const host = process.env.TEST_HOST || 'localhost';
const port = process.env.TEST_PORT || '3000';
const BASE_URL = process.env.APP_URL || `http://${host}:${port}/app`;

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('Content Security Policy')) {
      console.log(`[BROWSER ERROR] ${msg.text()}`);
    }
  });

  try {
    // ===== STEP 1: Load the app page =====
    console.log('\n=== STEP 1: Load the app page ===');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await setTimeout(3000);
    
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step1a-initial-load.png`, fullPage: false });
    console.log('Screenshot saved: step1a-initial-load.png');

    const title = await page.title();
    console.log(`Page title: "${title}"`);

    // Dismiss the welcome/onboarding modal
    const welcomeBtn = page.locator('button:has-text("I understand")');
    if (await welcomeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Welcome modal detected, dismissing...');
      await welcomeBtn.click();
      await setTimeout(1000);
    }
    
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step1b-app-loaded.png`, fullPage: false });
    console.log('Screenshot saved: step1b-app-loaded.png');
    
    const hasSNAI = await page.locator('text=SN AI Dev Agent').first().isVisible().catch(() => false);
    console.log(`SN AI Dev Agent title visible: ${hasSNAI}`);

    // ===== STEP 2: Connect to ServiceNow =====
    console.log('\n=== STEP 2: Connect to ServiceNow ===');
    
    // The sidebar should be visible on desktop (1440px)
    const sidebar = page.locator('aside').first();
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    console.log(`Sidebar visible: ${sidebarVisible}`);
    
    if (!sidebarVisible) {
      console.log('Trying to open sidebar via header toggle...');
      const toggleBtn = page.locator('button[title*="settings"], button[title*="panel"]').first();
      if (await toggleBtn.isVisible().catch(() => false)) {
        await toggleBtn.click();
        await setTimeout(500);
      }
    }

    // Find the sidebar inputs (the desktop sidebar, not mobile)
    const instanceInput = sidebar.locator('input[type="url"]').first();
    const usernameInput = sidebar.locator('input[placeholder="admin"]').first();
    const passwordInput = sidebar.locator('input[type="password"][placeholder*="••••"]').first();

    console.log('Filling Instance URL...');
    await instanceInput.click();
    await instanceInput.fill(process.env.SN_INSTANCE_URL || 'https://dev12345.service-now.com');
    await setTimeout(300);

    console.log('Filling Username...');
    await usernameInput.click();
    await usernameInput.fill(process.env.SN_USERNAME || 'admin');
    await setTimeout(300);

    console.log('Filling Password...');
    await passwordInput.click();
    await passwordInput.fill(process.env.SN_PASSWORD || 'password');
    await setTimeout(300);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step2a-credentials-filled.png`, fullPage: false });
    console.log('Screenshot saved: step2a-credentials-filled.png');

    // Find the Connect button within the sidebar 
    const connectBtn = sidebar.locator('button:has-text("Connect"):not([disabled])').first();
    const connectEnabled = await connectBtn.isVisible().catch(() => false);
    console.log(`Connect button visible & enabled: ${connectEnabled}`);
    
    if (connectEnabled) {
      console.log('Clicking Connect...');
      await connectBtn.click({ timeout: 5000 });
      
      console.log('Waiting for connection (up to 30s)...');
      let connected = false;
      for (let i = 0; i < 30; i++) {
        await setTimeout(1000);
        const pageContent = await page.locator('body').innerText();
        if (pageContent.toLowerCase().includes('connected') || pageContent.includes('Disconnect')) {
          connected = true;
          console.log(`Connection detected after ${i + 1}s`);
          break;
        }
      }
      
      if (!connected) {
        console.log('WARNING: Connection status not confirmed within 30s, checking page state...');
      }
    } else {
      console.log('Connect button not visible/enabled. Checking disabled Connect button...');
      const disabledConnect = sidebar.locator('button:has-text("Connect")').first();
      const isDisabled = await disabledConnect.getAttribute('disabled');
      console.log(`Connect button disabled attribute: ${isDisabled}`);
      
      // Try clicking via JavaScript to bypass
      console.log('Attempting to click Connect via evaluate...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('aside button'));
        const connectBtn = btns.find(b => b.textContent?.includes('Connect'));
        if (connectBtn) {
          connectBtn.removeAttribute('disabled');
          connectBtn.click();
        }
      });
      
      await setTimeout(5000);
    }

    await setTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step2b-after-connect.png`, fullPage: false });
    console.log('Screenshot saved: step2b-after-connect.png');

    // Describe what we see
    const postConnectText = await page.locator('body').innerText();
    const hasConnected = postConnectText.toLowerCase().includes('connected');
    const hasDisconnect = postConnectText.includes('Disconnect');
    console.log(`Page mentions "connected": ${hasConnected}`);
    console.log(`Page shows "Disconnect" button: ${hasDisconnect}`);

    // ===== STEP 3: Verify Release/Changelog dropdown =====
    console.log('\n=== STEP 3: Verify Release/Changelog dropdown ===');
    
    const releaseBtn = page.locator('button[title="What\'s new"]').first();
    const releaseBtnVisible = await releaseBtn.isVisible().catch(() => false);
    console.log(`Release button visible: ${releaseBtnVisible}`);
    
    if (releaseBtnVisible) {
      await releaseBtn.click();
      await setTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/step3-release-dropdown.png`, fullPage: false });
      console.log('Screenshot saved: step3-release-dropdown.png');
      
      const dropdownText = await page.locator('body').innerText();
      console.log(`Dropdown has "Recent": ${dropdownText.includes('Recent')}`);
      console.log(`Dropdown has "Coming Soon": ${dropdownText.includes('Coming Soon')}`);
      console.log(`Dropdown has "Multi-instance": ${dropdownText.includes('Multi-instance')}`);
      console.log(`Dropdown has "Flow Designer": ${dropdownText.includes('Flow Designer')}`);
      
      // Close it
      await releaseBtn.click();
      await setTimeout(500);
    } else {
      console.log('Release button not found');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/step3-release-not-found.png`, fullPage: false });
    }

    // ===== STEP 4: Verify SuggestionPanel =====
    console.log('\n=== STEP 4: Verify SuggestionPanel ===');
    
    const pageText = await page.locator('body').innerText();
    const tabs = ['Suggestions', 'For you', 'Build', 'Explore', 'Quick', 'Latest Updates'];
    for (const tab of tabs) {
      console.log(`Has "${tab}": ${pageText.includes(tab)}`);
    }
    
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step4-suggestion-panel.png`, fullPage: false });
    console.log('Screenshot saved: step4-suggestion-panel.png');

    // ===== STEP 5: Send a test message =====
    console.log('\n=== STEP 5: Send a test message ===');
    
    // After connecting, the textarea should be enabled
    const chatTextarea = page.locator('textarea:not([disabled])').first();
    const chatTextareaVisible = await chatTextarea.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Enabled chat textarea visible: ${chatTextareaVisible}`);
    
    if (chatTextareaVisible) {
      console.log('Typing message...');
      await chatTextarea.click();
      await chatTextarea.fill('What tables exist on this instance?');
      await setTimeout(500);
      
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/step5a-message-typed.png`, fullPage: false });
      console.log('Screenshot saved: step5a-message-typed.png');
      
      console.log('Sending message...');
      await chatTextarea.press('Enter');
      
      console.log('Waiting for AI response (up to 60s)...');
      let gotResponse = false;
      for (let i = 0; i < 60; i++) {
        await setTimeout(1000);
        const bodyText = await page.locator('body').innerText();
        // Look for AI response markers
        if (bodyText.includes('table') || bodyText.length > (pageText.length + 100)) {
          gotResponse = true;
          console.log(`Content change detected after ${i + 1}s`);
          break;
        }
        if (i % 10 === 9) {
          console.log(`Still waiting... (${i + 1}s)`);
        }
      }
      
      if (!gotResponse) {
        console.log('WARNING: No AI response detected within 60s');
      }
    } else {
      console.log('No enabled textarea found (may need connection first). Trying disabled one...');
      const anyTextarea = page.locator('textarea').first();
      const placeholder = await anyTextarea.getAttribute('placeholder');
      console.log(`Textarea placeholder: "${placeholder}"`);
    }
    
    await setTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step5b-chat-response.png`, fullPage: false });
    console.log('Screenshot saved: step5b-chat-response.png');

    // ===== STEP 6: Verify ChatTOC rail =====
    console.log('\n=== STEP 6: Verify ChatTOC rail ===');
    
    // Hover over the right edge of the main area
    const mainArea = page.locator('main').first();
    if (await mainArea.isVisible()) {
      const box = await mainArea.boundingBox();
      if (box) {
        console.log(`Main area: ${Math.round(box.width)}x${Math.round(box.height)} at (${Math.round(box.x)}, ${Math.round(box.y)})`);
        // Hover near the right edge
        await page.mouse.move(box.x + box.width - 14, box.y + box.height / 2);
        await setTimeout(1500);
        console.log('Hovering at right edge of main area...');
      }
    }
    
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step6-chat-toc.png`, fullPage: false });
    console.log('Screenshot saved: step6-chat-toc.png');

    console.log('\n=== ALL STEPS COMPLETE ===');
    console.log(`All screenshots saved to: ${SCREENSHOTS_DIR}/`);

  } catch (err) {
    console.error('Error during visual test:', err.message);
    console.error(err.stack);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/error-state.png`, fullPage: false }).catch(() => {});
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
