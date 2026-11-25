import { EscalationContactService, EscalationContactRecord } from '../escalation/EscalationContactService';

export interface QaRecipientRecord {
  id: string;
  agentKey: string;
  displayName: string;
  phoneE164: string;
  phoneMasked: string;
  isActive: boolean;
  notes: string | null;
}

let legacyActiveBorrowerRole: 'AGENT_A' | 'AGENT_B' = 'AGENT_A';

export class QaEscalationService {
  /**
   * List all configured escalation recipients.
   */
  static async listRecipients(): Promise<QaRecipientRecord[]> {
    const contacts = await EscalationContactService.listContacts(false);
    return contacts.map(c => ({
      id: c.id,
      agentKey: c.contactKey,
      displayName: c.displayName,
      phoneE164: c.phoneE164,
      phoneMasked: c.phoneMasked,
      isActive: c.isActive,
      notes: c.notes
    }));
  }

  /**
   * Backward-compatible helper for legacy test compatibility.
   */
  static async getActiveBorrowerRole(): Promise<string> {
    return legacyActiveBorrowerRole;
  }

  static async setActiveBorrowerRole(role: 'AGENT_A' | 'AGENT_B', updatedBy = 'operator'): Promise<string> {
    legacyActiveBorrowerRole = role;
    return role;
  }

  /**
   * Resolve recipient dynamically. When an acting borrower phone or legacy role is present,
   * excludes any recipient with that phone number and assigns the alternate available contact.
   */
  static async resolveDesignatedRecipient(actingBorrowerPhone?: string): Promise<{
    actingBorrowerRole: string;
    designatedRecipient: QaRecipientRecord | null;
    ruleDescription: string;
  }> {
    let borrowerPhoneToExclude = actingBorrowerPhone;
    if (!borrowerPhoneToExclude) {
      const contacts = await EscalationContactService.listContacts(false);
      const matched = contacts.find(c => c.contactKey === legacyActiveBorrowerRole);
      if (matched) borrowerPhoneToExclude = matched.phoneE164;
    }

    const routing = await EscalationContactService.resolveRecipientForBorrower(borrowerPhoneToExclude);
    const designated = routing.recipient ? {
      id: routing.recipient.id,
      agentKey: routing.recipient.contactKey,
      displayName: routing.recipient.displayName,
      phoneE164: routing.recipient.phoneE164,
      phoneMasked: routing.recipient.phoneMasked,
      isActive: routing.recipient.isActive,
      notes: routing.recipient.notes
    } : null;

    return {
      actingBorrowerRole: legacyActiveBorrowerRole,
      designatedRecipient: designated,
      ruleDescription: routing.routingReason + ' (Participant acting as borrower cannot receive their own escalation)'
    };
  }
}
