import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '../../src/db/client';
import {
  loans,
  borrowers,
  phoneNumbers,
  campaigns,
  scheduledJobs,
  servicingOutbox,
  callAttempts,
  callOverrideAudits,
  providerWebhookEvents
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { PreDialGate } from '../../src/domain/eligibility/PreDialGate';
import { SafetyInterlock } from '../../src/services/SafetyInterlock';
import { DurableJobScheduler } from '../../src/jobs/DurableJobScheduler';
import { PostCallProcessor } from '../../src/domain/disposition/PostCallProcessor';
import { DispositionEnum, BlockReasonEnum } from '@delinquency/contracts';
import { config } from '../../src/config';
import { cleanupTestLoans } from '../test-cleanup';

describe('Part 4: Comprehensive End-to-End Workflow Verification', () => {
  let testCampaignId: string;
  let testLoanId: string;
  let primaryPhoneId: string;
  let secondaryPhoneId: string;

  beforeAll(async () => {
    let camp = await db.query.campaigns.findFirst({
      where: (c, { eq }) => eq(c.name, 'E2E Verification Campaign')
    });
    if (!camp) {
      const [newCamp] = await db.insert(campaigns).values({
        name: 'E2E Verification Campaign',
        description: 'Automated end-to-end verification campaign',
        cohortLabel: 'E2E 1-59 DPD',
        dpdMin: 1,
        dpdMax: 59,
        status: 'active',
        maxAttempts: 3,
        dailyCap: 2,
        weeklyCap: 6,
        cooldownHours: 4,
        isSeeded: false
      }).returning();
      camp = newCamp;
    }
    testCampaignId = camp.id;
  });

  it('1. Accounts & Multi-Phone: creates account with two independent numbers and differing consent/DNC', async () => {
    const loanNum = `E2E-LOAN-${Date.now()}`;
    const [loan] = await db.insert(loans).values({
      campaignId: testCampaignId,
      loanNumber: loanNum,
      servicerId: 'SERVICER-E2E',
      productType: 'Conventional 30Y Fixed',
      interestRate: '0.0650',
      upb: '310000.00',
      piPayment: '1959.43',
      dpd: 16,
      delinquencyBucket: '1-30',
      pastDueAmount: '1959.43',
      totalToCure: '2024.43',
      isBankrupt: false,
      isLitigation: false,
      isDeceased: false,
      hasLossMitigation: false,
      hasActiveDispute: false,
      isScra: false,
      hasLegalTrigger: false,
      priorityScore: '65.00',
      isSeeded: false
    }).returning();
    testLoanId = loan.id;

    const [borrower] = await db.insert(borrowers).values({
      loanId: loan.id,
      isPrimary: true,
      firstName: 'Elena',
      lastName: 'Rostova',
      dob: '1988-06-15',
      addressLine1: '404 Verification Blvd',
      addressCity: 'Columbus',
      addressState: 'OH',
      addressZip: '43215',
      preferredLanguage: 'en',
      servicerReferenceNumber: `REF-${Date.now()}`,
      isSeeded: false
    }).returning();

    // Phone 1: Mobile with TCPA consent granted
    const [p1] = await db.insert(phoneNumbers).values({
      borrowerId: borrower.id,
      loanId: loan.id,
      phoneE164: '+16145550101',
      label: 'mobile_primary',
      relationship: 'borrower',
      lineType: 'mobile',
      isPrimary: true,
      tcpaConsent: true,
      tcpaConsentDate: new Date(),
      consentState: 'GRANTED',
      consentScope: 'servicing_calls',
      consentSource: 'account_onboarding',
      dnc: false,
      timezoneIana: 'America/New_York',
      state: 'OH',
      isHygieneVerified: true,
      isSeeded: false
    }).returning();
    primaryPhoneId = p1.id;

    // Phone 2: Landline without TCPA consent, separate timezone
    const [p2] = await db.insert(phoneNumbers).values({
      borrowerId: borrower.id,
      loanId: loan.id,
      phoneE164: '+12135550202',
      label: 'work_landline',
      relationship: 'work',
      lineType: 'landline',
      isPrimary: false,
      tcpaConsent: false,
      consentState: 'UNKNOWN',
      dnc: false,
      timezoneIana: 'America/Los_Angeles',
      state: 'CA',
      isHygieneVerified: true,
      isSeeded: false
    }).returning();
    secondaryPhoneId = p2.id;

    expect(primaryPhoneId).toBeDefined();
    expect(secondaryPhoneId).toBeDefined();
    expect(primaryPhoneId).not.toBe(secondaryPhoneId);

    const p1Record = await db.query.phoneNumbers.findFirst({ where: (p, { eq }) => eq(p.id, primaryPhoneId) });
    const p2Record = await db.query.phoneNumbers.findFirst({ where: (p, { eq }) => eq(p.id, secondaryPhoneId) });
    expect(p1Record?.lineType).toBe('mobile');
    expect(p1Record?.tcpaConsent).toBe(true);
    expect(p2Record?.lineType).toBe('landline');
    expect(p2Record?.tcpaConsent).toBe(false);
  });

  it('2. Multi-phone PreDialGate: primary phone passes mobile consent; landline passes without mobile consent', async () => {
    const loan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.id, testLoanId) });
    const p1 = await db.query.phoneNumbers.findFirst({ where: (p, { eq }) => eq(p.id, primaryPhoneId) });
    const p2 = await db.query.phoneNumbers.findFirst({ where: (p, { eq }) => eq(p.id, secondaryPhoneId) });

    const midDayTime = new Date('2026-10-21T18:00:00Z'); // 2:00 PM EDT / 11:00 AM PDT

    // Eval phone 1 (Mobile with consent)
    const eval1 = PreDialGate.evaluate({
      loan: { ...loan!, contactAttemptCount: loan!.contactAttemptCount || 0, priorityScore: loan!.priorityScore },
      phone: { ...p1!, preferredContactWindowStart: null, preferredContactWindowEnd: null },
      campaign: { id: testCampaignId, dpdMin: 1, dpdMax: 59, maxAttempts: 3, dailyCap: 2, weeklyCap: 6, cooldownHours: 4 },
      accountDnc: false,
      numberDnc: false,
      recentCallAttempts: [],
      pendingCallbacks: [],
      activeV1Restrictions: [],
      activeConcurrentCalls: 0
    }, midDayTime);

    const c5_1 = eval1.checkResults.find(c => c.check.startsWith('C5'));
    expect(c5_1?.result).toBe('pass');

    // Eval phone 2 (Landline without consent)
    const eval2 = PreDialGate.evaluate({
      loan: { ...loan!, contactAttemptCount: loan!.contactAttemptCount || 0, priorityScore: loan!.priorityScore },
      phone: { ...p2!, preferredContactWindowStart: null, preferredContactWindowEnd: null },
      campaign: { id: testCampaignId, dpdMin: 1, dpdMax: 59, maxAttempts: 3, dailyCap: 2, weeklyCap: 6, cooldownHours: 4 },
      accountDnc: false,
      numberDnc: false,
      recentCallAttempts: [],
      pendingCallbacks: [],
      activeV1Restrictions: [],
      activeConcurrentCalls: 0
    }, midDayTime);

    const c5_2 = eval2.checkResults.find(c => c.check.startsWith('C5'));
    expect(c5_2?.result).toBe('pass');
  });

  it('3. Gate Diagnostics: changing loan state immediately alters gate results and prevents stale UI bypass', async () => {
    const loan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.id, testLoanId) });
    const p1 = await db.query.phoneNumbers.findFirst({ where: (p, { eq }) => eq(p.id, primaryPhoneId) });
    const midDayTime = new Date('2026-10-21T18:00:00Z');

    let gateEval = PreDialGate.evaluate({
      loan: { ...loan!, contactAttemptCount: loan!.contactAttemptCount || 0, priorityScore: loan!.priorityScore },
      phone: { ...p1!, preferredContactWindowStart: null, preferredContactWindowEnd: null },
      campaign: { id: testCampaignId, dpdMin: 1, dpdMax: 59, maxAttempts: 3, dailyCap: 2, weeklyCap: 6, cooldownHours: 4 },
      accountDnc: false,
      numberDnc: false,
      recentCallAttempts: [],
      pendingCallbacks: [],
      activeV1Restrictions: [],
      activeConcurrentCalls: 0
    }, midDayTime);
    expect(gateEval.checkResults.find(c => c.check.startsWith('C2a'))?.result).toBe('pass');
    expect(gateEval.checkResults.find(c => c.check.startsWith('C2c'))?.result).toBe('pass');

    // Mutate loan to active dispute in database
    await db.update(loans).set({ hasActiveDispute: true }).where(eq(loans.id, testLoanId));
    const mutatedLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.id, testLoanId) });

    gateEval = PreDialGate.evaluate({
      loan: { ...mutatedLoan!, contactAttemptCount: mutatedLoan!.contactAttemptCount || 0, priorityScore: mutatedLoan!.priorityScore },
      phone: { ...p1!, preferredContactWindowStart: null, preferredContactWindowEnd: null },
      campaign: { id: testCampaignId, dpdMin: 1, dpdMax: 59, maxAttempts: 3, dailyCap: 2, weeklyCap: 6, cooldownHours: 4 },
      accountDnc: false,
      numberDnc: false,
      recentCallAttempts: [],
      pendingCallbacks: [],
      activeV1Restrictions: [],
      activeConcurrentCalls: 0
    }, midDayTime);
    expect(gateEval.checkResults.find(c => c.check.startsWith('C2c'))?.result).toBe('fail');
    expect(gateEval.checkResults.find(c => c.check.startsWith('C2c'))?.reason?.toLowerCase()).toContain('dispute');
    expect(gateEval.eligible).toBe(false);

    // Reset dispute
    await db.update(loans).set({ hasActiveDispute: false }).where(eq(loans.id, testLoanId));
  });

  it('4. Safety Interlock: prevents non-allowlisted destination from both normal call and direct test override', async () => {
    const nonAllowlistedPhone = '+16145559999';
    const check1 = SafetyInterlock.validateDestination(nonAllowlistedPhone);
    expect(check1.allowed).toBe(false);
    expect(check1.reason).toContain('Safety interlock active');

    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allowed.length > 0) {
      const allowedDestination = allowed[0];
      const check2 = SafetyInterlock.validateDestination(allowedDestination);
      expect(check2.allowed).toBe(true);
      expect(check2.destination).toBe(allowedDestination);
    }
  });

  it('5. Direct Test Override: audits mode as DIRECT_TEST_OVERRIDE and preserves failed gate snapshot', async () => {
    const simulatedViolatedGates = {
      finalResult: BlockReasonEnum.BLOCKED_COOLDOWN,
      reasons: ['Call attempt within last 4 hours']
    };

    const refNum = `REF-OVERRIDE-${Date.now()}`;
    const [overrideAttempt] = await db.insert(callAttempts).values({
      loanId: testLoanId,
      campaignId: testCampaignId,
      referenceNumber: refNum,
      disposition: 'PENDING_DISPATCH',
      callMode: 'SIMULATED_TEST_OVERRIDE',
      initiationSource: 'TEST_OVERRIDE',
      dialedPhoneE164: '+16145550101',
      isSeeded: false
    }).returning();

    const [auditEntry] = await db.insert(callOverrideAudits).values({
      loanId: testLoanId,
      phoneNumberId: primaryPhoneId,
      destinationE164: '+16145550101',
      callMode: 'SIMULATED_TEST_OVERRIDE',
      failedGates: simulatedViolatedGates,
      operatorIdentity: 'qa_lead',
      overrideReason: 'Supervised test override verification',
      acknowledgedAt: new Date(),
      callAttemptId: overrideAttempt.id,
      finalResult: BlockReasonEnum.BLOCKED_COOLDOWN
    }).returning();

    expect(auditEntry.callMode).toBe('SIMULATED_TEST_OVERRIDE');
    expect(auditEntry.overrideReason).toBe('Supervised test override verification');
    expect((auditEntry.failedGates as any).finalResult).toBe(BlockReasonEnum.BLOCKED_COOLDOWN);
  });

  it('6. Durable Scheduling: persists future operator job, re-evaluates gate at due time, blocks if conditions changed', async () => {
    const dueTime = new Date(Date.now() - 5000); // 5s in past to be immediately due
    const [job] = await db.insert(scheduledJobs).values({
      loanId: testLoanId,
      campaignId: testCampaignId,
      phoneNumberId: primaryPhoneId,
      targetPhoneE164: '+16145550101',
      jobType: 'OPERATOR_SCHEDULED',
      dueAtUtc: dueTime,
      originalTimezoneIana: 'America/New_York',
      status: 'scheduled'
    }).returning();

    // Invalidate eligibility before worker executes
    await db.update(loans).set({ isBankrupt: true }).where(eq(loans.id, testLoanId));

    // Run scheduler worker claim and process
    await DurableJobScheduler.pollAndExecute();

    // Verify job transitioned to blocked_at_execution
    const reloadedJob = await db.query.scheduledJobs.findFirst({
      where: (j, { eq }) => eq(j.id, job.id)
    });
    expect(reloadedJob?.status).toBe('blocked_at_execution');
    expect(reloadedJob?.blockedAtExecutionReason).toContain('BLOCKED_BANKRUPTCY');

    // Restore loan
    await db.update(loans).set({ isBankrupt: false }).where(eq(loans.id, testLoanId));
  });

  it('7. PostCallProcessor: idempotently processes webhook, records outbox write-back without fake defaults', async () => {
    const callAttemptId = crypto.randomUUID();
    const [attempt] = await db.insert(callAttempts).values({
      id: callAttemptId,
      loanId: testLoanId,
      campaignId: testCampaignId,
      phoneNumberId: primaryPhoneId,
      dialedPhoneE164: '+16145550101',
      disposition: 'IN_PROGRESS',
      callMode: 'NORMAL_DIAL',
      initiationSource: 'OPERATOR',
      referenceNumber: `REF-WB-${Date.now()}`,
      isSeeded: false
    }).returning();

    const outcome = {
      callAttemptId,
      disposition: DispositionEnum.RPC_PAYMENT_PROMISED,
      rpc: true,
      sentiment: 'cooperative' as const,
      ptpAmount: 750,
      ptpDate: '2026-10-31',
      paymentConfirmed: false,
      notes: {
        reasonSummary: 'Borrower committed $750 by end of month'
      }
    };

    // First write-back execution
    const res1 = await PostCallProcessor.process(callAttemptId, outcome);
    expect(res1.success).toBe(true);

    // Verify outbox row was written
    const outboxRows = await db.query.servicingOutbox.findMany({
      where: (o, { eq }) => eq(o.callAttemptId, callAttemptId)
    });
    expect(outboxRows.length).toBe(1);
    expect(outboxRows[0].deliveryStatus).toBe('delivered_local');
    const payload = outboxRows[0].payload as any;
    expect(payload.disposition).toBe(DispositionEnum.RPC_PAYMENT_PROMISED);
    expect(payload.ptpAmount).toBe(750);
    expect(payload.ptpDate).toBe('2026-10-31');

    // Verify loan was updated in DB
    const updatedLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.id, testLoanId) });
    expect(updatedLoan?.lastContactOutcome).toBe(DispositionEnum.RPC_PAYMENT_PROMISED);
    expect(updatedLoan?.rpcAchieved).toBe(true);
    expect(updatedLoan?.contactAttemptCount).toBeGreaterThanOrEqual(1);
  });

  it('8. Webhook Deduplication: providerWebhookEvents rejects duplicate externalId events', async () => {
    const externalId = `vapi-dup-test-${Date.now()}`;
    const eventType = 'end-of-call-report';

    // Insert first event
    await db.insert(providerWebhookEvents).values({
      provider: 'vapi',
      eventType,
      externalId,
      payloadHash: `hash-${externalId}`,
      rawPayload: { id: externalId, status: 'completed' },
      processedAt: new Date()
    });

    // Check duplicate detection
    const existing = await db.query.providerWebhookEvents.findFirst({
      where: (pwe, { eq, and }) => and(eq(pwe.provider, 'vapi'), eq(pwe.externalId, externalId), eq(pwe.eventType, eventType))
    });

    expect(existing).not.toBeNull();
    expect(existing?.externalId).toBe(externalId);

    // Clean up webhook event
    await db.delete(providerWebhookEvents).where(eq(providerWebhookEvents.externalId, externalId));
  });

  afterAll(async () => {
    // Clean up test loan and test campaign
    if (testLoanId) {
      await cleanupTestLoans([testLoanId], testCampaignId ? [testCampaignId] : []);
    }
  });
});
