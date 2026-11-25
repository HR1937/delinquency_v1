import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { assertDisposableTestDatabase } from '../test-cleanup';
import { QaEscalationService } from '../../src/domain/qa/QaEscalationService';
import { CampaignScheduleService } from '../../src/domain/campaigns/CampaignScheduleService';
import { CONFIGURED_CALLING_HOURS } from '../../src/domain/eligibility/PreDialChecks';
import { humanEscalations, callAttempts, loans, borrowers } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

describe('Overview Tab Clarification & QA Escalation Routing Suite', () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
  });

  afterAll(async () => {
    // Reset active QA borrower role to default AGENT_A
    await QaEscalationService.setActiveBorrowerRole('AGENT_A', 'test-teardown');
  });

  describe('1. Configured Borrower Contact Hours Source of Truth', () => {
    it('1.1: GET /api/v1/dashboard/summary exposes single backend source of truth for calling hours', async () => {
      const res = await app.request('/api/v1/dashboard/summary', { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.configuredCallingHours).toBeDefined();
      expect(data.configuredCallingHours.startHour).toBe(8);
      expect(data.configuredCallingHours.endHour).toBe(21);
      expect(data.configuredCallingHours.permissibleWindowBorrowerLocal).toBe('8:00 AM – 9:00 PM Borrower Local');
      expect(data.configuredCallingHours.backendEnforcementSource).toContain('PreDialChecks.ts');
      expect(data.configuredCallingHours.governingRegulation).toContain('CFPB Reg F');
    });

    it('1.2: CONFIGURED_CALLING_HOURS constant strictly matches PreDialChecks checkC7CallingWindow logic', () => {
      expect(CONFIGURED_CALLING_HOURS.startHour).toBe(8);
      expect(CONFIGURED_CALLING_HOURS.endHour).toBe(21);
      expect(CONFIGURED_CALLING_HOURS.permissibleWindowBorrowerLocal).toBe('8:00 AM – 9:00 PM Borrower Local');
    });
  });

  describe('2. Supervised QA Escalation Contacts & Alternate-Person Routing Rule', () => {
    it('2.1: QA recipients list contains Agent A and Agent B with strictly masked phone numbers', async () => {
      const recipients = await QaEscalationService.listRecipients();
      expect(recipients.length).toBeGreaterThanOrEqual(2);

      const agentA = recipients.find(r => r.agentKey === 'AGENT_A');
      const agentB = recipients.find(r => r.agentKey === 'AGENT_B');

      expect(agentA).toBeDefined();
      expect(agentA?.phoneMasked).toBe('+91 (***) ***-4331');
      expect(agentB).toBeDefined();
      expect(agentB?.phoneMasked).toBe('+91 (***) ***-1726');
    });

    it('2.2: Alternate-person rule assigns Agent B when Agent A is acting as borrower', async () => {
      await QaEscalationService.setActiveBorrowerRole('AGENT_A', 'test');
      const routing = await QaEscalationService.resolveDesignatedRecipient();

      expect(routing.actingBorrowerRole).toBe('AGENT_A');
      expect(routing.designatedRecipient).toBeDefined();
      expect(routing.designatedRecipient?.agentKey).toBe('AGENT_B');
      expect(routing.designatedRecipient?.phoneMasked).toBe('+91 (***) ***-1726');
      expect(routing.ruleDescription).toContain('cannot receive their own escalation');
    });

    it('2.3: POST /api/v1/qa/escalation-recipients/active-borrower toggles role and re-routes to Agent A', async () => {
      const res = await app.request('/api/v1/qa/escalation-recipients/active-borrower', {
        method: 'POST',
        headers: {
          'x-operator-auth': 'operator-local-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'AGENT_B' })
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.success).toBe(true);
      expect(data.actingBorrowerRole).toBe('AGENT_B');
      expect(data.designatedRecipient?.agentKey).toBe('AGENT_A');
      expect(data.designatedRecipient?.phoneMasked).toBe('+91 (***) ***-4331');

      // Reset back to AGENT_A
      await QaEscalationService.setActiveBorrowerRole('AGENT_A', 'test');
    });

    it('2.4: Reject invalid role with HTTP 400', async () => {
      const res = await app.request('/api/v1/qa/escalation-recipients/active-borrower', {
        method: 'POST',
        headers: {
          'x-operator-auth': 'operator-local-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'INVALID_AGENT' })
      });
      expect(res.status).toBe(400);
    });

    it('2.5: GET /api/v1/qa/escalation-recipients returns current recipients and active routing', async () => {
      const res = await app.request('/api/v1/qa/escalation-recipients', {
        method: 'GET',
        headers: { 'x-operator-auth': 'operator-local-token' }
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.recipients).toBeInstanceOf(Array);
      expect(data.recipients.length).toBeGreaterThanOrEqual(2);
      expect(data.actingBorrowerRole).toBe('AGENT_A');
      expect(data.designatedRecipient?.agentKey).toBe('AGENT_B');
    });
  });

  describe('3. Campaign Contacts Due Panel & Scheduling Evaluation', () => {
    it('3.1: CampaignScheduleService.getDueCampaignContacts returns structured due members across active campaigns', async () => {
      const dueData = await CampaignScheduleService.getDueCampaignContacts();

      expect(typeof dueData.dueEligibleCount).toBe('number');
      expect(typeof dueData.dueBlockedCount).toBe('number');
      expect(typeof dueData.totalDueCount).toBe('number');
      expect(dueData.dueContacts).toBeInstanceOf(Array);

      if (dueData.dueContacts.length > 0) {
        const contact = dueData.dueContacts[0];
        expect(contact.memberId).toBeDefined();
        expect(contact.loanId).toBeDefined();
        expect(contact.campaignId).toBeDefined();
        expect(contact.campaignName).toBeDefined();
        expect(contact.borrowerName).toBeDefined();
        expect(contact.loanNumberMasked).toMatch(/^LN-\*+/);
        expect(typeof contact.isEligible).toBe('boolean');
        expect(contact.contactType).toBeDefined();
      }
    });

    it('3.2: GET /api/v1/campaigns/due-contacts exposes due contacts to UI', async () => {
      const res = await app.request('/api/v1/campaigns/due-contacts', {
        method: 'GET',
        headers: { 'x-operator-auth': 'operator-local-token' }
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.totalDueCount).toBeDefined();
      expect(data.dueEligibleCount).toBeDefined();
      expect(data.dueContacts).toBeInstanceOf(Array);
    });
  });

  describe('4. Enriched Callbacks and Human Escalation Queues', () => {
    it('4.1: GET /api/v1/callbacks returns enriched campaignName and maskedLoanNumber', async () => {
      const res = await app.request('/api/v1/callbacks', {
        method: 'GET',
        headers: { 'x-operator-auth': 'operator-local-token' }
      });
      expect(res.status).toBe(200);
      const list = await res.json() as any[];

      expect(list).toBeInstanceOf(Array);
      if (list.length > 0) {
        const item = list[0];
        expect(item.campaignName).toBeDefined();
        expect(item.maskedLoanNumber).toBeDefined();
        expect(item.borrowerName).toBeDefined();
      }
    });

    it('4.2: GET /api/v1/human-queue returns enriched campaignName, borrowerName, and maskedLoanNumber', async () => {
      const res = await app.request('/api/v1/human-queue', {
        method: 'GET',
        headers: { 'x-operator-auth': 'operator-local-token' }
      });
      expect(res.status).toBe(200);
      const list = await res.json() as any[];

      expect(list).toBeInstanceOf(Array);
      if (list.length > 0) {
        const item = list[0];
        expect(item.campaignName).toBeDefined();
        expect(item.maskedLoanNumber).toBeDefined();
        expect(item.borrowerName).toBeDefined();
      }
    });
  });

  describe('5. Frozen Assets Byte-for-Byte Integrity', () => {
    it('5.1: docs/VAPI_SYSTEM_PROMPT.md matches frozen SHA-256', () => {
      const filePath = path.resolve(process.cwd(), 'docs/VAPI_SYSTEM_PROMPT.md');
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
      expect(hash).toBe('FD50A8F83103D177BE371C771D0D8000D8CB4DEE831395C98DD092439F8E2451');
    });

    it('5.2: docs/scripts/sync-vapi-prompt.ts matches frozen SHA-256', () => {
      const filePath = path.resolve(process.cwd(), 'docs/scripts/sync-vapi-prompt.ts');
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
      expect(hash).toBe('4DBA2E06452037CC3FDD319F1AA0165A2FDF53EE1CAF61336CEE284195C594C6');
    });
  });
});
