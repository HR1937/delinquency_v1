import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  time,
  jsonb,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── CAMPAIGNS ─────────────────────────────────────────────────────────────
export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  cohortLabel: text('cohort_label'),
  dpdMin: integer('dpd_min').notNull().default(1),
  dpdMax: integer('dpd_max').notNull().default(59),
  status: text('status').notNull().default('active'),
  maxAttempts: integer('max_attempts').notNull().default(3),
  dailyCap: integer('daily_cap').notNull().default(2),
  weeklyCap: integer('weekly_cap').notNull().default(6),
  cooldownHours: integer('cooldown_hours').notNull().default(4),
  callbackHorizonDays: integer('callback_horizon_days').notNull().default(7),
  fallbackThreshold: integer('fallback_threshold').notNull().default(3),
  isSeeded: boolean('is_seeded').notNull().default(false),
  qaDestinationE164: text('qa_destination_e164'),
  qaDestinationAuthorized: boolean('qa_destination_authorized').notNull().default(false),
  qaDestinationNotes: text('qa_destination_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ─── CAMPAIGN MEMBERS ──────────────────────────────────────────────────────
export const campaignMembers = pgTable('campaign_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  selectedPhoneNumberId: uuid('selected_phone_number_id'),
  status: text('status').notNull().default('active'), // active, paused, removed, completed
  addedReason: text('added_reason').default('cohort_filter'),
  nextContactAt: timestamp('next_contact_at', { withTimezone: true }),
  lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
  contactCadenceDays: integer('contact_cadence_days').notNull().default(3),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex('campaign_members_camp_loan_idx').on(table.campaignId, table.loanId),
  index('campaign_members_camp_idx').on(table.campaignId),
  index('campaign_members_loan_idx').on(table.loanId),
  index('campaign_members_next_contact_idx').on(table.nextContactAt)
]);

// ─── CAMPAIGN MEMBERSHIP AUDIT ─────────────────────────────────────────────
export const campaignMembershipAudit = pgTable('campaign_membership_audit', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  action: text('action').notNull(), // added, status_changed, phone_selected, removed
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),
  reason: text('reason'),
  performedBy: text('performed_by').notNull().default('system'),
  details: jsonb('details').default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('cma_camp_idx').on(table.campaignId),
  index('cma_loan_idx').on(table.loanId)
]);

// ─── LOANS ─────────────────────────────────────────────────────────────────
export const loans = pgTable('loans', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  loanNumber: text('loan_number').notNull().unique(),
  servicerId: text('servicer_id').notNull().default('SERVICER-01'),
  productType: text('product_type').default('Conventional 30Y Fixed'),
  interestRate: numeric('interest_rate', { precision: 6, scale: 4 }).default('0.0650'),
  upb: numeric('upb', { precision: 14, scale: 2 }).default('285000.00'),
  piPayment: numeric('pi_payment', { precision: 10, scale: 2 }).default('1801.40'),
  dpd: integer('dpd').notNull(),
  delinquencyBucket: text('delinquency_bucket').notNull(),
  pastDueAmount: numeric('past_due_amount', { precision: 10, scale: 2 }).notNull(),
  totalToCure: numeric('total_to_cure', { precision: 10, scale: 2 }).notNull(),
  lastPaymentDate: date('last_payment_date'),
  lastPaymentAmount: numeric('last_payment_amount', { precision: 10, scale: 2 }),
  nextDueDate: date('next_due_date'),
  escrowStatus: text('escrow_status'),
  autopayEnrolled: boolean('autopay_enrolled').default(false),
  recentNsf: boolean('recent_nsf').default(false),
  hardshipEligible: boolean('hardship_eligible').default(false),
  isBankrupt: boolean('is_bankrupt').notNull().default(false),
  isLitigation: boolean('is_litigation').notNull().default(false),
  isDeceased: boolean('is_deceased').notNull().default(false),
  hasLossMitigation: boolean('has_loss_mitigation').notNull().default(false),
  hasActiveDispute: boolean('has_active_dispute').notNull().default(false),
  isScra: boolean('is_scra').notNull().default(false),
  hasLegalTrigger: boolean('has_legal_trigger').notNull().default(false),
  priorityScore: numeric('priority_score', { precision: 5, scale: 2 }).default('50.00'),
  contactAttemptCount: integer('contact_attempt_count').notNull().default(0),
  lastContactDate: timestamp('last_contact_date', { withTimezone: true }),
  lastContactOutcome: text('last_contact_outcome'),
  rpcAchieved: boolean('rpc_achieved').default(false),
  isSeeded: boolean('is_seeded').notNull().default(false),
  batchId: text('batch_id'),
  scenarioType: text('scenario_type'),
  scenarioSimulatedAttemptAt: timestamp('scenario_simulated_attempt_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('loans_campaign_idx').on(table.campaignId),
  index('loans_dpd_idx').on(table.dpd),
  index('loans_batch_idx').on(table.batchId)
]);

// ─── BORROWERS ─────────────────────────────────────────────────────────────
export const borrowers = pgTable('borrowers', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  isPrimary: boolean('is_primary').notNull().default(true),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dob: date('dob'),
  addressLine1: text('address_line1'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  addressZip: text('address_zip'),
  preferredLanguage: text('preferred_language').notNull().default('en'),
  servicerReferenceNumber: text('servicer_reference_number'),
  isSeeded: boolean('is_seeded').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('borrowers_loan_idx').on(table.loanId)
]);

// ─── PHONE NUMBERS ─────────────────────────────────────────────────────────
export const phoneNumbers = pgTable('phone_numbers', {
  id: uuid('id').defaultRandom().primaryKey(),
  borrowerId: uuid('borrower_id').references(() => borrowers.id).notNull(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  phoneE164: text('phone_e164').notNull(),
  label: text('label').default('primary'),
  relationship: text('relationship').default('primary_borrower'),
  lineType: text('line_type').notNull().default('unknown'),
  isPrimary: boolean('is_primary').notNull().default(false),
  tcpaConsent: boolean('tcpa_consent'),
  tcpaConsentDate: timestamp('tcpa_consent_date', { withTimezone: true }),
  consentState: text('consent_state').default('UNKNOWN'),
  consentScope: text('consent_scope'),
  consentSource: text('consent_source'),
  consentEvidence: text('consent_evidence'),
  dnc: boolean('dnc').notNull().default(false),
  dncScope: text('dnc_scope'),
  dncSetAt: timestamp('dnc_set_at', { withTimezone: true }),
  dncSource: text('dnc_source'),
  timezoneIana: text('timezone_iana'),
  state: text('state'),
  preferredContactWindowStart: time('preferred_contact_window_start'),
  preferredContactWindowEnd: time('preferred_contact_window_end'),
  isHygieneVerified: boolean('is_hygiene_verified').default(false),
  hygieneCheckedAt: timestamp('hygiene_checked_at', { withTimezone: true }),
  isVerified: boolean('is_verified').notNull().default(false),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verificationNotes: text('verification_notes'),
  isTestDestination: boolean('is_test_destination').notNull().default(false),
  testRecipientAuthorized: boolean('test_recipient_authorized').notNull().default(false),
  testAttestationNotes: text('test_attestation_notes'),
  isActive: boolean('is_active').notNull().default(true),
  isSeeded: boolean('is_seeded').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex('phone_numbers_loan_e164_idx').on(table.loanId, table.phoneE164),
  index('phone_numbers_loan_idx').on(table.loanId)
]);

// ─── ELIGIBILITY EVALUATIONS ───────────────────────────────────────────────
export const eligibilityEvaluations = pgTable('eligibility_evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  phoneNumberId: uuid('phone_number_id').references(() => phoneNumbers.id),
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).defaultNow().notNull(),
  finalResult: text('final_result').notNull(),
  checkResults: jsonb('check_results').default(sql`'[]'::jsonb`).notNull(),
  c1CampaignScope: text('c1_campaign_scope'),
  c2aHardExclusion: text('c2a_hard_exclusion'),
  c2bLossMitigation: text('c2b_loss_mitigation'),
  c2cActiveDispute: text('c2c_active_dispute'),
  c3Dnc: text('c3_dnc'),
  c4PhoneHygiene: text('c4_phone_hygiene'),
  c5TcpaConsent: text('c5_tcpa_consent'),
  c6Timezone: text('c6_timezone'),
  c7CallingWindow: text('c7_calling_window'),
  c8Pcw: text('c8_pcw'),
  c9V1Restriction: text('c9_v1_restriction'),
  c10CooldownCaps: text('c10_cooldown_caps'),
  c11Callback: text('c11_callback'),
  c12Capacity: text('c12_capacity'),
  triggeredDial: boolean('triggered_dial').notNull().default(false),
  callAttemptId: uuid('call_attempt_id'),
  isSeeded: boolean('is_seeded').notNull().default(false)
}, (table) => [
  index('ee_loan_idx').on(table.loanId),
  index('ee_final_result_idx').on(table.finalResult)
]);

// ─── CALL ATTEMPTS ─────────────────────────────────────────────────────────
export const callAttempts = pgTable('call_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  borrowerId: uuid('borrower_id').references(() => borrowers.id),
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  eligibilityEvalId: uuid('eligibility_eval_id').references(() => eligibilityEvaluations.id),
  phoneNumberId: uuid('phone_number_id').references(() => phoneNumbers.id),
  referenceNumber: text('reference_number').notNull().unique(),
  vapiCallId: text('vapi_call_id'),
  twilioCallSid: text('twilio_call_sid'),
  voicePlatformCallId: text('voice_platform_call_id'),
  initiatedAt: timestamp('initiated_at', { withTimezone: true }).defaultNow().notNull(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSeconds: integer('duration_seconds'),
  callStatus: text('call_status').notNull().default('initiated'),
  disposition: text('disposition'),
  isRightPartyContact: boolean('is_right_party_contact'),
  identityVerificationMethod: text('identity_verification_method'),
  identityVerificationStatus: text('identity_verification_status').default('not_attempted'),
  identityVerificationAttempts: integer('identity_verification_attempts').default(0),
  recordingDisclosureGiven: boolean('recording_disclosure_given'),
  aiDisclosureGiven: boolean('ai_disclosure_given'),
  requiredDisclosureGiven: boolean('required_disclosure_given'),
  transcriptUrl: text('transcript_url'),
  recordingUrl: text('recording_url'),
  transcriptText: text('transcript_text'),
  sentiment: text('sentiment'),
  borrowerStatedReason: text('borrower_stated_reason'),
  structuredOutcome: jsonb('structured_outcome'),
  complianceFlags: jsonb('compliance_flags').default(sql`'[]'::jsonb`).notNull(),
  humanReviewRequired: boolean('human_review_required').notNull().default(false),
  humanReviewReason: text('human_review_reason'),
  isTechnicalFailure: boolean('is_technical_failure').notNull().default(false),
  failureDetail: text('failure_detail'),
  callMode: text('call_mode').notNull().default('NORMAL_DIAL'), // NORMAL_DIAL, DIRECT_TEST_OVERRIDE, SIMULATED_TEST_OVERRIDE, SCHEDULED_DIAL
  initiationSource: text('initiation_source').notNull().default('OPERATOR'), // OPERATOR, SCHEDULER, CALLBACK_POLLER, TEST_OVERRIDE
  dialedPhoneE164: text('dialed_phone_e164'),
  selectedPhoneSnapshot: jsonb('selected_phone_snapshot'),
  isSeeded: boolean('is_seeded').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('ca_loan_idx').on(table.loanId)
]);

// ─── PTP COMMITMENTS ───────────────────────────────────────────────────────
export const ptpCommitments = pgTable('ptp_commitments', {
  id: uuid('id').defaultRandom().primaryKey(),
  callAttemptId: uuid('call_attempt_id').references(() => callAttempts.id).notNull(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  promisedDate: date('promised_date').notNull(),
  status: text('status').notNull().default('pending'),
  paymentConfirmedAt: timestamp('payment_confirmed_at', { withTimezone: true }),
  paymentConfirmationSource: text('payment_confirmation_source'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ─── CALLBACKS ─────────────────────────────────────────────────────────────
export const callbacks = pgTable('callbacks', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  phoneNumberId: uuid('phone_number_id').references(() => phoneNumbers.id),
  sourceCallAttemptId: uuid('source_call_attempt_id').references(() => callAttempts.id),
  sourceType: text('source_type').notNull().default('BORROWER_REQUEST_FROM_REAL_CALL'), // BORROWER_REQUEST_FROM_REAL_CALL, OPERATOR_FOLLOWUP, QA_SCENARIO
  callbackRequestedAt: timestamp('callback_requested_at', { withTimezone: true }).notNull(),
  callbackScheduledDatetime: timestamp('callback_scheduled_datetime', { withTimezone: true }).notNull(),
  callbackTimezoneIana: text('callback_timezone_iana').notNull(),
  isOneTime: boolean('is_one_time').default(true),
  humanReadableNote: text('human_readable_note'),
  status: text('status').notNull().default('scheduled'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('cb_loan_status_idx').on(table.loanId, table.status),
  index('cb_source_type_idx').on(table.sourceType)
]);

// ─── V1 RESTRICTIONS ───────────────────────────────────────────────────────
export const v1Restrictions = pgTable('v1_restrictions', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  phoneNumberId: uuid('phone_number_id').references(() => phoneNumbers.id),
  sourceCallAttemptId: uuid('source_call_attempt_id').references(() => callAttempts.id),
  restrictionType: text('restriction_type').notNull(),
  restrictionStart: timestamp('restriction_start', { withTimezone: true }),
  restrictionEnd: timestamp('restriction_end', { withTimezone: true }),
  dayOfWeek: jsonb('day_of_week').default(sql`'[]'::jsonb`),
  timeStart: time('time_start'),
  timeEnd: time('time_end'),
  timezoneIana: text('timezone_iana').notNull(),
  isRecurring: boolean('is_recurring').default(false),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
  humanReadableNote: text('human_readable_note').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('v1_loan_idx').on(table.loanId)
]);

// ─── DNC RECORDS ───────────────────────────────────────────────────────────
export const dncRecords = pgTable('dnc_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  phoneNumberId: uuid('phone_number_id').references(() => phoneNumbers.id),
  scope: text('scope').notNull(),
  source: text('source').notNull().default('borrower_request'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  sourceCallAttemptId: uuid('source_call_attempt_id').references(() => callAttempts.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('dnc_loan_idx').on(table.loanId)
]);

// ─── COMPLIANCE EVENTS ─────────────────────────────────────────────────────
export const complianceEvents = pgTable('compliance_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  callAttemptId: uuid('call_attempt_id').references(() => callAttempts.id),
  eventType: text('event_type').notNull(),
  details: jsonb('details').default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// ─── HUMAN ESCALATIONS ─────────────────────────────────────────────────────
export const humanEscalations = pgTable('human_escalations', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  callAttemptId: uuid('call_attempt_id').references(() => callAttempts.id),
  reason: text('reason').notNull(),
  priority: integer('priority').notNull().default(5),
  status: text('status').notNull().default('pending'),
  assignedTo: text('assigned_to'),
  notes: text('notes'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('he_status_priority_idx').on(table.status, table.priority)
]);

// ─── SMS MESSAGES ──────────────────────────────────────────────────────────
export const smsMessages = pgTable('sms_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id),
  callAttemptId: uuid('call_attempt_id').references(() => callAttempts.id),
  twilioMessageSid: text('twilio_message_sid').unique(),
  fromNumber: text('from_number').notNull(),
  toNumberMasked: text('to_number_masked').notNull(),
  messageType: text('message_type').notNull(),
  status: text('status').notNull().default('queued'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// ─── WEBHOOK EVENTS ────────────────────────────────────────────────────────
export const providerWebhookEvents = pgTable('provider_webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: text('provider').notNull(),
  eventType: text('event_type').notNull(),
  externalId: text('external_id').notNull().unique(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  isDuplicate: boolean('is_duplicate').notNull().default(false),
  payloadHash: text('payload_hash').notNull(),
  rawPayload: jsonb('raw_payload').notNull(),
  associatedAttemptId: uuid('associated_attempt_id').references(() => callAttempts.id)
});

// ─── STATE CHANGE LOG ──────────────────────────────────────────────────────
export const stateChangeLog = pgTable('state_change_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id').references(() => loans.id),
  callAttemptId: uuid('call_attempt_id').references(() => callAttempts.id),
  fieldName: text('field_name').notNull(),
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value').notNull(),
  reason: text('reason'),
  sourceOfChange: text('source_of_change').default('manual_operator'),
  phoneNumberId: uuid('phone_number_id').references(() => phoneNumbers.id),
  borrowerId: uuid('borrower_id').references(() => borrowers.id),
  sessionId: text('session_id'),
  changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  changedBy: text('changed_by').notNull().default('system')
}, (table) => [
  index('scl_loan_idx').on(table.loanId),
  index('scl_attempt_idx').on(table.callAttemptId),
  index('scl_session_idx').on(table.sessionId)
]);

// ─── CONVERSATION SESSIONS (PERSISTENT VAPI VOICE HISTORY) ─────────────────
export const conversationSessions = pgTable('conversation_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: text('session_id').notNull().unique(), // e.g. SESS-20261123-XXXX
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  borrowerId: uuid('borrower_id').references(() => borrowers.id),
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  phoneNumberId: uuid('phone_number_id').references(() => phoneNumbers.id),
  transportType: text('transport_type').notNull().default('BROWSER_WEBRTC'), // BROWSER_WEBRTC, PSTN
  vapiCallId: text('vapi_call_id'),
  sessionStatus: text('session_status').notNull().default('connecting'), // connecting, connected, in_progress, completed, failed
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSeconds: integer('duration_seconds').default(0),
  transcript: jsonb('transcript').default(sql`'[]'::jsonb`).notNull(),
  toolInvocations: jsonb('tool_invocations').default(sql`'[]'::jsonb`).notNull(),
  recordingUrl: text('recording_url'),
  endOfCallReport: jsonb('end_of_call_report'),
  structuredDisposition: text('structured_disposition'),
  dispositionNotes: text('disposition_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('cs_loan_idx').on(table.loanId),
  index('cs_campaign_idx').on(table.campaignId),
  index('cs_vapi_idx').on(table.vapiCallId),
  index('cs_started_idx').on(table.startedAt)
]);

// ─── SCHEDULED JOBS ────────────────────────────────────────────────────────
export const scheduledJobs = pgTable('scheduled_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobType: text('job_type').notNull(), // CAMPAIGN_RUN, OPERATOR_SCHEDULED, BORROWER_CALLBACK
  status: text('status').notNull().default('scheduled'), // scheduled, claimed, running, dispatched, blocked_at_execution, provider_failed, completed, cancelled, dispatch_blocked_phase3, dispatch_blocked_phase4
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  phoneNumberId: uuid('phone_number_id').references(() => phoneNumbers.id),
  dueAtUtc: timestamp('due_at_utc', { withTimezone: true }).notNull(),
  originalLocalDatetime: text('original_local_datetime'),
  originalTimezoneIana: text('original_timezone_iana'),
  scheduledBy: text('scheduled_by').notNull().default('system'), // operator_username, borrower_callback, campaign_automation
  notes: text('notes'),
  sourceCallAttemptId: uuid('source_call_attempt_id').references(() => callAttempts.id),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  claimedByWorker: text('claimed_by_worker'),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  blockedAtExecutionReason: text('blocked_at_execution_reason'),
  lastEvaluationSnapshot: jsonb('last_evaluation_snapshot'),
  resultingCallAttemptId: uuid('resulting_call_attempt_id').references(() => callAttempts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('sj_status_due_idx').on(table.status, table.dueAtUtc),
  index('sj_loan_idx').on(table.loanId),
  index('sj_lease_idx').on(table.leaseExpiresAt)
]);

// ─── CALL OVERRIDE AUDIT ───────────────────────────────────────────────────
export const callOverrideAudits = pgTable('call_override_audits', {
  id: uuid('id').defaultRandom().primaryKey(),
  originalEvalId: uuid('original_eval_id').references(() => eligibilityEvaluations.id),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  phoneNumberId: uuid('phone_number_id').references(() => phoneNumbers.id),
  destinationE164: text('destination_e164').notNull(),
  callMode: text('call_mode').notNull(), // DIRECT_TEST_OVERRIDE, SIMULATED_TEST_OVERRIDE
  failedGates: jsonb('failed_gates').notNull(), // array of failed gate codes and reasons
  operatorIdentity: text('operator_identity').notNull(),
  overrideReason: text('override_reason').notNull(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }).notNull(),
  vapiCallId: text('vapi_call_id'),
  twilioCallSid: text('twilio_call_sid'),
  callAttemptId: uuid('call_attempt_id').references(() => callAttempts.id),
  finalResult: text('final_result').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('coa_loan_idx').on(table.loanId),
  index('coa_eval_idx').on(table.originalEvalId)
]);

// ─── SERVICING OUTBOX (LOCAL POC ADAPTER) ──────────────────────────────────
export const servicingOutbox = pgTable('servicing_outbox', {
  id: uuid('id').defaultRandom().primaryKey(),
  callAttemptId: uuid('call_attempt_id').references(() => callAttempts.id).notNull(),
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  referenceNumber: text('reference_number').notNull(),
  adapterTarget: text('adapter_target').notNull().default('LOCAL_POC_ADAPTER'),
  payloadSchemaVersion: text('payload_schema_version').notNull().default('1.0.0'),
  payload: jsonb('payload').notNull(),
  validationStatus: text('validation_status').notNull().default('valid'), // valid, invalid
  commitStatus: text('commit_status').notNull().default('committed'), // committed, pending, failed
  deliveryStatus: text('delivery_status').notNull().default('delivered_local'), // delivered_local, synced_external, failed
  retryCount: integer('retry_count').notNull().default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('so_loan_idx').on(table.loanId),
  index('so_attempt_idx').on(table.callAttemptId)
]);

// ─── QA SCENARIO BATCHES ────────────────────────────────────────────────────
export const qaScenarioBatches = pgTable('qa_scenario_batches', {
  id: text('id').primaryKey(),
  scenarioTypes: jsonb('scenario_types').notNull().default(sql`'[]'::jsonb`),
  accountCount: integer('account_count').notNull().default(0),
  status: text('status').notNull().default('active'), // active, archived, removed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').notNull().default('operator')
}, (table) => [
  index('qsb_status_idx').on(table.status)
]);

// ─── QA SIMULATION RUNS (ISOLATED WORKFLOW RUNS) ───────────────────────────
export const qaSimulationRuns = pgTable('qa_simulation_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: text('run_id').notNull().unique(), // SIM-YYYYMMDD-XXXX
  loanId: uuid('loan_id').references(() => loans.id).notNull(),
  phoneNumberId: uuid('phone_number_id').references(() => phoneNumbers.id),
  selectedOutcome: text('selected_outcome').notNull(),
  status: text('status').notNull().default('completed'), // completed, blocked, error
  gatePassed: boolean('gate_passed').notNull(),
  gateResults: jsonb('gate_results').notNull().default(sql`'[]'::jsonb`),
  allBlockingReasons: jsonb('all_blocking_reasons').notNull().default(sql`'[]'::jsonb`),
  normalizedDisposition: text('normalized_disposition'),
  simulationBanner: text('simulation_banner').notNull().default('SIMULATION — NO PHONE CALL OR SMS WAS SENT'),
  derivedActions: jsonb('derived_actions').notNull().default(sql`'{}'::jsonb`),
  executionTimeline: jsonb('execution_timeline').notNull().default(sql`'[]'::jsonb`),
  zeroNetworkCallsVerified: boolean('zero_network_calls_verified').notNull().default(true),
  simulatedTranscript: text('simulated_transcript'),
  simulatedBy: text('simulated_by').notNull().default('operator'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('qsr_loan_idx').on(table.loanId),
  index('qsr_created_idx').on(table.createdAt)
]);

// ─── OPERATOR SESSIONS (LOCAL OPERATOR AUTHENTICATION) ───────────────────────
export const operatorSessions = pgTable('operator_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  token: text('token').notNull().unique(),
  operatorUsername: text('operator_username').notNull(),
  role: text('role').notNull().default('operator'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('ops_token_idx').on(table.token)
]);

// ─── OPERATIONAL SETTINGS (SIDEBAR RUNTIME CONTROLS) ─────────────────────────
export const operationalSettings = pgTable('operational_settings', {
  id: text('id').primaryKey().default('default'),
  voiceMode: text('voice_mode').notNull().default('BROWSER_TESTING'), // 'OFF' | 'BROWSER_TESTING' | 'OUTBOUND_CALLS'
  smsEnabled: boolean('sms_enabled').notNull().default(false),
  campaignAutodispatchEnabled: boolean('campaign_autodispatch_enabled').notNull().default(false),
  qaActiveBorrowerRole: text('qa_active_borrower_role').notNull().default('AGENT_A'), // 'AGENT_A' | 'AGENT_B'
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text('updated_by').notNull().default('operator')
});

// QA ESCALATION RECIPIENTS (SUPERVISED TESTING)
export const qaEscalationRecipients = pgTable('qa_escalation_recipients', {
  id: uuid('id').defaultRandom().primaryKey(),
  agentKey: text('agent_key').notNull().unique(), // 'AGENT_A', 'AGENT_B'
  displayName: text('display_name').notNull(), // 'QA Test Agent A', 'QA Test Agent B'
  phoneE164: text('phone_e164').notNull(),
  phoneMasked: text('phone_masked').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('qer_agent_idx').on(table.agentKey),
  index('qer_active_idx').on(table.isActive)
]);

// ─── OWNER-ATTESTED VERIFIED CALL DESTINATIONS ──────────────────────────────
export const verifiedCallDestinations = pgTable('verified_call_destinations', {
  id: uuid('id').defaultRandom().primaryKey(),
  phoneE164: text('phone_e164').notNull().unique(),
  label: text('label'),
  status: text('status').notNull().default('active'), // 'active' | 'revoked'
  approvalSource: text('approval_source').notNull().default('owner_attestation'),
  approvedBy: text('approved_by').notNull().default('owner'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('vcd_phone_idx').on(table.phoneE164),
  index('vcd_status_idx').on(table.status)
]);



