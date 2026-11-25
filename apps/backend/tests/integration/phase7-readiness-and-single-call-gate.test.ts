import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { config } from '../../src/config';
import { db } from '../../src/db/client';
import { loans, phoneNumbers, callAttempts, operatorSessions, servicingOutbox, ptpCommitments } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { assertDisposableTestDatabase } from '../test-cleanup';
import { hashToken } from '../../src/utils/security';
import { sanitizeText, sanitizePayload } from '../../src/utils/sanitizer';
import { OneCallSafetyGate, normalizeE164, isDestinationAllowlisted } from '../../src/domain/qa/OneCallSafetyGate';
import { PostCallProcessor } from '../../src/domain/disposition/PostCallProcessor';

describe('Phase 7: Controlled Supervised Voice QA Final Readiness and Single-Call Safety Gate', () => {
  let testLoanId: string;
  let testPhoneId: string;
  let testCallAttemptId: string;
  let operatorToken: string;
  const allowlistedTarget = '+919328234331';

  beforeAll(async () => {
    // Assert we are strictly executing on disposable test database
    assertDisposableTestDatabase();

    // 1. Establish valid session for operator endpoints
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Phase7_QA_Lead',
        pinOrSecret: config.OPERATOR_PASSWORD
      })
    });
    const loginData = await loginRes.json() as any;
    operatorToken = loginData.token;

    // 2. Fetch baseline loan & phone for context tests
    const loan = await db.query.loans.findFirst({
      where: (l, { eq }) => eq(l.loanNumber, 'LN-100018')
    });
    if (!loan) throw new Error('Baseline loan LN-100018 not found in test database');
    testLoanId = loan.id;

    const phone = await db.query.phoneNumbers.findFirst({
      where: (p, { eq }) => eq(p.loanId, testLoanId)
    });
    if (!phone) throw new Error('Phone for LN-100018 not found');
    testPhoneId = phone.id;

    const campaign = await db.query.campaigns.findFirst();
    if (!campaign) throw new Error('No campaign found');

    // 3. Create a disposable call attempt in test DB to test binding
    const [createdAttempt] = await db.insert(callAttempts).values({
      loanId: testLoanId,
      phoneNumberId: testPhoneId,
      campaignId: campaign.id,
      referenceNumber: `ATT-P7-TEST-${Date.now()}`,
      callStatus: 'in_progress',
      disposition: 'PENDING',
      initiatedAt: new Date()
    }).returning();
    testCallAttemptId = createdAttempt.id;
  });

  afterAll(async () => {
    OneCallSafetyGate.clearTestAuthorizations();
    if (testCallAttemptId) {
      await db.delete(callAttempts).where(eq(callAttempts.id, testCallAttemptId));
    }
    if (operatorToken) {
      const hashed = hashToken(operatorToken);
      await db.delete(operatorSessions).where(eq(operatorSessions.token, hashed));
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSTREAM 2.1: MULTI-GATED PROVIDER-TOOL TEST OVERRIDE SECURITY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2.1 Multi-Gated Provider-Tool Test Override Security', () => {
    it('rejects provider tool call without valid secret and without override header (HTTP 401)', async () => {
      const res = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ callAttemptId: testCallAttemptId })
      });
      expect(res.status).toBe(401);
      const data = await res.json() as any;
      expect(data.error).toBe('UNAUTHORIZED_PROVIDER_CALL');
    });

    it('rejects override header if server override flag is disabled (HTTP 401)', async () => {
      const originalFlag = process.env.ENABLE_PROVIDER_TOOL_TEST_OVERRIDE;
      try {
        process.env.ENABLE_PROVIDER_TOOL_TEST_OVERRIDE = 'false';
        const res = await app.request('/api/v1/tools/get-borrower-context', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-provider-tool-test-override': 'true'
          },
          body: JSON.stringify({ callAttemptId: testCallAttemptId })
        });
        expect(res.status).toBe(401);
        const data = await res.json() as any;
        expect(data.error).toBe('UNAUTHORIZED_PROVIDER_CALL');
      } finally {
        process.env.ENABLE_PROVIDER_TOOL_TEST_OVERRIDE = originalFlag;
      }
    });

    it('rejects override header if NODE_ENV is set to production (HTTP 401)', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const res = await app.request('/api/v1/tools/get-borrower-context', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-provider-tool-test-override': 'true'
          },
          body: JSON.stringify({ callAttemptId: testCallAttemptId })
        });
        expect(res.status).toBe(401);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('permits override only when all 4 conditions are met (test runtime + server flag + disposable db + header)', async () => {
      const res = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': operatorToken,
          'x-provider-tool-test-override': 'true'
        },
        body: JSON.stringify({ callAttemptId: testCallAttemptId })
      });
      // In disposable test environment with operator session and all gates active, lookup succeeds
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.context.loanNumberMasked).toContain('0018');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSTREAM 2.2: OPERATOR LOGIN RETIREMENT & DIRECT CONSOLE ACCESS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2.2 Operator Login Retirement & Direct Console Access', () => {
    it('confirms operator login endpoint returns retired status cleanly without credentials', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Stakeholder' })
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.message).toContain('retired');
    });

    it('confirms console session returns authenticated stakeholder directly', async () => {
      const res = await app.request('/api/v1/auth/session');
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.authenticated).toBe(true);
      expect(data.operator.role).toBe('console');
      expect(data.operator.username).toBe('Stakeholder');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSTREAM 2.3: SENSITIVE DATA SANITIZER LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2.3 Sensitive Data Sanitizer Lifecycle', () => {
    it('redacts labeled raw 9-digit SSNs in text', () => {
      const input = 'Borrower verified identity with SSN: 123456789 during preliminary intake.';
      const sanitized = sanitizeText(input);
      expect(sanitized).not.toContain('123456789');
      expect(sanitized).toContain('[REDACTED_SSN]');
    });

    it('redacts standard delimited SSNs in text', () => {
      const input = 'Social security number provided: 123-45-6789.';
      const sanitized = sanitizeText(input);
      expect(sanitized).not.toContain('123-45-6789');
      expect(sanitized).toContain('[REDACTED_SSN]');
    });

    it('redacts sensitive payment keys and 13-19 digit Luhn-valid card numbers', () => {
      // 4532015112830366 is a valid Luhn test visa card
      const payload = {
        cardNumber: '4532015112830366',
        cvv: '123',
        amount: 340.50,
        loanNumber: 'LN-100018',
        arbitraryNotes: 'Caller mentioned card 4532015112830366'
      };
      const sanitized = sanitizePayload(payload);
      expect(sanitized.cardNumber).toBe('[REDACTED_SENSITIVE_PAYMENT_DATA]');
      expect(sanitized.cvv).toBe('[REDACTED_SENSITIVE_PAYMENT_DATA]');
      expect(sanitized.arbitraryNotes).toContain('[REDACTED_PAYMENT_CARD]');
      // Preserves benign identifiers and amounts
      expect(sanitized.amount).toBe(340.50);
      expect(sanitized.loanNumber).toBe('LN-100018');
    });

    it('safely handles circular references without crashing', () => {
      const circular: any = { name: 'Test Object', card_number: '4532015112830366' };
      circular.self = circular;
      expect(() => sanitizePayload(circular)).not.toThrow();
      const sanitized = sanitizePayload(circular);
      expect(sanitized.card_number).toContain('REDACTED');
      expect(sanitized.self).toBe('[CIRCULAR_REDACTED]');
    });

    it('sanitizes post-call outcome payloads before persistence', async () => {
      // Create a temporary call attempt to process
      const campaign = await db.query.campaigns.findFirst();
      const [attempt] = await db.insert(callAttempts).values({
        loanId: testLoanId,
        phoneNumberId: testPhoneId,
        campaignId: campaign!.id,
        referenceNumber: `ATT-SAN-TEST-${Date.now()}`,
        callStatus: 'in_progress',
        disposition: 'PENDING',
        initiatedAt: new Date()
      }).returning();

      const rawOutcomeWithPii = {
        disposition: 'PROMISE_TO_PAY',
        rpc: true,
        borrowerStatedReason: 'Temporary financial hardship - SSN 987654321',
        sentiment: 'cooperative',
        ptp: {
          amount: 340.50,
          paymentDate: '2026-03-15',
          paymentMethod: 'ACH'
        }
      };

      await PostCallProcessor.process(attempt.id, rawOutcomeWithPii as any);

      const refreshed = await db.query.callAttempts.findFirst({
        where: (a, { eq }) => eq(a.id, attempt.id)
      });
      expect(refreshed?.borrowerStatedReason).not.toContain('987654321');
      expect(refreshed?.borrowerStatedReason).toContain('[REDACTED_SSN]');

      // Cleanup child records before deleting call_attempts
      await db.delete(servicingOutbox).where(eq(servicingOutbox.callAttemptId, attempt.id));
      await db.delete(ptpCommitments).where(eq(ptpCommitments.callAttemptId, attempt.id));
      await db.delete(callAttempts).where(eq(callAttempts.id, attempt.id));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSTREAM 2.4-2.6: TRUTHFUL READINESS & CARRIER ROUTE CHECK
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2.4-2.6 Truthful Preflight & Carrier Route Check', () => {
    it('returns READY_WITH_BLOCKERS and truthful 8-facet breakdown', async () => {
      const res = await app.request('/api/v1/integrations/supervised-qa-readiness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': operatorToken
        },
        body: JSON.stringify({ toNumber: allowlistedTarget })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.status).toBe('READY_WITH_BLOCKERS');
      expect(data.readyForOwnerReview).toBe(true);
      expect(data.readyForLiveDispatch).toBe(false);
      expect(data.safetyLockActive).toBe(true);
      expect(data.callControl.enabled).toBe(false);
      expect(data.callControl.reason).toBe('Not enabled — owner approval and a separately configured QA assistant are required.');

      // Check Carrier Route Facet (+1 CLI to +91 target)
      expect(data.facets.carrierRouting).toBeDefined();
      expect(data.facets.carrierRouting.compliesWithNonIndianCliRule).toBe(true);
      expect(data.facets.carrierRouting.accountPermissionsVerified).toBe(false);

      // Check Webhook Security Facet (zero inline serverUrl in request preview)
      expect(data.facets.webhookSecurity.serverUrlInCallPayload).toBe(false);
      expect(data.syntheticRequestPreview.payload.serverUrl).toBeUndefined();
    });

    it('enforces that allowlisting is an internal filter and NOT borrower consent', () => {
      const preflight = OneCallSafetyGate.evaluatePreflight(allowlistedTarget);
      expect(preflight.facets.allowlist.borrowerConsent).toBe('NOT_BORROWER_CONSENT');
      expect(preflight.facets.allowlist.disclaimer).toContain('NOT constitute borrower consent');
    });

    it('correctly normalizes E.164 destinations and checks allowlist', () => {
      expect(normalizeE164('+91 (93282) 34331')).toBe('+919328234331');
      expect(normalizeE164('  +1-555-555-0199  ')).toBe('+15555550199');
      expect(isDestinationAllowlisted(allowlistedTarget)).toBe(true);
      expect(isDestinationAllowlisted('+12345678900')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKSTREAM 4: ONE-CALL SAFETY GATE FAIL-CLOSED INTERLOCKS & NONCE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. One-Call Safety Gate Fail-Closed Interlocks & Nonce', () => {
    it('fails closed with HTTP 423 when safety flags are disabled', async () => {
      const res = await app.request('/api/v1/integrations/dispatch-supervised-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': operatorToken
        },
        body: JSON.stringify({
          targetPhone: allowlistedTarget
        })
      });
      expect(res.status).toBe(423);
      const data = await res.json() as any;
      expect(data.callDispatched).toBe(false);
      expect(data.error).toBe('SUPERVISED_QA_CALLS_DISABLED');
    });

    it('fails closed when destination is not allowlisted', async () => {
      const result = await OneCallSafetyGate.attemptDispatch({
        targetPhone: '+19999999999', // Not in allowlist
        operatorUser: 'QA_Lead',
        oneCallNonce: 'some_nonce'
      });
      expect([403, 423]).toContain(result.status);
      expect(result.body.callDispatched).toBe(false);
    });

    it('fails closed with HTTP 403 when attempting to target baseline loan LN-100001–LN-100030', async () => {
      const origProd = config.PRODUCTION_CALLS_ENABLED;
      const origQa = config.SUPERVISED_QA_VOICE_ENABLED;
      const origQaId = config.VAPI_QA_ASSISTANT_ID;
      try {
        (config as any).PRODUCTION_CALLS_ENABLED = true;
        (config as any).SUPERVISED_QA_VOICE_ENABLED = true;
        (config as any).VAPI_QA_ASSISTANT_ID = '00000000-0000-0000-0000-000000000001';

        const result = await OneCallSafetyGate.attemptDispatch({
          targetPhone: allowlistedTarget,
          operatorUser: 'QA_Lead',
          loanId: 'LN-100018', // Baseline loan
          oneCallNonce: 'some_nonce'
        });
        expect(result.status).toBe(403);
        expect(result.body.error).toBe('OPERATIONAL_BASELINE_PROTECTED');
      } finally {
        (config as any).PRODUCTION_CALLS_ENABLED = origProd;
        (config as any).SUPERVISED_QA_VOICE_ENABLED = origQa;
        (config as any).VAPI_QA_ASSISTANT_ID = origQaId;
      }
    });

    it('enforces single-use authorization nonce and prevents replay (HTTP 409)', async () => {
      const origProd = config.PRODUCTION_CALLS_ENABLED;
      const origQa = config.SUPERVISED_QA_VOICE_ENABLED;
      const origQaId = config.VAPI_QA_ASSISTANT_ID;
      const testNonce = `nonce_test_${Date.now()}`;
      const mockQaAssistantId = '11111111-2222-3333-4444-555555555555';

      try {
        (config as any).PRODUCTION_CALLS_ENABLED = true;
        (config as any).SUPERVISED_QA_VOICE_ENABLED = true;
        (config as any).VAPI_QA_ASSISTANT_ID = mockQaAssistantId;

        // Register valid test nonce
        OneCallSafetyGate.registerTestAuthorization({
          nonce: testNonce,
          authorizedBy: 'Owner_Authorized_QA_Run',
          assistantId: mockQaAssistantId,
          destinationE164: allowlistedTarget,
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000 // 1 minute validity
        });

        // 1st attempt: Claims nonce atomically
        const firstAttempt = await OneCallSafetyGate.attemptDispatch({
          targetPhone: allowlistedTarget,
          operatorUser: 'QA_Lead',
          loanId: 'TEST-LOAN-999',
          oneCallNonce: testNonce
        });
        // Nonce is claimed, return is 423 (safety lock) or 200
        expect([423, 200]).toContain(firstAttempt.status);

        // 2nd attempt with SAME nonce: Replay must fail with HTTP 409
        const replayAttempt = await OneCallSafetyGate.attemptDispatch({
          targetPhone: allowlistedTarget,
          operatorUser: 'QA_Lead',
          loanId: 'TEST-LOAN-999',
          oneCallNonce: testNonce
        });
        expect(replayAttempt.status).toBe(409);
        expect(replayAttempt.body.error).toBe('AUTHORIZATION_NONCE_ALREADY_USED');
      } finally {
        (config as any).PRODUCTION_CALLS_ENABLED = origProd;
        (config as any).SUPERVISED_QA_VOICE_ENABLED = origQa;
        (config as any).VAPI_QA_ASSISTANT_ID = origQaId;
        OneCallSafetyGate.clearTestAuthorizations();
      }
    });

    it('rejects expired authorization nonce with HTTP 403', async () => {
      const origProd = config.PRODUCTION_CALLS_ENABLED;
      const origQa = config.SUPERVISED_QA_VOICE_ENABLED;
      const origQaId = config.VAPI_QA_ASSISTANT_ID;
      const expiredNonce = `nonce_expired_${Date.now()}`;
      const mockQaAssistantId = '11111111-2222-3333-4444-555555555555';

      try {
        (config as any).PRODUCTION_CALLS_ENABLED = true;
        (config as any).SUPERVISED_QA_VOICE_ENABLED = true;
        (config as any).VAPI_QA_ASSISTANT_ID = mockQaAssistantId;

        // Register expired nonce
        OneCallSafetyGate.registerTestAuthorization({
          nonce: expiredNonce,
          authorizedBy: 'Owner_Authorized_QA_Run',
          assistantId: mockQaAssistantId,
          destinationE164: allowlistedTarget,
          createdAt: Date.now() - 120000,
          expiresAt: Date.now() - 60000 // Expired 1 minute ago
        });

        const res = await OneCallSafetyGate.attemptDispatch({
          targetPhone: allowlistedTarget,
          operatorUser: 'QA_Lead',
          loanId: 'TEST-LOAN-999',
          oneCallNonce: expiredNonce
        });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('AUTHORIZATION_NONCE_EXPIRED');
      } finally {
        (config as any).PRODUCTION_CALLS_ENABLED = origProd;
        (config as any).SUPERVISED_QA_VOICE_ENABLED = origQa;
        (config as any).VAPI_QA_ASSISTANT_ID = origQaId;
        OneCallSafetyGate.clearTestAuthorizations();
      }
    });
  });
});
