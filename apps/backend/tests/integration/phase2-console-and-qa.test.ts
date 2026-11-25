import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import {
  loans,
  borrowers,
  phoneNumbers,
  campaigns,
  campaignMembers,
  campaignMembershipAudit,
  callAttempts,
  eligibilityEvaluations,
  dncRecords,
  v1Restrictions,
  callbacks,
  servicingOutbox,
  smsMessages,
  humanEscalations,
  ptpCommitments,
  qaScenarioBatches,
  stateChangeLog
} from '../../src/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { seedDatabase } from '../../src/db/seed';
import { PreDialGate } from '../../src/domain/eligibility/PreDialGate';
import { assertDisposableTestDatabase } from '../test-cleanup';

describe('Phase 2: Visible Operations Console, Campaigns, Contacts, and QA Scenario Management', () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
    // Clean up any test campaigns, orphaned outbox, commitments or attempts from prior runs
    await db.delete(servicingOutbox);
    await db.delete(ptpCommitments);
    await db.delete(humanEscalations);
    await db.update(callbacks).set({ sourceCallAttemptId: null });
    await db.delete(callAttempts);

    const testCamps = await db.query.campaigns.findMany({
      where: (c, { notInArray }) => notInArray(c.name, [
        'Early-Stage Delinquency | 1–30 DPD',
        'Early-Stage Delinquency | 31–59 DPD',
        'Supervised QA Test Campaign',
        'Verified Contact Test Campaign'
      ])
    });
    for (const tc of testCamps) {
      await db.update(loans).set({ campaignId: null }).where(eq(loans.campaignId, tc.id));
      await db.delete(eligibilityEvaluations).where(eq(eligibilityEvaluations.campaignId, tc.id));
      await db.delete(campaignMembershipAudit).where(eq(campaignMembershipAudit.campaignId, tc.id));
      await db.delete(campaignMembers).where(eq(campaignMembers.campaignId, tc.id));
      await db.delete(campaigns).where(eq(campaigns.id, tc.id));
    }
  });

  // ─── PART 1: MANDATORY PHASE 1 CORRECTION CHECKPOINT ────────────────────────
  describe('1. Phase 1 Correction Checkpoint: Clean call_attempts & Deterministic C10', () => {
    test('1.1: Operational call_attempts table contains ZERO fake provider or fixture calls', async () => {
      const allAttempts = await db.query.callAttempts.findMany();
      expect(allAttempts.length).toBe(0);

      const callsRes = await app.request('/api/v1/calls');
      expect(callsRes.status).toBe(200);
      const callsData = await callsRes.json();
      expect(callsData.length).toBe(0);

      const summaryRes = await app.request('/api/v1/dashboard/summary');
      expect(summaryRes.status).toBe(200);
      const summary = await summaryRes.json();
      expect(summary.callsInitiated).toBe(0);
      expect(summary.rpcRate).toBe('—');
      expect(summary.ptpRate).toBe('—');
      expect(summary.recentCalls.length).toBe(0);
    });

    test('1.2: Deterministic C10 Cooldown test: blocks when elapsed < 4h and passes when elapsed >= 4h', async () => {
      // 1.5 hours elapsed (< 4 hours) -> BLOCKED
      const blockRes = await app.request('/api/v1/qa/cooldown-demo?elapsedHours=1.5&cooldownHours=4.0');
      expect(blockRes.status).toBe(200);
      const blockData = await blockRes.json();
      expect(blockData.isScenarioEvaluation).toBe(true);
      expect(blockData.scenarioLabel).toBe('Scenario evaluation — not a live call');
      expect(blockData.evaluation.eligible).toBe(false);
      expect(blockData.evaluation.finalResult).toBe('BLOCKED_COOLDOWN');
      const c10CheckBlock = blockData.evaluation.checkResults.find((c: any) => c.check === 'C10_COOLDOWN_CAPS');
      expect(c10CheckBlock.result).toBe('fail');
      expect(c10CheckBlock.reason).toContain('Cooldown active: 1.5h elapsed < 4h required');

      // 4.5 hours elapsed (>= 4 hours) -> PASS
      const passRes = await app.request('/api/v1/qa/cooldown-demo?elapsedHours=4.5&cooldownHours=4.0');
      expect(passRes.status).toBe(200);
      const passData = await passRes.json();
      expect(passData.isScenarioEvaluation).toBe(true);
      expect(passData.evaluation.eligible).toBe(true);
      expect(passData.evaluation.finalResult).toBe('ELIGIBLE_TO_DIAL');
      const c10CheckPass = passData.evaluation.checkResults.find((c: any) => c.check === 'C10_COOLDOWN_CAPS');
      expect(c10CheckPass.result).toBe('pass');
    });

    test('1.3: Normal operational eligibility never reads QA simulated attempt as a real attempt', async () => {
      // Baseline LN-100001 evaluated in normal campaign queue
      const queueRes = await app.request('/api/v1/eligibility/queue');
      expect(queueRes.status).toBe(200);
      const queue = await queueRes.json();
      const ln1 = queue.find((q: any) => q.loan.loanNumber === 'LN-100001');
      expect(ln1).toBeDefined();
      expect(ln1.evaluation.isScenarioEvaluation).toBeFalsy();
      const c10 = ln1.evaluation.checkResults.find((c: any) => c.check === 'C10_COOLDOWN_CAPS');
      expect(c10.result).toBe('pass');
    });

    test('1.4: Idempotent seed: running seedDatabase twice never duplicates data or creates fake call_attempts', async () => {
      await seedDatabase();
      await seedDatabase();

      const loansCount = (await db.query.loans.findMany({ where: (l, { like }) => like(l.loanNumber, 'LN-%') })).length;
      expect(loansCount).toBe(30);

      const campsCount = (await db.query.campaigns.findMany()).length;
      expect(campsCount).toBeGreaterThanOrEqual(3);

      const attemptsCount = (await db.query.callAttempts.findMany()).length;
      expect(attemptsCount).toBe(0);
    });
  });

  // ─── PART 2: CAMPAIGN SCOPING & CRUD ─────────────────────────────────────────
  describe('2. Campaign Scoping and Zero-Member Scoping Guarantee', () => {
    let emptyCampaignId: string;

    test('2.1: Creates a new campaign with zero members', async () => {
      const res = await app.request('/api/v1/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Empty Test Campaign Phase 2',
          description: 'A test campaign with 0 members to verify strict scoping',
          dpdMin: 10,
          dpdMax: 20,
          maxAttempts: 2,
          cooldownHours: 4
        })
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Empty Test Campaign Phase 2');
      emptyCampaignId = data.id;
    });

    test('2.2: Zero-member campaign STRICTLY returns empty queue, never falls back to global queue', async () => {
      const res = await app.request(`/api/v1/eligibility/queue?campaignId=${emptyCampaignId}`);
      expect(res.status).toBe(200);
      const queue = await res.json();
      expect(Array.isArray(queue)).toBe(true);
      expect(queue.length).toBe(0); // MUST be 0! Never 30 or 100!
    });

    test('2.3: Zero-member campaign returns empty records array', async () => {
      const res = await app.request(`/api/v1/campaigns/${emptyCampaignId}/records`);
      expect(res.status).toBe(200);
      const records = await res.json();
      expect(records.length).toBe(0);
    });

    test('2.4: Edits campaign settings cleanly', async () => {
      const res = await app.request(`/api/v1/campaigns/${emptyCampaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'Updated description for phase 2 verification',
          status: 'paused'
        })
      });
      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.description).toBe('Updated description for phase 2 verification');
      expect(updated.status).toBe('paused');
    });

    test('2.5: Enrolls an account in the empty campaign and removes it safely', async () => {
      const baselineLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.loanNumber, 'LN-100001') });
      expect(baselineLoan).toBeDefined();

      // Add to campaign
      const addRes = await app.request(`/api/v1/campaigns/${emptyCampaignId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: baselineLoan!.id,
          addedReason: 'test_membership_flow'
        })
      });
      expect(addRes.status).toBe(201);
      const member = await addRes.json();
      expect(member.id).toBeDefined();

      // Now queue should have exactly 1 member
      const queueRes = await app.request(`/api/v1/eligibility/queue?campaignId=${emptyCampaignId}`);
      expect(queueRes.status).toBe(200);
      const queue = await queueRes.json();
      expect(queue.length).toBe(1);

      // Remove member from campaign
      const delRes = await app.request(`/api/v1/campaigns/${emptyCampaignId}/members/${member.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'test_removal' })
      });
      expect(delRes.status).toBe(200);

      // Loan itself must NOT be deleted
      const checkLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.id, baselineLoan!.id) });
      expect(checkLoan).toBeDefined();

      // Queue is empty again
      const queueRes2 = await app.request(`/api/v1/eligibility/queue?campaignId=${emptyCampaignId}`);
      expect((await queueRes2.json()).length).toBe(0);
    });

    afterAll(async () => {
      // Clean up test campaign
      if (emptyCampaignId) {
        await db.delete(campaignMembershipAudit).where(eq(campaignMembershipAudit.campaignId, emptyCampaignId));
        await db.delete(campaignMembers).where(eq(campaignMembers.campaignId, emptyCampaignId));
        await db.delete(campaigns).where(eq(campaigns.id, emptyCampaignId));
      }
    });
  });

  // ─── PART 3: ACCOUNTS & MULTI-PHONE CRUD ─────────────────────────────────────
  describe('3. Accounts & Multi-Phone CRUD for Synthetic Data', () => {
    let createdLoanId: string;
    let secondaryPhoneId: string;

    test('3.1: Creates synthetic account with server-generated non-colliding ID and defaults', async () => {
      const res = await app.request('/api/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Robert',
          lastName: 'Taylor',
          dpd: 14,
          pastDueAmount: '320.00',
          totalToCure: '640.00',
          lineType: 'mobile',
          tcpaConsent: true,
          timezoneIana: 'America/Chicago'
        })
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.loan.loanNumber).toMatch(/^SYN-\d+/);
      expect(data.borrower.firstName).toBe('Robert');
      expect(data.phone.phoneE164).toMatch(/^\+1555/);
      expect(data.phone.consentState).toBe('GRANTED');
      createdLoanId = data.loan.id;
    });

    test('3.2: Adds a second independent phone number (landline) with distinct consent/DNC', async () => {
      const res = await app.request(`/api/v1/accounts/${createdLoanId}/phones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneE164: '+15550100444',
          label: 'home_landline',
          relationship: 'primary_borrower',
          lineType: 'landline',
          tcpaConsent: false, // Landline: TCPA consent is NOT applicable
          timezoneIana: 'America/Chicago'
        })
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.lineType).toBe('landline');
      expect(data.consentState).toBe('NOT_APPLICABLE_TO_MOBILE_AUTODIAL_CONSENT');
      secondaryPhoneId = data.id;

      // Reload account and verify both numbers exist independently
      const accRes = await app.request(`/api/v1/accounts/${createdLoanId}`);
      expect(accRes.status).toBe(200);
      const acc = await accRes.json();
      expect(acc.phones.length).toBe(2);
      const p1 = acc.phones.find((p: any) => p.lineType === 'mobile');
      const p2 = acc.phones.find((p: any) => p.lineType === 'landline');
      expect(p1.consentState).toBe('GRANTED');
      expect(p2.consentState).toBe('NOT_APPLICABLE_TO_MOBILE_AUTODIAL_CONSENT');
    });

    test('3.3: Edits loan flags via PATCH /api/v1/accounts/:id and verifies immediate gate effect', async () => {
      const res = await app.request(`/api/v1/accounts/${createdLoanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isBankrupt: true,
          hasActiveDispute: true,
          accountDnc: true
        })
      });
      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.loan.isBankrupt).toBe(true);
      expect(updated.loan.hasActiveDispute).toBe(true);
      expect(updated.accountDnc).toBe(true);

      // Verify PreDialGate immediately catches the updated flags
      const camp = await db.query.campaigns.findFirst();
      const phone = updated.phones[0];
      const outcome = PreDialGate.evaluate({
        loan: {
          id: updated.loan.id,
          dpd: updated.loan.dpd,
          isBankrupt: updated.loan.isBankrupt,
          isLitigation: updated.loan.isLitigation,
          isDeceased: updated.loan.isDeceased,
          hasLossMitigation: updated.loan.hasLossMitigation,
          hasActiveDispute: updated.loan.hasActiveDispute,
          contactAttemptCount: updated.loan.contactAttemptCount,
          priorityScore: 50
        },
        phone: {
          id: phone.id,
          phoneE164: phone.phoneE164,
          lineType: phone.lineType,
          tcpaConsent: phone.tcpaConsent,
          dnc: phone.dnc,
          timezoneIana: phone.timezoneIana,
          isHygieneVerified: phone.isHygieneVerified,
          preferredContactWindowStart: null,
          preferredContactWindowEnd: null
        },
        campaign: {
          id: camp!.id,
          dpdMin: camp!.dpdMin,
          dpdMax: camp!.dpdMax,
          maxAttempts: camp!.maxAttempts,
          dailyCap: camp!.dailyCap,
          weeklyCap: camp!.weeklyCap,
          cooldownHours: camp!.cooldownHours
        },
        accountDnc: updated.accountDnc,
        numberDnc: phone.dnc,
        activeV1Restrictions: [],
        pendingCallbacks: [],
        recentCallAttempts: [],
        activeConcurrentCalls: 0
      });

      expect(outcome.eligible).toBe(false);
      expect(outcome.allBlockingReasons).toContain('BLOCKED_BANKRUPTCY');
      expect(outcome.allBlockingReasons).toContain('BLOCKED_ACTIVE_DISPUTE');
      expect(outcome.allBlockingReasons).toContain('BLOCKED_DNC_ACCOUNT');
    });

    afterAll(async () => {
      // Clean up test account
      if (createdLoanId) {
        await db.delete(stateChangeLog).where(eq(stateChangeLog.loanId, createdLoanId));
        await db.delete(dncRecords).where(eq(dncRecords.loanId, createdLoanId));
        await db.delete(phoneNumbers).where(eq(phoneNumbers.loanId, createdLoanId));
        await db.delete(borrowers).where(eq(borrowers.loanId, createdLoanId));
        await db.delete(loans).where(eq(loans.id, createdLoanId));
      }
    });
  });

  // ─── PART 4: QA SCENARIO BATCHES & SAFE REMOVAL ─────────────────────────────
  describe('4. QA Scenario Batches: Generation, Safety Boundary, and Safe Removal', () => {
    let generatedBatchId: string;

    test('4.1: Generates a small batch of varied QA scenarios and returns accurate summary', async () => {
      const scenarioTypes = [
        'clean_eligible',
        'no_consent',
        'cooldown_active',
        'account_dnc',
        'v1_restriction',
        'bankruptcy'
      ];

      const res = await app.request('/api/v1/qa/batches/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioTypes })
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.totalCreated).toBe(6);
      expect(data.batch.id).toMatch(/^batch-\d+/);
      generatedBatchId = data.batch.id;

      // Verify no operational activity was inserted
      const callAttemptsCount = (await db.query.callAttempts.findMany()).length;
      expect(callAttemptsCount).toBe(0);

      const smsCount = (await db.query.smsMessages.findMany()).length;
      expect(smsCount).toBe(0);

      const outboxCount = (await db.query.servicingOutbox.findMany()).length;
      expect(outboxCount).toBe(0);

      const escalationCount = (await db.query.humanEscalations.findMany()).length;
      expect(escalationCount).toBe(0);
    });

    test('4.2: Deletion boundary strictly blocks deleting baseline LN-* records', async () => {
      const baselineLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.loanNumber, 'LN-100001') });
      expect(baselineLoan).toBeDefined();

      const res = await app.request(`/api/v1/qa/scenarios/${baselineLoan!.id}`, {
        method: 'DELETE'
      });

      expect(res.status).toBe(403);
      const err = await res.json();
      expect(err.error).toContain('Baseline LN-* scenarios cannot be deleted');

      // Verify baseline loan was NOT deleted
      const checkBaseline = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.id, baselineLoan!.id) });
      expect(checkBaseline).toBeDefined();
    });

    test('4.3: Previews batch deletion accurately before removal', async () => {
      const res = await app.request(`/api/v1/qa/batches/${generatedBatchId}/preview-delete`);
      expect(res.status).toBe(200);
      const preview = await res.json();
      expect(preview.batchId).toBe(generatedBatchId);
      expect(preview.accountsCount).toBe(6);
      expect(preview.borrowersCount).toBe(6);
      expect(preview.phonesCount).toBe(6);
    });

    test('4.4: Deletes QA batch cleanly without touching baseline data', async () => {
      const res = await app.request(`/api/v1/qa/batches/${generatedBatchId}`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);
      const result = await res.json();
      expect(result.success).toBe(true);
      expect(result.deletedAccountsCount).toBe(6);

      // Verify baseline 30 loans remain exactly intact
      const baselineCount = (await db.query.loans.findMany({ where: (l, { like }) => like(l.loanNumber, 'LN-%') })).length;
      expect(baselineCount).toBe(30);

      // Verify batch status is 'removed'
      const batchRec = await db.query.qaScenarioBatches.findFirst({ where: (b, { eq }) => eq(b.id, generatedBatchId) });
      expect(batchRec?.status).toBe('removed');
    });
  });
});
