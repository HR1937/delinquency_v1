import { BlockReasonEnum, type BlockReason } from '@delinquency/contracts';

export interface PreDialContext {
  loan: {
    id: string;
    dpd: number;
    isBankrupt: boolean;
    isLitigation: boolean;
    isDeceased: boolean;
    hasLossMitigation: boolean;
    hasActiveDispute: boolean;
    contactAttemptCount: number;
    priorityScore: number | string | null;
  };
  phone: {
    id: string;
    phoneE164: string;
    lineType: string;
    tcpaConsent: boolean | null;
    dnc: boolean;
    timezoneIana: string | null;
    isHygieneVerified: boolean | null;
    isVerified?: boolean | null;
    preferredContactWindowStart: string | null;
    preferredContactWindowEnd: string | null;
  };
  campaign: {
    id: string;
    dpdMin: number;
    dpdMax: number;
    maxAttempts: number;
    dailyCap: number;
    weeklyCap: number;
    cooldownHours: number;
  };
  accountDnc: boolean;
  numberDnc: boolean;
  activeV1Restrictions: Array<{
    id: string;
    timeStart: string | null;
    timeEnd: string | null;
  }>;
  pendingCallbacks: Array<{
    id: string;
    callbackScheduledDatetime: Date;
  }>;
  recentCallAttempts: Array<{
    id: string;
    initiatedAt: Date;
    isTechnicalFailure: boolean;
  }>;
  simulatedPriorAttempt?: {
    initiatedAt: Date;
    isTechnicalFailure?: boolean;
  };
  activeConcurrentCalls: number;
  maxConcurrentAllowed?: number;
  simulatedLocalHour?: number; // for unit tests
}

export interface CheckResult {
  check: string;
  passed: boolean;
  blockReason?: BlockReason;
  reason?: string;
}

export function checkC1CampaignScope(ctx: PreDialContext): CheckResult {
  const inScope = ctx.loan.dpd >= ctx.campaign.dpdMin && ctx.loan.dpd <= ctx.campaign.dpdMax;
  return {
    check: 'C1_CAMPAIGN_SCOPE',
    passed: inScope,
    blockReason: inScope ? undefined : BlockReasonEnum.BLOCKED_OUT_OF_SCOPE,
    reason: inScope ? undefined : `Loan DPD ${ctx.loan.dpd} outside campaign bounds [${ctx.campaign.dpdMin}, ${ctx.campaign.dpdMax}]`
  };
}

export function checkC2aHardExclusions(ctx: PreDialContext): CheckResult {
  if (ctx.loan.isBankrupt) {
    return { check: 'C2a_HARD_EXCLUSION', passed: false, blockReason: BlockReasonEnum.BLOCKED_BANKRUPTCY, reason: 'Active bankruptcy on record' };
  }
  if (ctx.loan.isLitigation) {
    return { check: 'C2a_HARD_EXCLUSION', passed: false, blockReason: BlockReasonEnum.BLOCKED_LITIGATION, reason: 'Active litigation on record' };
  }
  if (ctx.loan.isDeceased) {
    return { check: 'C2a_HARD_EXCLUSION', passed: false, blockReason: BlockReasonEnum.BLOCKED_DECEASED, reason: 'Borrower deceased' };
  }
  return { check: 'C2a_HARD_EXCLUSION', passed: true };
}

export function checkC2bLossMitigation(ctx: PreDialContext): CheckResult {
  if (ctx.loan.hasLossMitigation) {
    return { check: 'C2b_LOSS_MITIGATION', passed: false, blockReason: BlockReasonEnum.BLOCKED_LOSS_MITIGATION, reason: 'Active loss mitigation program in progress' };
  }
  return { check: 'C2b_LOSS_MITIGATION', passed: true };
}

export function checkC2cActiveDispute(ctx: PreDialContext): CheckResult {
  if (ctx.loan.hasActiveDispute) {
    return { check: 'C2c_ACTIVE_DISPUTE', passed: false, blockReason: BlockReasonEnum.BLOCKED_ACTIVE_DISPUTE, reason: 'Active billing/balance dispute pending research' };
  }
  return { check: 'C2c_ACTIVE_DISPUTE', passed: true };
}

export function checkC3Dnc(ctx: PreDialContext): CheckResult {
  if (ctx.accountDnc) {
    return { check: 'C3_DNC', passed: false, blockReason: BlockReasonEnum.BLOCKED_DNC_ACCOUNT, reason: 'Account-wide Do Not Call active' };
  }
  if (ctx.numberDnc || ctx.phone.dnc) {
    return { check: 'C3_DNC', passed: false, blockReason: BlockReasonEnum.BLOCKED_DNC_NUMBER, reason: 'Number-specific Do Not Call active' };
  }
  return { check: 'C3_DNC', passed: true };
}

export function checkC4PhoneHygiene(ctx: PreDialContext): CheckResult {
  if (ctx.phone.isHygieneVerified || ctx.phone.isVerified) {
    return { check: 'C4_PHONE_HYGIENE', passed: true };
  }
  return { check: 'C4_PHONE_HYGIENE', passed: false, blockReason: BlockReasonEnum.BLOCKED_PHONE_HYGIENE, reason: 'Phone hygiene unverified or invalid number' };
}

export function checkC5TcpaConsent(ctx: PreDialContext): CheckResult {
  if (ctx.phone.lineType === 'mobile' && ctx.phone.tcpaConsent !== true) {
    return { check: 'C5_TCPA_CONSENT', passed: false, blockReason: BlockReasonEnum.BLOCKED_NO_CONSENT, reason: 'Mobile autodial requires documented express TCPA consent' };
  }
  return { check: 'C5_TCPA_CONSENT', passed: true };
}

export function checkC6Timezone(ctx: PreDialContext): CheckResult {
  if (!ctx.phone.timezoneIana) {
    return { check: 'C6_TIMEZONE', passed: false, blockReason: BlockReasonEnum.BLOCKED_TIMEZONE_MISSING, reason: 'Borrower local timezone is missing' };
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: ctx.phone.timezoneIana });
  } catch {
    return { check: 'C6_TIMEZONE', passed: false, blockReason: BlockReasonEnum.BLOCKED_TIMEZONE_UNVERIFIED, reason: `Invalid timezone identifier: ${ctx.phone.timezoneIana}` };
  }
  return { check: 'C6_TIMEZONE', passed: true };
}

export const CONFIGURED_CALLING_HOURS = {
  startHour: 8,
  endHour: 21,
  startDisplay: '8:00 AM',
  endDisplay: '9:00 PM',
  display: '8:00 AM – 9:00 PM',
  permissibleWindowBorrowerLocal: '8:00 AM – 9:00 PM Borrower Local',
  timezoneBasis: 'Borrower Local Time',
  policySource: 'CODE_POLICY_PRE_DIAL_CHECKS',
  statuteReference: '15 U.S.C. §1692c(a)(1) & CFPB Regulation F',
  governingRegulation: 'CFPB Reg F § 1006.6(b)(1) & TCPA calling hours',
  backendEnforcementSource: 'apps/backend/src/domain/eligibility/PreDialChecks.ts:checkC7CallingWindow',
  description: "The current calling-time guardrail is configured as 8:00 AM–9:00 PM in the borrower's local time. The backend resolves the borrower's timezone and checks this window before contact. Known inconvenient times, preferred contact hours and other applicable restrictions may impose stricter limits. This setting is an operational policy, not a standalone legal authorization."
};

export function checkC7CallingWindow(ctx: PreDialContext, now: Date = new Date()): CheckResult {
  let localHour = ctx.simulatedLocalHour;
  if (localHour === undefined && ctx.phone.timezoneIana) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: ctx.phone.timezoneIana,
        hour: 'numeric',
        hour12: false
      });
      localHour = parseInt(formatter.format(now), 10);
    } catch {
      localHour = 12;
    }
  }

  const hour = localHour ?? 12;
  // Legal window 8am to 9pm (8 <= hour < 21)
  if (hour < CONFIGURED_CALLING_HOURS.startHour || hour >= CONFIGURED_CALLING_HOURS.endHour) {
    return {
      check: 'C7_CALLING_WINDOW',
      passed: false,
      blockReason: BlockReasonEnum.BLOCKED_LEGAL_CALLING_WINDOW,
      reason: `Current local time ${hour}:00 is outside configured contact hours 08:00-21:00`
    };
  }
  return { check: 'C7_CALLING_WINDOW', passed: true };
}

export function checkC8Pcw(ctx: PreDialContext, now: Date = new Date()): CheckResult {
  if (!ctx.phone.preferredContactWindowStart || !ctx.phone.preferredContactWindowEnd) {
    return { check: 'C8_PREFERRED_CONTACT_WINDOW', passed: true };
  }
  // If PCW is provided, evaluate constraint
  let localTimeStr = '14:00:00';
  if (ctx.phone.timezoneIana) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: ctx.phone.timezoneIana,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      localTimeStr = formatter.format(now);
    } catch {}
  }

  const start = ctx.phone.preferredContactWindowStart;
  const end = ctx.phone.preferredContactWindowEnd;
  if (localTimeStr < start || localTimeStr > end) {
    return {
      check: 'C8_PREFERRED_CONTACT_WINDOW',
      passed: false,
      blockReason: BlockReasonEnum.BLOCKED_PREFERRED_CONTACT_WINDOW,
      reason: `Local time ${localTimeStr} is outside preferred window ${start} - ${end}`
    };
  }
  return { check: 'C8_PREFERRED_CONTACT_WINDOW', passed: true };
}

export function checkC9V1Restrictions(ctx: PreDialContext): CheckResult {
  if (ctx.activeV1Restrictions && ctx.activeV1Restrictions.length > 0) {
    return {
      check: 'C9_V1_RESTRICTION',
      passed: false,
      blockReason: BlockReasonEnum.BLOCKED_V1_RESTRICTION,
      reason: 'Active borrower temporary no-call restriction is currently in effect'
    };
  }
  return { check: 'C9_V1_RESTRICTION', passed: true };
}

export interface CooldownEvaluationResult {
  passed: boolean;
  blockReason?: BlockReason;
  reason?: string;
  elapsedHours: number;
  cooldownHours: number;
}

export function evaluateCooldown(
  elapsedHours: number,
  cooldownHours: number
): CooldownEvaluationResult {
  if (!Number.isFinite(elapsedHours) || !Number.isFinite(cooldownHours)) {
    return {
      passed: false,
      blockReason: BlockReasonEnum.BLOCKED_COOLDOWN,
      reason: 'Invalid cooldown parameter: elapsedHours and cooldownHours must be finite numbers',
      elapsedHours: Number.isFinite(elapsedHours) ? elapsedHours : 0,
      cooldownHours: Number.isFinite(cooldownHours) ? cooldownHours : 4
    };
  }

  if (elapsedHours < 0) {
    return {
      passed: false,
      blockReason: BlockReasonEnum.BLOCKED_COOLDOWN,
      reason: 'Invalid cooldown: elapsed hours cannot be negative (attempt in future)',
      elapsedHours,
      cooldownHours
    };
  }

  const safeCooldown = Math.max(0, cooldownHours);
  if (elapsedHours < safeCooldown) {
    return {
      passed: false,
      blockReason: BlockReasonEnum.BLOCKED_COOLDOWN,
      reason: `Cooldown active: ${elapsedHours.toFixed(1)}h elapsed < ${safeCooldown}h required`,
      elapsedHours,
      cooldownHours: safeCooldown
    };
  }

  return {
    passed: true,
    elapsedHours,
    cooldownHours: safeCooldown
  };
}

export function checkC10CooldownAndCaps(ctx: PreDialContext, now: Date = new Date()): CheckResult {
  if (ctx.loan.contactAttemptCount >= ctx.campaign.maxAttempts) {
    return {
      check: 'C10_COOLDOWN_CAPS',
      passed: false,
      blockReason: BlockReasonEnum.BLOCKED_MAX_ATTEMPTS,
      reason: `Maximum campaign attempts reached (${ctx.loan.contactAttemptCount}/${ctx.campaign.maxAttempts})`
    };
  }

  // Check cooldown from last non-tech attempt (persisted actual attempt or QA simulated prior attempt)
  const lastAttempt = ctx.recentCallAttempts.find(a => !a.isTechnicalFailure) ||
    (ctx.simulatedPriorAttempt && !ctx.simulatedPriorAttempt.isTechnicalFailure ? ctx.simulatedPriorAttempt : null);
  if (lastAttempt) {
    const elapsedHours = (now.getTime() - new Date(lastAttempt.initiatedAt).getTime()) / (1000 * 60 * 60);
    const evalRes = evaluateCooldown(elapsedHours, ctx.campaign.cooldownHours);
    if (!evalRes.passed) {
      return {
        check: 'C10_COOLDOWN_CAPS',
        passed: false,
        blockReason: evalRes.blockReason,
        reason: evalRes.reason
      };
    }
  }

  return { check: 'C10_COOLDOWN_CAPS', passed: true };
}

export function checkC11PendingCallback(ctx: PreDialContext, now: Date = new Date()): CheckResult {
  const pendingFuture = ctx.pendingCallbacks.find(c => new Date(c.callbackScheduledDatetime) > now);
  if (pendingFuture) {
    return {
      check: 'C11_CALLBACK',
      passed: false,
      blockReason: BlockReasonEnum.BLOCKED_CALLBACK_PENDING,
      reason: `Callback scheduled for future time: ${new Date(pendingFuture.callbackScheduledDatetime).toISOString()}`
    };
  }
  return { check: 'C11_CALLBACK', passed: true };
}

export function checkC12Capacity(ctx: PreDialContext): CheckResult {
  const max = ctx.maxConcurrentAllowed ?? 5;
  if (ctx.activeConcurrentCalls >= max) {
    return {
      check: 'C12_CAPACITY',
      passed: false,
      blockReason: BlockReasonEnum.BLOCKED_CAPACITY,
      reason: `Active calling load at capacity: ${ctx.activeConcurrentCalls}/${max}`
    };
  }
  return { check: 'C12_CAPACITY', passed: true };
}
