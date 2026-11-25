import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { loans, callbacks, stateChangeLog, operatorSessions, callAttempts, smsMessages } from '../../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { config } from '../../src/config';
import { safeCompare } from '../../src/utils/security';
import { sanitizeText, sanitizePayload } from '../../src/utils/sanitizer';
import { assertNotProtectedDatabase, cleanupTestLoans } from '../test-cleanup';
import { VapiClient } from '../../src/providers/vapi/VapiClient';
import { TwilioSmsService } from '../../src/providers/twilio/TwilioSmsService';
import crypto from 'crypto';

describe('Phase 5: Provider Integration Readiness, Security Validation & Supervised-QA Preparation', () => {
  const createdLoanIds: string[] = [];
  const createdCallbackIds: string[] = [];
  const createdSessionTokens: string[] = [];
  let testOperatorToken = '';

  beforeAll(async () => {
    // Bootstrap a known test operator session for testing authenticated paths
    testOperatorToken = crypto.randomBytes(32).toString('hex');
    await db.insert(operatorSessions).values({
      token: testOperatorToken,
      operatorUsername: 'phase5_qa_tester',
      role: 'operator',
      expiresAt: new Date(Date.now() + 3600000)
    });
    createdSessionTokens.push(testOperatorToken);
  });

  afterAll(async () => {
    if (createdCallbackIds.length > 0) {
      await db.delete(callbacks).where(inArray(callbacks.id, createdCallbackIds));
    }
    if (createdSessionTokens.length > 0) {
      await db.delete(operatorSessions).where(inArray(operatorSessions.token, createdSessionTokens));
    }
    if (createdLoanIds.length > 0) {
      await cleanupTestLoans(createdLoanIds);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PART A1: CALLBACK PROVENANCE SERVER ENFORCEMENT & FIXTURE TRUTH
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Part A1: Enforce Callback Provenance on the Server', () => {
    it('A1.1: Rejects client submission setting sourceType to BORROWER_REQUEST_FROM_REAL_CALL (HTTP 403)', async () => {
      const baselineLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.loanNumber, 'LN-100001') });
      expect(baselineLoan).toBeDefined();

      const res = await app.request('/api/v1/callbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': testOperatorToken
        },
        body: JSON.stringify({
          loanId: baselineLoan!.id,
          callbackScheduledDatetime: new Date(Date.now() + 86400000).toISOString(),
          sourceType: 'BORROWER_REQUEST_FROM_REAL_CALL'
        })
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN_PROVENANCE_SOURCE');
    });

    it('A1.2: Rejects client submission setting sourceType to QA_SCENARIO (HTTP 403)', async () => {
      const baselineLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.loanNumber, 'LN-100001') });

      const res = await app.request('/api/v1/callbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': testOperatorToken
        },
        body: JSON.stringify({
          loanId: baselineLoan!.id,
          callbackScheduledDatetime: new Date(Date.now() + 86400000).toISOString(),
          sourceType: 'QA_SCENARIO'
        })
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN_PROVENANCE_SOURCE');
    });

    it('A1.3: Rejects client callback creation specifying sourceCallAttemptId (HTTP 400)', async () => {
      const baselineLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.loanNumber, 'LN-100001') });

      const res = await app.request('/api/v1/callbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': testOperatorToken
        },
        body: JSON.stringify({
          loanId: baselineLoan!.id,
          callbackScheduledDatetime: new Date(Date.now() + 86400000).toISOString(),
          sourceCallAttemptId: '00000000-0000-0000-0000-000000000001'
        })
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('INVALID_CALLBACK_PROVENANCE');
    });

    it('A1.4: Creates OPERATOR_FOLLOWUP callback with audit log and null sourceCallAttemptId', async () => {
      const baselineLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.loanNumber, 'LN-100002') });

      const res = await app.request('/api/v1/callbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': testOperatorToken
        },
        body: JSON.stringify({
          loanId: baselineLoan!.id,
          callbackScheduledDatetime: new Date(Date.now() + 86400000).toISOString(),
          humanReadableNote: 'Operator scheduled follow-up via QA suite',
          operator: 'phase5_operator'
        })
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.callback.sourceType).toBe('OPERATOR_FOLLOWUP');
      expect(data.callback.sourceCallAttemptId).toBeNull();
      createdCallbackIds.push(data.callback.id);

      // Verify state change log
      const log = await db.query.stateChangeLog.findFirst({
        where: (sc, { eq, and }) => and(eq(sc.loanId, baselineLoan!.id), eq(sc.fieldName, 'operator_callback_created'))
      });
      expect(log).toBeDefined();
    });

    it('A1.5: PATCH /api/v1/callbacks/:id rejects modifying provenance fields with HTTP 400', async () => {
      expect(createdCallbackIds.length).toBeGreaterThan(0);
      const cbId = createdCallbackIds[0];

      // Try mutating sourceType
      const res1 = await app.request(`/api/v1/callbacks/${cbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': testOperatorToken
        },
        body: JSON.stringify({ sourceType: 'BORROWER_REQUEST_FROM_REAL_CALL' })
      });
      expect(res1.status).toBe(400);
      const data1 = await res1.json();
      expect(data1.error).toBe('PROVENANCE_IMMUTABLE');

      // Try mutating sourceCallAttemptId
      const res2 = await app.request(`/api/v1/callbacks/${cbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': testOperatorToken
        },
        body: JSON.stringify({ sourceCallAttemptId: '00000000-0000-0000-0000-000000000002' })
      });
      expect(res2.status).toBe(400);
      const data2 = await res2.json();
      expect(data2.error).toBe('PROVENANCE_IMMUTABLE');

      // Try mutating loanId
      const res3 = await app.request(`/api/v1/callbacks/${cbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': testOperatorToken
        },
        body: JSON.stringify({ loanId: '00000000-0000-0000-0000-000000000003' })
      });
      expect(res3.status).toBe(400);
      const data3 = await res3.json();
      expect(data3.error).toBe('PROVENANCE_IMMUTABLE');

      // Legitimate reschedule succeeds
      const newScheduledDate = new Date(Date.now() + 172800000).toISOString();
      const res4 = await app.request(`/api/v1/callbacks/${cbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': testOperatorToken
        },
        body: JSON.stringify({
          callbackScheduledDatetime: newScheduledDate,
          humanReadableNote: 'Rescheduled safely'
        })
      });
      expect(res4.status).toBe(200);
    });

    it('A1.6: Canonical scenario fixture is strictly Scenario 18 (LN-100018, Rachel FutureCallback, Gate C11)', async () => {
      const loan18 = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.loanNumber, 'LN-100018') });
      expect(loan18).toBeDefined();

      const cb = await db.query.callbacks.findFirst({ where: (c, { eq }) => eq(c.loanId, loan18!.id) });
      expect(cb).toBeDefined();
      expect(cb?.sourceType).toBe('QA_SCENARIO');
      expect(cb?.sourceCallAttemptId).toBeNull();

      // Verify LN-100013 has NO callbacks (clearing prior clerical typo)
      const loan13 = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.loanNumber, 'LN-100013') });
      expect(loan13).toBeDefined();
      const cb13 = await db.query.callbacks.findFirst({ where: (c, { eq }) => eq(c.loanId, loan13!.id) });
      expect(cb13).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PART A2: ROUTE-LEVEL AUTHORIZATION MATRIX & SECURITY HARDENING
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Part A2: Route-level Authorization Matrix & Security Hardening', () => {
    it('A2.1: Allows unauthenticated local loopback console requests without operator login', async () => {
      const res1 = await app.request('/api/v1/accounts');
      expect(res1.status).toBe(200);

      const res2 = await app.request('/api/v1/dashboard/summary');
      expect(res2.status).toBe(200);

      const res3 = await app.request('/api/v1/eligibility/queue');
      expect(res3.status).toBe(200);

      const res4 = await app.request('/api/v1/callbacks');
      expect(res4.status).toBe(200);
    });

    it('A2.2: Rejects public tunnel access to management endpoints with HTTP 403 FORBIDDEN_PUBLIC_TUNNEL_ACCESS', async () => {
      // Rejects accounts read over simulated tunnel
      const res1 = await app.request('/api/v1/accounts', {
        headers: { 'ngrok-trace-id': 'tunnel-probe-1' }
      });
      expect(res1.status).toBe(403);
      const data1 = await res1.json() as any;
      expect(data1.error).toBe('FORBIDDEN_PUBLIC_TUNNEL_ACCESS');

      // Rejects dashboard summary read over forwarded host
      const res2 = await app.request('/api/v1/dashboard/summary', {
        headers: { 'x-forwarded-host': 'api.external-tunnel.ngrok.app' }
      });
      expect(res2.status).toBe(403);
      const data2 = await res2.json() as any;
      expect(data2.error).toBe('FORBIDDEN_PUBLIC_TUNNEL_ACCESS');
    });

    it('A2.3: POST /api/v1/auth/login confirms operator login is retired and local console is directly active', async () => {
      const resGood = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'stakeholder' })
      });
      expect(resGood.status).toBe(200);
      const dataGood = await resGood.json() as any;
      expect(dataGood.success).toBe(true);
      expect(dataGood.message).toContain('retired');
    });

    it('A2.4: Provider tool endpoints accept x-vapi-secret or operator auth; reject unauthorized (HTTP 401)', async () => {
      // Unauthorized call to tools endpoint with x-enforce-auth
      const resUnauth = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-enforce-auth': 'true'
        },
        body: JSON.stringify({ callAttemptId: '00000000-0000-0000-0000-000000000001' })
      });
      expect(resUnauth.status).toBe(401);

      // Authorized via x-vapi-secret header (passes auth, returns 404 for non-existent callAttemptId)
      const resVapi = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-enforce-auth': 'true',
          'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
        },
        body: JSON.stringify({ callAttemptId: '00000000-0000-0000-0000-000000000001' })
      });
      expect(resVapi.status).toBe(404); // Proves authentication passed to handler

      // Operator token rejected on provider-only tool endpoints (Phase 6 hardening: 401)
      const resOp = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-enforce-auth': 'true',
          'x-operator-token': testOperatorToken
        },
        body: JSON.stringify({ callAttemptId: '00000000-0000-0000-0000-000000000001' })
      });
      expect(resOp.status).toBe(401);

      // Operator token with explicit test override accepted
      const resOpOverride = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-enforce-auth': 'true',
          'x-operator-token': testOperatorToken,
          'x-provider-tool-test-override': 'true'
        },
        body: JSON.stringify({ callAttemptId: '00000000-0000-0000-0000-000000000001' })
      });
      expect(resOpOverride.status).toBe(404); // Proves override authentication passed to handler
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PART A3: END-TO-END DATA PATH SANITIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Part A3: End-to-end Data Path Sanitization', () => {
    it('A3.1: Redacts Luhn-valid PANs, CVVs, and SSNs while preserving timestamps and IDs', () => {
      const epochTimestamp = 1718000000000;
      const uuidStr = '86ae99a0-3699-4661-b639-e3eb23b2ba57';

      const input = `Borrower verified SSN 987-65-4321, paid with card 4111 1111 1111 1111, cvv 432 at timestamp ${epochTimestamp} on account ${uuidStr}`;
      const sanitized = sanitizeText(input);

      expect(sanitized).not.toContain('987-65-4321');
      expect(sanitized).toContain('[REDACTED_SSN]');

      expect(sanitized).not.toContain('4111 1111 1111 1111');
      expect(sanitized).toContain('[REDACTED_PAYMENT_CARD]');

      expect(sanitized).not.toContain('432');
      expect(sanitized).toContain('[REDACTED_CVV]');

      expect(sanitized).toContain(String(epochTimestamp));
      expect(sanitized).toContain(uuidStr);
    });

    it('A3.2: Recursively sanitizes nested JSON payloads with numeric credit cards and sensitive keys', () => {
      const payload = {
        meta: {
          timestamp: 1718000000000,
          requestId: 'req-12345'
        },
        borrower: {
          name: 'Rachel FutureCallback',
          social_security_number: '123-45-6789',
          paymentDetails: {
            cardNumber: '4242424242424242',
            card_code: '999',
            amount: 340.50
          }
        }
      };

      const result = sanitizePayload(payload);

      expect(result.meta.timestamp).toBe(1718000000000);
      expect(result.meta.requestId).toBe('req-12345');
      expect(result.borrower.name).toBe('Rachel FutureCallback');
      expect(result.borrower.social_security_number).toBe('[REDACTED_SSN]');
      expect(result.borrower.paymentDetails.cardNumber).toBe('[REDACTED_SENSITIVE_PAYMENT_DATA]');
      expect(result.borrower.paymentDetails.card_code).toBe('[REDACTED_SENSITIVE_PAYMENT_DATA]');
      expect(result.borrower.paymentDetails.amount).toBe(340.50);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PART A4: PROVE QA SIMULATOR ISOLATION & DISPOSABLE DB SAFETY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Part A4: Prove QA Simulator Isolation & Disposable DB Safety', () => {
    it('A4.1: assertNotProtectedDatabase strictly refuses operations on delinquency_poc', () => {
      expect(() => {
        assertNotProtectedDatabase('postgres://localhost:5432/delinquency_poc');
      }).toThrow('SAFETY_VIOLATION');

      expect(() => {
        assertNotProtectedDatabase('postgresql://user:pass@127.0.0.1:5432/delinquency_poc?sslmode=disable');
      }).toThrow('SAFETY_VIOLATION');

      expect(() => {
        assertNotProtectedDatabase('postgres://localhost:5432/disposable_test_db');
      }).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PART B: PROVIDER INTEGRATION READINESS (DRY-RUN ONLY)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Part B: Provider Integration Readiness & Webhook Rehearsal', () => {
    it('B1: POST /api/v1/integrations/preflight assesses readiness without making live network calls', async () => {
      const res = await app.request('/api/v1/integrations/preflight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': testOperatorToken
        },
        body: JSON.stringify({ toNumber: '+15555550199' })
      });

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.readyForDryRun).toBe(true);
      expect(data.readyForSupervisedLiveCall).toBe(false);
      expect(data.safetyLockActive).toBe(true);

      // Verify facets
      expect(data.facets.database.status).toBe('HEALTHY');
      expect(data.facets.database.baselineLoans).toBe(30);

      expect(data.facets.vapi.promptFrozen).toBe(true);
      expect(data.facets.vapi.requiresServerSecretDashboard).toBe(true);

      // Verify request preview
      expect(data.requestPreview.provider).toBe('vapi');
      expect(data.requestPreview.endpoint).toBe('https://api.vapi.ai/call');
      expect(data.requestPreview.payload.assistantId).toBeDefined();
      expect(data.requestPreview.payload.customer.number).toMatch(/^\+1.*\d{4}$/);

      // Verify explicit blockers
      expect(data.blockers.some((b: string) => b.includes('SAFETY_LOCK_ACTIVE'))).toBe(true);
      expect(data.blockers.some((b: string) => b.includes('VAPI_PROMPT_FROZEN'))).toBe(true);
    });

    it('B2: POST /api/v1/integrations/webhook-rehearsal verifies 5 steps with 0 operational rows modified', async () => {
      const res = await app.request('/api/v1/integrations/webhook-rehearsal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': testOperatorToken
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.operationalRowsModified).toBe(0);
      expect(data.results.length).toBe(5);

      const steps = data.results.map((r: any) => r.step);
      expect(steps).toContain('auth_verification');
      expect(steps).toContain('payload_size_limit');
      expect(steps).toContain('deduplication');
      expect(steps).toContain('sensitive_data_redaction');
      expect(steps).toContain('idempotent_event_replay');

      expect(data.results.every((r: any) => r.passed)).toBe(true);
    });

    it('B3: Fail-closed provider dispatch: VapiClient and TwilioSmsService enforce lock', async () => {
      // VapiClient throws PHASE5_SAFETY_LOCK
      expect(
        VapiClient.initiateOutboundCall({
          customerNumber: '+15555550199',
          loanId: '00000000-0000-0000-0000-000000000001'
        })
      ).rejects.toThrow('PHASE5_SAFETY_LOCK');

      // TwilioSmsService with enabled mode automatically falls back to dryRun even if dryRun is omitted
      const prevMode = process.env.TWILIO_SMS_MODE;
      process.env.TWILIO_SMS_MODE = 'enable';
      try {
        const allowed = (config.ALLOWED_TEST_DESTINATIONS || '').split(',')[0]?.trim() || '+919328234331';
        const smsRes = await TwilioSmsService.sendTestSms({
          toNumber: allowed,
          dryRun: false // attempted live send
        });

        expect(smsRes.status).toBe('mocked_delivered');
        expect(smsRes.sid).toMatch(/^SM_dryrun_/);

        // Clean up diagnostic row
        if (smsRes.recordId) {
          await db.delete(smsMessages).where(eq(smsMessages.id, smsRes.recordId)).catch(() => {});
        }
      } finally {
        process.env.TWILIO_SMS_MODE = prevMode;
      }
    });
  });
});
