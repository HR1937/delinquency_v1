const { chromium } = require('playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/hetvi/.gemini/antigravity/brain/c1d44be6-5800-4f39-9ce4-eeae47462f41';

async function run() {
  console.log('Launching browser for final verification...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    // 1. Load app
    console.log('Navigating to http://localhost:5173/ ...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 2. Open Campaigns Tab
    console.log('1. Capturing Campaigns View (Exactly 3 campaigns, clean actions)...');
    await page.click('button:has-text("Campaigns")');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '01-campaigns-three-operational.png'),
      fullPage: false
    });
    console.log('Captured 01-campaigns-three-operational.png');

    // 3. Open Campaign Members modal and candidate selector
    console.log('2. Opening Campaign Members modal and candidate selector tab...');
    const membersBtn = page.locator('button:has-text("Members")').first();
    await membersBtn.click();
    await page.waitForTimeout(1500);

    // Click candidate selector tab
    const addTab = page.locator('button:has-text("Add Borrowers")').first();
    if (await addTab.isVisible()) {
      await addTab.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '02-campaign-members-candidate-selector.png'),
      fullPage: false
    });
    console.log('Captured 02-campaign-members-candidate-selector.png');

    // Close members modal
    await page.evaluate(() => {
      const xBtns = Array.from(document.querySelectorAll('button'));
      const closeBtn = xBtns.find(b => b.querySelector('svg.lucide-x') && b.closest('div[style*="position: fixed"]'));
      if (closeBtn) closeBtn.click();
    });
    await page.waitForTimeout(1000);

    // 4. Open Accounts & Contacts Tab (Portfolio Summary Banner)
    console.log('3. Capturing Accounts & Contacts Portfolio Summary...');
    await page.click('button:has-text("Accounts")');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '03-accounts-portfolio-summary.png'),
      fullPage: false
    });
    console.log('Captured 03-accounts-portfolio-summary.png');

    // Open detail drawer and 12-gate diagnostic
    console.log('4. Opening Account Drawer and 12-Gate Diagnostic Table...');
    const viewDetailBtn = page.locator('button:has-text("View Detail / Flags")').first();
    await viewDetailBtn.click();
    await page.waitForTimeout(2000);

    // Click 12-gate pre-dial tab
    const preDialTab = page.locator('button:has-text("12-Gate Diagnostic")').first();
    if (await preDialTab.isVisible()) {
      await preDialTab.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '04-account-drawer-12gates-diagnostics.png'),
      fullPage: false
    });
    console.log('Captured 04-account-drawer-12gates-diagnostics.png');

    // Close drawer
    await page.evaluate(() => {
      const xBtns = Array.from(document.querySelectorAll('button'));
      const closeBtn = xBtns.find(b => b.querySelector('svg.lucide-x'));
      if (closeBtn) closeBtn.click();
    });
    await page.waitForTimeout(1000);

    // 5. Open Calls & Responses Tab
    console.log('5. Capturing Calls & Responses Browser Testing Workspace...');
    await page.click('button:has-text("Calls")');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '05-calls-responses-vapi-workspace.png'),
      fullPage: false
    });
    console.log('Captured 05-calls-responses-vapi-workspace.png');

    // 6. Open Integration Health Tab
    console.log('6. Capturing Integration Health Tab...');
    await page.click('button:has-text("Integration Health")');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, '06-integration-health-clean.png'),
      fullPage: false
    });
    console.log('Captured 06-integration-health-clean.png');

    console.log('All final verification screenshots captured successfully!');
  } catch (err) {
    console.error('Playwright verification error:', err);
  } finally {
    await browser.close();
  }
}

run();
