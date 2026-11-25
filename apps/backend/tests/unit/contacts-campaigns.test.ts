import { describe, expect, test } from 'bun:test';
import { PreDialGate } from '../../src/domain/eligibility/PreDialGate';
import { BlockReasonEnum, ConsentStateEnum, NextActionEnum } from '@delinquency/contracts';
import type { PreDialContext } from '../../src/domain/eligibility/PreDialChecks';

describe('Part 1 Unit Tests: Contacts, Multiple Phones, and Eligibility Diagnostics', () => {
  const baseContext: PreDialContext = {
    loan: {
      id: 'loan-multi-phone',
      dpd: 25,
      isBankrupt: false,
      isLitigation: false,
      isDeceased: false,
      hasLossMitigation: false,
      hasActiveDispute: false,
      contactAttemptCount: 0,
      priorityScore: 60.0
    },
    phone: {
      id: 'phone-primary',
      phoneE164: '+15551112233',
      lineType: 'mobile',
      tcpaConsent: true,
      dnc: false,
      timezoneIana: 'America/New_York',
      isHygieneVerified: true,
      preferredContactWindowStart: null,
      preferredContactWindowEnd: null
    },
    campaign: {
      id: 'campaign-1',
      dpdMin: 1,
      dpdMax: 59,
      maxAttempts: 3,
      dailyCap: 2,
      weeklyCap: 6,
      cooldownHours: 4
    },
    accountDnc: false,
    numberDnc: false,
    activeV1Restrictions: [],
    pendingCallbacks: [],
    recentCallAttempts: [],
    activeConcurrentCalls: 0,
    simulatedLocalHour: 14 // 2 PM
  };

  test('Multi-phone evaluation: primary phone with consent passes, second phone without consent blocks', () => {
    // 1. Primary phone (mobile with consent)
    const primaryOutcome = PreDialGate.evaluate({
      ...baseContext,
      phone: {
        id: 'phone-primary',
        phoneE164: '+15551112233',
        lineType: 'mobile',
        tcpaConsent: true,
        dnc: false,
        timezoneIana: 'America/New_York',
        isHygieneVerified: true,
        preferredContactWindowStart: null,
        preferredContactWindowEnd: null
      }
    });
    expect(primaryOutcome.eligible).toBe(true);
    expect(primaryOutcome.finalResult).toBe(BlockReasonEnum.ELIGIBLE_TO_DIAL);

    // 2. Secondary phone (mobile WITHOUT consent)
    const secondaryOutcome = PreDialGate.evaluate({
      ...baseContext,
      phone: {
        id: 'phone-secondary',
        phoneE164: '+15559998877',
        lineType: 'mobile',
        tcpaConsent: false,
        dnc: false,
        timezoneIana: 'America/New_York',
        isHygieneVerified: true,
        preferredContactWindowStart: null,
        preferredContactWindowEnd: null
      }
    });
    expect(secondaryOutcome.eligible).toBe(false);
    expect(secondaryOutcome.finalResult).toBe(BlockReasonEnum.BLOCKED_NO_CONSENT);
    expect(secondaryOutcome.allBlockingReasons).toContain(BlockReasonEnum.BLOCKED_NO_CONSENT);
  });

  test('Multi-phone evaluation: mobile missing consent vs landline not applicable', () => {
    // Landline phone with no TCPA consent
    const landlineOutcome = PreDialGate.evaluate({
      ...baseContext,
      phone: {
        id: 'phone-landline',
        phoneE164: '+15554443322',
        lineType: 'landline',
        tcpaConsent: null,
        dnc: false,
        timezoneIana: 'America/New_York',
        isHygieneVerified: true,
        preferredContactWindowStart: null,
        preferredContactWindowEnd: null
      }
    });
    // Landline is exempt from mobile autodial consent requirement (check C5 passes)
    expect(landlineOutcome.eligible).toBe(true);
    expect(landlineOutcome.finalResult).toBe(BlockReasonEnum.ELIGIBLE_TO_DIAL);
  });

  test('Phone number DNC vs Account-wide DNC semantics', () => {
    // Number DNC blocks only that number
    const numberDncOutcome = PreDialGate.evaluate({
      ...baseContext,
      numberDnc: true,
      phone: { ...baseContext.phone, dnc: true }
    });
    expect(numberDncOutcome.eligible).toBe(false);
    expect(numberDncOutcome.finalResult).toBe(BlockReasonEnum.BLOCKED_DNC_NUMBER);

    // Account DNC blocks any number
    const accountDncOutcome = PreDialGate.evaluate({
      ...baseContext,
      accountDnc: true,
      numberDnc: false,
      phone: { ...baseContext.phone, dnc: false }
    });
    expect(accountDncOutcome.eligible).toBe(false);
    expect(accountDncOutcome.finalResult).toBe(BlockReasonEnum.BLOCKED_DNC_ACCOUNT);
  });

  test('PreDialGate evaluates full diagnostics without stopping early', () => {
    // Context with multiple simultaneous failures:
    // 1. C2a Bankrupt
    // 2. C5 No consent
    // 3. C6 Missing timezone
    const multiFailureOutcome = PreDialGate.evaluate({
      ...baseContext,
      loan: {
        ...baseContext.loan,
        isBankrupt: true
      },
      phone: {
        ...baseContext.phone,
        tcpaConsent: false,
        timezoneIana: null
      }
    });

    expect(multiFailureOutcome.eligible).toBe(false);
    expect(multiFailureOutcome.finalResult).toBe(BlockReasonEnum.BLOCKED_BANKRUPTCY);
    expect(multiFailureOutcome.allBlockingReasons.length).toBeGreaterThanOrEqual(3);
    expect(multiFailureOutcome.allBlockingReasons).toContain(BlockReasonEnum.BLOCKED_BANKRUPTCY);
    expect(multiFailureOutcome.allBlockingReasons).toContain(BlockReasonEnum.BLOCKED_NO_CONSENT);
    expect(multiFailureOutcome.allBlockingReasons).toContain(BlockReasonEnum.BLOCKED_TIMEZONE_MISSING);
    // Check results should contain evaluations for all 14 checks (including C2a, C2b, C2c)
    expect(multiFailureOutcome.checkResults.length).toBe(14);
  });

  test('ConsentStateEnum semantics and values match UX contract', () => {
    expect(ConsentStateEnum.GRANTED).toBe('GRANTED');
    expect(ConsentStateEnum.MISSING).toBe('MISSING');
    expect(ConsentStateEnum.REVOKED).toBe('REVOKED');
    expect(ConsentStateEnum.UNKNOWN).toBe('UNKNOWN');
    expect(ConsentStateEnum.NOT_APPLICABLE_TO_MOBILE_AUTODIAL_CONSENT).toBe('NOT_APPLICABLE_TO_MOBILE_AUTODIAL_CONSENT');
  });

  test('NextActionEnum semantics and values match UX contract', () => {
    expect(NextActionEnum.DIAL).toBe('DIAL');
    expect(NextActionEnum.WAIT_UNTIL).toBe('WAIT_UNTIL');
    expect(NextActionEnum.FIX_CONTACT_DATA).toBe('FIX_CONTACT_DATA');
    expect(NextActionEnum.SUPPRESS).toBe('SUPPRESS');
    expect(NextActionEnum.REFER).toBe('REFER');
    expect(NextActionEnum.CAPACITY_QUEUE).toBe('CAPACITY_QUEUE');
  });
});
