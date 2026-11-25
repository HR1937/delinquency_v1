const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
  const outputDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'phase5');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: '1366', width: 1366, height: 768 },
    { name: '1920', width: 1920, height: 1080 }
  ];

  for (const vp of viewports) {
    console.log(`\n========================================`);
    console.log(`Capturing Phase 5 views at ${vp.width}x${vp.height}...`);
    console.log(`========================================`);

    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Operator Auth State & Modal
    console.log('1. Capturing Operator Auth State...');
    const loginBtn = page.locator('button:has-text("Operator Login")');
    if (await loginBtn.count() > 0) {
      await loginBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outputDir, `operator-auth-state-${vp.name}.png`), fullPage: false });

      // Actually log in so subsequent views show authenticated operator badge
      const submitLogin = page.locator('form button:has-text("Log In")');
      if (await submitLogin.count() > 0) {
        await submitLogin.first().click();
        await page.waitForTimeout(800);
      }
    } else {
      // Already authenticated, take screenshot
      await page.screenshot({ path: path.join(outputDir, `operator-auth-state-${vp.name}.png`), fullPage: false });
    }

    // 2. Callbacks Provenance
    console.log('2. Capturing Callbacks & Schedules with Provenance...');
    const schedBtn = page.locator('nav button:has-text("Schedule & Callbacks")');
    if (await schedBtn.count() > 0) {
      await schedBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outputDir, `callbacks-provenance-${vp.name}.png`), fullPage: false });
    }

    // 3. Integration Health & Preflight Inspection
    console.log('3. Capturing Integration Health & Preflight...');
    const healthBtn = page.locator('nav button:has-text("Integration Health")');
    if (await healthBtn.count() > 0) {
      await healthBtn.first().click();
      await page.waitForTimeout(1000);

      // Click "Run Preflight Check"
      const preflightBtn = page.locator('button:has-text("Run Preflight Check")');
      if (await preflightBtn.count() > 0) {
        await preflightBtn.first().click();
        await page.waitForTimeout(1500);
      }

      await page.screenshot({ path: path.join(outputDir, `integration-health-preflight-${vp.name}.png`), fullPage: false });

      // 4. Webhook Rehearsal Runner Report
      console.log('4. Running Webhook Rehearsal and capturing report...');
      const rehearsalBtn = page.locator('button:has-text("Run Webhook Rehearsal")');
      if (await rehearsalBtn.count() > 0) {
        // Scroll down to rehearsal runner
        await rehearsalBtn.first().scrollIntoViewIfNeeded();
        await rehearsalBtn.first().click();
        await page.waitForTimeout(1500);
      }

      await page.screenshot({ path: path.join(outputDir, `webhook-rehearsal-report-${vp.name}.png`), fullPage: false });
    }

    await page.close();
  }

  await browser.close();
  console.log('\nAll Phase 5 screenshots captured successfully in docs/screenshots/phase5/!\n');
}

capture().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
