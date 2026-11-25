import { db } from './db/client';
import { loans, phoneNumbers, campaigns } from './db/schema';
import { PreDialGate } from './domain/eligibility/PreDialGate';
import { eq } from 'drizzle-orm';

async function main() {
  const allLoans = await db.select().from(loans);
  console.log('Evaluating all loans with current system time vs simulated daylight time (14:00)...');

  const camp = await db.query.campaigns.findFirst({ where: eq(campaigns.name, 'Early-Stage Delinquency | 1–30 DPD') });

  for (const l of allLoans.slice(0, 5)) {
    const p = await db.query.phoneNumbers.findFirst({ where: eq(phoneNumbers.loanId, l.id) });
    if (!p) continue;

    const ctx = {
      loan: {
        id: l.id,
        dpd: l.dpd,
        isBankrupt: l.isBankrupt,
        isLitigation: l.isLitigation,
        isDeceased: l.isDeceased,
        hasLossMitigation: l.hasLossMitigation,
        hasActiveDispute: l.hasActiveDispute,
        contactAttemptCount: l.contactAttemptCount,
        priorityScore: l.priorityScore,
      },
      phone: {
        id: p.id,
        phoneE164: p.phoneE164,
        lineType: p.lineType,
        tcpaConsent: p.tcpaConsent,
        dnc: p.dnc,
        timezoneIana: p.timezoneIana,
        isHygieneVerified: p.isHygieneVerified,
        preferredContactWindowStart: p.preferredContactWindowStart,
        preferredContactWindowEnd: p.preferredContactWindowEnd,
      },
      campaign: {
        id: camp!.id,
        dpdMin: camp!.dpdMin,
        dpdMax: camp!.dpdMax,
        maxAttempts: camp!.maxAttempts,
        dailyCap: camp!.dailyCap,
        weeklyCap: camp!.weeklyCap,
        cooldownHours: camp!.cooldownHours,
      },
      accountDnc: false,
      numberDnc: p.dnc,
      activeV1Restrictions: [],
      pendingCallbacks: [],
      recentCallAttempts: [],
      activeConcurrentCalls: 0,
    };

    const resNow = PreDialGate.evaluate(ctx);
    const resSimDaylight = PreDialGate.evaluate({ ...ctx, simulatedLocalHour: 14 });

    console.log(`\nLoan: ${l.loanNumber} (DPD: ${l.dpd}, Phone: ${p.phoneE164}, TZ: ${p.timezoneIana})`);
    console.log(`  At current time (${new Date().toISOString()}): eligible=${resNow.eligible}, result=${resNow.finalResult}, reason=${resNow.reason}`);
    console.log(`  At 14:00 local time: eligible=${resSimDaylight.eligible}, result=${resSimDaylight.finalResult}, reason=${resSimDaylight.reason}`);
    if (!resSimDaylight.eligible) {
      console.log('  Failed checks:', resSimDaylight.checkResults.filter(c => c.result === 'fail'));
    }
  }

  process.exit(0);
}

main();
