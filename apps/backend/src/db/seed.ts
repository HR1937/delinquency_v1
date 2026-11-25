import { db } from './client';
import {
  campaigns,
  campaignMembers,
  loans,
  borrowers,
  phoneNumbers,
  dncRecords,
  v1Restrictions,
  callbacks
} from './schema';
import { config } from '../config';
import { eq, and } from 'drizzle-orm';

export async function seedDatabase() {
  console.log('Starting idempotent purposeful seed...');

  // ─── 1. THREE PURPOSEFUL CAMPAIGNS ──────────────────────────────────────────
  // Campaign 1: Early-Stage Delinquency | 1–30 DPD
  let camp1 = await db.query.campaigns.findFirst({
    where: (c, { eq }) => eq(c.name, 'Early-Stage Delinquency | 1–30 DPD')
  });
  if (!camp1) {
    // Check if legacy campaign exists to rename
    const legacy = await db.query.campaigns.findFirst({
      where: (c, { eq }) => eq(c.name, 'PoC Early-Stage Delinquency Oct 2026')
    });
    if (legacy) {
      const [u] = await db.update(campaigns).set({
        name: 'Early-Stage Delinquency | 1–30 DPD',
        description: 'Primary early delinquency servicing cohort for accounts 1 to 30 days past due.',
        cohortLabel: '1–30 DPD Cohort',
        dpdMin: 1,
        dpdMax: 30,
        status: 'active',
        isSeeded: true
      }).where(eq(campaigns.id, legacy.id)).returning();
      camp1 = u;
    } else {
      const [c] = await db.insert(campaigns).values({
        name: 'Early-Stage Delinquency | 1–30 DPD',
        description: 'Primary early delinquency servicing cohort for accounts 1 to 30 days past due.',
        cohortLabel: '1–30 DPD Cohort',
        dpdMin: 1,
        dpdMax: 30,
        status: 'active',
        maxAttempts: 3,
        dailyCap: 2,
        weeklyCap: 6,
        cooldownHours: 4,
        callbackHorizonDays: 7,
        fallbackThreshold: 3,
        isSeeded: true
      }).returning();
      camp1 = c;
    }
  }

  // Campaign 2: Early-Stage Delinquency | 31–59 DPD
  let camp2 = await db.query.campaigns.findFirst({
    where: (c, { eq }) => eq(c.name, 'Early-Stage Delinquency | 31–59 DPD')
  });
  if (!camp2) {
    const [c] = await db.insert(campaigns).values({
      name: 'Early-Stage Delinquency | 31–59 DPD',
      description: 'Escalated early delinquency servicing cohort for accounts 31 to 59 days past due.',
      cohortLabel: '31–59 DPD Cohort',
      dpdMin: 31,
      dpdMax: 59,
      status: 'active',
      maxAttempts: 3,
      dailyCap: 2,
      weeklyCap: 6,
      cooldownHours: 4,
      callbackHorizonDays: 7,
      fallbackThreshold: 3,
      isSeeded: true
    }).returning();
    camp2 = c;
  }

  // Campaign 3: Verified Contacts (Delinquency Servicing Outreach across 1–59 DPD)
  let verifiedCamp = await db.query.campaigns.findFirst({
    where: (c, { eq }) => eq(c.name, 'Verified Contacts')
  });
  if (!verifiedCamp) {
    const legacyVerified = await db.query.campaigns.findFirst({
      where: (c, { eq }) => eq(c.name, 'Verified Contact Test Campaign')
    });
    if (legacyVerified) {
      const [u] = await db.update(campaigns).set({
        name: 'Verified Contacts',
        description: 'Delinquency servicing outreach for borrowers with verified contact numbers across 1–59 DPD.',
        cohortLabel: 'Verified Contacts',
        dpdMin: 1,
        dpdMax: 59,
        status: 'active',
        isSeeded: true
      }).where(eq(campaigns.id, legacyVerified.id)).returning();
      verifiedCamp = u;
    } else {
      const [c] = await db.insert(campaigns).values({
        name: 'Verified Contacts',
        description: 'Delinquency servicing outreach for borrowers with verified contact numbers across 1–59 DPD.',
        cohortLabel: 'Verified Contacts',
        dpdMin: 1,
        dpdMax: 59,
        status: 'active',
        maxAttempts: 3,
        dailyCap: 2,
        weeklyCap: 6,
        cooldownHours: 4,
        callbackHorizonDays: 7,
        fallbackThreshold: 3,
        isSeeded: true
      }).returning();
      verifiedCamp = c;
    }
  }

  // Ensure duplicate or historical QA campaigns are archived so exactly 3 operational campaigns remain active
  const legacyCampsToArchive = await db.query.campaigns.findMany({
    where: (c, { inArray }) => inArray(c.name, ['Supervised QA Test Campaign', 'first-1 '])
  });
  for (const lc of legacyCampsToArchive) {
    await db.update(campaigns).set({ status: 'archived', updatedAt: new Date() }).where(eq(campaigns.id, lc.id));
  }

  // ─── 2. 30 DEFINED TEST SCENARIOS (LN-100001 through LN-100030) ─────────────
  const scenarios = [
    { idx: 1, dpd: 15, name: 'Alex CleanEligible', mobile: true, consent: true, tz: 'America/New_York', notes: 'Clean eligible' },
    { idx: 2, dpd: 30, name: 'Brenda LandlinePass', mobile: false, consent: null, tz: 'America/Chicago', notes: 'Landline passed' },
    { idx: 3, dpd: 45, name: 'Carlos OpenPtpToday', mobile: true, consent: true, tz: 'America/New_York', openPtp: true, notes: 'PTP due today' },
    { idx: 4, dpd: 5, name: 'David ScraProtected', mobile: true, consent: true, tz: 'America/New_York', isScra: true, notes: 'SCRA flag' },
    { idx: 5, dpd: 22, name: 'Edward Bankrupt', mobile: true, consent: true, tz: 'America/New_York', isBankrupt: true, notes: 'Bankruptcy exclusion' },
    { idx: 6, dpd: 38, name: 'Fiona Litigation', mobile: true, consent: true, tz: 'America/New_York', isLitigation: true, notes: 'Litigation exclusion' },
    { idx: 7, dpd: 12, name: 'George Deceased', mobile: true, consent: true, tz: 'America/New_York', isDeceased: true, notes: 'Deceased exclusion' },
    { idx: 8, dpd: 25, name: 'Hannah LossMit', mobile: true, consent: true, tz: 'America/New_York', hasLossMit: true, notes: 'Active loss mitigation' },
    { idx: 9, dpd: 19, name: 'Ian ActiveDispute', mobile: true, consent: true, tz: 'America/New_York', hasDispute: true, notes: 'Active dispute' },
    { idx: 10, dpd: 33, name: 'Julia AccountDnc', mobile: true, consent: true, tz: 'America/New_York', accountDnc: true, notes: 'Account DNC' },
    { idx: 11, dpd: 28, name: 'Kevin NumberDnc', mobile: true, consent: true, tz: 'America/New_York', numberDnc: true, notes: 'Number DNC' },
    { idx: 12, dpd: 10, name: 'Laura NoConsent', mobile: true, consent: false, tz: 'America/New_York', notes: 'No TCPA consent' },
    { idx: 13, dpd: 42, name: 'Michael MissingTz', mobile: true, consent: true, tz: null, notes: 'Missing timezone' },
    { idx: 14, dpd: 17, name: 'Nora OutsidePcw', mobile: true, consent: true, tz: 'America/New_York', pcw: { start: '09:00:00', end: '10:00:00' }, notes: 'Outside PCW' },
    { idx: 15, dpd: 8, name: 'Oscar V1Restriction', mobile: true, consent: true, tz: 'America/New_York', v1: true, notes: 'v1 temporary restriction' },
    { idx: 16, dpd: 55, name: 'Patricia MaxAttempts', mobile: true, consent: true, tz: 'America/New_York', attempts: 3, notes: 'Max attempts cap' },
    { idx: 17, dpd: 20, name: 'Quinn CooldownActive', mobile: true, consent: true, tz: 'America/New_York', cooldown: true, notes: 'Cooldown active' },
    { idx: 18, dpd: 35, name: 'Rachel FutureCallback', mobile: true, consent: true, tz: 'America/New_York', callbackFuture: true, notes: 'Pending callback' },
    { idx: 19, dpd: 7, name: 'Samuel RecentNsf', mobile: true, consent: true, tz: 'America/New_York', recentNsf: true, notes: 'Recent NSF context' },
    { idx: 20, dpd: 29, name: 'Tina HardshipEligible', mobile: true, consent: true, tz: 'America/New_York', hardshipEligible: true, notes: 'Hardship flag' },
    { idx: 21, dpd: 14, name: 'Uma CoBorrower', mobile: true, consent: true, tz: 'America/New_York', coBorrower: true, notes: 'Co-borrower on loan' },
    { idx: 22, dpd: 48, name: 'Victor SpanishPref', mobile: true, consent: true, tz: 'America/New_York', lang: 'es', notes: 'Spanish preference' },
    { idx: 23, dpd: 3, name: 'Wendy EarlyDpd', mobile: false, consent: null, tz: 'America/Denver', notes: 'Early DPD 3' },
    { idx: 24, dpd: 58, name: 'Xavier LateDpdEdge', mobile: true, consent: true, tz: 'America/Los_Angeles', notes: 'Late DPD 58' },
    { idx: 25, dpd: 60, name: 'Yolanda OutOfScope', mobile: true, consent: true, tz: 'America/New_York', notes: 'Out of scope DPD 60' },
    { idx: 26, dpd: 31, name: 'Zachary PtpMissed', mobile: true, consent: true, tz: 'America/New_York', ptpMissed: true, notes: 'Missed PTP' },
    { idx: 27, dpd: 18, name: 'Arthur ThresholdReached', mobile: true, consent: true, tz: 'America/New_York', attempts: 3, notes: 'N=3 fallback threshold' },
    { idx: 28, dpd: 40, name: 'Beatrice LegalHistory', mobile: true, consent: true, tz: 'America/New_York', legalTrigger: true, notes: 'Legal trigger history' },
    { idx: 29, dpd: 12, name: 'Clara InvalidPhone', mobile: true, consent: true, tz: 'America/New_York', invalidPhone: true, notes: 'Hygiene unverified' },
    { idx: 30, dpd: 22, name: 'Daniel ReadySecondAttempt', mobile: true, consent: true, tz: 'America/New_York', attempts: 1, notes: 'Ready 2nd attempt' }
  ];

  const allowedTestDests = (config.ALLOWED_TEST_DESTINATIONS || '')
    .split(',')
    .map(d => d.trim())
    .filter(Boolean);

  for (const s of scenarios) {
    const loanNum = `LN-${100000 + s.idx}`;
    const targetCamp = s.dpd <= 30 ? camp1 : camp2;

    let loan = await db.query.loans.findFirst({
      where: (l, { eq }) => eq(l.loanNumber, loanNum)
    });

    if (!loan) {
      const pastDue = (s.dpd * 75.5).toFixed(2);
      const totalCure = (parseFloat(pastDue) + 65.0).toFixed(2);

      const [newLoan] = await db.insert(loans).values({
        campaignId: targetCamp.id,
        loanNumber: loanNum,
        servicerId: 'SERVICER-ALPHA',
        productType: 'Conventional 30Y Fixed',
        interestRate: '0.0625',
        upb: '290000.00',
        piPayment: '1785.50',
        dpd: s.dpd,
        delinquencyBucket: s.dpd <= 30 ? '1-30' : '31-59',
        pastDueAmount: pastDue,
        totalToCure: totalCure,
        nextDueDate: '2026-11-01',
        lastPaymentDate: '2026-09-15',
        lastPaymentAmount: '1785.50',
        isBankrupt: s.isBankrupt || false,
        isLitigation: s.isLitigation || false,
        isDeceased: s.isDeceased || false,
        hasLossMitigation: s.hasLossMit || false,
        hasActiveDispute: s.hasDispute || false,
        isScra: s.isScra || false,
        hasLegalTrigger: s.legalTrigger || false,
        recentNsf: s.recentNsf || false,
        hardshipEligible: s.hardshipEligible || false,
        contactAttemptCount: s.attempts || 0,
        priorityScore: (50 + (s.dpd * 0.5)).toFixed(2),
        isSeeded: true
      }).returning();
      loan = newLoan;

      const [firstName, ...lastParts] = s.name.split(' ');
      const lastName = lastParts.join(' ') || 'Borrower';

      const [borrower] = await db.insert(borrowers).values({
        loanId: loan.id,
        isPrimary: true,
        firstName,
        lastName,
        dob: '1985-05-12',
        addressLine1: `${100 + s.idx} Main Street`,
        addressCity: 'Columbus',
        addressState: 'OH',
        addressZip: '43215',
        preferredLanguage: s.lang || 'en',
        servicerReferenceNumber: `REF-${200000 + s.idx}`,
        isSeeded: true
      }).returning();

      // Consent mapping
      let consentState = 'UNKNOWN';
      if (!s.mobile) {
        consentState = 'NOT_APPLICABLE_TO_MOBILE_AUTODIAL_CONSENT';
      } else if (s.consent === true) {
        consentState = 'GRANTED';
      } else if (s.consent === false) {
        consentState = 'REVOKED';
      }

      // Synthetic E.164 phone number for baseline scenario (never hijack borrower phone with operator test number)
      const phoneE164 = `+15550100${(100 + s.idx).toString().slice(-3)}`;

      const [phone] = await db.insert(phoneNumbers).values({
        borrowerId: borrower.id,
        loanId: loan.id,
        phoneE164,
        label: 'primary',
        relationship: 'primary_borrower',
        lineType: s.mobile ? 'mobile' : 'landline',
        isPrimary: true,
        tcpaConsent: s.consent,
        tcpaConsentDate: s.consent ? new Date('2026-01-15') : null,
        consentState,
        consentScope: s.consent ? 'autodial_voice_and_sms' : null,
        consentSource: s.consent ? 'online_origination_portal' : null,
        consentEvidence: s.consent ? 'Electronic signature record 2026-01-15' : null,
        dnc: s.numberDnc || false,
        dncScope: s.numberDnc ? 'number' : null,
        timezoneIana: s.tz,
        state: 'OH',
        preferredContactWindowStart: s.pcw?.start || null,
        preferredContactWindowEnd: s.pcw?.end || null,
        isHygieneVerified: !s.invalidPhone,
        isTestDestination: false,
        testRecipientAuthorized: false,
        isSeeded: true
      }).returning();

      // Ensure membership in designated cohort campaign
      await db.insert(campaignMembers).values({
        campaignId: targetCamp.id,
        loanId: loan.id,
        selectedPhoneNumberId: phone.id,
        status: 'active',
        addedReason: 'cohort_dpd_filter'
      }).onConflictDoNothing();

      // If contact-ready, also add to Verified Contacts campaign
      const isInitialContactReady = !s.invalidPhone &&
        (s.consent === true || !s.mobile) &&
        !s.isBankrupt && !s.isLitigation && !s.isDeceased &&
        !s.hasLossMit && !s.hasDispute && !s.accountDnc && !s.numberDnc &&
        !!s.tz;
      if (isInitialContactReady && verifiedCamp) {
        await db.insert(campaignMembers).values({
          campaignId: verifiedCamp.id,
          loanId: loan.id,
          selectedPhoneNumberId: phone.id,
          status: 'active',
          addedReason: 'verified_contact_ready'
        }).onConflictDoNothing();
      }

      if (s.coBorrower) {
        const [coBorrower] = await db.insert(borrowers).values({
          loanId: loan.id,
          isPrimary: false,
          firstName: 'Robert',
          lastName: 'CoBorrower',
          dob: '1987-08-20',
          addressLine1: `${100 + s.idx} Maple Street`,
          addressCity: 'Springfield',
          addressState: 'OH',
          addressZip: '45501',
          preferredLanguage: 'en',
          servicerReferenceNumber: `REF-${300000 + s.idx}`,
          isSeeded: true
        }).returning();

        await db.insert(phoneNumbers).values({
          borrowerId: coBorrower.id,
          loanId: loan.id,
          phoneE164: `+1555000${(2000 + s.idx).toString().slice(-4)}`,
          label: 'secondary',
          relationship: 'co_borrower',
          lineType: 'mobile',
          isPrimary: false,
          tcpaConsent: false,
          consentState: 'MISSING',
          dnc: false,
          timezoneIana: s.tz,
          state: 'OH',
          isHygieneVerified: true,
          isSeeded: true
        }).onConflictDoNothing();
      }

      if (s.accountDnc) {
        await db.insert(dncRecords).values({
          loanId: loan.id,
          scope: 'account',
          source: 'borrower_request',
          requestedAt: new Date(),
          isActive: true
        });
      }

      if (s.v1) {
        await db.insert(v1Restrictions).values({
          loanId: loan.id,
          phoneNumberId: phone.id,
          restrictionType: 'time_window',
          timeStart: '00:00:00',
          timeEnd: '23:59:59',
          timezoneIana: 'America/New_York',
          humanReadableNote: 'Borrower requested do not call on Mondays',
          requestedAt: new Date(),
          isActive: true
        });
      }

      if (s.callbackFuture) {
        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        await db.insert(callbacks).values({
          loanId: loan.id,
          phoneNumberId: phone.id,
          sourceType: 'QA_SCENARIO',
          callbackRequestedAt: new Date(),
          callbackScheduledDatetime: futureDate,
          callbackTimezoneIana: 'America/New_York',
          humanReadableNote: 'Borrower asked to call back Thursday 2pm',
          status: 'scheduled'
        });
      }

      // Note: Cooldown test case (Scenario 17) is an explicit scenario-only fixture evaluated in QA mode
      // It does NOT insert fake rows into call_attempts, ensuring operational call_attempts has 0 fake activity.
    } else {
      // Ensure campaign_members record exists
      const existingMember = await db.query.campaignMembers.findFirst({
        where: (cm, { and, eq }) => and(eq(cm.campaignId, targetCamp.id), eq(cm.loanId, loan.id))
      });
      if (!existingMember) {
        const primaryPhone = await db.query.phoneNumbers.findFirst({
          where: (p, { and, eq }) => and(eq(p.loanId, loan.id), eq(p.isPrimary, true))
        });
        await db.insert(campaignMembers).values({
          campaignId: targetCamp.id,
          loanId: loan.id,
          selectedPhoneNumberId: primaryPhone?.id || null,
          status: 'active',
          addedReason: 'cohort_dpd_filter'
        }).onConflictDoNothing();
      }

      // Synchronize phone consent and hygiene for scenario 30 (Daniel ReadySecondAttempt)
      if (s.idx === 30) {
        const pPhone = await db.query.phoneNumbers.findFirst({
          where: (p, { and, eq }) => and(eq(p.loanId, loan.id), eq(p.isPrimary, true))
        });
        if (pPhone && (pPhone.tcpaConsent !== true || pPhone.consentState !== 'GRANTED')) {
          await db.update(phoneNumbers).set({
            tcpaConsent: true,
            tcpaConsentDate: new Date('2026-01-15'),
            consentState: 'GRANTED',
            consentScope: 'autodial_voice_and_sms',
            consentSource: 'online_origination_portal',
            consentEvidence: 'Electronic signature record 2026-01-15',
            isHygieneVerified: true
          }).where(eq(phoneNumbers.id, pPhone.id));
        }
      }

      // Enroll contact-ready accounts into Verified Contact Test Campaign
      // Contact-ready requires: verified phone hygiene, TCPA consent granted (or exempt landline), and no hard exclusions
      const isContactReady = !s.invalidPhone &&
        (s.consent === true || !s.mobile) &&
        !s.isBankrupt && !s.isLitigation && !s.isDeceased &&
        !s.hasLossMit && !s.hasDispute && !s.accountDnc && !s.numberDnc &&
        !!s.tz;

      if (isContactReady && verifiedCamp) {
        const existingVcMember = await db.query.campaignMembers.findFirst({
          where: (cm, { and, eq }) => and(eq(cm.campaignId, verifiedCamp!.id), eq(cm.loanId, loan.id))
        });
        const primaryPhone = await db.query.phoneNumbers.findFirst({
          where: (p, { and, eq }) => and(eq(p.loanId, loan.id), eq(p.isPrimary, true))
        });
        if (!existingVcMember) {
          await db.insert(campaignMembers).values({
            campaignId: verifiedCamp.id,
            loanId: loan.id,
            selectedPhoneNumberId: primaryPhone?.id || null,
            status: 'active',
            addedReason: 'verified_contact_ready'
          }).onConflictDoNothing();
        } else if (primaryPhone && !existingVcMember.selectedPhoneNumberId) {
          await db.update(campaignMembers).set({
            selectedPhoneNumberId: primaryPhone.id
          }).where(eq(campaignMembers.id, existingVcMember.id));
        }
      }
    }
  }

  console.log('Seed completed successfully: 30 baseline scenarios across campaigns.');
}

if (import.meta.main) {
  seedDatabase().then(() => process.exit(0)).catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}
