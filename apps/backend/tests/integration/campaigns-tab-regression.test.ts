import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { campaigns, campaignMembers, loans, borrowers, phoneNumbers, callAttempts, eligibilityEvaluations, stateChangeLog } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';

describe('Campaigns Tab Regression & Architecture Integrity Suite', () => {
  let createdCampaignIds: string[] = [];
  let createdLoanIds: string[] = [];
  let emptyCampaignId: string;
  let populatedCampaignId: string;
  let testLoanId: string;

  beforeAll(async () => {
    // 1. Create an isolated empty campaign
    const [emptyCamp] = await db.insert(campaigns).values({
      name: 'Regression Test Empty Campaign',
      description: 'Zero member campaign for scoping validation',
      cohortLabel: 'Empty Cohort',
      dpdMin: 1,
      dpdMax: 30,
      status: 'active',
      isSeeded: false
    }).returning();
    emptyCampaignId = emptyCamp.id;
    createdCampaignIds.push(emptyCampaignId);

    // 2. Create an isolated populated campaign
    const [popCamp] = await db.insert(campaigns).values({
      name: 'Regression Test Populated Campaign',
      description: 'Populated campaign for scoping validation',
      cohortLabel: 'Populated Cohort',
      dpdMin: 1,
      dpdMax: 30,
      status: 'active',
      isSeeded: false
    }).returning();
    populatedCampaignId = popCamp.id;
    createdCampaignIds.push(populatedCampaignId);

    // 3. Create a test loan and enroll in populatedCampaign
    const [loan] = await db.insert(loans).values({
      loanNumber: `TEST-CAMP-REG-${Date.now()}`,
      dpd: 15,
      delinquencyBucket: '1-30',
      pastDueAmount: '450.00',
      totalToCure: '900.00',
      isBankrupt: false,
      isLitigation: false,
      isDeceased: false,
      hasLossMitigation: false,
      hasActiveDispute: false,
      isSeeded: false
    }).returning();
    testLoanId = loan.id;
    createdLoanIds.push(testLoanId);

    const [borrower] = await db.insert(borrowers).values({
      loanId: testLoanId,
      firstName: 'RegTest',
      lastName: 'Borrower',
      isPrimary: true
    }).returning();

    const [phone] = await db.insert(phoneNumbers).values({
      loanId: testLoanId,
      borrowerId: borrower.id,
      phoneE164: '+15558881234',
      lineType: 'mobile',
      tcpaConsent: true,
      timezoneIana: 'America/New_York',
      isPrimary: true,
      isActive: true,
      isHygieneVerified: true
    }).returning();

    // Enroll loan into populatedCampaign only
    await db.insert(campaignMembers).values({
      campaignId: populatedCampaignId,
      loanId: testLoanId,
      selectedPhoneNumberId: phone.id,
      status: 'active',
      addedReason: 'regression_test_enrollment'
    });
  });

  afterAll(async () => {
    // Cleanup
    for (const cId of createdCampaignIds) {
      await db.delete(eligibilityEvaluations).where(eq(eligibilityEvaluations.campaignId, cId));
      await db.delete(campaignMembers).where(eq(campaignMembers.campaignId, cId));
      await db.delete(campaigns).where(eq(campaigns.id, cId));
    }
    for (const lId of createdLoanIds) {
      await db.delete(stateChangeLog).where(eq(stateChangeLog.loanId, lId));
      await db.delete(phoneNumbers).where(eq(phoneNumbers.loanId, lId));
      await db.delete(borrowers).where(eq(borrowers.loanId, lId));
      await db.delete(loans).where(eq(loans.id, lId));
    }
  });

  describe('1. Bug 3.1 Investigation: Empty Campaign Isolation', () => {
    it('1.1: Empty campaign returns strictly empty member list (GET /api/v1/campaigns/:id/members)', async () => {
      const res = await app.request(`/api/v1/campaigns/${emptyCampaignId}/members`, {
        method: 'GET',
        headers: { 'x-operator-id': 'internal_console_user' }
      });
      expect(res.status).toBe(200);
      const members = await res.json();
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBe(0);
    });

    it('1.2: Empty campaign strictly returns empty eligibility queue (GET /api/v1/eligibility/queue?campaignId=...) and NEVER leaks global loans', async () => {
      const res = await app.request(`/api/v1/eligibility/queue?campaignId=${emptyCampaignId}`, {
        method: 'GET',
        headers: { 'x-operator-id': 'internal_console_user' }
      });
      expect(res.status).toBe(200);
      const queue = await res.json();
      expect(Array.isArray(queue)).toBe(true);
      expect(queue.length).toBe(0);
    });

    it('1.3: Populated campaign returns only its own enrolled member (no leakage between campaigns)', async () => {
      const res = await app.request(`/api/v1/eligibility/queue?campaignId=${populatedCampaignId}`, {
        method: 'GET',
        headers: { 'x-operator-id': 'internal_console_user' }
      });
      expect(res.status).toBe(200);
      const queue = await res.json();
      expect(queue.length).toBe(1);
      expect(queue[0].loan.id).toBe(testLoanId);
    });
  });

  describe('2. Bug 3.2 Investigation: Invalid UUID / Parameter Robustness', () => {
    it('2.1: Non-UUID campaignId returns 400 Bad Request instead of 500 error on GET /campaigns/:id', async () => {
      const res = await app.request('/api/v1/campaigns/undefined', {
        method: 'GET',
        headers: { 'x-operator-id': 'internal_console_user' }
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('INVALID_CAMPAIGN_ID');
    });

    it('2.2: Non-UUID campaignId returns 400 Bad Request on GET /campaigns/:id/members', async () => {
      const res = await app.request('/api/v1/campaigns/undefined/members', {
        method: 'GET',
        headers: { 'x-operator-id': 'internal_console_user' }
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('INVALID_CAMPAIGN_ID');
    });

    it('2.3: Non-UUID campaignId returns 400 Bad Request on POST /campaigns/:id/dispatch-run', async () => {
      const res = await app.request('/api/v1/campaigns/undefined/dispatch-run', {
        method: 'POST',
        headers: { 'x-operator-id': 'internal_console_user', 'Content-Type': 'application/json' }
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('INVALID_CAMPAIGN_ID');
    });

    it('2.4: Non-UUID campaignId returns 400 Bad Request on GET /eligibility/queue?campaignId=undefined', async () => {
      const res = await app.request('/api/v1/eligibility/queue?campaignId=undefined', {
        method: 'GET',
        headers: { 'x-operator-id': 'internal_console_user' }
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('INVALID_CAMPAIGN_ID');
    });

    it('2.5: Non-UUID campaignId returns 400 Bad Request on GET /dashboard/summary?campaignId=undefined', async () => {
      const res = await app.request('/api/v1/dashboard/summary?campaignId=undefined', {
        method: 'GET',
        headers: { 'x-operator-id': 'internal_console_user' }
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('INVALID_CAMPAIGN_ID');
    });
  });

  describe('3. Campaign CRUD & Contact Policy Verification', () => {
    let newCampId: string;

    it('3.1: POST /api/v1/campaigns rejects empty name with 400', async () => {
      const res = await app.request('/api/v1/campaigns', {
        method: 'POST',
        headers: { 'x-operator-id': 'internal_console_user', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '   ', dpdMin: 1, dpdMax: 30 })
      });
      expect(res.status).toBe(400);
    });

    it('3.2: POST /api/v1/campaigns creates campaign with full contact policy', async () => {
      const res = await app.request('/api/v1/campaigns', {
        method: 'POST',
        headers: { 'x-operator-id': 'internal_console_user', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mid-Stage Targeted Policy',
          description: 'Special policy testing cohort',
          cohortLabel: 'Mid-Stage 31-45 DPD',
          dpdMin: 31,
          dpdMax: 45,
          cooldownHours: 6,
          dailyCap: 1,
          weeklyCap: 3,
          maxAttempts: 4,
          callbackHorizonDays: 10
        })
      });
      expect(res.status).toBe(201);
      const camp = await res.json();
      expect(camp.name).toBe('Mid-Stage Targeted Policy');
      expect(camp.cohortLabel).toBe('Mid-Stage 31-45 DPD');
      expect(camp.cooldownHours).toBe(6);
      expect(camp.dailyCap).toBe(1);
      expect(camp.weeklyCap).toBe(3);
      newCampId = camp.id;
      createdCampaignIds.push(newCampId);
    });

    it('3.3: PATCH /api/v1/campaigns/:id updates campaign parameters safely', async () => {
      const res = await app.request(`/api/v1/campaigns/${newCampId}`, {
        method: 'PATCH',
        headers: { 'x-operator-id': 'internal_console_user', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mid-Stage Updated Policy',
          cooldownHours: 8,
          weeklyCap: 4
        })
      });
      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.name).toBe('Mid-Stage Updated Policy');
      expect(updated.cooldownHours).toBe(8);
      expect(updated.weeklyCap).toBe(4);
      // Unrelated fields preserved
      expect(updated.dpdMin).toBe(31);
      expect(updated.dpdMax).toBe(45);
      expect(updated.dailyCap).toBe(1);
    });

    it('3.4: GET /api/v1/campaigns/:id returns enriched counts and contact policy', async () => {
      const res = await app.request(`/api/v1/campaigns/${newCampId}`, {
        method: 'GET',
        headers: { 'x-operator-id': 'internal_console_user' }
      });
      expect(res.status).toBe(200);
      const camp = await res.json();
      expect(camp.totalMembers).toBe(0);
      expect(camp.activeMembers).toBe(0);
      expect(camp.dueForEvaluation).toBe(0);
      expect(camp.cooldownHours).toBe(8);
    });
  });

  describe('4. Operational Invariants & Multi-Campaign Pacing', () => {
    it('4.1: Activating/Pausing campaign changes status but strictly never places calls or inserts callAttempts', async () => {
      const attemptsBefore = await db.query.callAttempts.findMany();
      
      const patchRes = await app.request(`/api/v1/campaigns/${populatedCampaignId}`, {
        method: 'PATCH',
        headers: { 'x-operator-id': 'internal_console_user', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
      expect(patchRes.status).toBe(200);

      const attemptsAfter = await db.query.callAttempts.findMany();
      expect(attemptsAfter.length).toBe(attemptsBefore.length);
    });

    it('4.2: Review Outreach Eligibility (dispatch-run) returns SAFETY_LOCKED_DRY_RUN without carrier calls', async () => {
      const res = await app.request(`/api/v1/campaigns/${populatedCampaignId}/dispatch-run`, {
        method: 'POST',
        headers: { 'x-operator-id': 'internal_console_user', 'Content-Type': 'application/json' }
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.safetyLockActive).toBe(true);
      expect(data.dispatchStatus).toContain('SAFETY_LOCKED_DRY_RUN');
      expect(data.totalMembers).toBe(1);
      expect(data.evaluatedCount).toBe(1);
    });
  });
});
