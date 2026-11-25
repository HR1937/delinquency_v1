import { chromium } from 'playwright';
import path from 'path';

const outDir = 'C:/Users/hetvi/.gemini/antigravity/brain/c1d44be6-5800-4f39-9ce4-eeae47462f41';

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Capture at 1920x1080
  console.log('Capturing 1920x1080...');
  const ctx1920 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page1920 = await ctx1920.newPage();
  await page1920.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page1920.waitForTimeout(2500);
  await page1920.screenshot({ path: path.join(outDir, '12_overview_1920x1080_clarification.png') });

  // 2. Click Active Campaigns KPI info icon to open KpiPopover
  console.log('Opening Active Campaigns popover...');
  const kpiInfoBtn = page1920.locator('button[aria-label="Information about ACTIVE CAMPAIGNS"]');
  await kpiInfoBtn.click();
  await page1920.waitForTimeout(500);
  await page1920.screenshot({ path: path.join(outDir, '13_kpi_popover_active_campaigns.png') });

  // Click again to close, or press Escape
  await page1920.keyboard.press('Escape');
  await page1920.waitForTimeout(300);

  // 3. Open Configured Borrower Contact Hours popover
  console.log('Opening Configured Borrower Contact Hours popover...');
  const hoursInfoBtn = page1920.locator('button[aria-label="Information about Configured Borrower Contact Hours"]');
  await hoursInfoBtn.click();
  await page1920.waitForTimeout(500);
  await page1920.screenshot({ path: path.join(outDir, '14_hours_popover_active.png') });
  await page1920.keyboard.press('Escape');
  await page1920.waitForTimeout(300);

  // 4. Capture at 1366x768
  console.log('Capturing 1366x768...');
  const ctx1366 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page1366 = await ctx1366.newPage();
  await page1366.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page1366.waitForTimeout(2000);
  await page1366.screenshot({ path: path.join(outDir, '15_overview_1366x768_responsiveness.png') });

  // 5. Capture at user-specified 1917x911
  console.log('Capturing 1917x911...');
  const ctx1917 = await browser.newContext({ viewport: { width: 1917, height: 911 } });
  const page1917 = await ctx1917.newPage();
  await page1917.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page1917.waitForTimeout(2000);
  await page1917.screenshot({ path: path.join(outDir, '16_overview_1917x911_viewport.png') });

  // 6. Test switching active borrower role to AGENT_B
  console.log('Switching active borrower role...');
  const agentBBtn = page1920.locator('button:has-text("Agent B")').first();
  if (await agentBBtn.isVisible()) {
    await agentBBtn.click();
    await page1920.waitForTimeout(1000);
    await page1920.screenshot({ path: path.join(outDir, '17_qa_alternate_routing_agent_b.png') });
  }

  await browser.close();
  console.log('All overview clarification screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
