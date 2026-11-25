import { db } from './client';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Running safe incremental migration...');
  await db.execute(sql`
    -- 1. Campaign Members
    CREATE TABLE IF NOT EXISTS campaign_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES campaigns(id),
      loan_id UUID NOT NULL REFERENCES loans(id),
      selected_phone_number_id UUID REFERENCES phone_numbers(id),
      status TEXT NOT NULL DEFAULT 'active',
      added_reason TEXT DEFAULT 'cohort_filter',
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT campaign_members_camp_loan_uniq UNIQUE (campaign_id, loan_id)
    );
    CREATE INDEX IF NOT EXISTS cm_camp_idx ON campaign_members(campaign_id);
    CREATE INDEX IF NOT EXISTS cm_loan_idx ON campaign_members(loan_id);

    -- 2. Campaign Membership Audit
    CREATE TABLE IF NOT EXISTS campaign_membership_audit (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES campaigns(id),
      loan_id UUID NOT NULL REFERENCES loans(id),
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      reason TEXT,
      performed_by TEXT NOT NULL DEFAULT 'system',
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS cma_camp_idx ON campaign_membership_audit(campaign_id);
    CREATE INDEX IF NOT EXISTS cma_loan_idx ON campaign_membership_audit(loan_id);

    -- 3. Alter phone_numbers columns
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'primary';
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS relationship TEXT DEFAULT 'primary_borrower';
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS consent_state TEXT DEFAULT 'UNKNOWN';
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS consent_scope TEXT;
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS consent_source TEXT;
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS consent_evidence TEXT;
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS is_test_destination BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS test_recipient_authorized BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS test_attestation_notes TEXT;

    -- 4. Alter loans.campaign_id to allow NULL
    ALTER TABLE loans ALTER COLUMN campaign_id DROP NOT NULL;

    -- 5. Backfill campaign_members from loans where campaign_id is not null
    INSERT INTO campaign_members (campaign_id, loan_id, status, added_reason)
    SELECT l.campaign_id, l.id, 'active', 'initial_migration'
    FROM loans l
    WHERE l.campaign_id IS NOT NULL
    ON CONFLICT (campaign_id, loan_id) DO NOTHING;

    -- 6. Backfill selected_phone_number_id in campaign_members with primary phone
    UPDATE campaign_members cm
    SET selected_phone_number_id = p.id
    FROM phone_numbers p
    WHERE p.loan_id = cm.loan_id AND p.is_primary = true AND cm.selected_phone_number_id IS NULL;

    -- 7. Call Attempts Part 2 columns
    ALTER TABLE call_attempts ADD COLUMN IF NOT EXISTS call_mode TEXT NOT NULL DEFAULT 'NORMAL_DIAL';
    ALTER TABLE call_attempts ADD COLUMN IF NOT EXISTS initiation_source TEXT NOT NULL DEFAULT 'OPERATOR';
    ALTER TABLE call_attempts ADD COLUMN IF NOT EXISTS dialed_phone_e164 TEXT;
    ALTER TABLE call_attempts ADD COLUMN IF NOT EXISTS selected_phone_snapshot JSONB;

    -- 8. Scheduled Jobs
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      campaign_id UUID REFERENCES campaigns(id),
      loan_id UUID NOT NULL REFERENCES loans(id),
      phone_number_id UUID REFERENCES phone_numbers(id),
      due_at_utc TIMESTAMPTZ NOT NULL,
      original_local_datetime TEXT,
      original_timezone_iana TEXT,
      scheduled_by TEXT NOT NULL DEFAULT 'system',
      notes TEXT,
      source_call_attempt_id UUID REFERENCES call_attempts(id),
      claimed_at TIMESTAMPTZ,
      claimed_by_worker TEXT,
      dispatched_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      blocked_at_execution_reason TEXT,
      last_evaluation_snapshot JSONB,
      resulting_call_attempt_id UUID REFERENCES call_attempts(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS sj_status_due_idx ON scheduled_jobs(status, due_at_utc);
    CREATE INDEX IF NOT EXISTS sj_loan_idx ON scheduled_jobs(loan_id);

    -- 9. Call Override Audits
    CREATE TABLE IF NOT EXISTS call_override_audits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      original_eval_id UUID REFERENCES eligibility_evaluations(id),
      loan_id UUID NOT NULL REFERENCES loans(id),
      phone_number_id UUID REFERENCES phone_numbers(id),
      destination_e164 TEXT NOT NULL,
      call_mode TEXT NOT NULL,
      failed_gates JSONB NOT NULL,
      operator_identity TEXT NOT NULL,
      override_reason TEXT NOT NULL,
      acknowledged_at TIMESTAMPTZ NOT NULL,
      vapi_call_id TEXT,
      twilio_call_sid TEXT,
      call_attempt_id UUID REFERENCES call_attempts(id),
      final_result TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS coa_loan_idx ON call_override_audits(loan_id);
    CREATE INDEX IF NOT EXISTS coa_eval_idx ON call_override_audits(original_eval_id);

    -- 10. Servicing Outbox
    CREATE TABLE IF NOT EXISTS servicing_outbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      call_attempt_id UUID NOT NULL REFERENCES call_attempts(id),
      loan_id UUID NOT NULL REFERENCES loans(id),
      reference_number TEXT NOT NULL,
      adapter_target TEXT NOT NULL DEFAULT 'LOCAL_POC_ADAPTER',
      payload_schema_version TEXT NOT NULL DEFAULT '1.0.0',
      payload JSONB NOT NULL,
      validation_status TEXT NOT NULL DEFAULT 'valid',
      commit_status TEXT NOT NULL DEFAULT 'committed',
      delivery_status TEXT NOT NULL DEFAULT 'delivered_local',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS so_loan_idx ON servicing_outbox(loan_id);
    CREATE INDEX IF NOT EXISTS so_attempt_idx ON servicing_outbox(call_attempt_id);

    -- 11. Alter sms_messages.loan_id to allow NULL for standalone system diagnostic messages
    ALTER TABLE sms_messages ALTER COLUMN loan_id DROP NOT NULL;

    -- 12. Campaign-level QA destination configuration
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS qa_destination_e164 TEXT;
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS qa_destination_authorized BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS qa_destination_notes TEXT;

    -- 13. QA Scenario Batches and Loan Batch Tracking
    CREATE TABLE IF NOT EXISTS qa_scenario_batches (
      id TEXT PRIMARY KEY,
      scenario_types JSONB NOT NULL DEFAULT '[]'::jsonb,
      account_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT NOT NULL DEFAULT 'operator'
    );
    CREATE INDEX IF NOT EXISTS qsb_status_idx ON qa_scenario_batches(status);

    ALTER TABLE loans ADD COLUMN IF NOT EXISTS batch_id TEXT;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS scenario_type TEXT;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS scenario_simulated_attempt_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS loans_batch_idx ON loans(batch_id);

    -- 14. Callbacks source_type column & deterministic backfill
    ALTER TABLE callbacks ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'BORROWER_REQUEST_FROM_REAL_CALL';
    CREATE INDEX IF NOT EXISTS cb_source_type_idx ON callbacks(source_type);

    -- Deterministic backfill:
    -- If source_call_attempt_id IS NOT NULL -> BORROWER_REQUEST_FROM_REAL_CALL
    -- If loan is LN-100018 or loan is_seeded = true and source_call_attempt_id IS NULL -> QA_SCENARIO
    -- Else -> OPERATOR_FOLLOWUP
    UPDATE callbacks
    SET source_type = CASE
      WHEN source_call_attempt_id IS NOT NULL THEN 'BORROWER_REQUEST_FROM_REAL_CALL'
      WHEN loan_id IN (SELECT id FROM loans WHERE loan_number = 'LN-100018' OR (is_seeded = true AND loan_number LIKE 'LN-%')) THEN 'QA_SCENARIO'
      ELSE 'OPERATOR_FOLLOWUP'
    END;

    -- 15. Scheduled jobs leasing & retry columns
    ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
    ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3;
    CREATE INDEX IF NOT EXISTS sj_lease_idx ON scheduled_jobs(lease_expires_at);

    -- 16. Webhook events unique external_id constraint
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'provider_webhook_events_external_id_unique'
      ) THEN
        ALTER TABLE provider_webhook_events ADD CONSTRAINT provider_webhook_events_external_id_unique UNIQUE (external_id);
      END IF;
    EXCEPTION
      WHEN others THEN NULL;
    END $$;

    -- 17. QA Simulation Runs
    CREATE TABLE IF NOT EXISTS qa_simulation_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id TEXT NOT NULL UNIQUE,
      loan_id UUID NOT NULL REFERENCES loans(id),
      phone_number_id UUID REFERENCES phone_numbers(id),
      selected_outcome TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      gate_passed BOOLEAN NOT NULL,
      gate_results JSONB NOT NULL DEFAULT '[]'::jsonb,
      all_blocking_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
      normalized_disposition TEXT,
      simulation_banner TEXT NOT NULL DEFAULT 'SIMULATION — NO PHONE CALL OR SMS WAS SENT',
      derived_actions JSONB NOT NULL DEFAULT '{}'::jsonb,
      execution_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
      zero_network_calls_verified BOOLEAN NOT NULL DEFAULT true,
      simulated_transcript TEXT,
      simulated_by TEXT NOT NULL DEFAULT 'operator',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS qsr_loan_idx ON qa_simulation_runs(loan_id);
    CREATE INDEX IF NOT EXISTS qsr_created_idx ON qa_simulation_runs(created_at);

    -- 18. Operator Sessions (Local Auth)
    CREATE TABLE IF NOT EXISTS operator_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token TEXT NOT NULL UNIQUE,
      operator_username TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ops_token_idx ON operator_sessions(token);

    -- 19. Operational Settings (Sidebar Controls)
    CREATE TABLE IF NOT EXISTS operational_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      voice_mode TEXT NOT NULL DEFAULT 'BROWSER_TESTING',
      sms_enabled BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by TEXT NOT NULL DEFAULT 'operator'
    );
    INSERT INTO operational_settings (id, voice_mode, sms_enabled)
    VALUES ('default', 'BROWSER_TESTING', false)
    ON CONFLICT (id) DO NOTHING;

    -- Allow system-level audit events in state_change_log without a loan_id
    ALTER TABLE state_change_log ALTER COLUMN loan_id DROP NOT NULL;

    -- 20. Verified Call Destinations & Operational Settings Enhancements
    ALTER TABLE operational_settings ADD COLUMN IF NOT EXISTS campaign_autodispatch_enabled BOOLEAN NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS verified_call_destinations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_e164 TEXT NOT NULL UNIQUE,
      label TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      approval_source TEXT NOT NULL DEFAULT 'owner_attestation',
      approved_by TEXT NOT NULL DEFAULT 'owner',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS vcd_phone_idx ON verified_call_destinations (phone_e164);
    CREATE INDEX IF NOT EXISTS vcd_status_idx ON verified_call_destinations (status);

    -- 21. Campaign Contact Scheduling & QA Escalation Recipients
    ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS next_contact_at TIMESTAMPTZ;
    ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
    ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS contact_cadence_days INTEGER NOT NULL DEFAULT 3;
    CREATE INDEX IF NOT EXISTS cm_next_contact_idx ON campaign_members (next_contact_at);

    -- Populate initial contact schedule for active campaign members if not set
    UPDATE campaign_members
    SET next_contact_at = added_at
    WHERE next_contact_at IS NULL AND status = 'active';

    ALTER TABLE operational_settings ADD COLUMN IF NOT EXISTS qa_active_borrower_role TEXT NOT NULL DEFAULT 'AGENT_A';

    CREATE TABLE IF NOT EXISTS qa_escalation_recipients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_key TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      phone_e164 TEXT NOT NULL,
      phone_masked TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS qer_agent_idx ON qa_escalation_recipients (agent_key);
    CREATE INDEX IF NOT EXISTS qer_active_idx ON qa_escalation_recipients (is_active);

    -- Insert the owner-approved human escalation contacts
    INSERT INTO qa_escalation_recipients (agent_key, display_name, phone_e164, phone_masked, is_active, notes)
    VALUES
      ('AGENT_A', 'Escalation Contact 1', '+919328234331', '+91 (***) ***-4331', true, 'Primary servicing escalation contact'),
      ('AGENT_B', 'Escalation Contact 2', '+916353191726', '+91 (***) ***-1726', true, 'Secondary servicing escalation contact'),
      ('CONTACT_3', 'Escalation Contact 3', '+919909662663', '+91 (***) ***-2663', true, 'Servicing escalation contact')
    ON CONFLICT (agent_key) DO UPDATE SET
      phone_e164 = EXCLUDED.phone_e164,
      phone_masked = EXCLUDED.phone_masked,
      display_name = EXCLUDED.display_name,
      notes = EXCLUDED.notes;
    -- 22. Conversation Sessions (Persistent Vapi Voice History)
    CREATE TABLE IF NOT EXISTS conversation_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id TEXT NOT NULL UNIQUE,
      loan_id UUID NOT NULL REFERENCES loans(id),
      borrower_id UUID REFERENCES borrowers(id),
      campaign_id UUID REFERENCES campaigns(id),
      phone_number_id UUID REFERENCES phone_numbers(id),
      transport_type TEXT NOT NULL DEFAULT 'BROWSER_WEBRTC',
      vapi_call_id TEXT,
      session_status TEXT NOT NULL DEFAULT 'connecting',
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ended_at TIMESTAMPTZ,
      duration_seconds INTEGER DEFAULT 0,
      transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
      tool_invocations JSONB NOT NULL DEFAULT '[]'::jsonb,
      recording_url TEXT,
      end_of_call_report JSONB,
      structured_disposition TEXT,
      disposition_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS cs_loan_idx ON conversation_sessions (loan_id);
    CREATE INDEX IF NOT EXISTS cs_campaign_idx ON conversation_sessions (campaign_id);
    CREATE INDEX IF NOT EXISTS cs_vapi_idx ON conversation_sessions (vapi_call_id);
    CREATE INDEX IF NOT EXISTS cs_started_idx ON conversation_sessions (started_at);

    -- 23. State Change Log Auditing Enhancements
    ALTER TABLE state_change_log ADD COLUMN IF NOT EXISTS reason TEXT;
    ALTER TABLE state_change_log ADD COLUMN IF NOT EXISTS source_of_change TEXT DEFAULT 'manual_operator';
    ALTER TABLE state_change_log ADD COLUMN IF NOT EXISTS phone_number_id UUID;
    ALTER TABLE state_change_log ADD COLUMN IF NOT EXISTS borrower_id UUID;
    ALTER TABLE state_change_log ADD COLUMN IF NOT EXISTS session_id TEXT;
    CREATE INDEX IF NOT EXISTS scl_session_idx ON state_change_log (session_id);

    -- 24. Reconcile Exactly Three Operational Campaigns & Consent Status
    UPDATE campaigns SET status = 'archived' WHERE name IN ('first-1 ', 'Supervised QA Test Campaign');
    UPDATE campaigns SET 
      name = 'Verified Contacts',
      description = 'Delinquency servicing outreach for borrowers with verified contact numbers across 1–59 DPD.',
      cohort_label = 'Verified Contacts',
      dpd_min = 1,
      dpd_max = 59,
      status = 'active',
      updated_at = NOW()
    WHERE name IN ('Verified Contact Test Campaign', 'Verified Contacts');

    UPDATE phone_numbers SET consent_state = 'GRANTED' WHERE tcpa_consent = true AND (consent_state IS NULL OR consent_state = 'UNKNOWN');
    UPDATE phone_numbers SET consent_state = 'MISSING' WHERE tcpa_consent = false AND (consent_state IS NULL OR consent_state = 'UNKNOWN');

    -- 25. Internal Team Contact Verification (Real Team-Verified Numbers)
    -- Columns added to support explicit operator-confirmed contact verification.
    -- is_verified must be set explicitly by an operator through the UI; it is NOT auto-populated
    -- from hygiene checks or any other automated source.
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS verified_by TEXT;
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS verification_notes TEXT;
  `);

  console.log('Safe incremental migration completed successfully!');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
