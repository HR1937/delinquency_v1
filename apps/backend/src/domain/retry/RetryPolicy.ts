import { DispositionEnum, type Disposition } from '@delinquency/contracts';

export const TERMINAL_DISPOSITIONS: Disposition[] = [
  DispositionEnum.RPC_PAYMENT_MADE_DURING_CALL,
  DispositionEnum.RPC_DISPUTE,
  DispositionEnum.RPC_HARDSHIP_REFERRED,
  DispositionEnum.NO_RPC_DNC_REQUESTED,
  DispositionEnum.RPC_LEGAL_TRIGGER,
  DispositionEnum.RPC_SAFETY_ESCALATED
];

export interface RetryEvaluationContext {
  lastDisposition: Disposition;
  contactAttemptCount: number;
  fallbackThreshold: number; // default 3
  isBankrupt: boolean;
  isLitigation: boolean;
  isDeceased: boolean;
  hasLossMitigation: boolean;
  hasActiveDispute: boolean;
  hasActiveDnc: boolean;
  cooldownHours: number;
  lastAttemptAt: Date;
  technicalFailureCount24h: number;
}

export interface RetryEvaluationOutcome {
  shouldRetry: boolean;
  terminal: boolean;
  fallbackTriggered: boolean;
  reason: string;
  nextAllowedAttemptAt?: Date;
}

export class RetryPolicy {
  static evaluate(ctx: RetryEvaluationContext, now: Date = new Date()): RetryEvaluationOutcome {
    if (TERMINAL_DISPOSITIONS.includes(ctx.lastDisposition)) {
      return {
        shouldRetry: false,
        terminal: true,
        fallbackTriggered: false,
        reason: `Terminal call outcome reached: ${ctx.lastDisposition}`
      };
    }

    if (ctx.isBankrupt || ctx.isLitigation || ctx.isDeceased || ctx.hasLossMitigation || ctx.hasActiveDispute || ctx.hasActiveDnc) {
      return {
        shouldRetry: false,
        terminal: true,
        fallbackTriggered: false,
        reason: 'Account transitioned into excluded or suppression status'
      };
    }

    if (ctx.contactAttemptCount >= ctx.fallbackThreshold) {
      return {
        shouldRetry: false,
        terminal: true,
        fallbackTriggered: true,
        reason: `Borrower attempt threshold reached (${ctx.contactAttemptCount}/${ctx.fallbackThreshold}). Routing to human queue / consented fallback.`
      };
    }

    if (ctx.technicalFailureCount24h >= 3) {
      return {
        shouldRetry: false,
        terminal: false,
        fallbackTriggered: false,
        reason: 'Technical failure threshold reached (3 within 24h). Pausing for technical remediation.'
      };
    }

    const nextTime = new Date(ctx.lastAttemptAt.getTime() + ctx.cooldownHours * 60 * 60 * 1000);
    return {
      shouldRetry: true,
      terminal: false,
      fallbackTriggered: false,
      reason: 'Eligible for retry after cooldown',
      nextAllowedAttemptAt: nextTime > now ? nextTime : now
    };
  }
}
