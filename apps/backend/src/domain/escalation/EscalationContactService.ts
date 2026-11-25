import { db } from '../../db/client';
import { qaEscalationRecipients } from '../../db/schema';
import { eq, asc } from 'drizzle-orm';
import { normalizeE164 } from '../qa/OneCallSafetyGate';

export interface EscalationContactRecord {
  id: string;
  contactKey: string;
  displayName: string;
  phoneE164: string;
  phoneMasked: string;
  isActive: boolean;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function maskPhone(e164: string): string {
  if (!e164 || e164.length < 7) return e164 || '—';
  const last4 = e164.slice(-4);
  const countryCode = e164.startsWith('+91') ? '+91' : e164.startsWith('+1') ? '+1' : '+';
  return `${countryCode} (***) ***-${last4}`;
}

export class EscalationContactService {
  /**
   * List all human escalation contacts.
   * If includeInactive is false, returns only active contacts.
   */
  static async listContacts(includeInactive = false): Promise<EscalationContactRecord[]> {
    const rows = await db.query.qaEscalationRecipients.findMany({
      where: includeInactive ? undefined : (r, { eq }) => eq(r.isActive, true),
      orderBy: (r, { asc }) => [asc(r.createdAt)]
    });

    return rows.map(r => ({
      id: r.id,
      contactKey: r.agentKey,
      displayName: r.displayName,
      phoneE164: r.phoneE164,
      phoneMasked: r.phoneMasked || maskPhone(r.phoneE164),
      isActive: r.isActive,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }

  /**
   * Add a new human escalation contact.
   */
  static async createContact(data: {
    displayName?: string;
    phoneE164: string;
    isActive?: boolean;
    notes?: string;
  }): Promise<EscalationContactRecord> {
    const normalizedPhone = normalizeE164(data.phoneE164);
    if (!normalizedPhone) {
      throw new Error('Invalid E.164 phone number');
    }
    const masked = maskPhone(normalizedPhone);

    const existing = await db.query.qaEscalationRecipients.findFirst({
      where: (r, { eq }) => eq(r.phoneE164, normalizedPhone)
    });
    if (existing) {
      throw new Error(`Contact with phone number ending in ...${normalizedPhone.slice(-4)} already exists`);
    }

    const all = await db.query.qaEscalationRecipients.findMany();
    const contactKey = `CONTACT_${all.length + 1}`;
    const displayName = data.displayName?.trim() || `Escalation Contact ${all.length + 1}`;

    const [created] = await db.insert(qaEscalationRecipients).values({
      agentKey: contactKey,
      displayName,
      phoneE164: normalizedPhone,
      phoneMasked: masked,
      isActive: data.isActive ?? true,
      notes: data.notes?.trim() || null
    }).returning();

    return {
      id: created.id,
      contactKey: created.agentKey,
      displayName: created.displayName,
      phoneE164: created.phoneE164,
      phoneMasked: created.phoneMasked,
      isActive: created.isActive,
      notes: created.notes,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    };
  }

  /**
   * Update an existing contact (edit name, notes, or toggle active status).
   */
  static async updateContact(id: string, data: {
    displayName?: string;
    isActive?: boolean;
    notes?: string;
  }): Promise<EscalationContactRecord | null> {
    const existing = await db.query.qaEscalationRecipients.findFirst({
      where: (r, { eq }) => eq(r.id, id)
    });
    if (!existing) return null;

    const updates: Partial<typeof qaEscalationRecipients.$inferInsert> = {
      updatedAt: new Date()
    };
    if (data.displayName !== undefined) updates.displayName = data.displayName.trim();
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.notes !== undefined) updates.notes = data.notes.trim();

    const [updated] = await db.update(qaEscalationRecipients)
      .set(updates)
      .where(eq(qaEscalationRecipients.id, id))
      .returning();

    return {
      id: updated.id,
      contactKey: updated.agentKey,
      displayName: updated.displayName,
      phoneE164: updated.phoneE164,
      phoneMasked: updated.phoneMasked,
      isActive: updated.isActive,
      notes: updated.notes,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  }

  /**
   * Remove a contact.
   */
  static async removeContact(id: string): Promise<boolean> {
    const existing = await db.query.qaEscalationRecipients.findFirst({
      where: (r, { eq }) => eq(r.id, id)
    });
    if (!existing) return false;

    await db.delete(qaEscalationRecipients).where(eq(qaEscalationRecipients.id, id));
    return true;
  }

  /**
   * Dynamic Safeguard Recipient Selection:
   * 1. Retrieve all active escalation contacts.
   * 2. Normalize borrower's phone number if provided.
   * 3. Exclude any contact whose phone number matches the current borrower's phone number.
   * 4. Select the next available eligible contact.
   * 5. If no eligible contact remains, return unassigned for operator manual handling.
   */
  static async resolveRecipientForBorrower(currentBorrowerPhoneE164?: string | null): Promise<{
    assigned: boolean;
    recipient: EscalationContactRecord | null;
    excludedPhoneMatched: boolean;
    routingReason: string;
  }> {
    const activeContacts = await this.listContacts(false);
    if (activeContacts.length === 0) {
      return {
        assigned: false,
        recipient: null,
        excludedPhoneMatched: false,
        routingReason: 'NO_ACTIVE_CONTACTS_CONFIGURED'
      };
    }

    const normBorrower = currentBorrowerPhoneE164 ? normalizeE164(currentBorrowerPhoneE164) : null;
    let excludedPhoneMatched = false;

    // Filter contacts that do NOT match current borrower's phone number
    const eligibleContacts = activeContacts.filter(c => {
      if (normBorrower && normalizeE164(c.phoneE164) === normBorrower) {
        excludedPhoneMatched = true;
        return false;
      }
      return true;
    });

    if (eligibleContacts.length > 0) {
      const selected = eligibleContacts[0];
      return {
        assigned: true,
        recipient: selected,
        excludedPhoneMatched,
        routingReason: excludedPhoneMatched
          ? `ASSIGNED_ALTERNATE_DUE_TO_BORROWER_PHONE_MATCH (${selected.displayName})`
          : `ASSIGNED_PRIMARY_AVAILABLE_CONTACT (${selected.displayName})`
      };
    }

    return {
      assigned: false,
      recipient: null,
      excludedPhoneMatched,
      routingReason: 'UNASSIGNED_ALL_CONTACTS_EXCLUDED_OR_UNAVAILABLE'
    };
  }
}
