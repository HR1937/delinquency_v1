import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { config, isTwilioSmsEnabled } from '../../src/config';
import { assertDisposableTestDatabase } from '../test-cleanup';
import { loans, borrowers, phoneNumbers, campaigns, campaignMembers, qaSimulationRuns, stateChangeLog, callAttempts, eligibilityEvaluations } from '../../src/db/schema';
import { eq, and, desc } from 'drizzle-orm';

function getCurrentlyDaytimeTimezone(): string {
  const candidates = ['America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];
  const now = new Date();
  for (const tz of candidates) {
    try {
      const h = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now), 10);
      if (h >= 9 && h <= 19) return tz;
    } catch {}
  }
  return 'Asia/Kolkata';
}

describe('Campaign-Driven Voice Interaction & Pre-Dial Gating Test Suite', () => {
  let testCampaignId: string;
  let testCampaignId2: string;
  let eligibleLoanId: string;
  let eligiblePhoneId: string;
  let blockedLoanId: string;
  let blockedPhoneId: string;
  let unrelatedLoanId: string;

  beforeAll(async () => {
    assertDisposableTestDatabase();

    // 1. Create Campaign 1
    const [c1] = await db.insert(campaigns).values({
      name: `Test Early Delinquency ${Date.now()}`,
      description: '1-30 DPD Test Campaign',
      dpdMin: 1,
      dpdMax: 30,
      status: 'active',
      strategy: 'early_curative',
      maxAttempts: 3,
      dailyCap: 2,
      weeklyCap: 6,
      cooldownHours: 4,
      isSeeded: false
    }).returning();
    testCampaignId = c1.id;

    // 2. Create Campaign 2
    const [c2] = await db.insert(campaigns).values({
      name: `Test Mid Delinquency ${Date.now()}`,
      description: '31-59 DPD Test Campaign',
      dpdMin: 31,
      dpdMax: 59,
      status: 'active',
      strategy: 'mid_curative',
      maxAttempts: 3,
      dailyCap: 2,
      weeklyCap: 6,
      cooldownHours: 4,
      isSeeded: false
    }).returning();
    testCampaignId2 = c2.id;

    // 3. Create an eligible member for Campaign 1
    const [loan1] = await db.insert(loans).values({
      campaignId: testCampaignId,
      loanNumber: `TEST-ELIG-${Date.now()}`,
      dpd: 15,
      delinquencyBucket: '1-30',
      pastDueAmount: '1250.00',
      totalToCure: '1325.00',
      isBankrupt: false,
      isLitigation: false,
      isDeceased: false,
      hasLossMitigation: false,
      hasActiveDispute: false,
      isScra: false,
      isSeeded: false
    }).returning();
    eligibleLoanId = loan1.id;

    const [b1] = await db.insert(borrowers).values({
      loanId: loan1.id,
      firstName: 'Samantha',
      lastName: 'Eligible',
      isPrimary: true,
      preferredLanguage: 'en',
      isSeeded: false
    }).returning();

    const [p1] = await db.insert(phoneNumbers).values({
      loanId: loan1.id,
      borrowerId: b1.id,
      phoneE164: '+15551234567',
      lineType: 'mobile',
      tcpaConsent: true,
      consentState: 'GRANTED',
      dnc: false,
      timezoneIana: getCurrentlyDaytimeTimezone(), // Inside daytime calling window
      isHygieneVerified: true,
      isSeeded: false
    }).returning();
    eligiblePhoneId = p1.id;

    await db.insert(campaignMembers).values({
      campaignId: testCampaignId,
      loanId: loan1.id,
      selectedPhoneNumberId: p1.id,
      status: 'active',
      addedReason: 'test_setup'
    });

    // 4. Create a blocked member for Campaign 1 (Bankrupt)
    const [loan2] = await db.insert(loans).values({
      campaignId: testCampaignId,
      loanNumber: `TEST-BLOCKED-${Date.now()}`,
      dpd: 20,
      delinquencyBucket: '1-30',
      pastDueAmount: '2400.00',
      totalToCure: '2550.00',
      isBankrupt: true, // Bankrupt -> Gate C2a Block
      isLitigation: false,
      isDeceased: false,
      hasLossMitigation: false,
      hasActiveDispute: false,
      isScra: false,
      isSeeded: false
    }).returning();
    blockedLoanId = loan2.id;

    const [b2] = await db.insert(borrowers).values({
      loanId: loan2.id,
      firstName: 'Benjamin',
      lastName: 'Bankrupt',
      isPrimary: true,
      isSeeded: false
    }).returning();

    const [p2] = await db.insert(phoneNumbers).values({
      loanId: loan2.id,
      borrowerId: b2.id,
      phoneE164: '+15559876543',
      lineType: 'mobile',
      tcpaConsent: true,
      consentState: 'GRANTED',
      dnc: false,
      timezoneIana: getCurrentlyDaytimeTimezone(),
      isHygieneVerified: true,
      isSeeded: false
    }).returning();
    blockedPhoneId = p2.id;

    await db.insert(campaignMembers).values({
      campaignId: testCampaignId,
      loanId: loan2.id,
      selectedPhoneNumberId: p2.id,
      status: 'active',
      addedReason: 'test_setup'
    });

    // 5. Create an unrelated loan belonging ONLY to Campaign 2
    const [loan3] = await db.insert(loans).values({
      campaignId: testCampaignId2,
      loanNumber: `TEST-OTHER-${Date.now()}`,
      dpd: 45,
      delinquencyBucket: '31-59',
      pastDueAmount: '3500.00',
      totalToCure: '3700.00',
      isBankrupt: false,
      isSeeded: false
    }).returning();
    unrelatedLoanId = loan3.id;

    await db.insert(campaignMembers).values({
      campaignId: testCampaignId2,
      loanId: loan3.id,
      status: 'active',
      addedReason: 'test_setup'
    });
  });

  // ─── 1. CAMPAIGN & MEMBER VALIDATION ─────────────────────────────────────────
  describe('1. Campaign and Member Validation', () => {
    it('1.1: Rejects web-qa-session when loanId does not belong to specified campaignId', async () => {
      const prevMode = process.env.VAPI_WEB_QA_MODE;
      const prevPub = process.env.VAPI_PUBLIC_KEY;
      process.env.VAPI_WEB_QA_MODE = 'enable';
      process.env.VAPI_PUBLIC_KEY = 'vapi_test_pubkey';

      try {
        const res = await app.request('/api/v1/integrations/web-qa-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: testCampaignId,
            loanId: unrelatedLoanId // Belongs to campaign 2!
          })
        });

        expect(res.status).toBe(400);
        const data = await res.json() as any;
        expect(data.success).toBe(false);
        expect(data.error).toBe('LOAN_NOT_IN_CAMPAIGN');
      } finally {
        process.env.VAPI_WEB_QA_MODE = prevMode;
        process.env.VAPI_PUBLIC_KEY = prevPub;
      }
    });

    it('1.2: Rejects arbitrary non-existent loanId with 404', async () => {
      const prevMode = process.env.VAPI_WEB_QA_MODE;
      const prevPub = process.env.VAPI_PUBLIC_KEY;
      process.env.VAPI_WEB_QA_MODE = 'enable';
      process.env.VAPI_PUBLIC_KEY = 'vapi_test_pubkey';

      try {
        const res = await app.request('/api/v1/integrations/web-qa-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: testCampaignId,
            loanId: '00000000-0000-0000-0000-000000000099'
          })
        });

        expect(res.status).toBe(404);
        const data = await res.json() as any;
        expect(data.error).toBe('LOAN_NOT_FOUND');
      } finally {
        process.env.VAPI_WEB_QA_MODE = prevMode;
        process.env.VAPI_PUBLIC_KEY = prevPub;
      }
    });
  });

  // ─── 2. DYNAMIC BROWSER QA CONTEXT INJECTION ──────────────────────────────
  describe('2. Dynamic Browser QA Context Injection', () => {
    it('2.1: Resolves and establishes real borrower context for selected campaign member', async () => {
      const prevMode = process.env.VAPI_WEB_QA_MODE;
      const prevPub = process.env.VAPI_PUBLIC_KEY;
      process.env.VAPI_WEB_QA_MODE = 'enable';
      process.env.VAPI_PUBLIC_KEY = 'vapi_test_pubkey';

      try {
        const res = await app.request('/api/v1/integrations/web-qa-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: testCampaignId,
            loanId: eligibleLoanId,
            phoneNumberId: eligiblePhoneId
          })
        });

        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.success).toBe(true);
        expect(data.assistantId).toBe(config.VAPI_ASSISTANT_ID);

        // Verify dynamic borrower context was populated server-side
        expect(data.syntheticContext.borrower_first_name).toBe('Samantha');
        expect(data.syntheticContext.borrower_last_name).toBe('Eligible');
        expect(data.syntheticContext.past_due_amount).toBe('$1250.00');
        expect(data.syntheticContext.days_past_due).toBe('15');
        expect(data.syntheticContext.loan_id).toBe(eligibleLoanId);
        expect(data.syntheticContext.interaction_reference).toContain('QA-TEST-ELIG');

        // Member context evaluation
        expect(data.memberContext).toBeDefined();
        expect(data.memberContext.borrowerName).toBe('Samantha Eligible');
        expect(data.memberContext.eligibility.eligible).toBe(true);
      } finally {
        process.env.VAPI_WEB_QA_MODE = prevMode;
        process.env.VAPI_PUBLIC_KEY = prevPub;
      }
    });

    it('2.2: Reports fresh pre-dial gate failure when selected member is blocked', async () => {
      const prevMode = process.env.VAPI_WEB_QA_MODE;
      const prevPub = process.env.VAPI_PUBLIC_KEY;
      process.env.VAPI_WEB_QA_MODE = 'enable';
      process.env.VAPI_PUBLIC_KEY = 'vapi_test_pubkey';

      try {
        const res = await app.request('/api/v1/integrations/web-qa-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: testCampaignId,
            loanId: blockedLoanId,
            phoneNumberId: blockedPhoneId
          })
        });

        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.success).toBe(true);
        expect(data.syntheticContext.borrower_first_name).toBe('Benjamin');
        expect(data.memberContext.eligibility.eligible).toBe(false);
        expect(data.memberContext.eligibility.finalResult).toBe('BLOCKED_BANKRUPTCY');
      } finally {
        process.env.VAPI_WEB_QA_MODE = prevMode;
        process.env.VAPI_PUBLIC_KEY = prevPub;
      }
    });
  });

  // ─── 3. QA STORAGE ISOLATION & NO FAKE OPERATIONAL ROWS ────────────────────
  describe('3. QA Storage Isolation & No Operational Mutation', () => {
    it('3.1: Records session completion in qaSimulationRuns and stateChangeLog with zero callAttempts inserted', async () => {
      const attemptsBefore = await db.select().from(callAttempts);

      const res = await app.request('/api/v1/integrations/web-qa-session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: testCampaignId,
          loanId: eligibleLoanId,
          phoneNumberId: eligiblePhoneId,
          transcript: [
            { role: 'assistant', text: 'Hello, this is Apex Mortgage Servicing calling on a recorded line.' },
            { role: 'user', text: 'Hi, I can make a payment this Friday.' },
            { role: 'assistant', text: 'Thank you, I have noted your promise to pay.' }
          ],
          durationSeconds: 45,
          disposition: 'RPC_PAYMENT_PROMISED'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.runId).toContain('SIM-QA');

      // Verify zero rows written to operational callAttempts table
      const attemptsAfter = await db.select().from(callAttempts);
      expect(attemptsAfter.length).toBe(attemptsBefore.length);

      // Verify recorded in isolated qaSimulationRuns table
      const qaRun = await db.query.qaSimulationRuns.findFirst({
        where: (q, { eq }) => eq(q.runId, data.runId)
      });
      expect(qaRun).toBeDefined();
      expect(qaRun?.selectedOutcome).toBe('BROWSER_VOICE_QA');
      expect(qaRun?.normalizedDisposition).toBe('RPC_PAYMENT_PROMISED');

      // Verify recorded in stateChangeLog for audit timeline
      const auditLog = await db.query.stateChangeLog.findFirst({
        where: (s, { and, eq }) => and(eq(s.loanId, eligibleLoanId), eq(s.fieldName, 'browser_voice_session_completed')),
        orderBy: [desc(stateChangeLog.changedAt)]
      });
      expect(auditLog).toBeDefined();
      expect((auditLog?.newValue as any)?.disposition).toBe('RPC_PAYMENT_PROMISED');
      expect((auditLog?.newValue as any)?.telephonyEgress).toBe('NONE');
    });
  });

  // ─── 4. TELEPHONE DISPATCH SAFETY GATES ────────────────────────────────────
  describe('4. Telephone Dispatch Safety & Membership Gating', () => {
    it('4.1: launch-call rejects loan not in specified campaign with LOAN_NOT_IN_CAMPAIGN', async () => {
      const res = await app.request(`/api/v1/campaigns/${testCampaignId}/launch-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: unrelatedLoanId
        })
      });

      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.reason).toBe('LOAN_NOT_IN_CAMPAIGN');
    });

    it('4.2: launch-call re-evaluates all 12 gates and fails closed on blocked borrower', async () => {
      const res = await app.request(`/api/v1/campaigns/${testCampaignId}/launch-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: blockedLoanId,
          phoneNumberId: blockedPhoneId
        })
      });

      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.status).toBe('blocked_at_dispatch');
      expect(data.reason).toBe('BLOCKED_BANKRUPTCY');
    });

    it('4.3: launch-call blocks unverified destination not in allowlist', async () => {
      const res = await app.request(`/api/v1/campaigns/${testCampaignId}/launch-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: eligibleLoanId,
          phoneNumberId: eligiblePhoneId
        })
      });

      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.reason).toBe('DESTINATION_NOT_IN_VERIFIED_ALLOWLIST');
    });
  });

  afterAll(async () => {
    // 1. Delete campaign members first (references campaigns, loans, phoneNumbers)
    if (testCampaignId) {
      await db.delete(campaignMembers).where(eq(campaignMembers.campaignId, testCampaignId));
      await db.delete(eligibilityEvaluations).where(eq(eligibilityEvaluations.campaignId, testCampaignId));
    }
    if (testCampaignId2) {
      await db.delete(campaignMembers).where(eq(campaignMembers.campaignId, testCampaignId2));
      await db.delete(eligibilityEvaluations).where(eq(eligibilityEvaluations.campaignId, testCampaignId2));
    }

    // 2. Clear campaignId on loans to break foreign key to campaigns
    if (eligibleLoanId) {
      await db.update(loans).set({ campaignId: null }).where(eq(loans.id, eligibleLoanId));
    }
    if (blockedLoanId) {
      await db.update(loans).set({ campaignId: null }).where(eq(loans.id, blockedLoanId));
    }
    if (unrelatedLoanId) {
      await db.update(loans).set({ campaignId: null }).where(eq(loans.id, unrelatedLoanId));
    }

    // 3. Delete campaigns
    if (testCampaignId) {
      await db.delete(campaigns).where(eq(campaigns.id, testCampaignId));
    }
    if (testCampaignId2) {
      await db.delete(campaigns).where(eq(campaigns.id, testCampaignId2));
    }

    // 3.5. Delete test QA runs and state change logs referencing test loans
    for (const lid of [eligibleLoanId, blockedLoanId, unrelatedLoanId]) {
      if (lid) {
        await db.delete(qaSimulationRuns).where(eq(qaSimulationRuns.loanId, lid));
        await db.delete(stateChangeLog).where(eq(stateChangeLog.loanId, lid));
      }
    }

    // 4. Delete phones, borrowers, loans
    if (eligibleLoanId) {
      await db.delete(phoneNumbers).where(eq(phoneNumbers.loanId, eligibleLoanId));
      await db.delete(borrowers).where(eq(borrowers.loanId, eligibleLoanId));
      await db.delete(loans).where(eq(loans.id, eligibleLoanId));
    }
    if (blockedLoanId) {
      await db.delete(phoneNumbers).where(eq(phoneNumbers.loanId, blockedLoanId));
      await db.delete(borrowers).where(eq(borrowers.loanId, blockedLoanId));
      await db.delete(loans).where(eq(loans.id, blockedLoanId));
    }
    if (unrelatedLoanId) {
      await db.delete(phoneNumbers).where(eq(phoneNumbers.loanId, unrelatedLoanId));
      await db.delete(borrowers).where(eq(borrowers.loanId, unrelatedLoanId));
      await db.delete(loans).where(eq(loans.id, unrelatedLoanId));
    }
  });
});
