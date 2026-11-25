const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
  const outputDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'phase3');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  
  const viewports = [
    { name: '1366x768', width: 1366, height: 768 },
    { name: '1920x1080', width: 1920, height: 1080 }
  ];

  for (const vp of viewports) {
    console.log(`\nCapturing views at ${vp.name}...`);
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const tabs = [
      { id: 'dashboard', label: 'Overview', file: `01_overview_${vp.name}.png` },
      { id: 'campaigns', label: 'Campaigns', file: `02_campaigns_${vp.name}.png` },
      { id: 'accounts', label: 'Accounts & Contacts', file: `03_accounts_${vp.name}.png` },
      { id: 'eligibility', label: 'Pre-Dial Eligibility', file: `04_predial_${vp.name}.png` },
      { id: 'schedules', label: 'Schedule & Callbacks', file: `05_schedule_callbacks_${vp.name}.png` },
      { id: 'servicing-outbox', label: 'Servicing Write-Back', file: `06_servicing_outbox_${vp.name}.png` },
      { id: 'human-queue', label: 'Human Queue', file: `07_human_queue_${vp.name}.png` },
      { id: 'integrations', label: 'Integration Health', file: `08_integrations_${vp.name}.png` },
      { id: 'audit', label: 'Operational Audit / QA', file: `09_qa_scenarios_${vp.name}.png` }
    ];

    for (const tab of tabs) {
      console.log(`  Navigating to ${tab.label}...`);
      // Find the button in nav
      const navBtn = page.locator(`nav button:has-text("${tab.label}")`);
      if (await navBtn.count() > 0) {
        await navBtn.first().click();
        await page.waitForTimeout(800);
        
        // If on schedules, also capture the scenario tab
        if (tab.id === 'schedules') {
          await page.screenshot({ path: path.join(outputDir, tab.file), fullPage: false });
          console.log(`    Saved ${tab.file}`);

          const scenarioTab = page.locator('button:has-text("Scenario Fixtures")');
          if (await scenarioTab.count() > 0) {
            await scenarioTab.first().click();
            await page.waitForTimeout(500);
            const scenarioFile = `05b_schedule_scenario_fixture_${vp.name}.png`;
            await page.screenshot({ path: path.join(outputDir, scenarioFile), fullPage: false });
            console.log(`    Saved ${scenarioFile}`);
          }
          continue;
        }

        await page.screenshot({ path: path.join(outputDir, tab.file), fullPage: false });
        console.log(`    Saved ${tab.file}`);
      } else {
        console.warn(`    Could not find button for ${tab.label}`);
      }
    }

    await page.close();
  }

  await browser.close();
  console.log('\nAll Phase 3 screenshots captured successfully.');
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
