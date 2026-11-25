const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
  const outputDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'phase4');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: '1366x768', width: 1366, height: 768 },
    { name: '1920x1080', width: 1920, height: 1080 }
  ];

  for (const vp of viewports) {
    console.log(`\n========================================`);
    console.log(`Capturing Phase 4 views at ${vp.name}...`);
    console.log(`========================================`);

    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Overview Dashboard
    console.log('1. Capturing Dashboard Overview...');
    await page.screenshot({ path: path.join(outputDir, `01_overview_${vp.name}.png`), fullPage: false });

    // 2. Operator Login Modal
    console.log('2. Capturing Operator Login Modal...');
    const loginBtn = page.locator('button:has-text("Operator Login")');
    if (await loginBtn.count() > 0) {
      await loginBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outputDir, `02_operator_login_${vp.name}.png`), fullPage: false });

      // Actually log in so subsequent views show authenticated operator badge
      const submitLogin = page.locator('form button:has-text("Log In")');
      if (await submitLogin.count() > 0) {
        await submitLogin.first().click();
        await page.waitForTimeout(600);
      }
    }

    // 3. Schedule & Callbacks (Provenance Badges)
    console.log('3. Capturing Schedule & Callbacks view...');
    const schedBtn = page.locator('nav button:has-text("Schedule & Callbacks")');
    if (await schedBtn.count() > 0) {
      await schedBtn.first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outputDir, `03_schedule_callbacks_${vp.name}.png`), fullPage: false });
    }

    // 4. QA Simulation Runner (Before Run)
    console.log('4. Capturing QA Simulation Runner tab...');
    const auditBtn = page.locator('nav button:has-text("Operational Audit / QA")');
    if (await auditBtn.count() > 0) {
      await auditBtn.first().click();
      await page.waitForTimeout(800);

      // Ensure simulator subtab is active
      const simTab = page.locator('button:has-text("QA Simulation Runner")');
      if (await simTab.count() > 0) {
        await simTab.first().click();
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: path.join(outputDir, `04_qa_simulator_runner_${vp.name}.png`), fullPage: false });

      // 5. Execute a Deterministic Simulation (e.g. MOCK_RPC_PTP)
      console.log('5. Executing and capturing simulation result...');
      const runSimBtn = page.locator('button:has-text("Run Simulation")');
      if (await runSimBtn.count() > 0) {
        await runSimBtn.first().click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(outputDir, `05_qa_simulation_result_${vp.name}.png`), fullPage: false });
      }

      // 6. Run a second deterministic outcome for rich history (e.g. MOCK_WRONG_NUMBER)
      console.log('6. Running second simulation and capturing history...');
      const outcomeSelect = page.locator('select').nth(1); // second select is outcome
      if (await outcomeSelect.count() > 0) {
        await outcomeSelect.selectOption('MOCK_WRONG_NUMBER');
        await page.waitForTimeout(300);
        if (await runSimBtn.count() > 0) {
          await runSimBtn.first().click();
          await page.waitForTimeout(1500);
        }
      }
      await page.screenshot({ path: path.join(outputDir, `06_qa_simulation_history_${vp.name}.png`), fullPage: false });
    }

    // 7. Servicing Outbox
    console.log('7. Capturing Servicing Outbox...');
    const outboxBtn = page.locator('nav button:has-text("Servicing Write-Back")');
    if (await outboxBtn.count() > 0) {
      await outboxBtn.first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outputDir, `07_servicing_outbox_${vp.name}.png`), fullPage: false });
    }

    // 8. Integration Health
    console.log('8. Capturing Integration Health...');
    const healthBtn = page.locator('nav button:has-text("Integration Health")');
    if (await healthBtn.count() > 0) {
      await healthBtn.first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outputDir, `08_integrations_${vp.name}.png`), fullPage: false });
    }

    await page.close();
  }

  await browser.close();
  console.log('\nAll Phase 4 screenshots captured successfully in docs/screenshots/phase4/!\n');
}

capture().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
