import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { config } from '../../src/config';
import { assertDisposableTestDatabase } from '../test-cleanup';
import {
  operationalSettings,
  stateChangeLog,
  callAttempts,
  callbacks,
  scheduledJobs,
  humanEscalations,
  complianceEvents,
  dncRecords,
  smsMessages,
  servicingOutbox,
  loans
} from '../../src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { OperationalSettingsService } from '../../src/domain/settings/OperationalSettingsService';

describe('Operational Sidebar Controls & QA Execution Boundary Suite', () => {
  const vapiHeaders = {
    'Content-Type': 'application/json',
    'x-vapi-secret': config.VAPI_WEBHOOK_SECRET || 'vapi_poc_webhook_secret_2026'
  };

  let cleanLoanId: string;
  let prevWebQaEnv: string | undefined;

  beforeAll(async () => {
    assertDisposableTestDatabase();
    prevWebQaEnv = process.env.VAPI_WEB_QA_MODE;
    delete process.env.VAPI_WEB_QA_MODE;

    const firstLoan = await db.query.loans.findFirst();
    cleanLoanId = firstLoan?.id || '00000000-0000-0000-0000-000000000001';

    // Ensure default settings row exists and starts in BROWSER_TESTING
    await db.update(operationalSettings)
      .set({ voiceMode: 'BROWSER_TESTING', smsEnabled: false, updatedBy: 'test_init' })
      .where(eq(operationalSettings.id, 'default'));
  });

  afterAll(async () => {
    if (prevWebQaEnv !== undefined) {
      process.env.VAPI_WEB_QA_MODE = prevWebQaEnv;
    }
    // Reset to clean default: BROWSER_TESTING, SMS false
    await db.update(operationalSettings)
      .set({ voiceMode: 'BROWSER_TESTING', smsEnabled: false, updatedBy: 'test_cleanup' })
      .where(eq(operationalSettings.id, 'default'));
  });

  describe('1. Global Voice Channel Mutually Exclusive Controls', () => {
    it('1.1: GET /api/v1/settings returns baseline operational settings and ceiling locks', async () => {
      const res = await app.request('/api/v1/settings', { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.success).toBe(true);
      expect(data.voiceMode).toBeDefined();
      expect(data.ceilings).toBeDefined();
      expect(data.ceilings.productionCallsEnabled).toBe(false);
      expect(data.ceilings.twilioSmsMode).toBe('disable');
      expect(data.effective).toBeDefined();
      expect(data.lockReasons).toBeDefined();
    });

    it('1.2: Browser Testing toggle ON/OFF via PATCH /api/v1/settings', async () => {
      // Toggle to OFF
      const resOff = await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'OFF' })
      });
      expect(resOff.status).toBe(200);
      const dataOff = await resOff.json() as any;
      expect(dataOff.voiceMode).toBe('OFF');
      expect(dataOff.effective.browserTesting).toBe(false);
      expect(dataOff.effective.outboundCalls).toBe(false);

      // Verify in DB directly
      const dbRow1 = await db.query.operationalSettings.findFirst({
        where: (s, { eq: eq_ }) => eq_(s.id, 'default')
      });
      expect(dbRow1?.voiceMode).toBe('OFF');

      // Toggle back to BROWSER_TESTING
      const resOn = await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'BROWSER_TESTING' })
      });
      expect(resOn.status).toBe(200);
      const dataOn = await resOn.json() as any;
      expect(dataOn.voiceMode).toBe('BROWSER_TESTING');
      expect(dataOn.effective.browserTesting).toBe(true);
      expect(dataOn.effective.outboundCalls).toBe(false);
    });

    it('1.3: Turning Browser Testing ON forces Outbound Calls OFF (mutual exclusivity)', async () => {
      const res = await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'BROWSER_TESTING' })
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.voiceMode).toBe('BROWSER_TESTING');
      expect(data.effective.browserTesting).toBe(true);
      expect(data.effective.outboundCalls).toBe(false);
    });

    it('1.4: Both voice modes can be OFF', async () => {
      const res = await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'OFF' })
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.voiceMode).toBe('OFF');
      expect(data.effective.browserTesting).toBe(false);
      expect(data.effective.outboundCalls).toBe(false);
    });

    it('1.5: Both voice modes can never be ON simultaneously (single authoritative enum)', async () => {
      // Re-enable browser testing
      await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'BROWSER_TESTING' })
      });

      const res = await app.request('/api/v1/settings', { method: 'GET' });
      const data = await res.json() as any;
      // It is mathematically impossible for both effective.browserTesting and effective.outboundCalls to be true
      expect(data.effective.browserTesting && data.effective.outboundCalls).toBe(false);
    });

    it('1.6: Outbound mode UI toggle succeeds (persisted in DB) while effective remains false when PRODUCTION_CALLS_ENABLED=false', async () => {
      expect(config.PRODUCTION_CALLS_ENABLED).toBe(false);

      const res = await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'OUTBOUND_CALLS' })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.voiceMode).toBe('OUTBOUND_CALLS');
      expect(data.effective.outboundCalls).toBe(false);
      expect(data.lockReasons.outboundCalls).toContain('PRODUCTION_CALLS_ENABLED=false');

      // Verify DB was mutated to OUTBOUND_CALLS
      const current = await OperationalSettingsService.getSettings();
      expect(current.voiceMode).toBe('OUTBOUND_CALLS');

      // Revert back to BROWSER_TESTING for remaining tests
      await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'BROWSER_TESTING' })
      });
    });

    it('1.7: Outbound mode cannot bypass CAMPAIGN_AUTODISPATCH_ENABLED', async () => {
      expect(config.CAMPAIGN_AUTODISPATCH_ENABLED).toBe(false);
      const firstCamp = await db.query.campaigns.findFirst();
      if (firstCamp) {
        const res = await app.request(`/api/v1/campaigns/${firstCamp.id}/dispatch-run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.safetyLockActive).toBe(true);
        expect(body.dispatchStatus).toContain('SAFETY_LOCKED_DRY_RUN');
      }
    });
  });

  describe('2. Independent SMS Messaging Control', () => {
    it('2.1: SMS UI toggle succeeds (persisted in DB) while effective remains false when TWILIO_SMS_MODE=disable', async () => {
      expect(config.TWILIO_SMS_MODE).toBe('disable');

      const res = await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsEnabled: true })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.smsEnabled).toBe(true);
      expect(data.effective.sms).toBe(false);
      expect(data.lockReasons.sms).toContain('TWILIO_SMS_MODE');

      // Verify DB persists smsEnabled = true
      const current = await OperationalSettingsService.getSettings();
      expect(current.smsEnabled).toBe(true);

      // Revert back to false
      await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsEnabled: false })
      });
    });

    it('2.2: SMS and Voice configuration remain independent', async () => {
      // Toggle voice mode to OFF without affecting SMS
      const resVoice = await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'OFF' })
      });
      expect(resVoice.status).toBe(200);

      const settingsAfter = await OperationalSettingsService.getSettings();
      expect(settingsAfter.voiceMode).toBe('OFF');
      expect(settingsAfter.smsEnabled).toBe(false);

      // Restore voice mode to BROWSER_TESTING
      await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'BROWSER_TESTING' })
      });
    });
  });

  describe('3. Audit Trail & State Recovery', () => {
    it('3.1: Settings survive backend refresh (persisted in operational_settings table)', async () => {
      await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'BROWSER_TESTING' })
      });

      // Direct DB query bypassing service
      const directDbRow = await db.query.operationalSettings.findFirst({
        where: (s, { eq: eq_ }) => eq_(s.id, 'default')
      });
      expect(directDbRow).toBeDefined();
      expect(directDbRow?.voiceMode).toBe('BROWSER_TESTING');

      // GET endpoint returns same
      const res = await app.request('/api/v1/settings', { method: 'GET' });
      const data = await res.json() as any;
      expect(data.voiceMode).toBe('BROWSER_TESTING');
    });

    it('3.2: Successful changes record audit entries in stateChangeLog', async () => {
      await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'OFF' })
      });

      const auditEntries = await db.query.stateChangeLog.findMany({
        where: (log, { eq: eq_ }) => eq_(log.fieldName, 'operational_settings'),
        orderBy: (log, { desc: desc_ }) => [desc_(log.changedAt)],
        limit: 5
      });

      expect(auditEntries.length).toBeGreaterThan(0);
      const latest = auditEntries[0];
      expect(latest.fieldName).toBe('operational_settings');
      expect((latest.newValue as any)?.voiceMode).toBe('OFF');

      // Reset back to BROWSER_TESTING
      await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'BROWSER_TESTING' })
      });
    });

    it('3.3: Failed changes do not persist false success states', async () => {
      const beforeState = await OperationalSettingsService.getSettings();

      const res = await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMode: 'INVALID_MODE' })
      });
      expect(res.status).toBe(400);

      const afterState = await OperationalSettingsService.getSettings();
      expect(afterState.voiceMode).toBe(beforeState.voiceMode);
    });
  });

  describe('4. QA Tool Execution Boundary (Zero Operational Table Rows)', () => {
    it('4.1: get_borrower_context returns borrower context without creating callAttempts rows', async () => {
      const attemptsBefore = await db.query.callAttempts.findMany();

      const res = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: vapiHeaders,
        body: JSON.stringify({
          callAttemptId: 'QA-LN-100001-TEST',
          loanId: cleanLoanId
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.isQaSimulation).toBe(true);
      expect(data.context).toBeDefined();

      const attemptsAfter = await db.query.callAttempts.findMany();
      expect(attemptsAfter.length).toBe(attemptsBefore.length);
    });

    it('4.2: verify_identity checks verification in QA mode without mutating callAttempts', async () => {
      const attemptsBefore = await db.query.callAttempts.findMany();

      const res = await app.request('/api/v1/tools/verify-identity', {
        method: 'POST',
        headers: vapiHeaders,
        body: JSON.stringify({
          callAttemptId: 'QA-LN-100001-TEST',
          method: 'dob_address',
          response: {
            dob: '1985-05-15'
          }
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.isQaSimulation).toBe(true);
      expect(data.attemptsRemaining).toBeDefined();

      const attemptsAfter = await db.query.callAttempts.findMany();
      expect(attemptsAfter.length).toBe(attemptsBefore.length);
    });

    it('4.3: send_payment_link safely fails closed with 0 smsMessages rows', async () => {
      const smsBefore = await db.query.smsMessages.findMany();

      const res = await app.request('/api/v1/tools/send-payment-link', {
        method: 'POST',
        headers: vapiHeaders,
        body: JSON.stringify({
          callAttemptId: 'QA-LN-100001-TEST',
          loanId: cleanLoanId,
          amount: '1250.00'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(false);
      expect(data.isQaSimulation).toBe(true);
      expect(data.error).toBe('SMS_DISABLED_IN_QA');

      const smsAfter = await db.query.smsMessages.findMany();
      expect(smsAfter.length).toBe(smsBefore.length);
    });

    it('4.4: schedule_callback simulates QA callback with 0 rows in callbacks and scheduledJobs', async () => {
      const callbacksBefore = await db.query.callbacks.findMany();
      const jobsBefore = await db.query.scheduledJobs.findMany();

      const res = await app.request('/api/v1/tools/schedule-callback', {
        method: 'POST',
        headers: vapiHeaders,
        body: JSON.stringify({
          callAttemptId: 'QA-LN-100001-TEST',
          scheduledDatetime: '2026-11-20T14:00:00Z',
          timezone: 'America/New_York',
          humanReadableNote: 'Borrower requested afternoon call'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.isQaSimulation).toBe(true);
      expect(data.sourceType).toBe('BROWSER_VOICE_QA_SIMULATION');

      const callbacksAfter = await db.query.callbacks.findMany();
      const jobsAfter = await db.query.scheduledJobs.findMany();
      expect(callbacksAfter.length).toBe(callbacksBefore.length);
      expect(jobsAfter.length).toBe(jobsBefore.length);
    });

    it('4.5: transfer_to_agent simulates QA escalation with 0 rows in humanEscalations', async () => {
      const escalationsBefore = await db.query.humanEscalations.findMany();

      const res = await app.request('/api/v1/tools/transfer-to-agent', {
        method: 'POST',
        headers: vapiHeaders,
        body: JSON.stringify({
          callAttemptId: 'QA-LN-100001-TEST',
          reason: 'SAFETY_ESCALATION',
          notes: 'Complex dispute requiring human supervisor'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.isQaSimulation).toBe(true);
      expect(data.escalationId).toBeDefined();

      const escalationsAfter = await db.query.humanEscalations.findMany();
      expect(escalationsAfter.length).toBe(escalationsBefore.length);
    });

    it('4.6: flag_compliance_event logs to stateChangeLog with 0 rows in complianceEvents or dncRecords', async () => {
      const complianceBefore = await db.query.complianceEvents.findMany();
      const dncBefore = await db.query.dncRecords.findMany();

      const res = await app.request('/api/v1/tools/flag-compliance-event', {
        method: 'POST',
        headers: vapiHeaders,
        body: JSON.stringify({
          callAttemptId: 'QA-LN-100001-TEST',
          eventType: 'DNC_REQUEST',
          scope: 'account',
          notes: 'Borrower requested DNC during QA rehearsal'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.isQaSimulation).toBe(true);
      expect(data.logged).toBe(true);

      const complianceAfter = await db.query.complianceEvents.findMany();
      const dncAfter = await db.query.dncRecords.findMany();
      expect(complianceAfter.length).toBe(complianceBefore.length);
      expect(dncAfter.length).toBe(dncBefore.length);
    });

    it('4.7: log_disposition logs QA outcome without servicingOutbox rows or PostCallProcessor', async () => {
      const outboxBefore = await db.query.servicingOutbox.findMany();
      const attemptsBefore = await db.query.callAttempts.findMany();

      const res = await app.request('/api/v1/tools/log-disposition', {
        method: 'POST',
        headers: vapiHeaders,
        body: JSON.stringify({
          callAttemptId: 'QA-LN-100001-TEST',
          disposition: 'PROMISE_TO_PAY'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.isQaSimulation).toBe(true);

      const outboxAfter = await db.query.servicingOutbox.findMany();
      const attemptsAfter = await db.query.callAttempts.findMany();
      expect(outboxAfter.length).toBe(outboxBefore.length);
      expect(attemptsAfter.length).toBe(attemptsBefore.length);
    });
  });
});
