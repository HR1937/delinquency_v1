import postgres from 'postgres';

async function main() {
  const sql = postgres('postgresql://postgres:1937@localhost:5432/delinquency_poc');

  console.log('--- RECONCILING CAMPAIGNS IN delinquency_poc ---');
  
  // 1. Archive first-1 and Supervised QA Test Campaign
  await sql`
    UPDATE campaigns 
    SET status = 'archived', updated_at = NOW() 
    WHERE name IN ('first-1 ', 'Supervised QA Test Campaign')
  `;

  // 2. Rename and standardize Verified Contact Test Campaign -> Verified Contacts
  await sql`
    UPDATE campaigns 
    SET 
      name = 'Verified Contacts',
      description = 'Delinquency servicing outreach for borrowers with verified contact numbers across 1–59 DPD.',
      cohort_label = 'Verified Contacts',
      dpd_min = 1,
      dpd_max = 59,
      status = 'active',
      updated_at = NOW()
    WHERE name IN ('Verified Contact Test Campaign', 'Verified Contacts')
  `;

  // 3. Ensure 1-30 DPD is active
  await sql`
    UPDATE campaigns 
    SET 
      name = 'Early-Stage Delinquency | 1–30 DPD',
      description = 'Primary early delinquency servicing cohort for accounts 1 to 30 days past due.',
      cohort_label = '1–30 DPD Cohort',
      dpd_min = 1,
      dpd_max = 30,
      status = 'active',
      updated_at = NOW()
    WHERE name = 'Early-Stage Delinquency | 1–30 DPD'
  `;

  // 4. Ensure 31-59 DPD is active
  await sql`
    UPDATE campaigns 
    SET 
      name = 'Early-Stage Delinquency | 31–59 DPD',
      description = 'Escalated early delinquency servicing cohort for accounts 31 to 59 days past due.',
      cohort_label = '31–59 DPD Cohort',
      dpd_min = 31,
      dpd_max = 59,
      status = 'active',
      updated_at = NOW()
    WHERE name = 'Early-Stage Delinquency | 31–59 DPD'
  `;

  const activeCamps = await sql`
    SELECT id, name, status, dpd_min, dpd_max, cohort_label 
    FROM campaigns 
    WHERE status = 'active'
    ORDER BY dpd_min ASC, name ASC
  `;
  console.log('Active Campaigns in DB:');
  console.log(activeCamps);

  await sql.end();
  process.exit(0);
}

main();
