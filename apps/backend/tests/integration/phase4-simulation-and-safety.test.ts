import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import {
  loans,
  borrowers,
  phoneNumbers,
  campaigns,
  callAttempts,
  providerWebhookEvents,
  smsMessages,
  servicingOutbox,
  humanEscalations,
  callbacks,
  scheduledJobs,
  qaSimulationRuns,
  operatorSessions
} from '../../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { config } from '../../src/config';
import { DurableJobScheduler } from '../../src/jobs/DurableJobScheduler';
import { QaSimulator } from '../../src/domain/qa/QaSimulator';
import { sanitizePayload, passesLuhn } from '../../src/utils/sanitizer';

describe('Phase 4: End-to-End QA Simulation, Reliability & Local API Safety', () => {
  let testLoanId: string;
  let testPhoneId: string;
  let testCampaignId: string;
  let operatorToken: string;
  const createdSimulationIds: string[] = [];
  const createdSessionTokens: string[] = [];
  const createdCallbackIds: string[] = [];

  beforeAll(async () => {
    console.log('PHASE4 DB URL:', process.env.DATABASE_URL);
    // Clean up any leftover test callbacks for LN-100001
    const baselineLoan = await db.query.loans.findFirst({
      where: (l, { eq }) => eq(l.loanNumber, 'LN-100001')
    });
    if (!baselineLoan) {
      throw new Error('Baseline loan LN-100001 not found');
    }
    testLoanId = baselineLoan.id;
    testCampaignId = baselineLoan.campaignId || '';

    await db.delete(callbacks).where(eq(callbacks.loanId, testLoanId));
    await db.delete(scheduledJobs).where(eq(scheduledJobs.loanId, testLoanId));

    const phone = await db.query.phoneNumbers.findFirst({
      where: (p, { eq }) => eq(p.loanId, testLoanId)
    });
    testPhoneId = phone?.id || '';
  });

  afterAll(async () => {
    // Clean up created simulations
    const validSimIds = createdSimulationIds.filter(Boolean);
    if (validSimIds.length > 0) {
      await db.delete(qaSimulationRuns).where(inArray(qaSimulationRuns.id, validSimIds));
    }
    // Clean up created operator sessions
    const validTokens = createdSessionTokens.filter(Boolean);
    if (validTokens.length > 0) {
      await db.delete(operatorSessions).where(inArray(operatorSessions.token, validTokens));
    }
    const validCbIds = createdCallbackIds.filter(Boolean);
    if (validCbIds.length > 0) {
      await db.delete(callbacks).where(inArray(callbacks.id, validCbIds));
    }
  });

  describe('1. Callback Provenance Isolation', () => {
    it('1.1: Canonical Scenario 18 callback fixture has sourceType = QA_SCENARIO and null sourceCallAttemptId', async () => {
      const scenario18Loan = await db.query.loans.findFirst({
        where: (l, { eq }) => eq(l.loanNumber, 'LN-100018')
      });
      expect(scenario18Loan).toBeDefined();

      const cb = await db.query.callbacks.findFirst({
        where: (c, { eq }) => eq(c.loanId, scenario18Loan!.id)
      });
      expect(cb).toBeDefined();
      expect(cb!.sourceType).toBe('QA_SCENARIO');
      expect(cb!.sourceCallAttemptId).toBeNull();
      expect(cb!.status).toBe('scheduled');
    });

    it('1.2: DurableJobScheduler ignores QA_SCENARIO callbacks and never dispatches them', async () => {
      const initialAttempts = await db.select().from(callAttempts);
      const initialAttemptsCount = initialAttempts.length;

      // Run scheduler poll pass
      await DurableJobScheduler.pollAndExecute();

      // Ensure no call attempts were created for the QA scenario callback
      const afterAttempts = await db.select().from(callAttempts);
      expect(afterAttempts.length).toBe(initialAttemptsCount);
    });

    it('1.3: Operator can schedule follow-up with explicit OPERATOR_FOLLOWUP provenance', async () => {
      const scheduledDate = new Date(Date.now() + 86400000).toISOString();
      let createdCallbackId: string | null = null;
      try {
        const res = await app.request('/api/v1/callbacks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loanId: testLoanId,
            phoneNumberId: testPhoneId,
            callbackScheduledDatetime: scheduledDate,
            humanReadableNote: 'Borrower requested operator assistance',
            operator: 'Operator Alice'
          })
        });

        expect(res.status).toBe(201);
        const data = await res.json() as any;
        createdCallbackId = data.callback?.id;
        expect(data.callback.sourceType).toBe('OPERATOR_FOLLOWUP');
        expect(data.callback.sourceCallAttemptId).toBeNull();
      } finally {
        await db.delete(callbacks).where(eq(callbacks.loanId, testLoanId));
        await db.delete(scheduledJobs).where(eq(scheduledJobs.loanId, testLoanId));
      }
    });
  });

  describe('2. QA Simulator: Deterministic Outcomes, Zero Network Calls & Zero Operational Rows', () => {
    it('2.1: Lists all available QA simulation scenarios with 12 gate previews', async () => {
      const res = await app.request('/api/v1/qa/simulation-scenarios', {
        method: 'GET'
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data).toHaveProperty('scenarios');
      expect(Array.isArray(data.scenarios)).toBe(true);
      expect(data.scenarios.length).toBeGreaterThanOrEqual(12);

      const first = data.scenarios[0];
      expect(first).toHaveProperty('loanNumber');
      expect(first).toHaveProperty('borrowerName');
      expect(first).toHaveProperty('maskedPhone');
      expect(first).toHaveProperty('flags');
    });

    it('2.2: Runs QA Simulation for MOCK_RPC_PTP with ZERO rows written to operational tables', async () => {
      // Record initial row counts of operational tables
      const [initAttempts, initWebhooks, initSms, initOutbox, initEscalations] = await Promise.all([
        db.select().from(callAttempts),
        db.select().from(providerWebhookEvents),
        db.select().from(smsMessages),
        db.select().from(servicingOutbox),
        db.select().from(humanEscalations)
      ]);

      const res = await app.request('/api/v1/qa/simulations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioLoanId: testLoanId,
          phoneNumberId: testPhoneId,
          selectedOutcome: 'MOCK_RPC_PTP'
        })
      });

      expect(res.status).toBe(201);
      const sim = await res.json() as any;
      expect(sim.id).toBeDefined();
      createdSimulationIds.push(sim.id);

      expect(sim.selectedOutcome).toBe('MOCK_RPC_PTP');
      expect(sim.zeroNetworkCallsVerified).toBe(true);
      expect(sim.simulationBanner).toContain('SIMULATION — NO PHONE CALL OR SMS WAS SENT');
      expect(sim.executionTimeline).toBeDefined();
      expect(Array.isArray(sim.executionTimeline)).toBe(true);
      expect(sim.executionTimeline.length).toBeGreaterThan(0);
      expect(sim.derivedActions).toBeDefined();
      expect(sim.derivedActions.ptpCommitment).toBeDefined();
      expect(sim.maskedPhone).toMatch(/\*\*\*/);

      // Verify ZERO rows were written to operational tables
      const [currAttempts, currWebhooks, currSms, currOutbox, currEscalations] = await Promise.all([
        db.select().from(callAttempts),
        db.select().from(providerWebhookEvents),
        db.select().from(smsMessages),
        db.select().from(servicingOutbox),
        db.select().from(humanEscalations)
      ]);

      expect(currAttempts.length).toBe(initAttempts.length);
      expect(currWebhooks.length).toBe(initWebhooks.length);
      expect(currSms.length).toBe(initSms.length);
      expect(currOutbox.length).toBe(initOutbox.length);
      expect(currEscalations.length).toBe(initEscalations.length);
    });

    it('2.3: Runs QA Simulation for MOCK_WRONG_NUMBER and verifies derived contact data update', async () => {
      const res = await app.request('/api/v1/qa/simulations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioLoanId: testLoanId,
          phoneNumberId: testPhoneId,
          selectedOutcome: 'MOCK_WRONG_NUMBER'
        })
      });

      expect(res.status).toBe(201);
      const sim = await res.json() as any;
      createdSimulationIds.push(sim.id);

      expect(sim.selectedOutcome).toBe('MOCK_WRONG_NUMBER');
      expect(sim.derivedActions.contactDataUpdate).toBeDefined();
      expect(sim.derivedActions.contactDataUpdate.markedDnc).toBe(true);
      expect(sim.zeroNetworkCallsVerified).toBe(true);
    });

    it('2.4: Retrieves simulation history and cleans up simulated run', async () => {
      const listRes = await app.request('/api/v1/qa/simulations', { method: 'GET' });
      expect(listRes.status).toBe(200);
      const list = await listRes.json() as any;
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);

      const targetId = createdSimulationIds[0];
      const getRes = await app.request(`/api/v1/qa/simulations/${targetId}`, { method: 'GET' });
      expect(getRes.status).toBe(200);
      const fetched = await getRes.json() as any;
      expect(fetched.id).toBe(targetId);

      // Delete target
      const delRes = await app.request(`/api/v1/qa/simulations/${targetId}`, { method: 'DELETE' });
      expect(delRes.status).toBe(200);

      // Verify deletion
      const checkRes = await app.request(`/api/v1/qa/simulations/${targetId}`, { method: 'GET' });
      expect(checkRes.status).toBe(404);
    });
  });

  describe('3. Local Console Direct Access & Boundary Security', () => {
    it('3.1: Permits local console mutations without operator login (no UNAUTHORIZED_OPERATOR_ACCESS)', async () => {
      const res = await app.request('/api/v1/callbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          loanId: testLoanId,
          phoneNumberId: testPhoneId,
          callbackScheduledDatetime: new Date().toISOString()
        })
      });

      expect(res.status).toBe(201);
      const data = await res.json() as any;
      const callbackId = data.callback?.id || data.id;
      expect(callbackId).toBeDefined();
      if (callbackId) createdCallbackIds.push(callbackId);
    });

    it('3.2: Rejects public tunnel access to console endpoints with 403 FORBIDDEN_PUBLIC_TUNNEL_ACCESS', async () => {
      const res = await app.request('/api/v1/campaigns', {
        headers: {
          'ngrok-trace-id': 'simulated-trace-123'
        }
      });

      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.error).toBe('FORBIDDEN_PUBLIC_TUNNEL_ACCESS');
    });

    it('3.3: Confirms operator login endpoint reports retired status', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Stakeholder'
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.message).toContain('retired');
    });

    it('3.4: Confirms session endpoint returns authenticated console state directly', async () => {
      const sessionRes = await app.request('/api/v1/auth/session', {
        method: 'GET'
      });

      expect(sessionRes.status).toBe(200);
      const session = await sessionRes.json() as any;
      expect(session.authenticated).toBe(true);
      expect(session.operator.role).toBe('console');
    });

    it('3.5: Confirms logout endpoint reports retired status cleanly', async () => {
      const logoutRes = await app.request('/api/v1/auth/logout', {
        method: 'POST'
      });

      expect(logoutRes.status).toBe(200);
      const data = await logoutRes.json() as any;
      expect(data.success).toBe(true);
    });

    it('3.6: Rejects mutation requests from untrusted origins with 403 Forbidden', async () => {
      const res = await app.request('/api/v1/callbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://attacker-phishing-site.com',
          'Host': 'localhost:3000'
        },
        body: JSON.stringify({
          loanId: testLoanId,
          phoneNumberId: testPhoneId,
          callbackScheduledDatetime: new Date().toISOString()
        })
      });

      expect(res.status).toBe(403);
      const body = await res.json() as any;
      expect(body.error).toBe('CSRF_ORIGIN_FORBIDDEN');
    });
  });

  describe('4. Webhook Hardening & Sensitive Data Redaction', () => {
    it('4.1: Webhook endpoint enforces 256KB request payload limit', async () => {
      // Create a payload larger than 256KB (> 262,144 bytes)
      const oversizedPayload = JSON.stringify({
        type: 'end-of-call-report',
        call: { id: 'call-oversized' },
        hugeField: 'x'.repeat(270000)
      });

      const res = await app.request('/api/v1/webhooks/vapi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'content-length': String(oversizedPayload.length),
          'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
        },
        body: oversizedPayload
      });

      expect(res.status).toBe(413);
      const body = await res.json() as any;
      expect(body.error).toBe('PAYLOAD_TOO_LARGE');
    });

    it('4.2: Sanitizer scrubs valid Luhn payment cards and CVVs without redacting Unix timestamps or IDs', () => {
      const testObj = {
        loanId: '3c89d84e-7b70-496a-8b83-a75d5e239241',
        timestamp: 1729962384123,
        vapiCallId: 'vapi-call-1729962384123',
        // Valid Luhn test card (Stripe test Visa)
        cardNumber: '4242 4242 4242 4242',
        cvv: '123',
        notes: 'Borrower mentioned card 4242 4242 4242 4242 and cvv: 123 during call',
        customerName: 'Alice Smith',
        phoneNumber: '+15551234567'
      };

      const sanitized = sanitizePayload(testObj);

      // Sensitive keys must be redacted
      expect(sanitized.cardNumber).toBe('[REDACTED_SENSITIVE_PAYMENT_DATA]');
      expect(sanitized.cvv).toBe('[REDACTED_SENSITIVE_PAYMENT_DATA]');

      // Free-form notes must have inline card and CVV redacted
      expect(sanitized.notes).toContain('[REDACTED_PAYMENT_CARD]');
      expect(sanitized.notes).toContain('[REDACTED_CVV]');

      // Timestamps, call IDs, and loan UUIDs must NOT be redacted
      expect(sanitized.timestamp).toBe(1729962384123);
      expect(sanitized.vapiCallId).toBe('vapi-call-1729962384123');
      expect(sanitized.loanId).toBe('3c89d84e-7b70-496a-8b83-a75d5e239241');
    });
  });

  describe('5. Durable Scheduler Concurrency & Lease Protection', () => {
    it('5.1: Leased jobs are protected and cannot be stolen by recoverStaleJobs', async () => {
      // Insert a test job with an active unexpired lease (expires 5 min in the future)
      const futureLease = new Date(Date.now() + 5 * 60 * 1000);
      const [activeLeasedJob] = await db.insert(scheduledJobs).values({
        loanId: testLoanId,
        campaignId: testCampaignId,
        jobType: 'OPERATOR_SCHEDULED',
        dueAtUtc: new Date(Date.now() - 60000), // Due in past
        status: 'running',
        leaseExpiresAt: futureLease,
        retryCount: 0,
        maxRetries: 3
      }).returning();

      // Attempt stale recovery
      const recoveredCount = await DurableJobScheduler.recoverStaleJobs(1);

      // Check job status in DB - it must still be 'running' with its unexpired lease
      const jobAfter = await db.query.scheduledJobs.findFirst({
        where: (j, { eq }) => eq(j.id, activeLeasedJob.id)
      });

      expect(jobAfter!.status).toBe('running');

      // Now simulate an expired lease (10 minutes ago)
      const pastLease = new Date(Date.now() - 10 * 60 * 1000);
      await db.update(scheduledJobs)
        .set({ leaseExpiresAt: pastLease })
        .where(eq(scheduledJobs.id, activeLeasedJob.id));

      // Attempt stale recovery again
      const recoveredAfterExpiry = await DurableJobScheduler.recoverStaleJobs(1);
      expect(recoveredAfterExpiry).toBeGreaterThanOrEqual(1);

      const jobRecovered = await db.query.scheduledJobs.findFirst({
        where: (j, { eq }) => eq(j.id, activeLeasedJob.id)
      });
      expect(jobRecovered!.status).toBe('scheduled');
      expect(jobRecovered!.leaseExpiresAt).toBeNull();

      // Clean up test job
      await db.delete(scheduledJobs).where(eq(scheduledJobs.id, activeLeasedJob.id));
    });
  });
});
