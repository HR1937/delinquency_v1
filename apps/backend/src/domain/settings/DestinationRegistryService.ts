import { db } from '../../db/client';
import { verifiedCallDestinations, stateChangeLog } from '../../db/schema';
import { getVerifiedCallDestinations } from '../../config';
import { eq, desc } from 'drizzle-orm';

export interface VerifiedDestinationRecord {
  id: string;
  phoneE164: string;
  phoneMasked: string;
  label: string | null;
  status: string;
  approvalSource: string;
  approvedBy: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function maskPhoneE164(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.length <= 5) return '***';
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix} *** *** ${suffix}`;
}

export class DestinationRegistryService {
  static async listDestinations(): Promise<VerifiedDestinationRecord[]> {
    const rows = await db.query.verifiedCallDestinations.findMany({
      orderBy: [desc(verifiedCallDestinations.createdAt)]
    });

    return rows.map((r) => ({
      id: r.id,
      phoneE164: r.phoneE164,
      phoneMasked: maskPhoneE164(r.phoneE164),
      label: r.label,
      status: r.status,
      approvalSource: r.approvalSource,
      approvedBy: r.approvedBy,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  static async addDestination(params: {
    phoneE164: string;
    label?: string;
    notes?: string;
    approvedBy?: string;
  }): Promise<{ success: boolean; data?: VerifiedDestinationRecord; error?: string }> {
    const raw = (params.phoneE164 || '').trim();
    const digits = raw.replace(/\D/g, '');
    const formatted = raw.startsWith('+') ? `+${digits}` : `+${digits}`;

    // Strict E.164 validation: + followed by 8 to 15 digits
    if (!/^\+[1-9]\d{7,14}$/.test(formatted)) {
      return {
        success: false,
        error: `INVALID_E164_FORMAT: Phone number "${raw}" does not match international E.164 specification (+[country code][subscriber number], 8 to 15 digits).`
      };
    }

    const approvedBy = params.approvedBy || 'owner';
    const now = new Date();

    const [row] = await db.insert(verifiedCallDestinations).values({
      phoneE164: formatted,
      label: params.label || 'Owner-Approved Destination',
      status: 'active',
      approvalSource: 'owner_attestation',
      approvedBy,
      notes: params.notes || null,
      createdAt: now,
      updatedAt: now
    }).onConflictDoUpdate({
      target: verifiedCallDestinations.phoneE164,
      set: {
        status: 'active',
        label: params.label || 'Owner-Approved Destination',
        notes: params.notes || null,
        approvedBy,
        updatedAt: now
      }
    }).returning();

    // Audit log
    await db.insert(stateChangeLog).values({
      fieldName: 'verified_call_destinations:added',
      previousValue: null,
      newValue: {
        id: row.id,
        phoneMasked: maskPhoneE164(formatted),
        label: row.label,
        approvalSource: row.approvalSource,
        status: 'active'
      },
      changedBy: approvedBy
    }).catch(() => {});

    return {
      success: true,
      data: {
        id: row.id,
        phoneE164: row.phoneE164,
        phoneMasked: maskPhoneE164(row.phoneE164),
        label: row.label,
        status: row.status,
        approvalSource: row.approvalSource,
        approvedBy: row.approvedBy,
        notes: row.notes,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
      }
    };
  }

  static async revokeDestination(id: string, operator: string = 'owner'): Promise<{ success: boolean; error?: string }> {
    const existing = await db.query.verifiedCallDestinations.findFirst({
      where: (d, { eq }) => eq(d.id, id)
    });

    if (!existing) {
      return { success: false, error: 'DESTINATION_NOT_FOUND' };
    }

    const [updated] = await db.update(verifiedCallDestinations)
      .set({
        status: 'revoked',
        updatedAt: new Date()
      })
      .where(eq(verifiedCallDestinations.id, id))
      .returning();

    // Audit log
    await db.insert(stateChangeLog).values({
      fieldName: 'verified_call_destinations:revoked',
      previousValue: { id: existing.id, status: existing.status, phoneMasked: maskPhoneE164(existing.phoneE164) },
      newValue: { id: updated.id, status: 'revoked', phoneMasked: maskPhoneE164(updated.phoneE164) },
      changedBy: operator
    }).catch(() => {});

    return { success: true };
  }

  static async isDestinationVerified(phone?: string | null): Promise<boolean> {
    if (!phone) return false;
    const digits = phone.trim().replace(/\D/g, '');
    const e164 = phone.trim().startsWith('+') ? `+${digits}` : `+${digits}`;

    // 1. Check database-backed owner-approved registry
    try {
      const dbMatch = await db.query.verifiedCallDestinations.findFirst({
        where: (d, { and, eq }) => and(eq(d.phoneE164, e164), eq(d.status, 'active'))
      });
      if (dbMatch) return true;
    } catch {}

    // 2. Fallback to legacy environment variable for backwards-compatibility in test suites
    const envDestinations = getVerifiedCallDestinations();
    return envDestinations.includes(e164);
  }
}
