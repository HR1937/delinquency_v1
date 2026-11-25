import { describe, expect, test } from 'bun:test';
import { PreDialGate } from '../../src/domain/eligibility/PreDialGate';
import { PriorityScorer } from '../../src/domain/campaign/PriorityScorer';
import { RetryPolicy } from '../../src/domain/retry/RetryPolicy';
import { BlockReasonEnum, DispositionEnum } from '@delinquency/contracts';
import type { PreDialContext } from '../../src/domain/eligibility/PreDialChecks';

const baseContext: PreDialContext = {
  loan: {
    id: 'loan-1',
    dpd: 20,
    isBankrupt: false,
    isLitigation: false,
    isDeceased: false,
    hasLossMitigation: false,
    hasActiveDispute: false,
    contactAttemptCount: 0,
    priorityScore: 50.0
  },
  phone: {
    id: 'phone-1',
    phoneE164: '+15551234567',
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
  simulatedLocalHour: 14 // 2 PM EST (inside legal window)
};

describe('PreDialGate Unit Tests', () => {
  test('C1: passes when DPD is within campaign scope', () => {
    const outcome = PreDialGate.evaluate({ ...baseContext, loan: { ...baseContext.loan, dpd: 15 } });
    expect(outcome.eligible).toBe(true);
    expect(outcome.finalResult).toBe(BlockReasonEnum.ELIGIBLE_TO_DIAL);
  });

  test('C1: blocks when DPD is out of scope (e.g. 60 DPD)', () => {
    const outcome = PreDialGate.evaluate({ ...baseContext, loan: { ...baseContext.loan, dpd: 65 } });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_OUT_OF_SCOPE);
  });

  test('C2a: blocks when borrower is bankrupt', () => {
    const outcome = PreDialGate.evaluate({ ...baseContext, loan: { ...baseContext.loan, isBankrupt: true } });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_BANKRUPTCY);
  });

  test('C2b: blocks when borrower has active loss mitigation', () => {
    const outcome = PreDialGate.evaluate({ ...baseContext, loan: { ...baseContext.loan, hasLossMitigation: true } });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_LOSS_MITIGATION);
  });

  test('C2c: blocks when borrower has active dispute', () => {
    const outcome = PreDialGate.evaluate({ ...baseContext, loan: { ...baseContext.loan, hasActiveDispute: true } });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_ACTIVE_DISPUTE);
  });

  test('C3: blocks when account-level DNC is active', () => {
    const outcome = PreDialGate.evaluate({ ...baseContext, accountDnc: true });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_DNC_ACCOUNT);
  });

  test('C3: blocks when number-level DNC is active', () => {
    const outcome = PreDialGate.evaluate({ ...baseContext, numberDnc: true });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_DNC_NUMBER);
  });

  test('C4: blocks when phone hygiene is unverified', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      phone: { ...baseContext.phone, isHygieneVerified: false }
    });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_PHONE_HYGIENE);
  });

  test('C5: blocks mobile without TCPA consent', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      phone: { ...baseContext.phone, lineType: 'mobile', tcpaConsent: null }
    });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_NO_CONSENT);
  });

  test('C5: allows landline without TCPA consent', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      phone: { ...baseContext.phone, lineType: 'landline', tcpaConsent: null }
    });
    expect(outcome.eligible).toBe(true);
  });

  test('C6: blocks missing timezone', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      phone: { ...baseContext.phone, timezoneIana: null }
    });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_TIMEZONE_MISSING);
  });

  test('C7: blocks outside legal calling window (e.g. 7:59 AM)', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      simulatedLocalHour: 7
    });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_LEGAL_CALLING_WINDOW);
  });

  test('C7: blocks outside legal calling window (e.g. 9:00 PM)', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      simulatedLocalHour: 21
    });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_LEGAL_CALLING_WINDOW);
  });

  test('C7: allows inside legal calling window (8 AM - 9 PM)', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      simulatedLocalHour: 8
    });
    expect(outcome.eligible).toBe(true);
  });

  test('C9: blocks active v1 restriction', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      activeV1Restrictions: [{ id: 'v1-1', timeStart: '00:00:00', timeEnd: '23:59:59' }]
    });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_V1_RESTRICTION);
  });

  test('C10: blocks when max attempts reached', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      loan: { ...baseContext.loan, contactAttemptCount: 3 }
    });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_MAX_ATTEMPTS);
  });

  test('C10: blocks during cooldown period (< 4 hours)', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      recentCallAttempts: [{
        id: 'att-1',
        initiatedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        isTechnicalFailure: false
      }]
    });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_COOLDOWN);
  });

  test('C11: blocks when future callback is pending', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      pendingCallbacks: [{
        id: 'cb-1',
        callbackScheduledDatetime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }]
    });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_CALLBACK_PENDING);
  });

  test('C12: blocks when calling capacity reached', () => {
    const outcome = PreDialGate.evaluate({
      ...baseContext,
      activeConcurrentCalls: 5,
      maxConcurrentAllowed: 5
    });
    expect(outcome.eligible).toBe(false);
    expect(outcome.finalResult).toBe(BlockReasonEnum.BLOCKED_CAPACITY);
  });
});

describe('PriorityScorer Unit Tests', () => {
  test('computes deterministic score based on DPD and factors', () => {
    const baseScore = PriorityScorer.score({ dpd: 30 });
    const boostScore = PriorityScorer.score({ dpd: 30, openPtpDueToday: true, recentNsf: true });
    expect(boostScore).toBeGreaterThan(baseScore);
    expect(Math.round(boostScore - baseScore)).toBe(20); // 15 for PTP + 5 for NSF
  });
});

describe('RetryPolicy Unit Tests', () => {
  test('marks terminal on explicit DNC request', () => {
    const outcome = RetryPolicy.evaluate({
      lastDisposition: DispositionEnum.NO_RPC_DNC_REQUESTED,
      contactAttemptCount: 1,
      fallbackThreshold: 3,
      isBankrupt: false,
      isLitigation: false,
      isDeceased: false,
      hasLossMitigation: false,
      hasActiveDispute: false,
      hasActiveDnc: false,
      cooldownHours: 4,
      lastAttemptAt: new Date(),
      technicalFailureCount24h: 0
    });
    expect(outcome.terminal).toBe(true);
    expect(outcome.shouldRetry).toBe(false);
  });

  test('triggers fallback at N=3 attempts', () => {
    const outcome = RetryPolicy.evaluate({
      lastDisposition: DispositionEnum.NO_RPC_NO_ANSWER,
      contactAttemptCount: 3,
      fallbackThreshold: 3,
      isBankrupt: false,
      isLitigation: false,
      isDeceased: false,
      hasLossMitigation: false,
      hasActiveDispute: false,
      hasActiveDnc: false,
      cooldownHours: 4,
      lastAttemptAt: new Date(),
      technicalFailureCount24h: 0
    });
    expect(outcome.fallbackTriggered).toBe(true);
    expect(outcome.shouldRetry).toBe(false);
  });
});
