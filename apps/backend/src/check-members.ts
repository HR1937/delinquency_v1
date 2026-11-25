import postgres from 'postgres';

async function main() {
  const sql = postgres('postgresql://postgres:1937@localhost:5432/delinquency_poc');
  const res = await sql`
    SELECT c.id, c.name, COUNT(cm.id) as count
    FROM campaigns c
    LEFT JOIN campaign_members cm ON cm.campaign_id = c.id
    WHERE c.status = 'active'
    GROUP BY c.id, c.name
    ORDER BY c.name
  `;
  console.log('Campaign member counts in delinquency_poc:');
  console.log(res);

  // Print members of Verified Contacts
  const vc = await sql`
    SELECT cm.id, cm.status, l.loan_number, l.dpd, b.first_name, b.last_name, p.phone_e164, p.line_type, p.is_hygiene_verified, p.consent_state, p.tcpa_consent
    FROM campaign_members cm
    JOIN campaigns c ON cm.campaign_id = c.id
    JOIN loans l ON cm.loan_id = l.id
    LEFT JOIN borrowers b ON b.loan_id = l.id
    LEFT JOIN phone_numbers p ON p.loan_id = l.id AND p.is_primary = true
    WHERE c.name = 'Verified Contacts'
    ORDER BY l.loan_number ASC
  `;
  console.log(`\nVerified Contacts members count: ${vc.length}`);
  console.log(vc.slice(0, 10));

  await sql.end();
  process.exit(0);
}

main();
