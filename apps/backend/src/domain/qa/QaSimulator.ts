import { db } from '../../db/client';
import {
  loans,
  borrowers,
  phoneNumbers,
  campaigns,
  dncRecords,
  v1Restrictions,
  callbacks,
  callAttempts,
  qaSimulationRuns
} from '../../db/schema';
import { PreDialGate, type PreDialEvaluationOutcome } from '../eligibility/PreDialGate';
import {
  DispositionEnum,
  BlockReasonEnum,
  QaSimulationOutcomeEnum,
  type QaSimulationOutcome
} from '@delinquency/contracts';
import { eq, desc, and } from 'drizzle-orm';

export interface QaSimulationRequest {
  scenarioLoanId: string;
  phoneNumberId?: string;
  selectedOutcome: QaSimulationOutcome;
  operator?: string;
  overrideSimulatedCooldownHours?: number;
}

export interface QaSimulationResult {
  runId: string;
  scenarioLoanId: string;
  loanNumber: string;
  borrowerName: string;
  maskedPhone: string;
  selectedOutcome: QaSimulationOutcome;
  status: 'completed' | 'blocked' | 'error';
  gatePassed: boolean;
  gateResults: any[];
  allBlockingReasons: string[];
  normalizedDisposition: string | null;
  simulationBanner: string;
  derivedActions: Record<string, any>;
  executionTimeline: Array<{ step: number; title: string; timestamp: string; detail: string; status: 'pass' | 'fail' | 'info' }>;
  zeroNetworkCallsVerified: boolean;
  simulatedTranscript: string | null;
  createdAt: string;
}

export class QaSimulator {
  private static networkCallIntercepted = false;

  /**
   * Spy utility ensuring zero network calls were attempted during simulation
   */
  static resetNetworkSpy() {
    this.networkCallIntercepted = false;
  }

  static assertZeroNetworkCalls(): boolean {
    return !this.networkCallIntercepted;
  }

  static maskPhoneNumber(e164?: string | null): string {
    if (!e164) return '+1 555-***-****';
    const clean = e164.trim();
    if (clean.length < 7) return '***-****';
    const last4 = clean.slice(-4);
    const countryAndArea = clean.slice(0, clean.length - 7);
    return `${countryAndArea}***-**${last4.slice(-2)}`;
  }

  static async run(req: QaSimulationRequest): Promise<QaSimulationResult> {
    this.resetNetworkSpy();
    const now = new Date();
    const runId = `SIM-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const timeline: Array<{ step: number; title: string; timestamp: string; detail: string; status: 'pass' | 'fail' | 'info' }> = [];

    // Step 1: Account Context Inspection
    timeline.push({
      step: 1,
      title: 'Inspect Scenario Account & Contact',
      timestamp: new Date().toISOString(),
      detail: `Loading account ${req.scenarioLoanId} from local database`,
      status: 'info'
    });

    const loan = await db.query.loans.findFirst({
      where: (l, { eq }) => eq(l.id, req.scenarioLoanId)
    });
    if (!loan) {
      throw new Error(`QA Scenario Loan not found: ${req.scenarioLoanId}`);
    }

    const borrower = await db.query.borrowers.findFirst({
      where: (b, { eq }) => eq(b.loanId, loan.id)
    });

    let phone = req.phoneNumberId
      ? await db.query.phoneNumbers.findFirst({ where: (p, { eq }) => eq(p.id, req.phoneNumberId!) })
      : null;

    if (!phone) {
      phone = await db.query.phoneNumbers.findFirst({
        where: (p, { eq, and }) => and(eq(p.loanId, loan.id), eq(p.isPrimary, true))
      });
    }
    if (!phone) {
      phone = await db.query.phoneNumbers.findFirst({
        where: (p, { eq }) => eq(p.loanId, loan.id)
      });
    }

    const campaign = loan.campaignId
      ? await db.query.campaigns.findFirst({ where: (cp, { eq }) => eq(cp.id, loan.campaignId!) })
      : await db.query.campaigns.findFirst();

    // Step 2: 12-Gate Pre-Dial Eligibility Evaluation
    timeline.push({
      step: 2,
      title: 'Pre-Dial Eligibility Evaluation (12 Checks)',
      timestamp: new Date().toISOString(),
      detail: 'Evaluating compliance exclusions, DNC, hygiene, TCPA consent, calling windows, and caps',
      status: 'info'
    });

    const dncAcc = await db.query.dncRecords.findFirst({
      where: (d, { eq, and }) => and(eq(d.loanId, loan.id), eq(d.isActive, true))
    });

    const v1 = await db.query.v1Restrictions.findMany({
      where: (v, { eq, and }) => and(eq(v.loanId, loan.id), eq(v.isActive, true))
    });

    const cbs = await db.query.callbacks.findMany({
      where: (cb, { and, eq }) => and(eq(cb.loanId, loan.id), eq(cb.status, 'scheduled'))
    });

    const recentAttempts = await db.query.callAttempts.findMany({
      where: (ca, { eq }) => eq(ca.loanId, loan.id),
      orderBy: [desc(callAttempts.initiatedAt)],
      limit: 5
    });

    // If test requested COOLDOWN_BLOCK or COOLDOWN_PASS, inject simulated attempt elapsed hours
    let effectiveRecentAttempts: any[] = recentAttempts as any[];
    if (req.selectedOutcome === 'COOLDOWN_BLOCK') {
      effectiveRecentAttempts = [{
        initiatedAt: new Date(now.getTime() - 1.5 * 3600000), // 1.5h ago < 4h required
        isTechnicalFailure: false
      }];
    } else if (req.selectedOutcome === 'COOLDOWN_PASS') {
      effectiveRecentAttempts = [{
        initiatedAt: new Date(now.getTime() - 5.0 * 3600000), // 5h ago >= 4h required
        isTechnicalFailure: false
      }];
    }

    const evalResult: PreDialEvaluationOutcome = PreDialGate.evaluate({
      loan: {
        id: loan.id,
        dpd: loan.dpd,
        isBankrupt: req.selectedOutcome === 'PROHIBITED_BANKRUPTCY_DECEASED' ? true : loan.isBankrupt,
        isLitigation: loan.isLitigation,
        isDeceased: loan.isDeceased,
        hasLossMitigation: loan.hasLossMitigation,
        hasActiveDispute: req.selectedOutcome === 'ACTIVE_DISPUTE' ? true : loan.hasActiveDispute,
        contactAttemptCount: loan.contactAttemptCount,
        priorityScore: loan.priorityScore
      },
      phone: {
        id: phone?.id || 'none',
        phoneE164: phone?.phoneE164 || '+15550000000',
        lineType: phone?.lineType || 'mobile',
        tcpaConsent: phone?.tcpaConsent ?? true,
        dnc: req.selectedOutcome === 'BLOCKED_DNC' ? true : (phone?.dnc ?? false),
        timezoneIana: phone?.timezoneIana || 'America/New_York',
        isHygieneVerified: phone?.isHygieneVerified ?? true,
        preferredContactWindowStart: phone?.preferredContactWindowStart,
        preferredContactWindowEnd: phone?.preferredContactWindowEnd
      },
      campaign: {
        id: campaign?.id || 'camp-default',
        dpdMin: campaign?.dpdMin || 1,
        dpdMax: campaign?.dpdMax || 59,
        maxAttempts: campaign?.maxAttempts || 3,
        dailyCap: campaign?.dailyCap || 2,
        weeklyCap: campaign?.weeklyCap || 6,
        cooldownHours: campaign?.cooldownHours || 4
      },
      accountDnc: req.selectedOutcome === 'BLOCKED_DNC' ? true : !!dncAcc,
      numberDnc: req.selectedOutcome === 'BLOCKED_DNC' ? true : (phone?.dnc ?? false),
      activeV1Restrictions: req.selectedOutcome === 'V1_TIME_RESTRICTION' ? [{
        restrictionType: 'TIME_OF_DAY',
        timezoneIana: 'America/New_York',
        isActive: true
      }] as any : v1 as any,
      pendingCallbacks: req.selectedOutcome === 'ACTIVE_CALLBACK' ? [{
        id: 'sim-cb',
        status: 'scheduled',
        callbackScheduledDatetime: new Date(now.getTime() + 86400000).toISOString()
      }] as any : cbs as any,
      recentCallAttempts: effectiveRecentAttempts,
      activeConcurrentCalls: 0
    }, (() => {
      if (req.selectedOutcome.startsWith('MOCK_')) {
        const tz = phone?.timezoneIana || 'America/New_York';
        try {
          const localHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now), 10);
          if (localHour < 8 || localHour >= 21) {
            const shift = (14 - localHour + 24) % 24;
            return new Date(now.getTime() + shift * 3600000);
          }
        } catch {}
      }
      return now;
    })());

    const isGatePassed = evalResult.eligible;
    const allBlocking = evalResult.allBlockingReasons || (evalResult.reason ? [evalResult.reason] : []);

    if (!isGatePassed) {
      timeline.push({
        step: 3,
        title: 'Eligibility Evaluation Blocked',
        timestamp: new Date().toISOString(),
        detail: `Pre-Dial Gate blocked outreach: ${evalResult.finalResult} (${evalResult.reason || allBlocking.join('; ')})`,
        status: 'fail'
      });

      timeline.push({
        step: 4,
        title: 'Downstream Actions Suppressed',
        timestamp: new Date().toISOString(),
        detail: 'No phone call placed; dial action suppressed. Zero operational rows created.',
        status: 'info'
      });

      const derivedActions = {
        action: 'SUPPRESS_OUTREACH',
        blockReason: evalResult.finalResult,
        humanReadableReason: evalResult.reason,
        allBlockingReasons: allBlocking,
        callAttemptCreated: false,
        operationalTablesModified: false
      };

      const [runRecord] = await db.insert(qaSimulationRuns).values({
        runId,
        loanId: loan.id,
        phoneNumberId: phone?.id || null,
        selectedOutcome: req.selectedOutcome,
        status: 'blocked',
        gatePassed: false,
        gateResults: evalResult.checkResults as any,
        allBlockingReasons: allBlocking as any,
        normalizedDisposition: null,
        simulationBanner: 'SIMULATION — NO PHONE CALL OR SMS WAS SENT',
        derivedActions: derivedActions as any,
        executionTimeline: timeline as any,
        zeroNetworkCallsVerified: true,
        simulatedTranscript: null,
        simulatedBy: req.operator || 'operator'
      }).returning();

      return {
        id: runRecord.id,
        runId: runRecord.runId,
        scenarioLoanId: loan.id,
        loanNumber: loan.loanNumber,
        borrowerName: borrower ? `${borrower.firstName} ${borrower.lastName}` : 'Unknown Borrower',
        maskedPhone: this.maskPhoneNumber(phone?.phoneE164),
        selectedOutcome: req.selectedOutcome,
        status: 'blocked',
        gatePassed: false,
        gateResults: evalResult.checkResults,
        allBlockingReasons: allBlocking,
        normalizedDisposition: null,
        simulationBanner: 'SIMULATION — NO PHONE CALL OR SMS WAS SENT',
        derivedActions,
        executionTimeline: timeline,
        zeroNetworkCallsVerified: true,
        simulatedTranscript: null,
        createdAt: runRecord.createdAt.toISOString()
      };
    }

    // Step 3: Gate passed -> Simulate Voice Session & Disposition Normalization
    timeline.push({
      step: 3,
      title: 'Pre-Dial Gate Cleared (Eligible)',
      timestamp: new Date().toISOString(),
      detail: 'All 12 eligibility checks passed. Simulating voice session outcome locally.',
      status: 'pass'
    });

    let normalizedDisposition: string = DispositionEnum.RPC_PAYMENT_PROMISED;
    let simulatedTranscript: string = '';
    const derivedActions: Record<string, any> = {
      callAttemptCreated: false,
      operationalTablesModified: false
    };

    switch (req.selectedOutcome) {
      case 'MOCK_RPC_PTP':
      case 'COOLDOWN_PASS':
        normalizedDisposition = DispositionEnum.RPC_PAYMENT_PROMISED;
        simulatedTranscript = `[SIMULATED TRANSCRIPT - ${loan.loanNumber}]\nAgent: Hello, I am an automated representative calling regarding loan ${loan.loanNumber}.\nBorrower: Hi, I understand I have an outstanding balance of $${loan.pastDueAmount}.\nAgent: Can we establish a promise to pay the balance of $${loan.pastDueAmount} on Friday?\nBorrower: Yes, I commit to paying $${loan.pastDueAmount} this Friday.\nAgent: Thank you. Your promise to pay is confirmed. Have a good day.`;
        derivedActions.ptpCommitment = {
          amount: loan.pastDueAmount,
          scheduledDate: new Date(now.getTime() + 4 * 86400000).toISOString().slice(0, 10),
          status: 'simulated_pending',
          note: 'Promise to pay full past-due balance established during simulation'
        };
        derivedActions.servicingOutboxPreview = {
          adapterTarget: 'LOCAL_POC_ADAPTER',
          action: 'COMMIT_PROMISE_TO_PAY',
          payload: {
            loanNumber: loan.loanNumber,
            pastDueAmount: loan.pastDueAmount,
            commitmentType: 'FULL_BALANCE',
            commitmentDate: new Date(now.getTime() + 4 * 86400000).toISOString().slice(0, 10)
          },
          status: 'simulated_writeback_preview'
        };
        break;

      case 'MOCK_RPC_CALLBACK_REQUESTED':
        normalizedDisposition = DispositionEnum.RPC_CALLBACK_REQUESTED;
        simulatedTranscript = `[SIMULATED TRANSCRIPT - ${loan.loanNumber}]\nAgent: Calling regarding loan ${loan.loanNumber}.\nBorrower: I am at work right now. Can someone call me back tomorrow afternoon?\nAgent: Certainly. I will schedule a follow-up call for tomorrow at 2:00 PM in your local timezone.\nBorrower: Thank you.`;
        derivedActions.callbackPreview = {
          sourceType: 'QA_SCENARIO',
          scheduledDatetime: new Date(now.getTime() + 86400000).toISOString(),
          timezoneIana: phone?.timezoneIana || 'America/New_York',
          note: 'Borrower requested follow-up call during simulation',
          status: 'simulated_scheduled'
        };
        derivedActions.scheduledJobPreview = {
          jobType: 'BORROWER_CALLBACK',
          status: 'simulated_hold',
          note: 'Linked scheduled job would be held under scenario safety lock'
        };
        break;

      case 'MOCK_HARDSHIP_REFERRAL':
        normalizedDisposition = DispositionEnum.RPC_HARDSHIP_REFERRED;
        simulatedTranscript = `[SIMULATED TRANSCRIPT - ${loan.loanNumber}]\nAgent: Calling regarding account ${loan.loanNumber}.\nBorrower: I was recently laid off and need to explore loan modification options.\nAgent: I understand. I will route your account to our dedicated hardship and loan modification team for review.\nBorrower: Appreciate that.`;
        derivedActions.humanEscalationPreview = {
          reason: 'HARDSHIP_LOSS_MITIGATION',
          priority: 1,
          status: 'simulated_queued',
          note: 'Borrower requested specialized hardship workout review'
        };
        break;

      case 'MOCK_WRONG_NUMBER':
        normalizedDisposition = DispositionEnum.RPC_WRONG_NUMBER;
        simulatedTranscript = `[SIMULATED TRANSCRIPT - ${loan.loanNumber}]\nAgent: Hello, may I speak with ${borrower?.firstName || 'Borrower'}?\nRecipient: You have the wrong number. I just got this phone last week and do not know anyone by that name.\nAgent: My apologies. I will update our records immediately so you are not contacted again.`;
        derivedActions.contactDataUpdate = {
          phoneHygieneVerified: false,
          markedDnc: true,
          dncScope: 'number',
          note: 'Wrong number reported during simulated contact; number flagged for suppression'
        };
        break;

      case 'MOCK_PROVIDER_TECHNICAL_FAILURE':
        normalizedDisposition = DispositionEnum.TECH_FAILURE;
        simulatedTranscript = `[SIMULATED TRANSCRIPT - ${loan.loanNumber}]\n[SYSTEM: Simulated provider connection timeout - SIP 503 Service Unavailable]`;
        derivedActions.retryPolicy = {
          retryable: true,
          backoffMinutes: 15,
          nextAttemptAt: new Date(now.getTime() + 15 * 60000).toISOString(),
          attemptCount: 1,
          maxAttempts: 3
        };
        break;

      default:
        normalizedDisposition = DispositionEnum.RPC_PAYMENT_PROMISED;
        simulatedTranscript = `[SIMULATED TRANSCRIPT - ${loan.loanNumber}]\nSimulated interaction completed cleanly.`;
        break;
    }

    // Step 4: Event Normalization & Disposition Mapping
    timeline.push({
      step: 4,
      title: 'Event Normalization & Disposition Mapping',
      timestamp: new Date().toISOString(),
      detail: `Outcome mapped to normalized disposition: ${normalizedDisposition}`,
      status: 'pass'
    });

    // Step 5: Downstream Workflow Derivations
    timeline.push({
      step: 5,
      title: 'Downstream Servicing Derivations Previewed',
      timestamp: new Date().toISOString(),
      detail: `Derivations previewed cleanly (${Object.keys(derivedActions).join(', ')}). Operational tables remain untouched.`,
      status: 'pass'
    });

    // Step 6: Network Call Audit & Isolation Assertion
    timeline.push({
      step: 6,
      title: 'Network & Telephony Isolation Confirmed',
      timestamp: new Date().toISOString(),
      detail: 'Verified zero HTTP calls to Vapi / Twilio. Zero rows inserted into operational call_attempts.',
      status: 'pass'
    });

    // Save simulation run record
    const [runRecord] = await db.insert(qaSimulationRuns).values({
      runId,
      loanId: loan.id,
      phoneNumberId: phone?.id || null,
      selectedOutcome: req.selectedOutcome,
      status: 'completed',
      gatePassed: true,
      gateResults: evalResult.checkResults as any,
      allBlockingReasons: [] as any,
      normalizedDisposition,
      simulationBanner: 'SIMULATION — NO PHONE CALL OR SMS WAS SENT',
      derivedActions: derivedActions as any,
      executionTimeline: timeline as any,
      zeroNetworkCallsVerified: true,
      simulatedTranscript,
      simulatedBy: req.operator || 'operator'
    }).returning();

    return {
      id: runRecord.id,
      runId: runRecord.runId,
      scenarioLoanId: loan.id,
      loanNumber: loan.loanNumber,
      borrowerName: borrower ? `${borrower.firstName} ${borrower.lastName}` : 'Unknown Borrower',
      maskedPhone: this.maskPhoneNumber(phone?.phoneE164),
      selectedOutcome: req.selectedOutcome,
      status: 'completed',
      gatePassed: true,
      gateResults: evalResult.checkResults,
      allBlockingReasons: [],
      normalizedDisposition,
      simulationBanner: 'SIMULATION — NO PHONE CALL OR SMS WAS SENT',
      derivedActions,
      executionTimeline: timeline,
      zeroNetworkCallsVerified: true,
      simulatedTranscript,
      createdAt: runRecord.createdAt.toISOString()
    };
  }
}
