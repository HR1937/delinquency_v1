import postgres from 'postgres';

async function main() {
  const sql = postgres('postgresql://postgres:1937@localhost:5432/delinquency_poc');
  
  await sql`
    UPDATE phone_numbers 
    SET consent_state = 'GRANTED' 
    WHERE tcpa_consent = true AND (consent_state IS NULL OR consent_state = 'UNKNOWN')
  `;

  await sql`
    UPDATE phone_numbers 
    SET consent_state = 'MISSING' 
    WHERE tcpa_consent = false AND (consent_state IS NULL OR consent_state = 'UNKNOWN')
  `;

  console.log('Updated consent_state in delinquency_poc.');
  await sql.end();
  process.exit(0);
}

main();
