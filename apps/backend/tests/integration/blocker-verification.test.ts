import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import {
  loans,
  borrowers,
  phoneNumbers,
  campaigns,
  callAttempts,
  callOverrideAudits,
  providerWebhookEvents,
  scheduledJobs,
  servicingOutbox
} from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { config } from '../../src/config';
import { DurableJobScheduler } from '../../src/jobs/DurableJobScheduler';
import { BlockReasonEnum } from '@delinquency/contracts';
import { cleanupTestLoans } from '../test-cleanup';

describe('Blocker Verification Suite (Pre-User-Test Audit)', () => {
  let testCampaignId: string;
  let testLoanId: string;
  let testPhoneId: string;
  let allowlistedPhoneId: string;

  beforeAll(async () => {
    // 1. Establish or get test campaign
    let camp = await db.query.campaigns.findFirst({
      where: (c, { eq }) => eq(c.name, 'Blocker Audit Campaign')
    });
    if (!camp) {
      const [newCamp] = await db.insert(campaigns).values({
        name: 'Blocker Audit Campaign',
        description: 'Test campaign for pre-user-test blocker verification',
        cohortLabel: '1-59 DPD Audit',
        dpdMin: 1,
        dpdMax: 59,
        status: 'paused',
        maxAttempts: 3,
        dailyCap: 2,
        weeklyCap: 6,
        cooldownHours: 4,
        isSeeded: false
      }).returning();
      camp = newCamp;
    }
    testCampaignId = camp.id;

    // 2. Establish test loan with borrower and phone
    const [loan] = await db.insert(loans).values({
      campaignId: testCampaignId,
      loanNumber: `AUDIT-LN-${Date.now()}`,
      servicerId: 'SERVICER-AUDIT',
      productType: 'Conventional 30Y Fixed',
      interestRate: '0.0650',
      upb: '275000.00',
      piPayment: '1738.20',
      dpd: 25,
      delinquencyBucket: '1-30',
      pastDueAmount: '1738.20',
      totalToCure: '1803.20',
      isBankrupt: false,
      isLitigation: false,
      isDeceased: false,
      hasLossMitigation: false,
      hasActiveDispute: false,
      isScra: false,
      hasLegalTrigger: false,
      priorityScore: '70.00',
      contactAttemptCount: 0,
      isSeeded: false
    }).returning();
    testLoanId = loan.id;

    const [borrower] = await db.insert(borrowers).values({
      loanId: loan.id,
      firstName: 'Audit',
      lastName: 'Borrower',
      isPrimary: true,
      isSeeded: false
    }).returning();

    const [phone] = await db.insert(phoneNumbers).values({
      loanId: loan.id,
      borrowerId: borrower.id,
      phoneE164: '+16145550199', // Non-allowlisted number
      lineType: 'mobile',
      tcpaConsent: true,
      consentState: 'GRANTED',
      dnc: false,
      timezoneIana: 'America/New_York',
      isHygieneVerified: true,
      isSeeded: false
    }).returning();
    testPhoneId = phone.id;

    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '').split(',').map(s => s.trim()).filter(Boolean);
    const allowlistedNumber = allowed[0] || '+919328234331';

    const [phone2] = await db.insert(phoneNumbers).values({
      loanId: loan.id,
      borrowerId: borrower.id,
      phoneE164: allowlistedNumber,
      lineType: 'mobile',
      tcpaConsent: true,
      consentState: 'GRANTED',
      dnc: false,
      timezoneIana: 'America/New_York',
      isHygieneVerified: true,
      isTestDestination: true,
      testRecipientAuthorized: true,
      isSeeded: false
    }).returning();
    allowlistedPhoneId = phone2.id;
  });

  // ─── 1. WEBHOOK AUTHENTICATION (FAIL-CLOSED) ───────────────────────────────
  it('E.1: Rejects webhook with missing x-vapi-secret (HTTP 401)', async () => {
    const res = await app.request('/api/v1/webhooks/vapi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'end-of-call-report', call: { id: `fake-vapi-${Date.now()}` } })
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('x-vapi-secret');
  });

  it('E.2: Rejects webhook with invalid x-vapi-secret (HTTP 401)', async () => {
    const res = await app.request('/api/v1/webhooks/vapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': 'invalid_secret_token_123'
      },
      body: JSON.stringify({ type: 'end-of-call-report', call: { id: `fake-vapi-${Date.now()}` } })
    });
    expect(res.status).toBe(401);
  });

  it('E.3: Accepts webhook with correct x-vapi-secret (HTTP 200)', async () => {
    const callId = `vapi-auth-pass-${Date.now()}`;
    const res = await app.request('/api/v1/webhooks/vapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
      },
      body: JSON.stringify({
        type: 'status-update',
        call: { id: callId, status: 'in-progress' }
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  // ─── 2. WEBHOOK OUT-OF-ORDER AND DEDUPLICATION ─────────────────────────────
  it('E.4: Deduplicates identical webhook event idempotently', async () => {
    const externalId = `vapi-dedup-${Date.now()}`;
    const payload = {
      type: 'end-of-call-report',
      id: externalId,
      call: { id: externalId, status: 'ended' },
      message: { type: 'end-of-call-report', durationSeconds: 45 }
    };

    // First delivery
    const res1 = await app.request('/api/v1/webhooks/vapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
      },
      body: JSON.stringify(payload)
    });
    expect(res1.status).toBe(200);

    // Second delivery (duplicate)
    const res2 = await app.request('/api/v1/webhooks/vapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
      },
      body: JSON.stringify(payload)
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.duplicate).toBe(true);
  });

  // ─── 3. CAMPAIGN ACTIVATION DISPATCH ISOLATION ────────────────────────────
  it('A.1: Activating a campaign does NOT automatically dispatch calls or create jobs', async () => {
    const jobsBefore = await db.query.scheduledJobs.findMany({
      where: (sj, { eq }) => eq(sj.campaignId, testCampaignId)
    });

    const res = await app.request(`/api/v1/campaigns/${testCampaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    });
    expect(res.status).toBe(200);

    const jobsAfter = await db.query.scheduledJobs.findMany({
      where: (sj, { eq }) => eq(sj.campaignId, testCampaignId)
    });

    // Activating campaign must NOT create mass-dial jobs
    expect(jobsAfter.length).toBe(jobsBefore.length);
  });

  // ─── 4. BLOCKED CALL DISPATCH PREVENTION ──────────────────────────────────
  it('A.2: Blocked row ordinary call action refuses dispatch with 400 and full diagnostics', async () => {
    // Set loan condition to bankrupt
    await db.update(loans).set({ isBankrupt: true }).where(eq(loans.id, testLoanId));

    const res = await app.request(`/api/v1/campaigns/${testCampaignId}/launch-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanId: testLoanId, phoneNumberId: testPhoneId })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.status).toBe('blocked_at_dispatch');
    expect(body.reason).toBe(BlockReasonEnum.BLOCKED_BANKRUPTCY);
    expect(body.checkResults).toBeDefined();

    // Revert bankruptcy
    await db.update(loans).set({ isBankrupt: false }).where(eq(loans.id, testLoanId));
  });

  // ─── 5. SAFETY INTERLOCK & GATE BLOCK: NON-ALLOWLISTED DESTINATION ─────────
  it('A.3: Non-allowlisted destination or blocked gate refuses normal call dispatch', async () => {
    const res = await app.request(`/api/v1/campaigns/${testCampaignId}/launch-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanId: testLoanId, phoneNumberId: testPhoneId })
    });

    // Rejection must be either 400 (gate blocked) or 403 (safety interlock)
    expect([400, 403]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // ─── 6. DIRECT TEST OVERRIDE SAFETY RESTRICTION ────────────────────────────
  it('B.1: Live DIRECT_TEST_OVERRIDE is rejected because frozen Vapi prompt lacks test disclosure', async () => {
    const res = await app.request(`/api/v1/campaigns/${testCampaignId}/override-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loanId: testLoanId,
        phoneNumberId: allowlistedPhoneId,
        overrideReason: 'Attempting live override',
        acknowledgementText: 'Acknowledged',
        isSimulation: false // Requesting live call
      })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('LIVE_OVERRIDE_DISABLED');
    expect(body.safeModeAvailable).toBe('SIMULATED_TEST_OVERRIDE');
  });

  it('B.2: Simulated test override succeeds safely and audits mode as SIMULATED_TEST_OVERRIDE', async () => {
    // Force a condition that fails gate
    await db.update(loans).set({ hasLossMitigation: true }).where(eq(loans.id, testLoanId));

    const res = await app.request(`/api/v1/campaigns/${testCampaignId}/override-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loanId: testLoanId,
        phoneNumberId: allowlistedPhoneId,
        overrideReason: 'Supervised QA scenario audit verification',
        acknowledgementText: 'I acknowledge simulation override',
        isSimulation: true // Safe simulation
      })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.callMode).toBe('SIMULATED_TEST_OVERRIDE');
    expect(body.status).toBe('simulated');
    expect(body.auditId).toBeDefined();

    // Verify audit entry in database
    const auditRecord = await db.query.callOverrideAudits.findFirst({
      where: (a, { eq }) => eq(a.id, body.auditId)
    });
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.callMode).toBe('SIMULATED_TEST_OVERRIDE');
    expect((auditRecord?.failedGates as any).finalResult).toBe(BlockReasonEnum.BLOCKED_LOSS_MITIGATION);

    // Revert loss mitigation
    await db.update(loans).set({ hasLossMitigation: false }).where(eq(loans.id, testLoanId));
  });

  // ─── 7. NO FABRICATED TRANSCRIPTS OR SUMMARY ──────────────────────────────
  it('G.1: Call attempt with empty transcript in webhook remains null without invented text', async () => {
    const vapiCallId = `vapi-empty-trans-${Date.now()}`;
    const [attempt] = await db.insert(callAttempts).values({
      loanId: testLoanId,
      campaignId: testCampaignId,
      vapiCallId,
      referenceNumber: `REF-NOTRANS-${Date.now()}`,
      callStatus: 'initiated',
      isSeeded: false
    }).returning();

    // Webhook with null transcript
    const res = await app.request('/api/v1/webhooks/vapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
      },
      body: JSON.stringify({
        type: 'end-of-call-report',
        call: { id: vapiCallId },
        message: {
          type: 'end-of-call-report',
          durationSeconds: 12,
          transcript: null,
          analysis: { summary: null }
        }
      })
    });

    expect(res.status).toBe(200);

    const reloaded = await db.query.callAttempts.findFirst({
      where: (ca, { eq }) => eq(ca.id, attempt.id)
    });
    expect(reloaded?.transcriptText).toBeNull();
    expect(reloaded?.durationSeconds).toBe(12);
  });

  afterAll(async () => {
    // Clean up test webhook events first
    await db.delete(providerWebhookEvents).where(eq(providerWebhookEvents.provider, 'vapi'));

    if (testLoanId) {
      await cleanupTestLoans([testLoanId], testCampaignId ? [testCampaignId] : []);
    }
  });
});
