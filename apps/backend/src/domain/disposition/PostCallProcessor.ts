import { db } from '../../db/client';
import {
  loans,
  callAttempts,
  ptpCommitments,
  callbacks,
  v1Restrictions,
  dncRecords,
  humanEscalations,
  stateChangeLog,
  scheduledJobs,
  servicingOutbox,
  phoneNumbers
} from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { StructuredOutcome } from '@delinquency/contracts';
import { DispositionEnum } from '@delinquency/contracts';
import { sanitizePayload, sanitizeText } from '../../utils/sanitizer';

export class PostCallProcessor {
  static async process(callAttemptId: string, rawOutcome: StructuredOutcome) {
    // Sanitize outcome payload before any database writes or state transitions
    const outcome = sanitizePayload(rawOutcome) as StructuredOutcome;
    const attempt = await db.query.callAttempts.findFirst({
      where: (a, { eq }) => eq(a.id, callAttemptId)
    });
    if (!attempt) {
      throw new Error(`Call attempt ${callAttemptId} not found`);
    }

    const loan = await db.query.loans.findFirst({
      where: (l, { eq }) => eq(l.id, attempt.loanId)
    });
    if (!loan) {
      throw new Error(`Loan ${attempt.loanId} not found`);
    }

    const now = new Date();

    // 1. Update call_attempts record with final disposition & structured outcome
    await db.update(callAttempts).set({
      disposition: outcome.disposition,
      isRightPartyContact: outcome.rpc,
      structuredOutcome: outcome as any,
      borrowerStatedReason: outcome.borrowerStatedReason ? sanitizeText(outcome.borrowerStatedReason) : null,
      sentiment: outcome.sentiment || null,
      endedAt: now,
      callStatus: 'completed'
    }).where(eq(callAttempts.id, callAttemptId));

    // 2. State change log helper
    const logStateChange = async (fieldName: string, prevVal: any, newVal: any) => {
      await db.insert(stateChangeLog).values({
        loanId: loan.id,
        callAttemptId,
        fieldName,
        previousValue: prevVal,
        newValue: newVal,
        changedAt: now,
        changedBy: 'post_call_processor'
      });
    };

    // 3. Handle PTP (idempotent: check if already exists for this callAttemptId)
    if (outcome.ptpAmount && outcome.ptpDate) {
      const existingPtp = await db.query.ptpCommitments.findFirst({
        where: (p, { eq }) => eq(p.callAttemptId, callAttemptId)
      });
      if (!existingPtp) {
        await db.insert(ptpCommitments).values({
          callAttemptId,
          loanId: loan.id,
          amount: outcome.ptpAmount.toFixed(2),
          promisedDate: outcome.ptpDate,
          status: outcome.paymentConfirmed ? 'kept' : 'pending',
          paymentConfirmedAt: outcome.paymentConfirmed ? now : null,
          paymentConfirmationSource: outcome.paymentConfirmationSource || null
        });

        await logStateChange('open_ptp', null, { amount: outcome.ptpAmount, date: outcome.ptpDate });
      }
    }

    // 4. Handle DNC (idempotent)
    if (outcome.dnc) {
      const existingDnc = await db.query.dncRecords.findFirst({
        where: (d, { eq }) => eq(d.sourceCallAttemptId, callAttemptId)
      });
      if (!existingDnc) {
        await db.insert(dncRecords).values({
          loanId: loan.id,
          phoneNumberId: attempt.phoneNumberId,
          scope: outcome.dnc.scope,
          source: 'borrower_request',
          sourceCallAttemptId: callAttemptId,
          requestedAt: now,
          isActive: true
        });
        await logStateChange('dnc_active', false, true);
      }
    }

    // 5. Handle v1 restriction (idempotent)
    if (outcome.v1Restriction) {
      const existingV1 = await db.query.v1Restrictions.findFirst({
        where: (v, { eq }) => eq(v.sourceCallAttemptId, callAttemptId)
      });
      if (!existingV1) {
        await db.insert(v1Restrictions).values({
          loanId: loan.id,
          phoneNumberId: attempt.phoneNumberId,
          sourceCallAttemptId: callAttemptId,
          restrictionType: outcome.v1Restriction.type,
          timezoneIana: outcome.callbackTimezone || 'America/New_York',
          humanReadableNote: outcome.v1Restriction.note,
          requestedAt: now,
          isActive: true
        });
        await logStateChange('v1_restriction', null, outcome.v1Restriction);
      }
    }

    // 6. Handle borrower callback & create corresponding scheduled_jobs record (idempotent)
    if (outcome.v2Callback || outcome.disposition === DispositionEnum.RPC_CALLBACK_REQUESTED) {
      const existingCb = await db.query.callbacks.findFirst({
        where: (cb, { eq }) => eq(cb.sourceCallAttemptId, callAttemptId)
      });

      const requestedAt = outcome.v2Callback?.requestedAt ? new Date(outcome.v2Callback.requestedAt) : now;
      const scheduledDatetime = outcome.v2Callback?.scheduledFor
        ? new Date(outcome.v2Callback.scheduledFor)
        : new Date(now.getTime() + 24 * 3600000);
      const timezone = outcome.v2Callback?.timezone || outcome.callbackTimezone || 'America/New_York';
      const rawNote = outcome.v2Callback?.humanReadableNote || outcome.notes?.reasonSummary || 'Borrower requested callback via verified call outcome';
      const note = sanitizeText(rawNote);

      if (!existingCb) {
        const [cbRecord] = await db.insert(callbacks).values({
          loanId: loan.id,
          phoneNumberId: attempt.phoneNumberId,
          sourceCallAttemptId: callAttemptId,
          sourceType: 'BORROWER_REQUEST_FROM_REAL_CALL',
          callbackRequestedAt: requestedAt,
          callbackScheduledDatetime: scheduledDatetime,
          callbackTimezoneIana: timezone,
          humanReadableNote: note,
          status: 'scheduled'
        }).returning();
        await logStateChange('scheduled_callback', null, { callbackId: cbRecord.id, scheduledDatetime, timezone });
      }

      // Also create matching scheduled_job if not already present
      const existingJob = await db.query.scheduledJobs.findFirst({
        where: (sj, { eq }) => eq(sj.sourceCallAttemptId, callAttemptId)
      });
      if (!existingJob) {
        await db.insert(scheduledJobs).values({
          jobType: 'BORROWER_CALLBACK',
          status: 'scheduled',
          campaignId: attempt.campaignId,
          loanId: loan.id,
          phoneNumberId: attempt.phoneNumberId,
          dueAtUtc: scheduledDatetime,
          originalLocalDatetime: scheduledDatetime.toISOString(),
          originalTimezoneIana: timezone,
          scheduledBy: 'borrower_callback',
          notes: note,
          sourceCallAttemptId: callAttemptId
        });
        await logStateChange('scheduled_job', null, { type: 'BORROWER_CALLBACK', dueAtUtc: scheduledDatetime });
      }
    }

    // 7. Handle Human Escalation (idempotent)
    if (outcome.humanRouteRequired) {
      const existingEscalation = await db.query.humanEscalations.findFirst({
        where: (he, { eq }) => eq(he.callAttemptId, callAttemptId)
      });
      if (!existingEscalation) {
        await db.insert(humanEscalations).values({
          loanId: loan.id,
          callAttemptId,
          reason: (outcome.escalationReason as any) || 'HUMAN_REQUESTED',
          priority: outcome.disposition === DispositionEnum.RPC_SAFETY_ESCALATED ? 1 : 5,
          status: 'pending',
          notes: outcome.notes?.reasonSummary || 'Escalated from voice agent'
        });
        await logStateChange('human_escalation', null, { reason: outcome.escalationReason });
      }
    }

    // 8. Update loan contact metadata
    const nextAttemptCount = (loan.contactAttemptCount || 0) + 1;
    await db.update(loans).set({
      contactAttemptCount: nextAttemptCount,
      lastContactDate: now,
      lastContactOutcome: outcome.disposition,
      rpcAchieved: outcome.rpc || loan.rpcAchieved,
      hasActiveDispute: outcome.disputeRecorded ? true : loan.hasActiveDispute
    }).where(eq(loans.id, loan.id));

    // Also update phone number DNC flag if DNC was requested
    if (outcome.dnc && attempt.phoneNumberId) {
      await db.update(phoneNumbers).set({
        dnc: true,
        dncScope: outcome.dnc.scope,
        dncSource: 'post_call_processor',
        dncSetAt: now
      }).where(eq(phoneNumbers.id, attempt.phoneNumberId));
    }

    // 9. Persist exact serialized servicing write-back payload in local PoC servicing_outbox (idempotent)
    const servicingPayload = {
      attemptId: callAttemptId,
      referenceNumber: attempt.referenceNumber,
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      borrowerId: attempt.borrowerId,
      campaignId: attempt.campaignId,
      callMode: attempt.callMode,
      phoneNumberId: attempt.phoneNumberId,
      dialedPhoneE164: attempt.dialedPhoneE164,
      disposition: outcome.disposition,
      isRightPartyContact: outcome.rpc,
      durationSeconds: attempt.durationSeconds,
      transcriptUrl: attempt.transcriptUrl,
      recordingUrl: attempt.recordingUrl,
      borrowerStatedReason: outcome.borrowerStatedReason || null,
      sentiment: outcome.sentiment || null,
      ptpAmount: outcome.ptpAmount ?? null,
      ptpDate: outcome.ptpDate ?? null,
      structuredOutcome: outcome,
      complianceFlags: attempt.complianceFlags,
      humanReviewRequired: attempt.humanReviewRequired,
      humanReviewReason: attempt.humanReviewReason,
      isTechnicalFailure: attempt.isTechnicalFailure,
      executedAt: now.toISOString(),
      adapter: 'LOCAL_POC_ADAPTER'
    };

    const existingOutbox = await db.query.servicingOutbox.findFirst({
      where: (so, { eq }) => eq(so.callAttemptId, callAttemptId)
    });
    if (!existingOutbox) {
      await db.insert(servicingOutbox).values({
        callAttemptId,
        loanId: loan.id,
        referenceNumber: attempt.referenceNumber,
        adapterTarget: 'LOCAL_POC_ADAPTER',
        payloadSchemaVersion: '1.0.0',
        payload: servicingPayload as any,
        validationStatus: 'valid',
        commitStatus: 'committed',
        deliveryStatus: 'delivered_local'
      });
    }

    return { success: true, servicingPayload };
  }
}
