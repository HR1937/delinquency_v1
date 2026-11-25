import { db } from '../apps/backend/src/db/client';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== 1. CAMPAIGNS TABLE COLUMNS ===');
  const cols = await db.execute(sql`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'campaigns' 
    ORDER BY ordinal_position
  `);
  console.table(cols);

  console.log('=== 2. ALL CAMPAIGNS ROWS ===');
  const campRows = await db.execute(sql`SELECT * FROM campaigns ORDER BY created_at ASC`);
  console.log(campRows);

  console.log('=== 3. CAMPAIGN MEMBERS COUNT BY CAMPAIGN ===');
  const memberCounts = await db.execute(sql`
    SELECT c.id, c.name, COUNT(cm.id) as total_members,
           COUNT(CASE WHEN cm.status = 'active' THEN 1 END) as active_members,
           COUNT(CASE WHEN cm.status = 'paused' THEN 1 END) as paused_members,
           COUNT(CASE WHEN cm.status = 'removed' THEN 1 END) as removed_members
    FROM campaigns c
    LEFT JOIN campaign_members cm ON c.id = cm.campaign_id
    GROUP BY c.id, c.name
  `);
  console.table(memberCounts);

  console.log('=== 4. LOANS & PHONES OVERVIEW ===');
  const loansOverview = await db.execute(sql`
    SELECT COUNT(l.id) as total_loans,
           COUNT(CASE WHEN l.batch_id IS NULL AND l.loan_number NOT LIKE 'TEST-%' THEN 1 END) as baseline_loans,
           COUNT(CASE WHEN l.batch_id IS NOT NULL OR l.loan_number LIKE 'TEST-%' THEN 1 END) as qa_batch_loans
    FROM loans l
  `);
  console.table(loansOverview);

  console.log('=== 5. PHONE NUMBERS & TCPA CONSENT / VERIFICATION STATUS ===');
  const phonesSample = await db.execute(sql`
    SELECT p.id, p.loan_id, l.loan_number, p.phone_e164, p.line_type, p.tcpa_consent, p.is_dnc, p.is_verified, p.verified_at
    FROM phone_numbers p
    JOIN loans l ON p.loan_id = l.id
    ORDER BY l.loan_number ASC
    LIMIT 10
  `);
  console.table(phonesSample);

  console.log('=== 6. VERIFIED CALL DESTINATIONS ===');
  const vcd = await db.execute(sql`SELECT * FROM verified_call_destinations`);
  console.table(vcd);

  console.log('=== 7. QA ESCALATION RECIPIENTS ===');
  const qer = await db.execute(sql`SELECT * FROM qa_escalation_recipients`);
  console.table(qer);

  console.log('=== 8. QA BATCHES ===');
  const batches = await db.execute(sql`
    SELECT batch_id, COUNT(id) as count, MIN(created_at) as created_at 
    FROM loans 
    WHERE batch_id IS NOT NULL 
    GROUP BY batch_id
  `);
  console.table(batches);

  console.log('=== 9. QA SIMULATION RUNS ===');
  const simRuns = await db.execute(sql`
    SELECT id, loan_id, campaign_id, session_status, started_at, completed_at 
    FROM qa_simulation_runs 
    ORDER BY started_at DESC 
    LIMIT 5
  `);
  console.table(simRuns);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
