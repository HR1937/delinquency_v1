import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/hetvi/.gemini/antigravity/brain/c1d44be6-5800-4f39-9ce4-eeae47462f41';
const DOCS_DIR = 'R:/out-intern-delinquency-proj2/docs/ui-audit/campaigns-review';

if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

async function capture() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  
  // 1. Campaigns listing at 1920x1080
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Navigate to Campaigns tab
  console.log('Navigating to Campaigns tab...');
  await page.locator('.sidebar-nav-btn:has-text("Campaigns")').click();
  await page.waitForTimeout(1200);

  // 1. Save 01-campaigns-listing-1920x1080.png
  console.log('Capturing 01-campaigns-listing-1920x1080.png...');
  let p1 = path.join(DOCS_DIR, '01-campaigns-listing-1920x1080.png');
  await page.screenshot({ path: p1 });
  fs.copyFileSync(p1, path.join(ARTIFACT_DIR, '01-campaigns-listing-1920x1080.png'));

  // 2. Campaigns listing at 1366x768
  console.log('Capturing 02-campaigns-listing-1366x768.png...');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(600);
  let p2 = path.join(DOCS_DIR, '02-campaigns-listing-1366x768.png');
  await page.screenshot({ path: p2 });
  fs.copyFileSync(p2, path.join(ARTIFACT_DIR, '02-campaigns-listing-1366x768.png'));

  // Reset viewport to 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);

  // 3. Create Campaign modal
  console.log('Opening Create Campaign modal...');
  await page.locator('button:has-text("Create Campaign")').first().click();
  await page.waitForTimeout(600);
  let p3 = path.join(DOCS_DIR, '03-create-campaign-modal.png');
  await page.screenshot({ path: p3 });
  fs.copyFileSync(p3, path.join(ARTIFACT_DIR, '03-create-campaign-modal.png'));
  await page.locator('button:has-text("Cancel")').click();
  await page.waitForTimeout(500);

  // 4. Campaign Details Drawer (5 Sections: Contact Policy Tab)
  console.log('Opening Campaign Details drawer...');
  await page.locator('button:has-text("Details")').first().click();
  await page.waitForTimeout(1000);
  // Click on Contact Policy tab
  await page.locator('button:has-text("Contact Policy")').click();
  await page.waitForTimeout(500);
  let p4 = path.join(DOCS_DIR, '04-campaign-details-drawer.png');
  await page.screenshot({ path: p4 });
  fs.copyFileSync(p4, path.join(ARTIFACT_DIR, '04-campaign-details-drawer.png'));
  await page.locator('button:has-text("Close Details")').click();
  await page.waitForTimeout(500);

  // 5. Edit Campaign Modal
  console.log('Opening Edit Campaign modal...');
  await page.locator('button:has-text("Edit")').first().click();
  await page.waitForTimeout(600);
  let p5 = path.join(DOCS_DIR, '05-edit-campaign-modal.png');
  await page.screenshot({ path: p5 });
  fs.copyFileSync(p5, path.join(ARTIFACT_DIR, '05-edit-campaign-modal.png'));
  await page.locator('button:has-text("Cancel")').click();
  await page.waitForTimeout(500);

  // 6. Campaign Members modal
  console.log('Opening Campaign Members modal...');
  await page.locator('button:has-text("Members")').first().click();
  await page.waitForTimeout(1200);
  let p6 = path.join(DOCS_DIR, '06-campaign-members-modal.png');
  await page.screenshot({ path: p6 });
  fs.copyFileSync(p6, path.join(ARTIFACT_DIR, '06-campaign-members-modal.png'));
  await page.locator('button:has(svg.lucide-x)').first().click();
  await page.waitForTimeout(500);

  // 7. Review Outreach Eligibility modal
  console.log('Opening Review Outreach Eligibility modal...');
  await page.locator('button:has-text("Review Outreach Eligibility")').first().click();
  await page.waitForTimeout(2500);
  let p7 = path.join(DOCS_DIR, '07-eligibility-review-modal.png');
  await page.screenshot({ path: p7 });
  fs.copyFileSync(p7, path.join(ARTIFACT_DIR, '07-eligibility-review-modal.png'));
  await page.locator('button:has-text("Close Review")').click();
  await page.waitForTimeout(500);

  // 8. Empty Campaign View (first-1 )
  console.log('Opening Empty Campaign Members modal for first-1 ...');
  // Find row with first-1 and click Members
  const emptyRow = page.locator('tr:has-text("first-1")');
  await emptyRow.locator('button:has-text("Members")').click();
  await page.waitForTimeout(1000);
  let p8 = path.join(DOCS_DIR, '08-empty-campaign-view.png');
  await page.screenshot({ path: p8 });
  fs.copyFileSync(p8, path.join(ARTIFACT_DIR, '08-empty-campaign-view.png'));
  await page.locator('button:has(svg.lucide-x)').first().click();
  await page.waitForTimeout(500);

  // 9. Internal Testing & QA Scenarios View
  console.log('Switching to Internal Testing & QA Scenarios toggle...');
  await page.locator('button:has-text("Internal Testing & QA Scenarios")').click();
  await page.waitForTimeout(800);
  let p9 = path.join(DOCS_DIR, '09-internal-qa-toggle-view.png');
  await page.screenshot({ path: p9 });
  fs.copyFileSync(p9, path.join(ARTIFACT_DIR, '09-internal-qa-toggle-view.png'));

  console.log('All 9 screenshots captured successfully!');
  await browser.close();
}

capture().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
