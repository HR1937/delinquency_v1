import postgres from 'postgres';

async function main() {
  const sql = postgres('postgresql://postgres:1937@localhost:5432/delinquency_disposable_test');
  const [loan] = await sql`SELECT id, loan_number, campaign_id, dpd FROM loans WHERE loan_number = 'LN-100001'`;
  console.log('LN-100001 in test db:', loan);
  await sql.end();
  process.exit(0);
}

main().catch(console.error);
