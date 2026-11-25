import { describe, it, expect } from 'bun:test';
import { EscalationContactService } from '../../src/domain/escalation/EscalationContactService';
import { app } from '../../src/index';

describe('EscalationContactService & Operator Dynamic Phone-Exclusion Safeguard', () => {
  it('lists configured escalation contacts', async () => {
    const contacts = await EscalationContactService.listContacts(false);
    expect(contacts.length).toBeGreaterThanOrEqual(3);
    const c1 = contacts.find(c => c.contactKey === 'AGENT_A');
    const c2 = contacts.find(c => c.contactKey === 'AGENT_B');
    const c3 = contacts.find(c => c.phoneE164 === '+919909662663');

    expect(c1).toBeDefined();
    expect(c1?.displayName).toBe('Escalation Contact 1');
    expect(c1?.phoneMasked).toContain('4331');

    expect(c2).toBeDefined();
    expect(c2?.displayName).toBe('Escalation Contact 2');
    expect(c2?.phoneMasked).toContain('1726');

    expect(c3).toBeDefined();
    expect(c3?.displayName).toBe('Escalation Contact 3');
    expect(c3?.phoneMasked).toContain('2663');
  });

  it('dynamic recipient selection excludes contact matching borrower phone', async () => {
    // Current borrower phone matches Contact 1 (+919328234331)
    const routing1 = await EscalationContactService.resolveRecipientForBorrower('+919328234331');
    expect(routing1.assigned).toBe(true);
    expect(routing1.recipient).toBeDefined();
    expect(routing1.recipient?.phoneE164).not.toBe('+919328234331');
    expect(routing1.excludedPhoneMatched).toBe(true);
    expect(routing1.routingReason).toContain('ASSIGNED_ALTERNATE');

    // Current borrower phone matches Contact 2 (+916353191726)
    const routing2 = await EscalationContactService.resolveRecipientForBorrower('+916353191726');
    expect(routing2.assigned).toBe(true);
    expect(routing2.recipient).toBeDefined();
    expect(routing2.recipient?.phoneE164).not.toBe('+916353191726');

    // Unrelated borrower phone assigns first available contact
    const routing3 = await EscalationContactService.resolveRecipientForBorrower('+15551234567');
    expect(routing3.assigned).toBe(true);
    expect(routing3.recipient).toBeDefined();
  });

  it('REST API endpoints for escalation contacts CRUD', async () => {
    // GET /api/v1/escalation-contacts
    const getRes = await app.request('/api/v1/escalation-contacts', {
      headers: { 'x-operator-auth': 'operator-local-token' }
    });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json() as any;
    expect(getData.contacts).toBeInstanceOf(Array);
    expect(getData.contacts.length).toBeGreaterThanOrEqual(3);

    // PATCH update contact notes
    const contactToUpdate = getData.contacts[0];
    const patchRes = await app.request(`/api/v1/escalation-contacts/${contactToUpdate.id}`, {
      method: 'PATCH',
      headers: {
        'x-operator-auth': 'operator-local-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notes: 'Updated via test suite' })
    });
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json() as any;
    expect(patchData.success).toBe(true);
    expect(patchData.contact.notes).toBe('Updated via test suite');
  });

  it('Part 0.1: Human escalation contact creation strictly does NOT create or authorize outbound call destinations', async () => {
    const { DestinationRegistryService } = await import('../../src/domain/settings/DestinationRegistryService');
    const { db } = await import('../../src/db/client');

    const testContactPhone = '+12025550199';

    // 1. Ensure test contact is not in verified_call_destinations
    const beforeDest = await DestinationRegistryService.isDestinationVerified(testContactPhone);
    expect(beforeDest).toBe(false);

    // 2. Create a new escalation contact
    const created = await EscalationContactService.createContact({
      displayName: 'Temporary Test Contact',
      phoneE164: testContactPhone,
      notes: 'Testing architectural separation'
    });
    expect(created.id).toBeDefined();

    // 3. Verify that the contact was NOT automatically added to verified_call_destinations
    const afterDest = await DestinationRegistryService.isDestinationVerified(testContactPhone);
    expect(afterDest).toBe(false);

    const dbDest = await db.query.verifiedCallDestinations.findFirst({
      where: (v, { eq }) => eq(v.phoneE164, testContactPhone)
    });
    expect(dbDest).toBeUndefined();

    // 4. Update the contact
    const updated = await EscalationContactService.updateContact(created.id, {
      isActive: false,
      notes: 'Deactivated test contact'
    });
    expect(updated?.isActive).toBe(false);

    // 5. Verify outbound destinations remain completely unaffected
    const stillNotDest = await DestinationRegistryService.isDestinationVerified(testContactPhone);
    expect(stillNotDest).toBe(false);

    // Clean up created test contact
    await EscalationContactService.removeContact(created.id);
  });

  it('Part 0.2: Overview summary provides operational counts without leaking full contact management', async () => {
    const res = await app.request('/api/v1/dashboard/summary', {
      headers: { 'x-operator-auth': 'operator-local-token' }
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;

    expect(data.openEscalationsCount).toBeDefined();
    expect(typeof data.openEscalationsCount).toBe('number');
    expect(data.humanEscalationContacts).toBeInstanceOf(Array);

    // Verify all returned contact records have masked phone numbers (zero unmasked phones leaked)
    for (const contact of data.humanEscalationContacts) {
      expect(contact.phoneMasked).toContain('***');
      expect(contact.phoneE164).toBeUndefined();
    }
  });
});
