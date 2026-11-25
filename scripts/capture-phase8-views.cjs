const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const postgres = require(path.resolve(__dirname, '..', 'apps', 'backend', 'node_modules', 'postgres'));

async function capture() {
  const outputDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'phase8');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate and insert a valid operator session token directly in local database
  const dotenv = require(path.resolve(__dirname, '..', 'apps', 'backend', 'node_modules', 'dotenv'));
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
  const dbUrl = process.env.DATABASE_URL;
  const sql = postgres(dbUrl);
  const sessionToken = `phase8_capture_token_${Date.now()}`;
  const [createdSession] = await sql`
    INSERT INTO operator_sessions (token, operator_username, role, expires_at)
    VALUES (${sessionToken}, 'Phase8_Lead', 'lead', NOW() + INTERVAL '2 hours')
    RETURNING id
  `;
  console.log(`✓ Established operator session token for Playwright capture (ID: ${createdSession.id})`);

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: '1366', width: 1366, height: 768 },
    { name: '1920', width: 1920, height: 1080 }
  ];

  for (const vp of viewports) {
    console.log(`\n========================================`);
    console.log(`Capturing Phase 8 views at ${vp.width}x${vp.height}...`);
    console.log(`========================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });

    // Pre-populate operator token into localStorage so all views are unlocked immediately
    await context.addInitScript((tok) => {
      window.localStorage.setItem('delinquency_operator_token', tok);
    }, sessionToken);

    const page = await context.newPage();

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // 1. Integration Health Tab: Overview & Twilio SMS Hard-Disable Banner
    console.log('1. Navigating to Integration Health...');
    const healthBtn = page.locator('aside button:has-text("Integration Health")');
    if (await healthBtn.count() > 0) {
      await healthBtn.first().click({ force: true });
      await page.waitForTimeout(1500);

      console.log('2. Capturing Integration Health Overview...');
      await page.screenshot({ path: path.join(outputDir, `integration-health-overview-${vp.name}.png`), fullPage: false });

      // Scroll to Web QA Card
      console.log('3. Capturing Browser Web Voice QA Card...');
      const webQaCard = page.locator('div:has-text("Browser Web Voice QA (@vapi-ai/web)")').first();
      if (await webQaCard.count() > 0) {
        await webQaCard.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(outputDir, `web-qa-card-${vp.name}.png`), fullPage: false });
      }

      // Scroll to Verified PSTN Destinations Table
      console.log('4. Capturing Verified PSTN Destinations Table...');
      const verifiedDestCard = page.locator('div:has-text("Owner-Attested Verified PSTN Destinations")').first();
      if (await verifiedDestCard.count() > 0) {
        await verifiedDestCard.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(outputDir, `verified-destinations-table-${vp.name}.png`), fullPage: false });
      }
    }

    // 2. Outbound SMS Messages Tab: SMS Disabled Control
    console.log('5. Navigating to SMS Messages Tab...');
    const smsTabBtn = page.locator('aside button:has-text("SMS Messages")');
    if (await smsTabBtn.count() > 0) {
      await smsTabBtn.first().click({ force: true });
      await page.waitForTimeout(1200);

      console.log('6. Capturing SMS Disabled Control View...');
      await page.screenshot({ path: path.join(outputDir, `sms-disabled-control-${vp.name}.png`), fullPage: false });
    }

    // 3. Campaign Orchestration Tab: Trigger "Run Eligible Borrowers Now"
    console.log('7. Navigating to Campaign Orchestration Tab...');
    const campTabBtn = page.locator('aside button:has-text("Campaigns")');
    if (await campTabBtn.count() > 0) {
      await campTabBtn.first().click({ force: true });
      await page.waitForTimeout(1500);

      console.log('8. Clicking "Run Eligible Borrowers Now"...');
      const runBtn = page.locator('button:has-text("Run Eligible Borrowers Now")').first();
      if (await runBtn.count() > 0) {
        await runBtn.click({ force: true });
        await page.waitForTimeout(2500);

        console.log('9. Capturing Campaign Run Queue Modal...');
        await page.screenshot({ path: path.join(outputDir, `campaign-run-queue-${vp.name}.png`), fullPage: false });

        // Close modal
        const closeBtn = page.locator('button:has-text("Close Queue View")');
        if (await closeBtn.count() > 0) {
          await closeBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    await page.close();
    await context.close();
  }

  await browser.close();

  // Clean up created operator session
  await sql`DELETE FROM operator_sessions WHERE token = ${sessionToken}`;
  await sql.end();
  console.log('✓ Cleaned up temporary operator session.');
  console.log('\n✓ Phase 8 visual capture complete! Files saved in docs/screenshots/phase8/');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
