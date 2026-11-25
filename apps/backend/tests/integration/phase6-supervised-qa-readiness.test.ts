import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { config } from '../../src/config';
import { db } from '../../src/db/client';
import { loans, borrowers, phoneNumbers, callAttempts, operatorSessions } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { assertDisposableTestDatabase } from '../test-cleanup';
import { hashToken } from '../../src/utils/security';
import { sanitizeText, sanitizePayload } from '../../src/utils/sanitizer';

describe('Phase 6: Supervised Voice-Agent QA Readiness and Single-Call Safety Gate', () => {
  let testLoanId: string;
  let testPhoneId: string;
  let testCallAttemptId: string;
  let otherLoanId: string;
  let operatorToken: string;

  beforeAll(async () => {
    // 1. Establish valid session for operator endpoints
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'QA_Safety_Lead',
        pinOrSecret: config.OPERATOR_PASSWORD
      })
    });
    const loginData = await loginRes.json() as any;
    operatorToken = loginData.token;

    // 2. Fetch baseline loan & phone for context tests
    const loan = await db.query.loans.findFirst({
      where: (l, { eq }) => eq(l.loanNumber, 'LN-100018')
    });
    if (!loan) throw new Error('Baseline loan LN-100018 not found');
    testLoanId = loan.id;

    const phone = await db.query.phoneNumbers.findFirst({
      where: (p, { eq }) => eq(p.loanId, testLoanId)
    });
    if (!phone) throw new Error('Phone for LN-100018 not found');
    testPhoneId = phone.id;

    const otherLoan = await db.query.loans.findFirst({
      where: (l, { eq }) => eq(l.loanNumber, 'LN-100001')
    });
    if (!otherLoan) throw new Error('Baseline loan LN-100001 not found');
    otherLoanId = otherLoan.id;

    const campaign = await db.query.campaigns.findFirst();
    if (!campaign) throw new Error('No campaign found');

    // 3. Create a disposable call attempt in test DB to test context binding
    const [createdAttempt] = await db.insert(callAttempts).values({
      loanId: testLoanId,
      phoneNumberId: testPhoneId,
      campaignId: campaign.id,
      referenceNumber: `ATT-P6-TEST-${Date.now()}`,
      callStatus: 'in_progress',
      disposition: 'PENDING',
      initiatedAt: new Date()
    }).returning();
    testCallAttemptId = createdAttempt.id;
  });

  afterAll(async () => {
    // Cleanup disposable test attempt
    if (testCallAttemptId) {
      await db.delete(callAttempts).where(eq(callAttempts.id, testCallAttemptId));
    }
    // Cleanup operator session
    if (operatorToken) {
      const hashed = hashToken(operatorToken);
      await db.delete(operatorSessions).where(eq(operatorSessions.token, hashed));
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSTREAM A5: DISPOSABLE TEST DATABASE ISOLATION GUARD
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Workstream A5: Disposable Test Database Isolation Guard', () => {
    it('A5.1: Rejects delinquency_poc under all URL aliases and encodings', () => {
      // Direct delinquency_poc
      expect(() => {
        assertDisposableTestDatabase('postgres://postgres:postgres@localhost:5432/delinquency_poc');
      }).toThrow(/SAFETY_VIOLATION.*delinquency_poc/);

      // URL-encoded delinquency%5Fpoc
      expect(() => {
        assertDisposableTestDatabase('postgres://postgres:postgres@localhost:5432/delinquency%5Fpoc');
      }).toThrow(/SAFETY_VIOLATION.*delinquency_poc/);

      // Case variant
      expect(() => {
        assertDisposableTestDatabase('postgres://postgres:postgres@localhost:5432/DELINQUENCY_POC');
      }).toThrow(/SAFETY_VIOLATION.*delinquency_poc/);
    });

    it('A5.2: Rejects non-disposable database names missing test suffix', () => {
      expect(() => {
        assertDisposableTestDatabase('postgres://postgres:postgres@localhost:5432/delinquency_staging');
      }).toThrow(/SAFETY_VIOLATION.*not an approved disposable/);

      expect(() => {
        assertDisposableTestDatabase('postgres://postgres:postgres@localhost:5432/production');
      }).toThrow(/SAFETY_VIOLATION.*not an approved disposable/);
    });

    it('A5.3: Requires explicit TEST_DISPOSABLE_DB_OPT_IN flag', () => {
      const oldOptIn = process.env.TEST_DISPOSABLE_DB_OPT_IN;
      const oldReset = process.env.ALLOW_TEST_DATABASE_RESET;
      try {
        process.env.TEST_DISPOSABLE_DB_OPT_IN = 'false';
        process.env.ALLOW_TEST_DATABASE_RESET = 'false';
        expect(() => {
          assertDisposableTestDatabase('postgres://postgres:postgres@localhost:5432/delinquency_disposable_test');
        }).toThrow(/Destructive test operation refused without explicit TEST_DISPOSABLE_DB_OPT_IN=true/);
      } finally {
        process.env.TEST_DISPOSABLE_DB_OPT_IN = oldOptIn || 'true';
        process.env.ALLOW_TEST_DATABASE_RESET = oldReset || '';
      }
    });

    it('A5.4: Accepts validated disposable database target when opt-in is confirmed', () => {
      expect(() => {
        assertDisposableTestDatabase('postgres://postgres:postgres@localhost:5432/delinquency_disposable_test');
      }).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSTREAM A2: PROVIDER TOOL AUTHORIZATION & CALL-SESSION BINDING
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Workstream A2: Provider Tool Authorization & Call-Session Binding', () => {
    it('A2.1: Rejects unauthenticated tool invocations with HTTP 401', async () => {
      const endpoints = [
        '/api/v1/tools/get-borrower-context',
        '/api/v1/tools/verify-identity',
        '/api/v1/tools/send-payment-link',
        '/api/v1/tools/schedule-callback',
        '/api/v1/tools/transfer-to-agent',
        '/api/v1/tools/flag-compliance-event',
        '/api/v1/tools/log-disposition'
      ];

      for (const endpoint of endpoints) {
        const res = await app.request(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-enforce-auth': 'true'
          },
          body: JSON.stringify({ callAttemptId: testCallAttemptId })
        });
        expect(res.status).toBe(401);
      }
    });

    it('A2.2: Rejects standard operator session tokens on provider tool endpoints (HTTP 401)', async () => {
      const res = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-enforce-auth': 'true',
          'x-operator-token': operatorToken
        },
        body: JSON.stringify({ callAttemptId: testCallAttemptId })
      });
      expect(res.status).toBe(401);
      const data = await res.json() as any;
      expect(data.error).toBe('UNAUTHORIZED_PROVIDER_CALL');
    });

    it('A2.3: Accepts provider secret (x-vapi-secret) on tool endpoints', async () => {
      const res = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-enforce-auth': 'true',
          'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
        },
        body: JSON.stringify({ callAttemptId: testCallAttemptId })
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.context.borrowerName).toBe('Rachel FutureCallback');
      expect(data.context.loanNumberMasked).toBe('****0018');
    });

    it('A2.4: send-payment-link verifies strict loan binding (rejects loanId mismatch with HTTP 403)', async () => {
      // Attempt to send payment link for LN-100001 using LN-100018 callAttemptId
      const mismatchRes = await app.request('/api/v1/tools/send-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-enforce-auth': 'true',
          'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
        },
        body: JSON.stringify({
          callAttemptId: testCallAttemptId,
          loanId: otherLoanId // Mismatch!
        })
      });

      expect(mismatchRes.status).toBe(403);
      const mismatchData = await mismatchRes.json() as any;
      expect(mismatchData.error).toBe('LOAN_CALL_CONTEXT_MISMATCH');
    });

    it('A2.5: Rejects missing or non-existent callAttemptId with 400 or 404', async () => {
      // Missing callAttemptId
      const missingRes = await app.request('/api/v1/tools/send-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-enforce-auth': 'true',
          'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
        },
        body: JSON.stringify({})
      });
      expect(missingRes.status).toBe(400);

      // Non-existent valid UUID callAttemptId
      const fakeUuidRes = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-enforce-auth': 'true',
          'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
        },
        body: JSON.stringify({ callAttemptId: '00000000-0000-0000-0000-000000000099' })
      });
      expect(fakeUuidRes.status).toBe(404);
      const fakeData = await fakeUuidRes.json() as any;
      expect(fakeData.error).toBe('INVALID_CALL_CONTEXT');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSTREAM A3: OPERATOR AUTHENTICATION RETIREMENT & DIRECT CONSOLE ACCESS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Workstream A3: Operator Authentication Retirement & Direct Console Access', () => {
    it('A3.1: Session endpoint returns authenticated console state directly without tokens', async () => {
      const res = await app.request('/api/v1/auth/session');
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.authenticated).toBe(true);
      expect(data.operator.role).toBe('console');
      expect(data.operator.username).toBe('Stakeholder');
    });

    it('A3.2: Login endpoint returns retired notice without credential validation', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Stakeholder'
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.message).toContain('retired');
    });

    it('A3.3: Logout endpoint returns retired notice cleanly', async () => {
      const res = await app.request('/api/v1/auth/logout', {
        method: 'POST'
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.message).toContain('retired');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSTREAM A4: SENSITIVE DATA SANITIZER HARDENING
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Workstream A4: Sensitive Data Sanitizer Hardening', () => {
    it('A4.1: Sanitizes 13 to 19 digit Luhn-valid PANs', () => {
      // 16-digit Visa
      const visa16 = '4532015112830366';
      expect(sanitizeText(`Card: ${visa16}`)).toContain('[REDACTED_PAYMENT_CARD]');

      // 15-digit Amex
      const amex15 = '378282246310005';
      expect(sanitizeText(`Amex: ${amex15}`)).toContain('[REDACTED_PAYMENT_CARD]');

      // Non-Luhn 16 digits preserved (e.g. phone/account reference)
      const fakeNumber = '1234567890123456';
      expect(sanitizeText(`Account Ref: ${fakeNumber}`)).toBe(`Account Ref: ${fakeNumber}`);
    });

    it('A4.2: Sanitizes labeled CVVs and SSNs in delimited and spaced formats', () => {
      expect(sanitizeText('My CVV is 789 on the card')).toBe('My CVV is [REDACTED_CVV] on the card');
      expect(sanitizeText('SSN 000-12-3456 provided')).toBe('SSN [REDACTED_SSN] provided');
      expect(sanitizeText('SSN 000 12 3456 provided')).toBe('SSN [REDACTED_SSN] provided');
    });

    it('A4.3: Handles deep nested objects and circular references safely', () => {
      const circular: any = { name: 'safe_test' };
      circular.self = circular;

      // Must not throw stack overflow
      expect(() => sanitizePayload(circular)).not.toThrow();
      const sanitized = sanitizePayload(circular);
      expect(sanitized.self).toBe('[CIRCULAR_REDACTED]');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSTREAM B & C: SUPERVISED QA READINESS ENDPOINT & CALL CONTROL
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Workstream B & C: Supervised QA Readiness Endpoint & Fail-Closed Gate', () => {
    it('C1.1: POST /api/v1/integrations/supervised-qa-readiness returns full audit facets', async () => {
      const res = await app.request('/api/v1/integrations/supervised-qa-readiness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': operatorToken
        },
        body: JSON.stringify({})
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(['QA_GATE_LOCKED', 'READY_WITH_BLOCKERS']).toContain(data.status);
      expect(data.readyForSupervisedLiveCall).toBe(false);

      // Verify callControl state is disabled with required explanation
      expect(data.callControl.enabled).toBe(false);
      expect(data.callControl.reason).toBe('Not enabled — owner approval and a separately configured QA assistant are required.');

      // Verify facets
      expect(data.facets.safetyInterlock.productionCallsEnabled).toBe(false);
      expect(data.facets.safetyInterlock.supervisedQaVoiceEnabled).toBe(false);
      expect(data.facets.safetyInterlock.status).toBe('ENFORCED_FAIL_CLOSED');

      expect(data.facets.qaAssistantSeparation.frozenProductionAssistantId).toBe('e990ce6c-c8ef-4148-97e2-a680b465a66d');
      expect(data.facets.qaAssistantSeparation.draftPromptLocation).toBe('docs/VAPI_QA_SYSTEM_PROMPT_DRAFT.md');

      expect(data.facets.allowlist.targetTested).toMatch(/^\+\d+ •••• \d{4}$/);
      expect(data.facets.allowlist.disclaimer).toContain('Test destination allowlisting is not borrower consent');

      // Verify actionable blockers
      expect(data.blockers.some((b: string) => b.includes('PRODUCTION_CALLS_ENABLED is false'))).toBe(true);
      expect(data.blockers.some((b: string) => b.includes('SUPERVISED_QA_VOICE_ENABLED is false'))).toBe(true);
      expect(data.blockers.some((b: string) => b.includes('EXPLICIT_OWNER_APPROVAL_REQUIRED'))).toBe(true);

      // Verify synthetic request preview
      expect(data.syntheticRequestPreview.provider).toBe('vapi');
      expect(data.syntheticRequestPreview.endpoint).toBe('https://api.vapi.ai/call');
      expect(data.syntheticRequestPreview.payload.serverUrlAuthMode).toBe('SAVED_SERVER_CONFIG (Dashboard Secret Validation)');
      expect(data.syntheticRequestPreview.payload.assistantOverrides.variableValues.qa_scenario_type).toBe('INTERNAL_QA_SUPERVISED_TEST');
      expect(data.syntheticRequestPreview.payload.customer.number).toMatch(/^\+\d+ •••• \d{4}$/);
    });

    it('C1.2: POST /api/v1/integrations/dispatch-supervised-call fails closed with HTTP 423 Locked', async () => {
      // Capture database counts before dispatch attempt
      const attemptsBefore = (await db.query.callAttempts.findMany()).length;

      const res = await app.request('/api/v1/integrations/dispatch-supervised-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': operatorToken
        },
        body: JSON.stringify({
          targetPhone: '+919328234331',
          scenarioType: 'A_DIRECT_RIGHT_PARTY'
        })
      });

      expect(res.status).toBe(423);
      const data = await res.json() as any;
      expect(data.error).toBe('SUPERVISED_QA_CALLS_DISABLED');
      expect(data.message).toBe('Not enabled — owner approval and a separately configured QA assistant are required.');
      expect(data.callDispatched).toBe(false);

      // Verify ZERO database writes
      const attemptsAfter = (await db.query.callAttempts.findMany()).length;
      expect(attemptsAfter - attemptsBefore).toBe(0);
    });
  });
});
