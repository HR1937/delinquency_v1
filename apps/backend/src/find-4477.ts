import { db } from './db/client';
import { phoneNumbers, loans, borrowers } from './db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const phones = await db.select().from(phoneNumbers);
  console.log(`=== FOUND ${phones.length} PHONES IN DB ===`);
  for (const p of phones) {
    const l = await db.query.loans.findFirst({ where: eq(loans.id, p.loanId) });
    const b = await db.query.borrowers.findFirst({ where: eq(borrowers.loanId, p.loanId) });
    console.log(
      p.id, 
      p.phoneE164, 
      p.lineType, 
      'hygieneVerified:', p.isHygieneVerified, 
      'consentState:', p.consentState, 
      'tcpaConsent:', p.tcpaConsent, 
      'loan:', l?.loanNumber, 
      'dpd:', l?.dpd, 
      'borrower:', `${b?.firstName} ${b?.lastName}`
    );
  }
  process.exit(0);
}

main();
