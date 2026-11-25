import postgres from 'postgres';

async function main() {
  const sql = postgres('postgresql://postgres:1937@localhost:5432/delinquency_poc');
  const rows = await sql`
    SELECT 
      p.id AS phone_id,
      p.phone_e164,
      p.line_type,
      p.is_primary,
      p.is_hygiene_verified,
      p.consent_state,
      p.tcpa_consent,
      p.dnc,
      l.id AS loan_id,
      l.loan_number,
      l.dpd,
      b.id AS borrower_id,
      b.first_name,
      b.last_name
    FROM phone_numbers p
    JOIN loans l ON p.loan_id = l.id
    LEFT JOIN borrowers b ON b.loan_id = l.id
    ORDER BY l.loan_number ASC
  `;

  console.log(`Found ${rows.length} phone records:`);
  for (const r of rows) {
    console.log(
      `${r.loan_number.padEnd(10)} | ${r.first_name} ${r.last_name} | DPD:${r.dpd} | ` +
      `Phone:${r.phone_e164} | Line:${r.line_type} | Prim:${r.is_primary} | ` +
      `Hygiene:${r.is_hygiene_verified} | Consent:${r.consent_state} (TCPA:${r.tcpa_consent}) | DNC:${r.dnc}`
    );
  }
  await sql.end();
  process.exit(0);
}

main();
