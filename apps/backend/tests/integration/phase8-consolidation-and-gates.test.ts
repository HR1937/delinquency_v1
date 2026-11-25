import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { config, isTwilioSmsEnabled, isWebQaEnabled, isVerifiedCallDestination } from '../../src/config';
import { db } from '../../src/db/client';
import { loans, borrowers, phoneNumbers, callAttempts, campaigns, campaignMembers, smsMessages, stateChangeLog } from '../../src/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { TwilioSmsService } from '../../src/providers/twilio/TwilioSmsService';
import crypto from 'crypto';
import fs from 'fs';

const FROZEN_PROMPT_SHA256 = 'fd50a8f83103d177be371c771d0d8000d8cb4dee831395c98dd092439f8e2451';
const FROZEN_SYNC_SHA256 = '4dba2e06452037cc3fdd319f1aa0165a2fdf53ee1caf61336cee284195c594c6';

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

describe('Phase 8: Final Product Consolidation, Browser Voice QA, SMS Kill-Switch & Gates', () => {
  let operatorToken: string;
  let testCampaignId: string;
  let testLoanId: string;
  let testPhoneId: string;
  let testCallAttemptId: string;
  const createdAttemptIds: string[] = [];

  beforeAll(async () => {
    // 1. Authenticate operator
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Phase8_Lead',
        pinOrSecret: config.OPERATOR_PASSWORD
      })
    });
    const loginData = await loginRes.json() as any;
    operatorToken = loginData.token;

    // 2. Fetch baseline campaign and loan matching 35 DPD
    const camp = await db.query.campaigns.findFirst({
      where: (cp, { and, lte, gte }) => and(lte(cp.dpdMin, 35), gte(cp.dpdMax, 35))
    });
    if (!camp) throw new Error('No campaign found matching 35 DPD');
    testCampaignId = camp.id;

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

    // Create a mock call attempt for tool context testing
    const [attempt] = await db.insert(callAttempts).values({
      loanId: testLoanId,
      campaignId: testCampaignId,
      referenceNumber: `PH8-TEST-${Date.now()}`,
      status: 'initiated',
      destinationNumberMasked: phone.phoneE164.slice(-4),
      attemptType: 'test_override'
    }).returning();
    testCallAttemptId = attempt.id;
    createdAttemptIds.push(attempt.id);
  });

  afterAll(async () => {
    if (createdAttemptIds.length > 0) {
      await db.delete(callAttempts).where(inArray(callAttempts.id, createdAttemptIds)).catch(() => {});
    }
  });

  // ─── 1. TWILIO SMS HARD-DISABLE SWITCH TESTS (DELIVERABLE B) ───────────────
  describe('1. Twilio SMS Hard-Disable Kill-Switch (TWILIO_SMS_MODE=disable)', () => {
    it('1.1: TwilioSmsService.sendTestSms throws SMS_DISABLED when TWILIO_SMS_MODE=disable', async () => {
      const prevMode = process.env.TWILIO_SMS_MODE;
      process.env.TWILIO_SMS_MODE = 'disable';
      try {
        await expect(
          TwilioSmsService.sendTestSms({ toNumber: '+919328234331', dryRun: true })
        ).rejects.toThrow('SMS_DISABLED');
      } finally {
        process.env.TWILIO_SMS_MODE = prevMode;
      }
    });

    it('1.2: TwilioSmsService.sendPaymentLink throws SMS_DISABLED when TWILIO_SMS_MODE=disable', async () => {
      const prevMode = process.env.TWILIO_SMS_MODE;
      process.env.TWILIO_SMS_MODE = 'disable';
      try {
        await expect(
          TwilioSmsService.sendPaymentLink({
            loanId: testLoanId,
            toNumber: '+919328234331',
            callAttemptId: testCallAttemptId
          })
        ).rejects.toThrow('SMS_DISABLED');
      } finally {
        process.env.TWILIO_SMS_MODE = prevMode;
      }
    });

    it('1.3: POST /api/v1/integrations/test-sms returns HTTP 423 SMS_DISABLED when disabled', async () => {
      const prevMode = process.env.TWILIO_SMS_MODE;
      process.env.TWILIO_SMS_MODE = 'disable';
      try {
        const res = await app.request('/api/v1/integrations/test-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${operatorToken}`
          },
          body: JSON.stringify({ toNumber: '+919328234331' })
        });
        expect(res.status).toBe(423);
        const data = await res.json() as any;
        expect(data.success).toBe(false);
        expect(data.error).toBe('SMS_DISABLED');
      } finally {
        process.env.TWILIO_SMS_MODE = prevMode;
      }
    });

    it('1.4: POST /api/v1/tools/send-payment-link returns SMS_DISABLED when disabled', async () => {
      const prevMode = process.env.TWILIO_SMS_MODE;
      process.env.TWILIO_SMS_MODE = 'disable';
      try {
        const res = await app.request('/api/v1/tools/send-payment-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
          },
          body: JSON.stringify({
            callAttemptId: testCallAttemptId,
            loanId: testLoanId
          })
        });
        const data = await res.json() as any;
        expect(data.success).toBe(false);
        expect(data.error).toBe('SMS_DISABLED');
      } finally {
        process.env.TWILIO_SMS_MODE = prevMode;
      }
    });

    it('1.5: Zero rows inserted into smsMessages when disabled', async () => {
      const prevMode = process.env.TWILIO_SMS_MODE;
      process.env.TWILIO_SMS_MODE = 'disable';
      const beforeCount = (await db.query.smsMessages.findMany()).length;

      try {
        await TwilioSmsService.sendTestSms({ toNumber: '+919328234331' }).catch(() => {});
      } finally {
        process.env.TWILIO_SMS_MODE = prevMode;
      }

      const afterCount = (await db.query.smsMessages.findMany()).length;
      expect(afterCount).toBe(beforeCount);
    });

    it('1.6: When TWILIO_SMS_MODE=enable (mock context), existing validated path functions', async () => {
      const prevMode = process.env.TWILIO_SMS_MODE;
      process.env.TWILIO_SMS_MODE = 'enable';
      try {
        const allowed = (config.ALLOWED_TEST_DESTINATIONS || '').split(',')[0]?.trim() || '+919328234331';
        const smsRes = await TwilioSmsService.sendTestSms({
          toNumber: allowed,
          dryRun: true
        });
        expect(smsRes.success).toBe(true);
        expect(smsRes.status).toBe('mocked_delivered');

        // Cleanup
        if (smsRes.recordId) {
          await db.delete(smsMessages).where(eq(smsMessages.id, smsRes.recordId)).catch(() => {});
        }
      } finally {
        process.env.TWILIO_SMS_MODE = prevMode;
      }
    });

    it('1.7: Twilio Voice credentials presence is unaffected by TWILIO_SMS_MODE', () => {
      const prevMode = process.env.TWILIO_SMS_MODE;
      process.env.TWILIO_SMS_MODE = 'disable';
      expect(isTwilioSmsEnabled()).toBe(false);
      // Voice number and Sid remain configured and accessible
      expect(typeof config.TWILIO_VOICE_NUMBER).toBe('string');
      expect(typeof config.TWILIO_ACCOUNT_SID).toBe('string');
      process.env.TWILIO_SMS_MODE = prevMode;
    });
  });

  // ─── 2. VERIFIED PSTN DESTINATION ALLOWLIST (DELIVERABLE C) ───────────────
  describe('2. Owner-Attested Verified PSTN Destination Gate (VERIFIED_CALL_DESTINATIONS_E164)', () => {
    it('2.1: isVerifiedCallDestination rejects unlisted, null, and empty destinations', () => {
      const prevList = process.env.VERIFIED_CALL_DESTINATIONS_E164;
      process.env.VERIFIED_CALL_DESTINATIONS_E164 = '+919328234331,+15555550199';
      try {
        expect(isVerifiedCallDestination(null)).toBe(false);
        expect(isVerifiedCallDestination('')).toBe(false);
        expect(isVerifiedCallDestination('+19999999999')).toBe(false);
      } finally {
        process.env.VERIFIED_CALL_DESTINATIONS_E164 = prevList;
      }
    });

    it('2.2: isVerifiedCallDestination accepts exact matching E.164 destinations', () => {
      const prevList = process.env.VERIFIED_CALL_DESTINATIONS_E164;
      process.env.VERIFIED_CALL_DESTINATIONS_E164 = '+919328234331,+15555550199';
      try {
        expect(isVerifiedCallDestination('+919328234331')).toBe(true);
        expect(isVerifiedCallDestination('+15555550199')).toBe(true);
      } finally {
        process.env.VERIFIED_CALL_DESTINATIONS_E164 = prevList;
      }
    });

    it('2.3: POST /api/v1/campaigns/:id/launch-call blocks unverified destinations with DESTINATION_NOT_IN_VERIFIED_ALLOWLIST', async () => {
      const prevList = process.env.VERIFIED_CALL_DESTINATIONS_E164;
      process.env.VERIFIED_CALL_DESTINATIONS_E164 = ''; // empty verified list

      // Use clean loan LN-100001 (0 attempts, 15 DPD) with Campaign 1 (1-30 DPD)
      const cleanLoan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.loanNumber, 'LN-100001') });
      const cleanPhone = await db.query.phoneNumbers.findFirst({ where: (p, { eq }) => eq(p.loanId, cleanLoan!.id) });
      const camp1 = await db.query.campaigns.findFirst({ where: (c, { eq }) => eq(c.name, 'Early-Stage Delinquency | 1–30 DPD') });

      // Temporarily set daytime timezone so C7/C8 window passes
      const originalTz = cleanPhone?.timezoneIana;
      await db.update(phoneNumbers).set({ timezoneIana: getCurrentlyDaytimeTimezone() }).where(eq(phoneNumbers.id, cleanPhone!.id));

      try {
        const res = await app.request(`/api/v1/campaigns/${camp1!.id}/launch-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${operatorToken}`
          },
          body: JSON.stringify({
            loanId: cleanLoan!.id,
            phoneNumberId: cleanPhone!.id
          })
        });
        expect(res.status).toBe(400);
        const data = await res.json() as any;
        expect(data.success).toBe(false);
        expect(data.reason).toBe('DESTINATION_NOT_IN_VERIFIED_ALLOWLIST');
      } finally {
        process.env.VERIFIED_CALL_DESTINATIONS_E164 = prevList;
        if (originalTz && cleanPhone) {
          await db.update(phoneNumbers).set({ timezoneIana: originalTz }).where(eq(phoneNumbers.id, cleanPhone.id));
        }
      }
    });
  });

  // ─── 3. BROWSER WEB VOICE QA GATE (DELIVERABLE D) ──────────────────────────
  describe('3. Browser Web Voice QA Gate (@vapi-ai/web)', () => {
    it('3.1: GET /api/v1/integrations/web-qa-config returns operational configuration and canonical assistant', async () => {
      const res = await app.request('/api/v1/integrations/web-qa-config');
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.webQaMode).toBeDefined();
      expect(data.assistantId).toBe(config.VAPI_ASSISTANT_ID || 'e990ce6c-c8ef-4148-97e2-a680b465a66d');
      expect(Array.isArray(data.blockers)).toBe(true);
    });

    it('3.2: POST /api/v1/integrations/web-qa-session fails closed with 423 when VAPI_WEB_QA_MODE=disable', async () => {
      const prevMode = process.env.VAPI_WEB_QA_MODE;
      process.env.VAPI_WEB_QA_MODE = 'disable';
      try {
        const res = await app.request('/api/v1/integrations/web-qa-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        expect(res.status).toBe(423);
        const data = await res.json() as any;
        expect(data.success).toBe(false);
        expect(data.error).toBe('WEB_QA_DISABLED');
      } finally {
        process.env.VAPI_WEB_QA_MODE = prevMode;
      }
    });

    it('3.3: POST /api/v1/integrations/web-qa-session fails closed if VAPI_PUBLIC_KEY is missing', async () => {
      const prevMode = process.env.VAPI_WEB_QA_MODE;
      const prevPub = process.env.VAPI_PUBLIC_KEY;
      process.env.VAPI_WEB_QA_MODE = 'enable';
      process.env.VAPI_PUBLIC_KEY = '';
      try {
        const res = await app.request('/api/v1/integrations/web-qa-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        expect(res.status).toBe(400);
        const data = await res.json() as any;
        expect(data.success).toBe(false);
        expect(data.error).toBe('MISSING_VAPI_PUBLIC_KEY');
      } finally {
        process.env.VAPI_WEB_QA_MODE = prevMode;
        process.env.VAPI_PUBLIC_KEY = prevPub;
      }
    });

    it('3.4: When enabled with public key, returns single canonical assistant ID and synthetic session context', async () => {
      const prevMode = process.env.VAPI_WEB_QA_MODE;
      const prevPub = process.env.VAPI_PUBLIC_KEY;
      process.env.VAPI_WEB_QA_MODE = 'enable';
      process.env.VAPI_PUBLIC_KEY = 'vapi_pub_test_key_12345';
      try {
        const res = await app.request('/api/v1/integrations/web-qa-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.success).toBe(true);
        expect(data.assistantId).toBe(config.VAPI_ASSISTANT_ID || 'e990ce6c-c8ef-4148-97e2-a680b465a66d');
        expect(data.syntheticContext.borrower_first_name).toBe('Alex');
      } finally {
        process.env.VAPI_WEB_QA_MODE = prevMode;
        process.env.VAPI_PUBLIC_KEY = prevPub;
      }
    });
  });

  // ─── 4. CAMPAIGN DISPATCH RUN (DELIVERABLE E) ──────────────────────────────
  describe('4. Campaign Dispatch Run Semantics (Run Eligible Borrowers Now)', () => {
    it('4.1: POST /api/v1/campaigns/:id/dispatch-run returns 404 for nonexistent campaign', async () => {
      const res = await app.request('/api/v1/campaigns/00000000-0000-0000-0000-000000000000/dispatch-run', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${operatorToken}` }
      });
      expect(res.status).toBe(404);
    });

    it('4.2: Evaluates active campaign members across 12 gates + verified PSTN allowlist', async () => {
      const res = await app.request(`/api/v1/campaigns/${testCampaignId}/dispatch-run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${operatorToken}` }
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.campaignId).toBe(testCampaignId);
      expect(typeof data.totalMembers).toBe('number');
      expect(typeof data.evaluatedCount).toBe('number');
      expect(typeof data.eligibleCount).toBe('number');
      expect(typeof data.blockedCount).toBe('number');
      expect(data.blockedByGate).toBeDefined();
      expect(Array.isArray(data.members)).toBe(true);
    });

    it('4.3: Sorts results deterministically by priorityScore DESC, DPD DESC', async () => {
      const res = await app.request(`/api/v1/campaigns/${testCampaignId}/dispatch-run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${operatorToken}` }
      });
      const data = await res.json() as any;
      const members = data.members;
      for (let i = 0; i < members.length - 1; i++) {
        if (members[i].priorityScore !== members[i + 1].priorityScore) {
          expect(members[i].priorityScore).toBeGreaterThanOrEqual(members[i + 1].priorityScore);
        } else {
          expect(members[i].dpd).toBeGreaterThanOrEqual(members[i + 1].dpd);
        }
      }
    });

    it('4.4: Enforces fail-closed safety lock (0 live calls initiated)', async () => {
      const res = await app.request(`/api/v1/campaigns/${testCampaignId}/dispatch-run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${operatorToken}` }
      });
      const data = await res.json() as any;
      expect(data.safetyLockActive).toBe(true);
      expect(data.dispatchStatus).toContain('SAFETY_LOCKED_DRY_RUN');
    });

    it('4.5: Records audit trail in stateChangeLog', async () => {
      const log = await db.query.stateChangeLog.findFirst({
        where: (s, { eq }) => eq(s.fieldName, 'campaign_dispatch_run_evaluated'),
        orderBy: [desc(stateChangeLog.changedAt)]
      });
      expect(log).toBeDefined();
      expect((log?.newValue as any)?.campaignId).toBe(testCampaignId);
    });
  });

  // ─── 5. FROZEN ASSETS INTEGRITY (NON-NEGOTIABLE GUARDRAIL) ─────────────────
  describe('5. Frozen Assets Byte-for-Byte Integrity', () => {
    it('5.1: docs/VAPI_SYSTEM_PROMPT.md SHA-256 matches frozen baseline', () => {
      const content = fs.readFileSync('docs/VAPI_SYSTEM_PROMPT.md');
      const hash = crypto.createHash('sha256').update(content).digest('hex').toLowerCase();
      expect(hash).toBe(FROZEN_PROMPT_SHA256);
    });

    it('5.2: docs/scripts/sync-vapi-prompt.ts SHA-256 matches frozen baseline', () => {
      const content = fs.readFileSync('docs/scripts/sync-vapi-prompt.ts');
      const hash = crypto.createHash('sha256').update(content).digest('hex').toLowerCase();
      expect(hash).toBe(FROZEN_SYNC_SHA256);
    });
  });
});
