import { db } from '../db/client';
import {
  campaigns,
  campaignMembers,
  campaignMembershipAudit,
  loans,
  borrowers,
  phoneNumbers,
  eligibilityEvaluations,
  callAttempts,
  ptpCommitments,
  callbacks,
  v1Restrictions,
  dncRecords,
  complianceEvents,
  humanEscalations,
  smsMessages,
  providerWebhookEvents,
  stateChangeLog,
  scheduledJobs,
  callOverrideAudits,
  servicingOutbox,
  qaScenarioBatches
} from '../db/schema';
import { sql } from 'drizzle-orm';

async function inspect() {
  const allLoans = await db.select().from(loans);
  const baselineLoans = allLoans.filter((l) => l.loanNumber.startsWith('LN-'));
  const synLoans = allLoans.filter((l) => l.loanNumber.startsWith('SYN-'));
  const otherLoans = allLoans.filter((l) => !l.loanNumber.startsWith('LN-') && !l.loanNumber.startsWith('SYN-'));

  const allBorrowers = await db.select().from(borrowers);
  const allPhones = await db.select().from(phoneNumbers);
  const allCampaigns = await db.select().from(campaigns);
  const allCampaignMembers = await db.select().from(campaignMembers);
  const allCampaignAudits = await db.select().from(campaignMembershipAudit);
  const allCallAttempts = await db.select().from(callAttempts);
  const allPtp = await db.select().from(ptpCommitments);
  const allCallbacks = await db.select().from(callbacks);
  const allV1 = await db.select().from(v1Restrictions);
  const allDnc = await db.select().from(dncRecords);
  const allComplianceEvents = await db.select().from(complianceEvents);
  const allHumanEscalations = await db.select().from(humanEscalations);
  const allSms = await db.select().from(smsMessages);
  const allWebhooks = await db.select().from(providerWebhookEvents);
  const allStateChanges = await db.select().from(stateChangeLog);
  const allJobs = await db.select().from(scheduledJobs);
  const allOverrides = await db.select().from(callOverrideAudits);
  const allOutbox = await db.select().from(servicingOutbox);
  const allQaBatches = await db.select().from(qaScenarioBatches);

  const report = {
    database: 'delinquency_poc (local PostgreSQL)',
    timestamp: new Date().toISOString(),
    counts: {
      loans: {
        total: allLoans.length,
        baseline_LN: baselineLoans.length,
        synthetic_SYN: synLoans.length,
        other: otherLoans.length
      },
      borrowers: allBorrowers.length,
      phone_numbers: allPhones.length,
      campaigns: allCampaigns.length,
      campaign_members: allCampaignMembers.length,
      campaign_membership_audit: allCampaignAudits.length,
      call_attempts: {
        total: allCallAttempts.length,
        hasCooldownFixture: allCallAttempts.some((c) => c.id === 'SEEDED_COOLDOWN_FIXTURE' || c.externalCallId === 'SEEDED_COOLDOWN_FIXTURE')
      },
      ptp_commitments: allPtp.length,
      callbacks: {
        total: allCallbacks.length,
        details: allCallbacks.map((cb) => ({
          id: cb.id,
          loanId: cb.loanId,
          reason: cb.reason,
          status: cb.status,
          sourceCallAttemptId: cb.sourceCallAttemptId
        }))
      },
      v1_restrictions: allV1.length,
      dnc_records: allDnc.length,
      compliance_events: allComplianceEvents.length,
      human_escalations: allHumanEscalations.length,
      sms_messages: allSms.length,
      provider_webhook_events: allWebhooks.length,
      state_change_log: allStateChanges.length,
      scheduled_jobs: allJobs.length,
      call_override_audits: allOverrides.length,
      servicing_outbox: allOutbox.length,
      qa_scenario_batches: allQaBatches.length
    }
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

inspect().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
