import { chromium } from 'playwright';
import path from 'path';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const outDir = 'C:/Users/hetvi/.gemini/antigravity/brain/c1d44be6-5800-4f39-9ce4-eeae47462f41';

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Initial State: Sidebar with Browser Testing ON, Outbound Calls OFF (locked), SMS OFF (locked)
  await page.screenshot({ path: path.join(outDir, '01_sidebar_initial_controls.png') });
  console.log('Saved 01_sidebar_initial_controls.png');

  // 2. Click Outbound Calls toggle (should trigger ceiling rejection toast)
  const outboundBtn = page.locator('button[aria-label="Toggle Outbound Calls"]');
  await outboundBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '02_outbound_rejected_ceiling.png') });
  console.log('Saved 02_outbound_rejected_ceiling.png');

  // 3. Click SMS toggle (should trigger ceiling rejection toast)
  const smsBtn = page.locator('button[aria-label="Toggle SMS Messaging"]');
  await smsBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '03_sms_rejected_ceiling.png') });
  console.log('Saved 03_sms_rejected_ceiling.png');

  // 4. Click Browser Testing toggle (turn it OFF)
  const browserBtn = page.locator('button[aria-label="Toggle Browser Testing"]');
  await browserBtn.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, '04_voice_mode_off.png') });
  console.log('Saved 04_voice_mode_off.png');

  // 5. Navigate to Calls & Responses tab to show Voice Mode OFF banner
  const callsTab = page.locator('button:has-text("Calls & Responses")');
  await callsTab.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '05_calls_voice_mode_off.png') });
  console.log('Saved 05_calls_voice_mode_off.png');

  // 6. Turn Browser Testing back ON from sidebar
  await browserBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '06_calls_browser_testing_active.png') });
  console.log('Saved 06_calls_browser_testing_active.png');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
