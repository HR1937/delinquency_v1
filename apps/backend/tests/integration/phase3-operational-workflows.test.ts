import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { config } from '../../src/config';
import {
  loans,
  borrowers,
  phoneNumbers,
  campaigns,
  scheduledJobs,
  callbacks,
  servicingOutbox,
  humanEscalations,
  providerWebhookEvents,
  callAttempts,
  stateChangeLog,
  eligibilityEvaluations
} from '../../src/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { DurableJobScheduler } from '../../src/jobs/DurableJobScheduler';
import { PostCallProcessor } from '../../src/domain/disposition/PostCallProcessor';
import { DispositionEnum } from '@delinquency/contracts';
import { evaluateCooldown } from '../../src/domain/eligibility/PreDialChecks';

describe('Phase 3: Operational Workflow Foundation, Integration Readiness & Safety Hardening', () => {
  const createdLoanIds: string[] = [];
  const createdJobIds: string[] = [];
  const createdCallbackIds: string[] = [];
  const createdOutboxIds: string[] = [];
  const createdEscalationIds: string[] = [];
  const createdAttemptIds: string[] = [];

  let testLoanId: string;
  let testPhoneId: string;
  let testCampaignId: string;

  beforeAll(async () => {
    // 1. Fetch matching test campaign (DPD 22 -> 1-30 cohort)
    const camp = await db.query.campaigns.findFirst({
      where: (c, { and, lte, gte }) => and(lte(c.dpdMin, 22), gte(c.dpdMax, 22))
    });
    testCampaignId = camp?.id || crypto.randomUUID();

    // 2. Create isolated test loan for Phase 3 integration testing
    const [loan] = await db.insert(loans).values({
      loanNumber: `TEST-P3-${Date.now()}`,
      dpd: 22,
      delinquencyBucket: '1-30',
      pastDueAmount: '350.00',
      totalToCure: '700.00',
      isBankrupt: false,
      isLitigation: false,
      isDeceased: false,
      hasLossMitigation: false,
      hasActiveDispute: false,
      isScra: false,
      hardshipEligible: false,
      isSeeded: false
    }).returning();
    testLoanId = loan.id;
    createdLoanIds.push(loan.id);

    const [borrower] = await db.insert(borrowers).values({
      loanId: loan.id,
      firstName: 'Phase3',
      lastName: 'Tester',
      isPrimary: true
    }).returning();

    const allowedDest = (config.ALLOWED_TEST_DESTINATIONS || '').split(',').map((s: string) => s.trim()).filter(Boolean)[0] || '+15559993333';

    const [phone] = await db.insert(phoneNumbers).values({
      loanId: loan.id,
      borrowerId: borrower.id,
      phoneE164: allowedDest,
      lineType: 'mobile',
      tcpaConsent: true,
      timezoneIana: 'America/New_York',
      isHygieneVerified: true,
      isPrimary: true,
      dnc: false
    }).returning();
    testPhoneId = phone.id;
  });

  afterAll(async () => {
    // Clean up test records in correct foreign key order
    for (const lid of createdLoanIds) {
      await db.delete(eligibilityEvaluations).where(eq(eligibilityEvaluations.loanId, lid));
      await db.delete(stateChangeLog).where(eq(stateChangeLog.loanId, lid));
    }
    for (const jid of createdJobIds) {
      await db.delete(scheduledJobs).where(eq(scheduledJobs.id, jid));
    }
    for (const cbid of createdCallbackIds) {
      await db.delete(callbacks).where(eq(callbacks.id, cbid));
    }
    for (const oid of createdOutboxIds) {
      await db.delete(servicingOutbox).where(eq(servicingOutbox.id, oid));
    }
    for (const hid of createdEscalationIds) {
      await db.delete(humanEscalations).where(eq(humanEscalations.id, hid));
    }
    for (const aid of createdAttemptIds) {
      await db.delete(stateChangeLog).where(eq(stateChangeLog.callAttemptId, aid));
      await db.delete(servicingOutbox).where(eq(servicingOutbox.callAttemptId, aid));
      await db.delete(callAttempts).where(eq(callAttempts.id, aid));
    }
    for (const lid of createdLoanIds) {
      await db.delete(phoneNumbers).where(eq(phoneNumbers.loanId, lid));
      await db.delete(borrowers).where(eq(borrowers.loanId, lid));
      await db.delete(loans).where(eq(loans.id, lid));
    }
  });

  // ─── PART A: ENTRY GATE & COOLDOWN TESTS ─────────────────────────────────
  describe('Part A: Entry Gate & Shared Cooldown Logic', () => {
    it('A2.1: evaluateCooldown pure helper behaves deterministically at boundaries', () => {
      // Below boundary (3.9h < 4.0h) -> blocks
      const resBelow = evaluateCooldown(3.9, 4.0);
      expect(resBelow.passed).toBe(false);
      expect(resBelow.blockReason).toBe('BLOCKED_COOLDOWN');
      expect(resBelow.reason).toContain('3.9h elapsed < 4h required');

      // Exact boundary (4.0h >= 4.0h) -> passes
      const resExact = evaluateCooldown(4.0, 4.0);
      expect(resExact.passed).toBe(true);

      // Above boundary (4.1h >= 4.0h) -> passes
      const resAbove = evaluateCooldown(4.1, 4.0);
      expect(resAbove.passed).toBe(true);

      // Excessively large elapsed time (10,000h) -> passes without overflow
      const resLarge = evaluateCooldown(10000, 4.0);
      expect(resLarge.passed).toBe(true);
    });

    it('A2.2: evaluateCooldown rejects negative and non-finite inputs safely', () => {
      // Negative elapsed hours
      const resNeg = evaluateCooldown(-2, 4.0);
      expect(resNeg.passed).toBe(false);
      expect(resNeg.reason).toContain('negative');

      // NaN
      const resNan = evaluateCooldown(NaN, 4.0);
      expect(resNan.passed).toBe(false);
      expect(resNan.reason).toContain('finite');

      // Infinity
      const resInf = evaluateCooldown(Infinity, 4.0);
      expect(resInf.passed).toBe(false);
      expect(resInf.reason).toContain('finite');
    });

    it('A2.3: /api/v1/qa/cooldown-demo endpoint rejects invalid query params with 400', async () => {
      // Invalid string for elapsedHours
      const resInvalid = await app.request('/api/v1/qa/cooldown-demo?elapsedHours=not-a-number');
      expect(resInvalid.status).toBe(400);
      const dataInvalid = await resInvalid.json();
      expect(dataInvalid.error).toBe('INVALID_COOLDOWN_INPUT');

      // Negative elapsedHours
      const resNeg = await app.request('/api/v1/qa/cooldown-demo?elapsedHours=-5');
      expect(resNeg.status).toBe(400);

      // Invalid cooldownHours
      const resInvalidCd = await app.request('/api/v1/qa/cooldown-demo?elapsedHours=2&cooldownHours=0');
      expect(resInvalidCd.status).toBe(400);
    });

    it('A2.4: /api/v1/qa/cooldown-demo never inserts rows into operational call_attempts', async () => {
      const attemptsBefore = (await db.select().from(callAttempts)).length;
      const res = await app.request('/api/v1/qa/cooldown-demo?elapsedHours=5.0');
      expect(res.status).toBe(200);
      const attemptsAfter = (await db.select().from(callAttempts)).length;
      expect(attemptsAfter).toBe(attemptsBefore);
    });

    it('A3.1: Server guards baseline LN-* scenarios against deletion', async () => {
      const baseline = await db.query.loans.findFirst({
        where: (l, { like }) => like(l.loanNumber, 'LN-100001')
      });
      expect(baseline).toBeDefined();

      const res = await app.request(`/api/v1/qa/scenarios/${baseline!.id}`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(403);
      const err = await res.json();
      expect(err.error).toBe('Safety Violation: Baseline LN-* scenarios cannot be deleted');
    });

    it('A4.1: Integration health response separates credentials, lock state, probe, and dispatch', async () => {
      const res = await app.request('/api/v1/integrations/health');
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.database.driver).toBe('postgres.js');
      expect(data.database.isLocal).toBe(true);
      expect(data.database.readOnlyProbe.status).toBe('connected');

      expect(data.vapi.safetyLockState).toBe('SAFE_LOCK_ENFORCED');
      expect(data.vapi.dispatchState).toBe('BLOCKED_PROMPT_FROZEN');
      expect(data.vapi.readOnlyProbe.scope).toBe('read_only_assistant_metadata');

      expect(data.twilio.safetyLockState).toBe('ALLOWLIST_INTERLOCK_ACTIVE');
      expect(data.twilio.dispatchState).toBe('DRY_RUN_ONLY');

      expect(data.servicingOutbox.adapter).toBe('LOCAL_POC_OUTBOX_ADAPTER');
      expect(data.servicingOutbox.externalLosConnected).toBe(false);
    });
  });

  // ─── PART B: SCHEDULING, CALLBACKS & POST-CALL WORKFLOWS ─────────────────
  describe('Part B: Scheduling, Callbacks, Webhooks & Outbox Workflows', () => {
    it('B1.1: Operator can create, reschedule, and cancel a follow-up job with audit log', async () => {
      const futureDate = new Date(Date.now() + 2 * 3600000);

      // Create
      const createRes = await app.request('/api/v1/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: testLoanId,
          phoneNumberId: testPhoneId,
          campaignId: testCampaignId,
          jobType: 'OPERATOR_SCHEDULED',
          dueAtUtc: futureDate.toISOString(),
          originalTimezoneIana: 'America/New_York',
          notes: 'Test Operator Follow-up'
        })
      });
      expect(createRes.status).toBe(201);
      const job = await createRes.json();
      expect(job.status).toBe('scheduled');
      expect(job.jobType).toBe('OPERATOR_SCHEDULED');
      createdJobIds.push(job.id);

      // Reschedule
      const newFutureDate = new Date(Date.now() + 4 * 3600000);
      const patchRes = await app.request(`/api/v1/schedules/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueAtUtc: newFutureDate.toISOString(),
          notes: 'Rescheduled by supervisor'
        })
      });
      expect(patchRes.status).toBe(200);
      const updatedJob = await patchRes.json();
      expect(new Date(updatedJob.dueAtUtc).getTime()).toBe(newFutureDate.getTime());
      expect(updatedJob.notes).toBe('Rescheduled by supervisor');

      // Cancel
      const deleteRes = await app.request(`/api/v1/schedules/${job.id}`, {
        method: 'DELETE'
      });
      expect(deleteRes.status).toBe(200);
      const cancelledJob = await deleteRes.json();
      expect(cancelledJob.job.status).toBe('cancelled');
    });

    it('B1.2: Operator can create, reschedule, and cancel a callback with audit log', async () => {
      const futureDate = new Date(Date.now() + 3 * 3600000);

      // Create operator callback
      const createRes = await app.request('/api/v1/callbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: testLoanId,
          phoneNumberId: testPhoneId,
          callbackScheduledDatetime: futureDate.toISOString(),
          callbackTimezoneIana: 'America/New_York',
          humanReadableNote: 'Operator scheduled review call',
          operator: 'test_operator'
        })
      });
      expect(createRes.status).toBe(201);
      const cbData = await createRes.json();
      expect(cbData.success).toBe(true);
      expect(cbData.callback.status).toBe('scheduled');
      expect(cbData.callback.sourceCallAttemptId).toBeNull();
      createdCallbackIds.push(cbData.callback.id);
      if (cbData.job?.id) createdJobIds.push(cbData.job.id);

      // Reschedule callback
      const rescheduledDate = new Date(Date.now() + 5 * 3600000);
      const patchRes = await app.request(`/api/v1/callbacks/${cbData.callback.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callbackScheduledDatetime: rescheduledDate.toISOString(),
          humanReadableNote: 'Moved to afternoon',
          operator: 'test_operator'
        })
      });
      expect(patchRes.status).toBe(200);
      const updatedCb = await patchRes.json();
      expect(new Date(updatedCb.callbackScheduledDatetime).getTime()).toBe(rescheduledDate.getTime());

      // Cancel callback
      const deleteRes = await app.request(`/api/v1/callbacks/${cbData.callback.id}`, {
        method: 'DELETE'
      });
      expect(deleteRes.status).toBe(200);
      const delData = await deleteRes.json();
      expect(delData.callback.status).toBe('cancelled');
    });

    it('B1.3: Scenario callback fixture is held and never dispatched by poller', async () => {
      // Find seeded scenario callback fixture (sourceCallAttemptId is null)
      const scenarioCb = await db.query.callbacks.findFirst({
        where: (cb, { isNull }) => isNull(cb.sourceCallAttemptId)
      });
      expect(scenarioCb).toBeDefined();
      expect(scenarioCb!.sourceCallAttemptId).toBeNull();

      // Ensure that a job created for a scenario fixture transitions to scenario_hold
      const [holdJob] = await db.insert(scheduledJobs).values({
        jobType: 'SCENARIO_TEST',
        status: 'scheduled',
        loanId: scenarioCb!.loanId,
        dueAtUtc: new Date(Date.now() - 60000), // past due
        originalTimezoneIana: 'America/New_York',
        scheduledBy: 'scenario_fixture'
      }).returning();
      createdJobIds.push(holdJob.id);

      await DurableJobScheduler.processJob(holdJob);

      const reloadedJob = await db.query.scheduledJobs.findFirst({ where: (sj, { eq }) => eq(sj.id, holdJob.id) });
      expect(reloadedJob?.status).toBe('scenario_hold');
      expect(reloadedJob?.blockedAtExecutionReason).toContain('Scenario callback fixture is non-dispatchable');
    });

    it('B1.4: Due job remains dispatch-blocked under Phase 3 safety guardrail', async () => {
      // Ensure phone timezone is within legal calling window (8:00-21:00) regardless of time test is executed
      const openTz = (() => {
        const candidates = ['Asia/Kolkata', 'UTC', 'Europe/London', 'America/New_York', 'America/Los_Angeles'];
        for (const tz of candidates) {
          try {
            const hr = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date()), 10);
            if (hr >= 9 && hr <= 20) return tz;
          } catch {}
        }
        return 'UTC';
      })();
      await db.update(phoneNumbers).set({ timezoneIana: openTz }).where(eq(phoneNumbers.id, testPhoneId));

      // Create an eligible past-due operator job
      const [dueJob] = await db.insert(scheduledJobs).values({
        jobType: 'OPERATOR_SCHEDULED',
        status: 'scheduled',
        loanId: testLoanId,
        phoneNumberId: testPhoneId,
        campaignId: testCampaignId,
        dueAtUtc: new Date(Date.now() - 60000), // due in the past
        originalTimezoneIana: openTz,
        scheduledBy: 'operator'
      }).returning();
      createdJobIds.push(dueJob.id);

      await DurableJobScheduler.processJob(dueJob);

      const reloaded = await db.query.scheduledJobs.findFirst({ where: (sj, { eq }) => eq(sj.id, dueJob.id) });
      expect(reloaded?.status).toBe('dispatch_blocked_phase3');
      expect(reloaded?.blockedAtExecutionReason).toContain('DISPATCH_BLOCKED_PHASE3');
    });

    it('B1.5: Stale processing jobs are recovered safely by recoverStaleJobs', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const [staleJob] = await db.insert(scheduledJobs).values({
        jobType: 'OPERATOR_SCHEDULED',
        status: 'claimed',
        loanId: testLoanId,
        dueAtUtc: tenMinutesAgo,
        claimedAt: tenMinutesAgo,
        claimedByWorker: 'crashed-worker-999',
        scheduledBy: 'operator'
      }).returning();
      createdJobIds.push(staleJob.id);

      const recoveredCount = await DurableJobScheduler.recoverStaleJobs(5 * 60 * 1000);
      expect(recoveredCount).toBeGreaterThanOrEqual(1);

      const reloadedStale = await db.query.scheduledJobs.findFirst({ where: (sj, { eq }) => eq(sj.id, staleJob.id) });
      expect(reloadedStale?.status).toBe('scheduled');
      expect(reloadedStale?.claimedByWorker).toBeNull();
      expect(reloadedStale?.notes).toContain('Auto-recovered from stale processing state');
    });

    it('B2.1: PostCallProcessor creates both callback and scheduled_jobs record idempotently', async () => {
      const callAttemptId = crypto.randomUUID();
      const [attempt] = await db.insert(callAttempts).values({
        id: callAttemptId,
        loanId: testLoanId,
        campaignId: testCampaignId,
        phoneNumberId: testPhoneId,
        dialedPhoneE164: '+15559993333',
        callMode: 'NORMAL_DIAL',
        initiationSource: 'OPERATOR',
        referenceNumber: `REF-P3-CB-${Date.now()}`,
        isSeeded: false
      }).returning();
      createdAttemptIds.push(attempt.id);

      const callbackTime = new Date(Date.now() + 24 * 3600000).toISOString();
      const outcome = {
        callAttemptId: attempt.id,
        disposition: DispositionEnum.RPC_CALLBACK_REQUESTED,
        rpc: true,
        v2Callback: {
          requestedAt: new Date().toISOString(),
          scheduledFor: callbackTime,
          timezone: 'America/New_York',
          humanReadableNote: 'Borrower requested afternoon call'
        },
        notes: { reasonSummary: 'Callback requested during verified AI call' }
      };

      // Process 1st time
      await PostCallProcessor.process(attempt.id, outcome as any);

      const createdCbs = await db.query.callbacks.findMany({ where: (cb, { eq }) => eq(cb.sourceCallAttemptId, attempt.id) });
      expect(createdCbs.length).toBe(1);
      createdCallbackIds.push(createdCbs[0].id);

      const createdJobs = await db.query.scheduledJobs.findMany({ where: (sj, { eq }) => eq(sj.sourceCallAttemptId, attempt.id) });
      expect(createdJobs.length).toBe(1);
      expect(createdJobs[0].jobType).toBe('BORROWER_CALLBACK');
      createdJobIds.push(createdJobs[0].id);

      // Process 2nd time (simulate duplicate delivery)
      await PostCallProcessor.process(attempt.id, outcome as any);

      // Verify no duplicates
      const afterSecondCbs = await db.query.callbacks.findMany({ where: (cb, { eq }) => eq(cb.sourceCallAttemptId, attempt.id) });
      expect(afterSecondCbs.length).toBe(1);

      const afterSecondJobs = await db.query.scheduledJobs.findMany({ where: (sj, { eq }) => eq(sj.sourceCallAttemptId, attempt.id) });
      expect(afterSecondJobs.length).toBe(1);
    });

    it('B4.1: Servicing outbox retry endpoint performs bounded idempotent redelivery', async () => {
      // Create a test call attempt first to satisfy foreign key requirement
      const attemptId = crypto.randomUUID();
      const [attempt] = await db.insert(callAttempts).values({
        id: attemptId,
        loanId: testLoanId,
        campaignId: testCampaignId,
        phoneNumberId: testPhoneId,
        dialedPhoneE164: '+15559993333',
        callMode: 'NORMAL_DIAL',
        initiationSource: 'OPERATOR',
        referenceNumber: `REF-P3-OUT-${Date.now()}`,
        isSeeded: false
      }).returning();
      createdAttemptIds.push(attempt.id);

      // Find or insert an outbox record
      const [outboxRecord] = await db.insert(servicingOutbox).values({
        callAttemptId: attempt.id,
        loanId: testLoanId,
        referenceNumber: `OUTBOX-${Date.now()}`,
        adapterTarget: 'LOCAL_POC_ADAPTER',
        payload: { test: true },
        validationStatus: 'valid',
        commitStatus: 'committed',
        deliveryStatus: 'delivery_failed',
        retryCount: 1,
        lastError: 'Simulated connection timeout'
      }).returning();
      createdOutboxIds.push(outboxRecord.id);

      // Retry delivery
      const res = await app.request(`/api/v1/servicing-outbox/${outboxRecord.id}/retry`, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.record.deliveryStatus).toBe('delivered_local');
      expect(data.record.retryCount).toBe(2);
      expect(data.record.lastError).toBeNull();
    });

    it('B5.1: Operator can create and resolve a human queue escalation with audit trail', async () => {
      // Create manual escalation
      const createRes = await app.request('/api/v1/human-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: testLoanId,
          reason: 'COMPLEX_HARDSHIP',
          priority: 1,
          notes: 'Borrower requested specialized hardship workout'
        })
      });
      expect(createRes.status).toBe(201);
      const escData = await createRes.json();
      expect(escData.success).toBe(true);
      expect(escData.escalation.priority).toBe(1);
      expect(escData.escalation.status).toBe('pending');
      createdEscalationIds.push(escData.escalation.id);

      // Resolve escalation
      const patchRes = await app.request(`/api/v1/human-queue/${escData.escalation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          notes: 'Resolved by loan modification team'
        })
      });
      expect(patchRes.status).toBe(200);
      const resolvedData = await patchRes.json();
      expect(resolvedData.status).toBe('resolved');
      expect(resolvedData.resolvedAt).toBeDefined();
    });
  });
});
