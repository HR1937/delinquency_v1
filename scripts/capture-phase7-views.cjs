const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
  const outputDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'phase7');
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
    console.log(`Capturing Phase 7 views at ${vp.width}x${vp.height}...`);
    console.log(`========================================`);

    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Operator Login
    console.log('1. Logging in as operator...');
    const loginBtn = page.locator('button:has-text("Operator Login")');
    if (await loginBtn.count() > 0 && await loginBtn.first().isVisible()) {
      await loginBtn.first().click();
      await page.waitForTimeout(600);

      const passInput = page.locator('form input[type="password"]');
      if (await passInput.count() > 0) {
        await passInput.first().fill('dev-operator-pass-2026');
      }

      const submitLogin = page.locator('form button:has-text("Log In")');
      if (await submitLogin.count() > 0) {
        await submitLogin.first().click();
        await page.waitForTimeout(1000);
      }

      const cancelBtn = page.locator('form button:has-text("Cancel")');
      if (await cancelBtn.count() > 0 && await cancelBtn.first().isVisible()) {
        await cancelBtn.first().click();
        await page.waitForTimeout(500);
      }
    }

    // 2. Navigating to Integration Health & Supervised QA Voice Readiness
    console.log('2. Navigating to Integration Health...');
    const healthBtn = page.locator('aside button:has-text("Integration Health")');
    if (await healthBtn.count() > 0) {
      await healthBtn.first().click({ force: true });
      await page.waitForTimeout(1500);

      // Trigger "Inspect Supervised QA Readiness" if present
      const inspectQaBtn = page.locator('button:has-text("Inspect Supervised QA Readiness")');
      if (await inspectQaBtn.count() > 0) {
        await inspectQaBtn.first().scrollIntoViewIfNeeded();
        await inspectQaBtn.first().click();
        await page.waitForTimeout(1500);
      }

      // Capture Supervised QA Readiness Overview
      console.log('3. Capturing Supervised QA Voice Readiness Panel...');
      const qaSection = page.locator('div:has-text("Supervised Voice-Agent QA Readiness")').first();
      if (await qaSection.count() > 0) {
        await qaSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
      }
      await page.screenshot({ path: path.join(outputDir, `supervised-qa-readiness-${vp.name}.png`), fullPage: false });

      // Click "Probe Fail-Closed Gate (HTTP 423)" to prove fail-closed gate
      console.log('4. Probing Fail-Closed Gate (HTTP 423)...');
      const probeBtn = page.locator('button:has-text("Probe Fail-Closed Gate")');
      if (await probeBtn.count() > 0) {
        await probeBtn.first().scrollIntoViewIfNeeded();
        await probeBtn.first().click();
        await page.waitForTimeout(1200);
      }

      // Capture Disabled Call Control & Fail-Closed Gate Verification
      console.log('5. Capturing Disabled Call Control & Interlock Verification...');
      const gateControl = page.locator('div:has-text("Single-Call Supervised Voice Dispatch Gate")').first();
      if (await gateControl.count() > 0) {
        await gateControl.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: path.join(outputDir, `disabled-call-control-${vp.name}.png`), fullPage: false });

      // Capture Synthetic Call Request Preview
      console.log('6. Capturing Synthetic Call Request Preview...');
      const previewSpan = page.locator('span:has-text("Synthetic Call Request Preview")').first();
      if (await previewSpan.count() > 0) {
        await previewSpan.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: path.join(outputDir, `synthetic-request-preview-${vp.name}.png`), fullPage: false });

      // Capture Entire Integrations Overview
      console.log('7. Capturing Entire Integrations Tab...');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outputDir, `integrations-overview-${vp.name}.png`), fullPage: false });
    }

    await page.close();
  }

  await browser.close();
  console.log(`\nAll Phase 7 screenshots successfully saved to: ${outputDir}`);
}

capture().catch(err => {
  console.error('Phase 7 screenshot capture failed:', err);
  process.exit(1);
});
