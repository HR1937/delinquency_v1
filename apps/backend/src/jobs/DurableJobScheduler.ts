import { db } from '../db/client';
import {
  scheduledJobs,
  campaigns,
  campaignMembers,
  loans,
  phoneNumbers,
  borrowers,
  callbacks,
  v1Restrictions,
  dncRecords,
  callAttempts,
  eligibilityEvaluations
} from '../db/schema';
import { eq, and, lte, desc, sql } from 'drizzle-orm';
import { PreDialGate } from '../domain/eligibility/PreDialGate';
import { VapiClient } from '../providers/vapi/VapiClient';
import { config } from '../config';

export interface SchedulerHeartbeat {
  status: 'running' | 'idle' | 'stopped';
  lastPolledAt: string | null;
  lastJobProcessedAt: string | null;
  jobsProcessedCount: number;
  workerId: string;
}

export class DurableJobScheduler {
  private static workerId = `worker-${Math.random().toString(36).substring(2, 9)}`;
  private static intervalMs = 15000; // 15 seconds
  private static timer: any = null;
  private static isRunning = false;
  private static lastPolledAt: Date | null = null;
  private static lastJobProcessedAt: Date | null = null;
  private static jobsProcessedCount = 0;

  static getHeartbeat(): SchedulerHeartbeat {
    return {
      status: this.isRunning ? 'running' : 'idle',
      lastPolledAt: this.lastPolledAt ? this.lastPolledAt.toISOString() : null,
      lastJobProcessedAt: this.lastJobProcessedAt ? this.lastJobProcessedAt.toISOString() : null,
      jobsProcessedCount: this.jobsProcessedCount,
      workerId: this.workerId
    };
  }

  static start(intervalMs: number = 15000) {
    if (this.timer) return;
    this.intervalMs = intervalMs;
    this.isRunning = true;
    console.log(`[DurableJobScheduler] Started worker ${this.workerId} with interval ${this.intervalMs}ms`);

    this.timer = setInterval(async () => {
      await this.pollAndExecute();
    }, this.intervalMs);

    // Initial immediate poll
    this.pollAndExecute().catch(err => {
      console.error('[DurableJobScheduler] Initial poll error:', err);
    });
  }

  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log(`[DurableJobScheduler] Stopped worker ${this.workerId}`);
  }

  /**
   * Atomic claim of due scheduled jobs using Postgres atomic UPDATE ... RETURNING
   */
  static async claimNextDueJob() {
    const nowIso = new Date().toISOString();
    // Atomic lease: pick 1 scheduled job where due_at_utc <= now
    const claimedRows = await db.execute(sql`
      UPDATE scheduled_jobs
      SET status = 'claimed',
          claimed_at = now(),
          lease_expires_at = now() + interval '5 minutes',
          claimed_by_worker = ${this.workerId},
          updated_at = now()
      WHERE id = (
        SELECT id
        FROM scheduled_jobs
        WHERE status = 'scheduled'
          AND due_at_utc <= now()
        ORDER BY due_at_utc ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `);

    return (claimedRows as any)[0] || null;
  }

  static async pollAndExecute() {
    this.lastPolledAt = new Date();
    try {
      // Keep claiming and executing until no due jobs remain
      let job = await this.claimNextDueJob();
      while (job) {
        await this.processJob(job);
        this.jobsProcessedCount++;
        this.lastJobProcessedAt = new Date();
        job = await this.claimNextDueJob();
      }
    } catch (err) {
      console.error('[DurableJobScheduler] Poll execution error:', err);
    }
  }

  static async processJob(job: any) {
    const now = new Date();
    const jobId = job.id;
    const loanId = job.loanId || job.loan_id;
    const jobType = job.jobType || job.job_type;
    const phoneNumberId = job.phoneNumberId || job.phone_number_id;
    const campaignIdFromJob = job.campaignId || job.campaign_id;

    console.log(`[DurableJobScheduler] Processing job ${jobId} (type: ${jobType}, loanId: ${loanId})`);

    // Scenario callback guardrail: Seeded scenario fixtures must never be dispatched by production poller
    const sourceCallId = job.sourceCallAttemptId || job.source_call_attempt_id;
    let linkedCallback = null;
    if (loanId) {
      linkedCallback = await db.query.callbacks.findFirst({
        where: (cb, { eq }) => eq(cb.loanId, loanId)
      });
    }

    const isExplicitScenario = jobType === 'SCENARIO_TEST' ||
      job.scheduledBy === 'scenario_fixture' ||
      (linkedCallback && linkedCallback.sourceType === 'QA_SCENARIO');

    if (isExplicitScenario) {
      console.log(`[DurableJobScheduler] Job ${jobId} held: Scenario callback fixture is non-dispatchable by production poller`);
      await db.update(scheduledJobs).set({
        status: 'scenario_hold',
        blockedAtExecutionReason: 'Scenario callback fixture is non-dispatchable by production poller',
        updatedAt: now
      }).where(eq(scheduledJobs.id, jobId));
      return;
    }

    // Mark as running
    await db.update(scheduledJobs)
      .set({ status: 'running', updatedAt: now })
      .where(eq(scheduledJobs.id, jobId));

    // Reload loan, borrower, phone, campaign, DNC, V1, callbacks, call attempts
    const loan = await db.query.loans.findFirst({ where: (l, { eq }) => eq(l.id, loanId) });
    if (!loan) {
      await db.update(scheduledJobs)
        .set({ status: 'provider_failed', blockedAtExecutionReason: 'Loan record not found', updatedAt: now })
        .where(eq(scheduledJobs.id, jobId));
      return;
    }

    const borrower = await db.query.borrowers.findFirst({ where: (b, { eq }) => eq(b.loanId, loan.id) });

    let phone = phoneNumberId
      ? await db.query.phoneNumbers.findFirst({ where: (p, { eq }) => eq(p.id, phoneNumberId) })
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

    if (!phone) {
      await db.update(scheduledJobs)
        .set({ status: 'blocked_at_execution', blockedAtExecutionReason: 'No phone number available for loan', updatedAt: now })
        .where(eq(scheduledJobs.id, job.id));
      return;
    }

    // Load campaign
    const campaignId = job.campaignId || job.campaign_id || loan.campaignId;
    let camp = campaignId ? await db.query.campaigns.findFirst({ where: (cp, { eq }) => eq(cp.id, campaignId) }) : null;
    if (!camp) {
      camp = await db.query.campaigns.findFirst();
    }

    // Safety: If job is automated campaign run, ensure campaign is active
    if ((job.jobType === 'CAMPAIGN_RUN' || job.job_type === 'CAMPAIGN_RUN') && camp?.status !== 'active') {
      await db.update(scheduledJobs).set({
        status: 'blocked_at_execution',
        blockedAtExecutionReason: `Campaign ${camp?.name || 'unknown'} is not active (${camp?.status})`,
        updatedAt: now
      }).where(eq(scheduledJobs.id, job.id));
      return;
    }

    // Fresh Gate Evaluation
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

    const evalResult = PreDialGate.evaluate({
      loan: {
        id: loan.id,
        dpd: loan.dpd,
        isBankrupt: loan.isBankrupt,
        isLitigation: loan.isLitigation,
        isDeceased: loan.isDeceased,
        hasLossMitigation: loan.hasLossMitigation,
        hasActiveDispute: loan.hasActiveDispute,
        contactAttemptCount: loan.contactAttemptCount,
        priorityScore: loan.priorityScore
      },
      phone: {
        id: phone.id,
        phoneE164: phone.phoneE164,
        lineType: phone.lineType,
        tcpaConsent: phone.tcpaConsent,
        dnc: phone.dnc,
        timezoneIana: phone.timezoneIana,
        isHygieneVerified: phone.isHygieneVerified,
        preferredContactWindowStart: phone.preferredContactWindowStart,
        preferredContactWindowEnd: phone.preferredContactWindowEnd
      },
      campaign: {
        id: camp?.id || 'camp',
        dpdMin: camp?.dpdMin || 1,
        dpdMax: camp?.dpdMax || 59,
        maxAttempts: camp?.maxAttempts || 3,
        dailyCap: camp?.dailyCap || 2,
        weeklyCap: camp?.weeklyCap || 6,
        cooldownHours: camp?.cooldownHours || 4
      },
      accountDnc: !!dncAcc,
      numberDnc: phone.dnc,
      activeV1Restrictions: v1 as any,
      pendingCallbacks: cbs as any,
      recentCallAttempts: recentAttempts as any,
      activeConcurrentCalls: 0
    }, now);

    // Record evaluation
    const [evalRecord] = await db.insert(eligibilityEvaluations).values({
      loanId: loan.id,
      phoneNumberId: phone.id,
      campaignId: camp?.id || loan.campaignId || '00000000-0000-0000-0000-000000000000',
      finalResult: evalResult.finalResult,
      checkResults: evalResult.checkResults as any,
      triggeredDial: evalResult.eligible
    }).returning();

    // If blocked at due time: mark BLOCKED_AT_EXECUTION and do not create false call attempt
    if (!evalResult.eligible) {
      console.log(`[DurableJobScheduler] Job ${job.id} blocked at execution: ${evalResult.finalResult} (${evalResult.reason})`);
      await db.update(scheduledJobs).set({
        status: 'blocked_at_execution',
        blockedAtExecutionReason: `${evalResult.finalResult}: ${evalResult.reason}`,
        lastEvaluationSnapshot: evalResult as any,
        updatedAt: now
      }).where(eq(scheduledJobs.id, job.id));
      return;
    }

    // Safety Interlock check for target destination
    const targetNumber = phone.phoneE164;
    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '').split(',').map((n: string) => n.trim()).filter(Boolean);

    if (!config.PRODUCTION_CALLS_ENABLED && !allowed.includes(targetNumber)) {
      console.log(`[DurableJobScheduler] Job ${job.id} blocked: Destination ${targetNumber} not in ALLOWED_TEST_DESTINATIONS`);
      await db.update(scheduledJobs).set({
        status: 'blocked_at_execution',
        blockedAtExecutionReason: `SAFETY_INTERLOCK: Destination ${targetNumber.replace(/\d(?=\d{4})/g, 'x')} not in ALLOWED_TEST_DESTINATIONS`,
        lastEvaluationSnapshot: evalResult as any,
        updatedAt: now
      }).where(eq(scheduledJobs.id, job.id));
      return;
    }

    // Safety Guardrail: No live outbound voice calls or real SMS are permitted.
    // The due job has survived fresh gate evaluation and is marked as 'dispatch_blocked_phase3'.
    // It remains safely held without creating false call attempts or calling provider APIs.
    console.log(`[DurableJobScheduler] Job ${jobId} eligible; dispatch is blocked under integration readiness safety guardrail`);
    await db.update(scheduledJobs).set({
      status: 'dispatch_blocked_phase3',
      blockedAtExecutionReason: 'DISPATCH_BLOCKED_PHASE3: Live voice dispatch is prohibited during integration readiness.',
      lastEvaluationSnapshot: evalResult as any,
      updatedAt: now
    }).where(eq(scheduledJobs.id, jobId));
  }

  /**
   * Heartbeat to renew worker lease on an actively running job
   */
  static async heartbeat(jobId: string, extensionMinutes: number = 5) {
    await db.execute(sql`
      UPDATE scheduled_jobs
      SET lease_expires_at = now() + (${extensionMinutes} || ' minutes')::interval,
          updated_at = now()
      WHERE id = ${jobId} AND status = 'running';
    `);
  }

  /**
   * Safe recovery of stale processing/claimed jobs from workers that crashed or timed out.
   * Jobs within their active lease window are strictly protected from theft.
   */
  static async recoverStaleJobs(staleThresholdMs: number = 5 * 60 * 1000) {
    const cutoff = new Date(Date.now() - staleThresholdMs).toISOString();
    const result = await db.execute(sql`
      UPDATE scheduled_jobs
      SET status = 'scheduled',
          claimed_by_worker = NULL,
          lease_expires_at = NULL,
          notes = COALESCE(notes, '') || ' [Auto-recovered from stale processing state at ' || now() || ']',
          updated_at = now()
      WHERE status IN ('claimed', 'running')
        AND (
          (lease_expires_at IS NOT NULL AND lease_expires_at < now())
          OR (lease_expires_at IS NULL AND claimed_at < ${cutoff}::timestamptz)
        )
      RETURNING id;
    `);
    return (result as any).length || 0;
  }
}
