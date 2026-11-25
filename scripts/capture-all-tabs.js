import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/hetvi/.gemini/antigravity/brain/c1d44be6-5800-4f39-9ce4-eeae47462f41';
const DOCS_DIR = 'R:/out-intern-delinquency-proj2/docs/ui-audit';

const tabs = [
  { id: 'overview', name: '01-overview.png', label: 'Overview' },
  { id: 'campaigns', name: '02-campaigns.png', label: 'Campaigns' },
  { id: 'accounts', name: '03-accounts-contacts.png', label: 'Accounts & Contacts' },
  { id: 'eligibility', name: '04-predial-eligibility.png', label: 'Pre-Dial Eligibility' },
  { id: 'calls', name: '05-calls-responses.png', label: 'Calls & Responses' },
  { id: 'schedules', name: '06-schedule-callbacks.png', label: 'Schedule & Callbacks' },
  { id: 'outbox', name: '07-servicing-writeback.png', label: 'Servicing Write-Back' },
  { id: 'human-queue', name: '08-human-queue.png', label: 'Human Queue' },
  { id: 'compliance', name: '09-compliance-dnc.png', label: 'Compliance & DNC' },
  { id: 'sms', name: '10-sms-messages.png', label: 'SMS Messages' },
  { id: 'integrations', name: '11-integration-health.png', label: 'Integration Health' },
  { id: 'audit', name: '12-operational-audit.png', label: 'Operational Audit' },
];

async function capture() {
  const browser = await chromium.launch({ headless: true });
  
  // 1. Capture 1920x1080 of each tab
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  for (const tab of tabs) {
    console.log(`Capturing tab: ${tab.label}...`);
    // Click button with text matching tab.label inside sidebar
    const btn = page.locator(`.sidebar-nav-btn:has-text("${tab.label}")`);
    await btn.click();
    await page.waitForTimeout(800);

    const docPath = path.join(DOCS_DIR, tab.name);
    await page.screenshot({ path: docPath, fullPage: false });
    
    // Copy to artifact dir
    const artPath = path.join(ARTIFACT_DIR, tab.name);
    fs.copyFileSync(docPath, artPath);
    console.log(`  Saved to ${docPath} and ${artPath}`);
  }

  // 2. Capture viewport responsiveness for Overview & Sidebar
  // Click back to Overview
  await page.locator(`.sidebar-nav-btn:has-text("Overview")`).click();
  await page.waitForTimeout(500);

  const viewports = [
    { width: 1920, height: 1080, name: 'sidebar-alignment-1920x1080.png' },
    { width: 1366, height: 768, name: 'sidebar-alignment-1366x768.png' },
    { width: 1917, height: 911, name: 'sidebar-alignment-1917x911.png' },
  ];

  for (const vp of viewports) {
    console.log(`Capturing viewport ${vp.width}x${vp.height}...`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);

    const docPath = path.join(DOCS_DIR, vp.name);
    await page.screenshot({ path: docPath, fullPage: false });
    const artPath = path.join(ARTIFACT_DIR, vp.name);
    fs.copyFileSync(docPath, artPath);
    console.log(`  Saved to ${docPath}`);
  }

  // 3. Capture Human Queue with Escalation Contacts section visible
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator(`.sidebar-nav-btn:has-text("Human Queue")`).click();
  await page.waitForTimeout(500);
  const hqPath = path.join(DOCS_DIR, '08-human-queue-roster.png');
  await page.screenshot({ path: hqPath, fullPage: true });
  fs.copyFileSync(hqPath, path.join(ARTIFACT_DIR, '08-human-queue-roster.png'));

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch(console.error);
