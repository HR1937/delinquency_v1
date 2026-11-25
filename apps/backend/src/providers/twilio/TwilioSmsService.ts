import twilio from 'twilio';
import { config, isTwilioSmsEnabled } from '../../config';
import { db } from '../../db/client';
import { smsMessages } from '../../db/schema';
import { SmsStatusEnum } from '@delinquency/contracts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TwilioSmsService {
  private static getClient() {
    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) {
      throw new Error('TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured');
    }
    return twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
  }

  /**
   * System integration test SMS: validates destination against safety allowlist,
   * sends a clear diagnostic test message (not a borrower payment link),
   * and truthfully stores records with nullable loanId and callAttemptId.
   */
  static async sendTestSms(params: {
    toNumber: string;
    loanId?: string | null;
    dryRun?: boolean;
    clientMock?: any;
  }) {
    if (!isTwilioSmsEnabled()) {
      throw new Error('SMS_DISABLED: Twilio SMS is disabled by environment configuration (TWILIO_SMS_MODE=disable)');
    }

    if (!params.toNumber) {
      throw new Error('DESTINATION_REQUIRED: Destination phone number must be provided');
    }

    // Safety check against allowed destinations
    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!config.PRODUCTION_CALLS_ENABLED && !allowed.includes(params.toNumber)) {
      throw new Error(`SAFETY_INTERLOCK: Destination ${params.toNumber} is not in ALLOWED_TEST_DESTINATIONS`);
    }

    // Validate loanId if provided
    let validLoanId: string | null = null;
    if (params.loanId) {
      if (!UUID_REGEX.test(params.loanId)) {
        throw new Error(`INVALID_LOAN_ID: "${params.loanId}" is not a valid UUID`);
      }
      const existingLoan = await db.query.loans.findFirst({
        where: (l, { eq }) => eq(l.id, params.loanId!)
      });
      if (!existingLoan) {
        throw new Error(`LOAN_NOT_FOUND: Loan ${params.loanId} does not exist`);
      }
      validLoanId = existingLoan.id;
    }

    const bodyText = `Delinquency Servicing PoC: Authorized integration diagnostic test. No action required. Ref: test-${Date.now().toString().slice(-6)}.`;

    let sid: string;
    let messageStatus: string;

    const effectiveDryRun = params.dryRun === true || (!params.clientMock && !config.PRODUCTION_CALLS_ENABLED);

    if (effectiveDryRun) {
      sid = `SM_dryrun_${Date.now()}`;
      messageStatus = 'mocked_delivered';
    } else {
      const client = params.clientMock || this.getClient();
      const message = await client.messages.create({
        from: config.TWILIO_SMS_FROM_NUMBER || config.TWILIO_VOICE_NUMBER || '+15550000000',
        to: params.toNumber,
        body: bodyText
      });
      sid = message.sid;
      messageStatus = message.status;
    }

    // Record in database
    const [record] = await db.insert(smsMessages).values({
      loanId: validLoanId,
      callAttemptId: null,
      twilioMessageSid: sid,
      fromNumber: config.TWILIO_SMS_FROM_NUMBER || config.TWILIO_VOICE_NUMBER || '+15550000000',
      toNumberMasked: params.toNumber.slice(-4),
      messageType: 'integration_test',
      status: (messageStatus as any) || SmsStatusEnum.queued,
      sentAt: new Date()
    }).returning();

    return {
      success: true,
      sid,
      status: messageStatus,
      recordId: record.id
    };
  }

  /**
   * Borrower payment link SMS: triggered only by verified borrower workflows.
   */
  static async sendPaymentLink(params: {
    loanId: string;
    toNumber: string;
    callAttemptId?: string | null;
    amount?: string;
    dryRun?: boolean;
    clientMock?: any;
  }) {
    if (!isTwilioSmsEnabled()) {
      throw new Error('SMS_DISABLED: Twilio SMS is disabled by environment configuration (TWILIO_SMS_MODE=disable)');
    }

    if (!UUID_REGEX.test(params.loanId)) {
      throw new Error(`INVALID_LOAN_ID: "${params.loanId}" is not a valid UUID`);
    }

    let validCallAttemptId: string | null = null;
    if (params.callAttemptId) {
      if (!UUID_REGEX.test(params.callAttemptId)) {
        throw new Error(`INVALID_CALL_ATTEMPT_ID: "${params.callAttemptId}" is not a valid UUID`);
      }
      validCallAttemptId = params.callAttemptId;
    }

    // Safety check against allowed destinations
    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!config.PRODUCTION_CALLS_ENABLED && !allowed.includes(params.toNumber)) {
      throw new Error(`SAFETY_INTERLOCK: Destination ${params.toNumber} is not in ALLOWED_TEST_DESTINATIONS`);
    }

    const paymentUrl = config.PAYMENT_PORTAL_BASE_URL
      ? `${config.PAYMENT_PORTAL_BASE_URL}?loan=${params.loanId}&token=pay_${Date.now()}`
      : 'https://servicing.example.com/pay/demo-link';

    const bodyText = `Delinquency Servicing: Secure payment link for your account: ${paymentUrl}. Contact us at ${config.TWILIO_VOICE_NUMBER} for assistance.`;

    let sid: string;
    let messageStatus: string;

    const effectiveDryRun = params.dryRun === true || (!params.clientMock && !config.PRODUCTION_CALLS_ENABLED);

    if (effectiveDryRun) {
      sid = `SM_dryrun_${Date.now()}`;
      messageStatus = 'mocked_delivered';
    } else {
      const client = params.clientMock || this.getClient();
      const message = await client.messages.create({
        from: config.TWILIO_SMS_FROM_NUMBER || config.TWILIO_VOICE_NUMBER || '+15550000000',
        to: params.toNumber,
        body: bodyText
      });
      sid = message.sid;
      messageStatus = message.status;
    }

    // Record in database
    const [record] = await db.insert(smsMessages).values({
      loanId: params.loanId,
      callAttemptId: validCallAttemptId,
      twilioMessageSid: sid,
      fromNumber: config.TWILIO_SMS_FROM_NUMBER || config.TWILIO_VOICE_NUMBER || '+15550000000',
      toNumberMasked: params.toNumber.slice(-4),
      messageType: 'payment_link',
      status: (messageStatus as any) || SmsStatusEnum.queued,
      sentAt: new Date()
    }).returning();

    return {
      success: true,
      sid,
      status: messageStatus,
      recordId: record.id
    };
  }
}
