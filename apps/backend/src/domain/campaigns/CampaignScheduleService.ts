import { db } from '../../db/client';
import {
  campaigns,
  campaignMembers,
  loans,
  borrowers,
  phoneNumbers,
  dncRecords,
  v1Restrictions,
  callbacks,
  callAttempts
} from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { PreDialGate } from '../eligibility/PreDialGate';
import { maskPhoneE164, DestinationRegistryService } from '../settings/DestinationRegistryService';

export interface DueCampaignContact {
  memberId: string;
  campaignId: string;
  campaignName: string;
  loanId: string;
  loanNumber: string;
  borrowerName: string;
  phoneMasked: string;
  phoneE164: string | null;
  scheduledTimeUtc: string;
  scheduledTimeLocal: string;
  borrowerTimezone: string;
  eligible: boolean;
  finalResult: string;
  blockingReasons: string[];
  dueReason: string;
  priorityScore: number;
  dpd: number;
  pastDueAmount: string;
}

export class CampaignScheduleService {
  /**
   * Retrieve all due campaign contacts across all active campaigns.
   */
  static async getDueCampaignContacts(now: Date = new Date()): Promise<{
    dueEligibleCount: number;
    dueBlockedCount: number;
    totalDueCount: number;
    dueContacts: DueCampaignContact[];
  }> {
    // 1. Fetch active campaigns
    const activeCamps = await db.query.campaigns.findMany({
      where: (c, { eq }) => eq(c.status, 'active')
    });

    if (activeCamps.length === 0) {
      return {
        dueEligibleCount: 0,
        dueBlockedCount: 0,
        totalDueCount: 0,
        dueContacts: []
      };
    }

    const campMap = new Map(activeCamps.map(c => [c.id, c]));

    // 2. Fetch active campaign members whose next_contact_at is null or <= now
    const members = await db.query.campaignMembers.findMany({
      where: (cm, { eq }) => eq(cm.status, 'active')
    });

    const activeMembers = members.filter(m => campMap.has(m.campaignId));
    const dueContacts: DueCampaignContact[] = [];

    for (const member of activeMembers) {
      const camp = campMap.get(member.campaignId)!;

      // Contact is considered due if nextContactAt is null (initial contact) or nextContactAt <= now
      const isDue = !member.nextContactAt || new Date(member.nextContactAt) <= now;
      if (!isDue) continue;

      const loan = await db.query.loans.findFirst({
        where: (l, { eq }) => eq(l.id, member.loanId)
      });
      if (!loan) continue;

      const borrower = await db.query.borrowers.findFirst({
        where: (b, { eq }) => eq(b.loanId, loan.id)
      });

      let phone = member.selectedPhoneNumberId
        ? await db.query.phoneNumbers.findFirst({ where: (p, { eq }) => eq(p.id, member.selectedPhoneNumberId!) })
        : null;

      if (!phone) {
        phone = await db.query.phoneNumbers.findFirst({
          where: (p, { eq, and }) => and(eq(p.loanId, loan.id), eq(p.isPrimary, true))
        });
      }
      if (!phone) {
        phone = await db.query.phoneNumbers.findFirst({
          where: (p, { eq }) => eq(p.loanId, loan.id)
        });
      }

      const borrowerName = borrower ? `${borrower.firstName} ${borrower.lastName}`.trim() : 'Unknown Borrower';
      const rawLoanNumber = loan.loanNumber || '0000';
      const maskedLoan = rawLoanNumber.length > 4 ? `LN-****${rawLoanNumber.slice(-4)}` : rawLoanNumber;
      const borrowerTimezone = phone?.timezoneIana || 'America/New_York';

      // Format local time
      let scheduledTimeLocal = '--:--';
      const scheduledUtc = member.nextContactAt ? new Date(member.nextContactAt) : now;
      try {
        scheduledTimeLocal = new Intl.DateTimeFormat('en-US', {
          timeZone: borrowerTimezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(scheduledUtc);
      } catch {
        scheduledTimeLocal = scheduledUtc.toISOString().slice(11, 16) + ' UTC';
      }

      if (!phone) {
        dueContacts.push({
          memberId: member.id,
          campaignId: camp.id,
          campaignName: camp.name,
          loanId: loan.id,
          loanNumber: maskedLoan,
          loanNumberMasked: maskedLoan,
          borrowerName,
          phoneMasked: 'None',
          phoneE164: null,
          scheduledTimeUtc: scheduledUtc.toISOString(),
          scheduledTimeLocal,
          dueTimeLocal: scheduledTimeLocal,
          borrowerTimezone,
          eligible: false,
          isEligible: false,
          finalResult: 'BLOCKED_NO_PHONE',
          blockingReasons: ['No primary or selected phone number found'],
          contactType: member.lastContactAt ? 'OPERATOR_FOLLOWUP' : 'INITIAL_CAMPAIGN_CONTACT',
          dueReason: member.lastContactAt ? 'Recurring cadence contact' : 'Initial campaign contact',
          priorityScore: Number(loan.priorityScore || 0),
          dpd: Number(loan.dpd || 0),
          pastDueAmount: loan.pastDueAmount || '$0.00'
        });
        continue;
      }

      // Re-evaluate complete 12 Pre-Dial Gates
      const dncAcc = await db.query.dncRecords.findFirst({
        where: (d, { eq, and }) => and(eq(d.loanId, loan.id), eq(d.isActive, true))
      });
      const v1 = await db.query.v1Restrictions.findMany({
        where: (v, { eq, and }) => and(eq(v.loanId, loan.id), eq(v.isActive, true))
      });
      const cbs = await db.query.callbacks.findMany({
        where: (cb, { and, eq }) => and(eq(cb.loanId, loan.id), eq(cb.status, 'scheduled'))
      });
      const recentAttempts = await db.query.callAttempts.findMany({
        where: (ca, { eq }) => eq(ca.loanId, loan.id),
        orderBy: [desc(callAttempts.initiatedAt)],
        limit: 5
      });

      const evalOutcome = PreDialGate.evaluate({
        loan: {
          id: loan.id,
          dpd: loan.dpd,
          isBankrupt: loan.isBankrupt,
          isLitigation: loan.isLitigation,
          isDeceased: loan.isDeceased,
          hasLossMitigation: loan.hasLossMitigation,
          hasActiveDispute: loan.hasActiveDispute,
          contactAttemptCount: loan.contactAttemptCount,
          priorityScore: loan.priorityScore
        },
        phone: {
          id: phone.id,
          phoneE164: phone.phoneE164,
          lineType: phone.lineType,
          tcpaConsent: phone.tcpaConsent,
          dnc: phone.dnc,
          timezoneIana: phone.timezoneIana,
          isHygieneVerified: phone.isHygieneVerified,
          preferredContactWindowStart: phone.preferredContactWindowStart,
          preferredContactWindowEnd: phone.preferredContactWindowEnd
        },
        campaign: {
          id: camp.id,
          dpdMin: camp.dpdMin,
          dpdMax: camp.dpdMax,
          maxAttempts: camp.maxAttempts,
          dailyCap: camp.dailyCap,
          weeklyCap: camp.weeklyCap,
          cooldownHours: camp.cooldownHours
        },
        accountDnc: !!dncAcc,
        numberDnc: phone.dnc,
        activeV1Restrictions: v1 as any,
        pendingCallbacks: cbs as any,
        recentCallAttempts: recentAttempts as any,
        activeConcurrentCalls: 0
      }, now);

      dueContacts.push({
        memberId: member.id,
        campaignId: camp.id,
        campaignName: camp.name,
        loanId: loan.id,
        loanNumber: maskedLoan,
        loanNumberMasked: maskedLoan,
        borrowerName,
        phoneMasked: maskPhoneE164(phone.phoneE164),
        phoneE164: phone.phoneE164,
        scheduledTimeUtc: scheduledUtc.toISOString(),
        scheduledTimeLocal,
        dueTimeLocal: scheduledTimeLocal,
        borrowerTimezone,
        eligible: evalOutcome.eligible,
        isEligible: evalOutcome.eligible,
        finalResult: evalOutcome.finalResult,
        blockingReasons: evalOutcome.allBlockingReasons || [],
        contactType: member.lastContactAt ? 'OPERATOR_FOLLOWUP' : 'INITIAL_CAMPAIGN_CONTACT',
        dueReason: member.lastContactAt ? 'Recurring cadence contact' : 'Initial campaign contact',
        priorityScore: Number(loan.priorityScore || 0),
        dpd: Number(loan.dpd || 0),
        pastDueAmount: loan.pastDueAmount || '$0.00'
      });
    }

    // Sort by priorityScore DESC, then dpd DESC
    dueContacts.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return b.dpd - a.dpd;
    });

    const dueEligibleCount = dueContacts.filter(c => c.eligible).length;
    const dueBlockedCount = dueContacts.filter(c => !c.eligible).length;

    return {
      dueEligibleCount,
      dueBlockedCount,
      totalDueCount: dueContacts.length,
      dueContacts
    };
  }
}
