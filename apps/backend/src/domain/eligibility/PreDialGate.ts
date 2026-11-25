import {
  type PreDialContext,
  checkC1CampaignScope,
  checkC2aHardExclusions,
  checkC2bLossMitigation,
  checkC2cActiveDispute,
  checkC3Dnc,
  checkC4PhoneHygiene,
  checkC5TcpaConsent,
  checkC6Timezone,
  checkC7CallingWindow,
  checkC8Pcw,
  checkC9V1Restrictions,
  checkC10CooldownAndCaps,
  checkC11PendingCallback,
  checkC12Capacity,
  type CheckResult,
  evaluateCooldown,
  type CooldownEvaluationResult
} from './PreDialChecks';
export { evaluateCooldown, type CooldownEvaluationResult };
import { BlockReasonEnum, type BlockReason, type CheckResultItem } from '@delinquency/contracts';

export interface PreDialEvaluationOutcome {
  eligible: boolean;
  finalResult: BlockReason;
  checkResults: CheckResultItem[];
  stoppedAtCheck?: string;
  reason?: string;
  allBlockingReasons?: string[];
  isScenarioEvaluation?: boolean;
  scenarioLabel?: string;
}

export class PreDialGate {
  static evaluate(ctx: PreDialContext, now: Date = new Date(), stopOnFirstFailure: boolean = false): PreDialEvaluationOutcome {
    const checks: Array<() => CheckResult> = [
      () => checkC1CampaignScope(ctx),
      () => checkC2aHardExclusions(ctx),
      () => checkC2bLossMitigation(ctx),
      () => checkC2cActiveDispute(ctx),
      () => checkC3Dnc(ctx),
      () => checkC4PhoneHygiene(ctx),
      () => checkC5TcpaConsent(ctx),
      () => checkC6Timezone(ctx),
      () => checkC7CallingWindow(ctx, now),
      () => checkC8Pcw(ctx, now),
      () => checkC9V1Restrictions(ctx),
      () => checkC10CooldownAndCaps(ctx, now),
      () => checkC11PendingCallback(ctx, now),
      () => checkC12Capacity(ctx)
    ];

    const recordedResults: CheckResultItem[] = [];
    const allBlockingReasons: string[] = [];
    let firstFailedResult: CheckResult | undefined;

    for (const runCheck of checks) {
      const res = runCheck();
      recordedResults.push({
        check: res.check,
        result: res.passed ? 'pass' : 'fail',
        reason: res.reason || null,
        evaluatedAt: now.toISOString()
      });

      if (!res.passed) {
        if (!firstFailedResult) {
          firstFailedResult = res;
        }
        if (res.blockReason) {
          allBlockingReasons.push(res.blockReason);
        } else if (res.reason) {
          allBlockingReasons.push(res.reason);
        }

        if (stopOnFirstFailure) {
          return {
            eligible: false,
            finalResult: res.blockReason || BlockReasonEnum.BLOCKED_OTHER,
            checkResults: recordedResults,
            stoppedAtCheck: res.check,
            reason: res.reason,
            allBlockingReasons: [res.blockReason || res.reason || '']
          };
        }
      }
    }

    const isScenarioEvaluation = !!ctx.simulatedPriorAttempt;
    const scenarioLabel = isScenarioEvaluation ? 'Scenario evaluation — not a live call' : undefined;

    if (firstFailedResult) {
      return {
        eligible: false,
        finalResult: firstFailedResult.blockReason || BlockReasonEnum.BLOCKED_OTHER,
        checkResults: recordedResults,
        stoppedAtCheck: firstFailedResult.check,
        reason: firstFailedResult.reason,
        allBlockingReasons,
        isScenarioEvaluation,
        scenarioLabel
      };
    }

    return {
      eligible: true,
      finalResult: BlockReasonEnum.ELIGIBLE_TO_DIAL,
      checkResults: recordedResults,
      allBlockingReasons: [],
      isScenarioEvaluation,
      scenarioLabel
    };
  }
}
