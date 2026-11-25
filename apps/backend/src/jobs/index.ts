import { db } from '../db/client';
import { callbacks, ptpCommitments, scheduledJobs } from '../db/schema';
import { eq, and, lt, lte, isNotNull } from 'drizzle-orm';
import { DurableJobScheduler } from './DurableJobScheduler';

function startCallbackPoller() {
  setInterval(async () => {
    try {
      const now = new Date();
      // Only enqueue live borrower callbacks from real call events.
      // Seeded scenario fixtures (sourceCallAttemptId = null) are passive eligibility test data, not auto-dispatch jobs.
      const dueCallbacks = await db.query.callbacks.findMany({
        where: (cb, { and, eq, isNotNull: isNotN }) => and(
          eq(cb.status, 'scheduled'),
          isNotN(cb.sourceCallAttemptId)
        )
      });

      for (const cb of dueCallbacks) {
        // Check if job already exists
        const existingJob = await db.query.scheduledJobs.findFirst({
          where: (sj, { eq, and }) => and(
            eq(sj.loanId, cb.loanId),
            eq(sj.jobType, 'BORROWER_CALLBACK'),
            eq(sj.dueAtUtc, cb.callbackScheduledDatetime)
          )
        });

        if (!existingJob) {
          await db.insert(scheduledJobs).values({
            jobType: 'BORROWER_CALLBACK',
            status: 'scheduled',
            loanId: cb.loanId,
            phoneNumberId: cb.phoneNumberId,
            dueAtUtc: cb.callbackScheduledDatetime,
            originalLocalDatetime: cb.callbackScheduledDatetime.toISOString(),
            originalTimezoneIana: cb.callbackTimezoneIana,
            scheduledBy: 'borrower_callback',
            notes: cb.humanReadableNote || 'Borrower requested callback'
          });
          console.log(`[CallbackPoller] Enqueued scheduled_job for callback on loan ${cb.loanId}`);
        }
      }
    } catch (err) {
      console.error('[CallbackPoller] Error:', err);
    }
  }, 30 * 1000); // Check every 30s
}

function startPtpMonitor() {
  setInterval(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      
      const overduePtps = await db.query.ptpCommitments.findMany({
        where: (ptp, { and, eq, lt }) => and(
          eq(ptp.status, 'pending'),
          lt(ptp.promisedDate, today)
        )
      });
      
      for (const ptp of overduePtps) {
        await db.update(ptpCommitments)
          .set({ status: 'missed' })
          .where(eq(ptpCommitments.id, ptp.id));
        console.log(`[PTPMonitor] Marked PTP ${ptp.id} as missed (was due ${ptp.promisedDate})`);
      }
    } catch (err) {
      console.error('[PTPMonitor] Error:', err);
    }
  }, 60 * 60 * 1000); // every hour
}

export function startJobs() {
  if (
    process.env.NODE_ENV === 'test' || 
    process.env.BUN_ENV === 'test' ||
    process.argv.some(a => a.toLowerCase().includes('test'))
  ) {
    // Tests manage job scheduler deterministically; do not run continuous background timers
    return;
  }
  console.log('[Jobs] Starting background job scheduler and durable worker...');
  DurableJobScheduler.start(15000); // Poll every 15 seconds
  startCallbackPoller();
  startPtpMonitor();
  console.log('[Jobs] Durable job scheduler, callback poller, and PTP monitor active.');
}

