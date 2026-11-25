import { db } from '../src/db/client';
import {
  loans,
  borrowers,
  phoneNumbers,
  campaigns,
  campaignMembers,
  campaignMembershipAudit,
  callAttempts,
  scheduledJobs,
  callOverrideAudits,
  servicingOutbox,
  dncRecords,
  v1Restrictions,
  callbacks,
  ptpCommitments,
  humanEscalations,
  smsMessages,
  providerWebhookEvents,
  stateChangeLog,
  eligibilityEvaluations,
  qaSimulationRuns
} from '../src/db/schema';
import { inArray } from 'drizzle-orm';

/**
 * Assert that the database URL points to an explicitly disposable test database.
 * Refuses destructive setup, cleanup, or broad mutations unless:
 * 1. The database name contains '_test', '_disposable', or 'tmp_test'.
 * 2. The database name is NOT 'delinquency_poc' (including URL-encoded variants, aliases, and query parameters).
 * 3. The test opt-in environment variable TEST_DISPOSABLE_DB_OPT_IN or ALLOW_TEST_DATABASE_RESET is set to 'true'.
 */
export function assertDisposableTestDatabase(databaseUrl?: string) {
  const rawUrl = databaseUrl || process.env.DATABASE_URL || '';
  if (!rawUrl) {
    throw new Error('SAFETY_VIOLATION: DATABASE_URL is not configured.');
  }

  // Decode URL components to prevent bypass via URL-encoding (e.g. %64elinquency_poc)
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(rawUrl);
  } catch {
    decodedUrl = rawUrl;
  }

  // Reject any appearance of delinquency_poc in any scheme, alias, path, or query
  const normalized = decodedUrl.toLowerCase().replace(/\\/g, '/');
  if (/[\/:@?&=](?:delinquency_poc)(?:[?\/&=]|$)/i.test(normalized) || normalized.includes('delinquency_poc')) {
    throw new Error('SAFETY_VIOLATION: Refusing to perform destructive operation on protected operational database "delinquency_poc".');
  }

  // Extract database name from URL
  let dbName = '';
  try {
    const parsed = new URL(rawUrl.startsWith('postgresql://') || rawUrl.startsWith('postgres://') ? rawUrl : `postgres://${rawUrl}`);
    dbName = decodeURIComponent(parsed.pathname.replace(/^\//, '')).split('?')[0].toLowerCase();
  } catch {
    const match = normalized.match(/\/([^\/?#]+)(?:\?.*)?$/);
    dbName = match ? match[1] : '';
  }

  // Verify database name matches approved disposable naming pattern
  const isApprovedDisposable = /(?:_test|_disposable|tmp_test)/i.test(dbName);
  if (!isApprovedDisposable) {
    throw new Error(`SAFETY_VIOLATION: Target database "${dbName}" is not an approved disposable test database pattern (*_test, *_disposable, tmp_test).`);
  }

  // Require explicit opt-in environment variable
  const optIn = process.env.TEST_DISPOSABLE_DB_OPT_IN === 'true' || process.env.ALLOW_TEST_DATABASE_RESET === 'true';
  if (!optIn) {
    throw new Error('SAFETY_VIOLATION: Destructive test operation refused without explicit TEST_DISPOSABLE_DB_OPT_IN=true or ALLOW_TEST_DATABASE_RESET=true.');
  }
}

export function assertNotProtectedDatabase(databaseUrl?: string) {
  assertDisposableTestDatabase(databaseUrl);
}

/**
 * Cleanly deletes all test-created loans and their child records in exact reverse foreign key order.
 */
export async function cleanupTestLoans(loanIds: string[], campaignIds: string[] = []) {
  if (loanIds.length === 0 && campaignIds.length === 0) return;

  if (loanIds.length > 0) {
    // 0. Find call attempt IDs associated with these loans
    const attempts = await db.query.callAttempts.findMany({
      where: (ca, { inArray: inArr }) => inArr(ca.loanId, loanIds)
    });
    const attemptIds = attempts.map(a => a.id);

    if (attemptIds.length > 0) {
      // Delete provider webhook events referencing these attempts
      await db.delete(providerWebhookEvents).where(inArray(providerWebhookEvents.associatedAttemptId, attemptIds));
    }

    // 1. Delete grandchild and outbox records
    await db.delete(servicingOutbox).where(inArray(servicingOutbox.loanId, loanIds));
    await db.delete(callOverrideAudits).where(inArray(callOverrideAudits.loanId, loanIds));
    await db.delete(stateChangeLog).where(inArray(stateChangeLog.loanId, loanIds));
    await db.delete(smsMessages).where(inArray(smsMessages.loanId, loanIds));
    await db.delete(scheduledJobs).where(inArray(scheduledJobs.loanId, loanIds));
    await db.delete(humanEscalations).where(inArray(humanEscalations.loanId, loanIds));
    await db.delete(callbacks).where(inArray(callbacks.loanId, loanIds));
    await db.delete(ptpCommitments).where(inArray(ptpCommitments.loanId, loanIds));
    await db.delete(dncRecords).where(inArray(dncRecords.loanId, loanIds));
    await db.delete(v1Restrictions).where(inArray(v1Restrictions.loanId, loanIds));
    await db.delete(campaignMembers).where(inArray(campaignMembers.loanId, loanIds));
    await db.delete(campaignMembershipAudit).where(inArray(campaignMembershipAudit.loanId, loanIds));
    await db.delete(qaSimulationRuns).where(inArray(qaSimulationRuns.loanId, loanIds));

    // 2. Delete call_attempts (after outbox, webhook events, override audits are gone)
    await db.delete(callAttempts).where(inArray(callAttempts.loanId, loanIds));

    // 3. Delete eligibility evaluations
    await db.delete(eligibilityEvaluations).where(inArray(eligibilityEvaluations.loanId, loanIds));

    // 4. Delete phone numbers and borrowers
    await db.delete(phoneNumbers).where(inArray(phoneNumbers.loanId, loanIds));
    await db.delete(borrowers).where(inArray(borrowers.loanId, loanIds));

    // 5. Delete loans
    await db.delete(loans).where(inArray(loans.id, loanIds));
  }

  // 6. Delete test campaigns if any
  if (campaignIds.length > 0) {
    await db.delete(eligibilityEvaluations).where(inArray(eligibilityEvaluations.campaignId, campaignIds));
    await db.delete(callAttempts).where(inArray(callAttempts.campaignId, campaignIds));
    await db.delete(scheduledJobs).where(inArray(scheduledJobs.campaignId, campaignIds));
    await db.delete(campaignMembers).where(inArray(campaignMembers.campaignId, campaignIds));
    await db.delete(campaignMembershipAudit).where(inArray(campaignMembershipAudit.campaignId, campaignIds));
    // Nullify campaign_id on any loans that still reference it
    await db.update(loans).set({ campaignId: null }).where(inArray(loans.campaignId, campaignIds));
    await db.delete(campaigns).where(inArray(campaigns.id, campaignIds));
  }
}
