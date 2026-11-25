import postgres from 'postgres';

async function main() {
  const client = postgres('postgresql://postgres:1937@localhost:5432/delinquency_poc');
  
  console.log('--- PHONE NUMBERS in delinquency_poc ---');
  const phones = await client`SELECT * FROM phone_numbers`;
  console.log(`Total phones: ${phones.length}`);
  phones.forEach(p => {
    console.log(`Phone: ${p.id} | ${p.phone_e164} | ${p.line_type} | primary:${p.is_primary} | hygiene:${p.is_hygiene_verified} | consentState:${p.consent_state} | loanId:${p.loan_id}`);
  });

  console.log('\n--- VERIFIED CALL DESTINATIONS in delinquency_poc ---');
  const vcd = await client`SELECT * FROM verified_call_destinations`;
  console.log(vcd);

  console.log('\n--- LOANS in delinquency_poc ---');
  const loans = await client`SELECT id, loan_number, dpd, past_due_amount, total_to_cure, campaign_id FROM loans`;
  console.log(`Total loans: ${loans.length}`);
  loans.forEach(l => {
    console.log(`Loan: ${l.id} | ${l.loan_number} | DPD:${l.dpd} | PastDue:${l.past_due_amount} | Cure:${l.total_to_cure} | Camp:${l.campaign_id}`);
  });

  console.log('\n--- BORROWERS in delinquency_poc ---');
  const borrowers = await client`SELECT id, loan_id, first_name, last_name, email FROM borrowers`;
  console.log(`Total borrowers: ${borrowers.length}`);
  borrowers.forEach(b => {
    console.log(`Borrower: ${b.id} | ${b.first_name} ${b.last_name} | Loan:${b.loan_id}`);
  });

  await client.end();
  process.exit(0);
}

main();
