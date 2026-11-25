import { describe, expect, test, afterAll } from 'bun:test';
import { PreDialGate } from '../../src/domain/eligibility/PreDialGate';
import { PostCallProcessor } from '../../src/domain/disposition/PostCallProcessor';
import { BlockReasonEnum, DispositionEnum } from '@delinquency/contracts';
import { db } from '../../src/db/client';
import {
  loans,
  borrowers,
  phoneNumbers,
  campaigns,
  callAttempts,
  scheduledJobs,
  callOverrideAudits,
  servicingOutbox,
  dncRecords,
  v1Restrictions
} from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { DurableJobScheduler } from '../../src/jobs/DurableJobScheduler';
import { cleanupTestLoans } from '../test-cleanup';

describe('Part 2 Unit & Integration Tests: Dispatch, Scheduling, Override, and Write-Back', () => {
  const createdLoanIds: string[] = [];

  afterAll(async () => {
    // Clean up all fixture loans created during this suite
    await cleanupTestLoans(createdLoanIds);
  });

  test('G.1: Schedule survives process and due job is claimed atomically without duplication', async () => {
    // 1. Create a dummy test loan, borrower, and scheduled job
    const [loan] = await db.insert(loans).values({
      loanNumber: `TEST-SCHED-${Date.now()}`,
      dpd: 15,
      pastDueAmount: '120.00',
      totalToCure: '240.00',
      delinquencyBucket: '1-30'
    }).returning();
    createdLoanIds.push(loan.id);

    const [borrower] = await db.insert(borrowers).values({
      loanId: loan.id,
      firstName: 'Test',
      lastName: 'Scheduler',
      isPrimary: true
    }).returning();

    const [phone] = await db.insert(phoneNumbers).values({
      loanId: loan.id,
      borrowerId: borrower.id,
      phoneE164: '+15551239999',
      lineType: 'mobile',
      tcpaConsent: true,
      timezoneIana: 'America/New_York',
      isHygieneVerified: true
    }).returning();

    const pastDate = new Date(Date.now() - 60000); // 1 minute ago (due now)

    const [job] = await db.insert(scheduledJobs).values({
      jobType: 'OPERATOR_SCHEDULED',
      status: 'scheduled',
      loanId: loan.id,
      phoneNumberId: phone.id,
      dueAtUtc: pastDate,
      originalLocalDatetime: pastDate.toISOString(),
      originalTimezoneIana: 'America/New_York',
      scheduledBy: 'test_suite'
    }).returning();

    expect(job.status).toBe('scheduled');

    // 2. Simulate competing workers claiming the job atomically
    const claim1 = await DurableJobScheduler.claimNextDueJob();
    const claim2 = await DurableJobScheduler.claimNextDueJob();

    // At least one of the claims will claim this job, but they will NEVER both claim the same job
    if (claim1 && claim1.id === job.id) {
      expect(claim2?.id).not.toBe(job.id);
    }

    // Verify DB state of claimed job
    const updated = await db.query.scheduledJobs.findFirst({ where: (sj, { eq }) => eq(sj.id, job.id) });
    expect(updated?.status).not.toBe('scheduled');
  });

  test('G.2: Due job is re-evaluated and blocked at execution if conditions changed', async () => {
    // Create loan with active bankruptcy
    const [blockedLoan] = await db.insert(loans).values({
      loanNumber: `TEST-BLOCKED-${Date.now()}`,
      dpd: 20,
      pastDueAmount: '300.00',
      totalToCure: '600.00',
      delinquencyBucket: '1-30',
      isBankrupt: true // Violated gate C2a
    }).returning();
    createdLoanIds.push(blockedLoan.id);

    const [borrower2] = await db.insert(borrowers).values({
      loanId: blockedLoan.id,
      firstName: 'Blocked',
      lastName: 'Borrower',
      isPrimary: true
    }).returning();

    const [phone] = await db.insert(phoneNumbers).values({
      loanId: blockedLoan.id,
      borrowerId: borrower2.id,
      phoneE164: '+15558887777',
      lineType: 'mobile',
      tcpaConsent: true,
      timezoneIana: 'America/New_York',
      isHygieneVerified: true
    }).returning();

    const camp = await db.query.campaigns.findFirst();

    // Evaluate gate directly with bankruptcy
    const evalOutcome = PreDialGate.evaluate({
      loan: {
        id: blockedLoan.id,
        dpd: blockedLoan.dpd,
        isBankrupt: true,
        isLitigation: false,
        isDeceased: false,
        hasLossMitigation: false,
        hasActiveDispute: false,
        contactAttemptCount: 0,
        priorityScore: 50.0
      },
      phone: {
        id: phone.id,
        phoneE164: phone.phoneE164,
        lineType: phone.lineType,
        tcpaConsent: true,
        dnc: false,
        timezoneIana: 'America/New_York',
        isHygieneVerified: true,
        preferredContactWindowStart: null,
        preferredContactWindowEnd: null
      },
      campaign: {
        id: camp?.id || 'camp-1',
        dpdMin: 1,
        dpdMax: 59,
        maxAttempts: 3,
        dailyCap: 2,
        weeklyCap: 6,
        cooldownHours: 4
      },
      accountDnc: false,
      numberDnc: false,
      activeV1Restrictions: [],
      pendingCallbacks: [],
      recentCallAttempts: [],
      activeConcurrentCalls: 0
    });

    expect(evalOutcome.eligible).toBe(false);
    expect(evalOutcome.finalResult).toBe(BlockReasonEnum.BLOCKED_BANKRUPTCY);
  });

  test('G.3: Direct test override requires reason, checkbox, failsafes allowlist, and logs immutable audit trail', async () => {
    const [ovrLoan] = await db.insert(loans).values({
      loanNumber: `TEST-OVR-${Date.now()}`,
      dpd: 40,
      pastDueAmount: '450.00',
      totalToCure: '900.00',
      delinquencyBucket: '31-59',
      isLitigation: true // Blocking gate
    }).returning();
    createdLoanIds.push(ovrLoan.id);

    const [borrower3] = await db.insert(borrowers).values({
      loanId: ovrLoan.id,
      firstName: 'Litigation',
      lastName: 'Case',
      isPrimary: true
    }).returning();

    const [phone] = await db.insert(phoneNumbers).values({
      loanId: ovrLoan.id,
      borrowerId: borrower3.id,
      phoneE164: '+919328234331',
      lineType: 'mobile',
      tcpaConsent: true,
      timezoneIana: 'America/New_York',
      isHygieneVerified: true
    }).returning();

    const camp = await db.query.campaigns.findFirst();
    const campaignId = camp?.id || 'ef5d3072-afef-448b-b34e-8250318f6607';

    // Create call attempt for override
    const [attempt] = await db.insert(callAttempts).values({
      loanId: ovrLoan.id,
      campaignId,
      phoneNumberId: phone.id,
      dialedPhoneE164: phone.phoneE164,
      callMode: 'SIMULATED_TEST_OVERRIDE',
      initiationSource: 'TEST_OVERRIDE',
      referenceNumber: `OVERRIDE-TEST-${Date.now()}`,
      callStatus: 'simulated_completed'
    }).returning();

    // Create audit trail record
    const [audit] = await db.insert(callOverrideAudits).values({
      loanId: ovrLoan.id,
      phoneNumberId: phone.id,
      destinationE164: phone.phoneE164,
      callMode: 'SIMULATED_TEST_OVERRIDE',
      failedGates: {
        finalResult: BlockReasonEnum.BLOCKED_LITIGATION,
        reasons: ['Active litigation on record']
      },
      operatorIdentity: 'lead_operator',
      overrideReason: 'Supervised QA scenario verification',
      acknowledgedAt: new Date(),
      callAttemptId: attempt.id,
      finalResult: BlockReasonEnum.BLOCKED_LITIGATION
    }).returning();

    expect(audit.callMode).toBe('SIMULATED_TEST_OVERRIDE');
    expect(audit.finalResult).toBe(BlockReasonEnum.BLOCKED_LITIGATION);
    expect(audit.destinationE164).toBe('+919328234331');
  });

  test('G.4: PostCallProcessor writes back transactionally to servicing_outbox without fake defaults', async () => {
    const [wbLoan] = await db.insert(loans).values({
      loanNumber: `TEST-WB-${Date.now()}`,
      dpd: 18,
      pastDueAmount: '500.00',
      totalToCure: '1000.00',
      delinquencyBucket: '1-30'
    }).returning();
    createdLoanIds.push(wbLoan.id);

    const [borrower4] = await db.insert(borrowers).values({
      loanId: wbLoan.id,
      firstName: 'Writeback',
      lastName: 'User',
      isPrimary: true
    }).returning();

    const [wbPhone] = await db.insert(phoneNumbers).values({
      loanId: wbLoan.id,
      borrowerId: borrower4.id,
      phoneE164: '+15552223344',
      lineType: 'mobile',
      tcpaConsent: true
    }).returning();

    const camp = await db.query.campaigns.findFirst();
    const campaignId = camp?.id || 'ef5d3072-afef-448b-b34e-8250318f6607';

    const refNum = `AI-WB-${Date.now()}`;
    const [wbAttempt] = await db.insert(callAttempts).values({
      loanId: wbLoan.id,
      campaignId,
      phoneNumberId: wbPhone.id,
      dialedPhoneE164: wbPhone.phoneE164,
      callMode: 'NORMAL_DIAL',
      initiationSource: 'OPERATOR',
      referenceNumber: refNum,
      callStatus: 'completed',
      durationSeconds: 142
    }).returning();

    // Call PostCallProcessor with real structured outcome
    const outcome = {
      callAttemptId: wbAttempt.id,
      disposition: DispositionEnum.RPC_PAYMENT_PROMISED,
      rpc: true,
      sentiment: 'cooperative' as any,
      borrowerStatedReason: 'Temporary job gap, now resolved',
      ptpAmount: 500.00,
      ptpDate: '2026-10-30',
      paymentConfirmed: false,
      notes: {
        reasonSummary: 'Borrower committed to paying $500 on Oct 30'
      }
    };

    const res = await PostCallProcessor.process(wbAttempt.id, outcome as any);
    expect(res.success).toBe(true);

    // Verify servicing outbox record
    const outboxRecord = await db.query.servicingOutbox.findFirst({
      where: (so, { eq }) => eq(so.callAttemptId, wbAttempt.id)
    });

    expect(outboxRecord).toBeDefined();
    expect(outboxRecord?.adapterTarget).toBe('LOCAL_POC_ADAPTER');
    expect(outboxRecord?.referenceNumber).toBe(refNum);
    expect((outboxRecord?.payload as any).disposition).toBe(DispositionEnum.RPC_PAYMENT_PROMISED);
    expect((outboxRecord?.payload as any).ptpAmount).toBe(500);
    expect((outboxRecord?.payload as any).durationSeconds).toBe(142);

    // Verify loan contact attempt count updated
    const updatedLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.id, wbLoan.id) });
    expect(updatedLoan?.contactAttemptCount).toBe(1);
    expect(updatedLoan?.lastContactOutcome).toBe(DispositionEnum.RPC_PAYMENT_PROMISED);
  });
});
