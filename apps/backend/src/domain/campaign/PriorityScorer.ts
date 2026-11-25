export interface LoanScoringInput {
  dpd: number;
  openPtpDueToday?: boolean;
  rpcAchieved?: boolean;
  recentNsf?: boolean;
}

export class PriorityScorer {
  static score(input: LoanScoringInput): number {
    let score = 50.0;
    // Higher DPD within 1-59 gets higher priority
    score += (Math.min(input.dpd, 59) / 59) * 20;

    if (input.openPtpDueToday) {
      score += 15;
    }
    if (input.rpcAchieved) {
      score += 10;
    }
    if (input.recentNsf) {
      score += 5;
    }

    return Math.min(Math.max(score, 0), 100);
  }
}
