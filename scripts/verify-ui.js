const { chromium } = require('playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/hetvi/.gemini/antigravity/brain/c1d44be6-5800-4f39-9ce4-eeae47462f41';

async function run() {
  console.log('Launching browser with node...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    // 1. Load app
    console.log('Navigating to http://localhost:5173/ ...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 2. Open Campaigns Tab
    console.log('Checking Unified Campaigns Tab...');
    await page.click('button:has-text("Campaigns")');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '01-campaigns-unified-view.png'),
      fullPage: false
    });
    console.log('Captured 01-campaigns-unified-view.png');

    // 3. Open Campaign Members for Verified Contact Test Campaign
    console.log('Opening Campaign Members modal...');
    const membersBtn = page.locator('button:has-text("Members")').first();
    await membersBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '02-campaign-members-verified-contacts.png'),
      fullPage: false
    });
    console.log('Captured 02-campaign-members-verified-contacts.png');

    // Close members modal by clicking the X button in its header
    console.log('Closing Campaign Members modal...');
    await page.evaluate(() => {
      const xBtns = Array.from(document.querySelectorAll('button'));
      const closeBtn = xBtns.find(b => b.querySelector('svg.lucide-x') && b.closest('div[style*="position: fixed"]'));
      if (closeBtn) closeBtn.click();
    });
    await page.waitForTimeout(1000);

    // 4. Open Accounts & Contacts Tab and Drawer
    console.log('Checking Accounts & Contacts Tab & Drawer...');
    await page.click('button:has-text("Accounts")');
    await page.waitForTimeout(2000);

    const viewDetailBtn = page.locator('button:has-text("View Detail / Flags")').first();
    await viewDetailBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '03-account-drawer-verified-labels-balance.png'),
      fullPage: false
    });
    console.log('Captured 03-account-drawer-verified-labels-balance.png');

    // Close drawer
    console.log('Closing Account Drawer...');
    await page.evaluate(() => {
      const xBtns = Array.from(document.querySelectorAll('button'));
      const closeBtn = xBtns.find(b => b.querySelector('svg.lucide-x'));
      if (closeBtn) closeBtn.click();
    });
    await page.waitForTimeout(1000);

    // 5. Open Calls & Responses Tab
    console.log('Checking Calls & Responses Tab (Workspace & History)...');
    await page.click('button:has-text("Calls")');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '04-calls-browser-test-workspace.png'),
      fullPage: false
    });
    console.log('Captured 04-calls-browser-test-workspace.png');

    // 6. View Transcript for SESS-20261123-DEMO1
    console.log('Opening Chat-Style Transcript Viewer...');
    const viewTranscriptBtn = page.locator('button:has-text("View Transcript")').first();
    await viewTranscriptBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '05-conversation-session-chat-viewer.png'),
      fullPage: false
    });
    console.log('Captured 05-conversation-session-chat-viewer.png');

    console.log('All verification screenshots captured successfully!');
  } catch (err) {
    console.error('Playwright verification error:', err);
  } finally {
    await browser.close();
  }
}

run();
