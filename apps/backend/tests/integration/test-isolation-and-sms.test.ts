import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { loans, smsMessages } from '../../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { cleanupTestLoans } from '../test-cleanup';
import { TwilioSmsService } from '../../src/providers/twilio/TwilioSmsService';
import { config } from '../../src/config';

describe('Phase 1 Verification: Test Isolation and Test SMS Robustness', () => {
  const createdLoanIds: string[] = [];
  const createdSmsIds: string[] = [];
  const originalSmsMode = process.env.TWILIO_SMS_MODE;

  beforeAll(() => {
    process.env.TWILIO_SMS_MODE = 'enable';
  });

  afterAll(async () => {
    process.env.TWILIO_SMS_MODE = originalSmsMode;
    if (createdSmsIds.length > 0) {
      await db.delete(smsMessages).where(inArray(smsMessages.id, createdSmsIds));
    }
    await db.delete(smsMessages).where(eq(smsMessages.messageType, 'integration_test'));
    if (createdLoanIds.length > 0) {
      await cleanupTestLoans(createdLoanIds);
    }
  });

  // ─── 1. TEST ISOLATION REGRESSION TEST ────────────────────────────────────
  it('1. Test Isolation: Mutating integration workflow leaves zero persistent rows in DB', async () => {
    // Baseline loan count
    const baselineLoans = await db.query.loans.findMany();
    const baselineCount = baselineLoans.length;

    // Mutating action: create a test loan
    const [loan] = await db.insert(loans).values({
      loanNumber: `TEST-ISOLATION-${Date.now()}`,
      dpd: 20,
      pastDueAmount: '200.00',
      totalToCure: '300.00',
      delinquencyBucket: '1-30'
    }).returning();

    // Verify it was temporarily added
    const duringLoans = await db.query.loans.findMany();
    expect(duringLoans.length).toBe(baselineCount + 1);

    // Run cleanup
    await cleanupTestLoans([loan.id]);

    // Assert counts return strictly to exact baseline
    const afterLoans = await db.query.loans.findMany();
    expect(afterLoans.length).toBe(baselineCount);
    expect(afterLoans.some(l => l.id === loan.id)).toBe(false);
  });

  // ─── 2. TEST SMS UUID BUG FIX & VALIDATION ────────────────────────────────
  it('2. Test SMS: Dry-run dispatch succeeds without UUID syntax error', async () => {
    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '').split(',')[0]?.trim() || '+919328234331';

    const res = await app.request('/api/v1/integrations/test-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toNumber: allowed,
        dryRun: true
      })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('mocked_delivered');
    expect(body.recordId).toBeDefined();

    createdSmsIds.push(body.recordId);

    // Verify row in database
    const row = await db.query.smsMessages.findFirst({
      where: (s, { eq }) => eq(s.id, body.recordId)
    });
    expect(row).toBeDefined();
    expect(row?.loanId).toBeNull();
    expect(row?.callAttemptId).toBeNull();
    expect(row?.messageType).toBe('integration_test');
  });

  it('3. Test SMS: Rejects non-allowlisted destination with safety interlock', async () => {
    const res = await app.request('/api/v1/integrations/test-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toNumber: '+19999999999', // Not in allowlist
        dryRun: true
      })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('SAFETY_INTERLOCK');
  });

  it('4. Test SMS: Rejects invalid UUID loanId with INVALID_LOAN_ID', async () => {
    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '').split(',')[0]?.trim() || '+919328234331';

    const res = await app.request('/api/v1/integrations/test-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toNumber: allowed,
        loanId: 'test-seed', // String placeholder, invalid UUID
        dryRun: true
      })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('INVALID_LOAN_ID');
  });

  it('5. Test SMS: Rejects non-existent valid UUID loanId with LOAN_NOT_FOUND', async () => {
    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '').split(',')[0]?.trim() || '+919328234331';

    const res = await app.request('/api/v1/integrations/test-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toNumber: allowed,
        loanId: '00000000-0000-0000-0000-000000000000', // Valid UUID, does not exist
        dryRun: true
      })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('LOAN_NOT_FOUND');
  });

  it('6. Test SMS: Handles mocked Twilio provider error cleanly without crash', async () => {
    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '').split(',')[0]?.trim() || '+919328234331';

    const mockClient = {
      messages: {
        create: async () => {
          throw new Error('Twilio RestException 21211: Invalid To phone number');
        }
      }
    };

    expect(
      TwilioSmsService.sendTestSms({
        toNumber: allowed,
        clientMock: mockClient
      })
    ).rejects.toThrow('Twilio RestException 21211');
  });

  it('7. Test SMS: dryRun: true strictly never invokes Twilio REST API', async () => {
    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '').split(',')[0]?.trim();
    if (!allowed) throw new Error('No allowlisted destination configured');

    let clientInvoked = false;
    const mockClient = {
      messages: {
        create: async () => {
          clientInvoked = true;
          throw new Error('NETWORK_CALL_UNEXPECTED: messages.create should never be invoked in dry-run mode');
        }
      }
    };

    const result = await TwilioSmsService.sendTestSms({
      toNumber: allowed,
      dryRun: true,
      clientMock: mockClient
    });

    expect(clientInvoked).toBe(false);
    expect(result.success).toBe(true);
    expect(result.status).toBe('mocked_delivered');
    expect(result.sid.startsWith('SM_dryrun_')).toBe(true);

    createdSmsIds.push(result.recordId);
  });
});
