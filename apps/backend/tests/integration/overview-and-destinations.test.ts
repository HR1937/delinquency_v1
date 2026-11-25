import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { assertDisposableTestDatabase } from '../test-cleanup';
import {
  verifiedCallDestinations,
  operationalSettings
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { DestinationRegistryService } from '../../src/domain/settings/DestinationRegistryService';

describe('Overview Tab Metrics & Verified Destination Registry Suite', () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
  });

  afterAll(async () => {
    // Clean up test destination records
    await db.delete(verifiedCallDestinations)
      .where(eq(verifiedCallDestinations.approvalSource, 'TEST_SUITE'));
  });

  describe('1. Dashboard Summary Truthful Metrics', () => {
    it('1.1: GET /api/v1/dashboard/summary returns truthful metrics with correct types and keys', async () => {
      const res = await app.request('/api/v1/dashboard/summary', { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      // Campaign counts
      expect(typeof data.activeCampaignsCount).toBe('number');
      expect(typeof data.totalCampaignsCount).toBe('number');
      expect(data.activeCampaignsCount).toBeGreaterThanOrEqual(0);
      expect(data.totalCampaignsCount).toBeGreaterThanOrEqual(data.activeCampaignsCount);

      // Account counts
      expect(typeof data.borrowersAssignedToCampaigns).toBe('number');
      expect(typeof data.portfolioAccountsCount).toBe('number');
      expect(typeof data.qaScenarioAccountsCount).toBe('number');
      expect(data.portfolioAccountsCount).toBeGreaterThanOrEqual(0);

      // Provider call and RPC metrics
      expect(typeof data.completedCallCount).toBe('number');
      expect(typeof data.rpcCount).toBe('number');
      expect(typeof data.rpcRate).toBe('string');
      if (data.completedCallCount > 0) {
        expect(data.rpcRate).toMatch(/^\d+(\.\d+)?%$/);
      } else {
        expect(data.rpcRate).toBe('—');
      }

      // Callbacks
      expect(typeof data.borrowerCallbacksPending).toBe('number');
      expect(typeof data.scenarioCallbacksPending).toBe('number');
      expect(data.callbacksPending).toBe(data.borrowerCallbacksPending);
    });
  });

  describe('2. Verified Call Destinations Registry API', () => {
    let createdDestId: string;
    const testE164 = '+14155552671';

    it('2.1: GET /api/v1/destinations returns destination list with masked phones', async () => {
      const res = await app.request('/api/v1/destinations', { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(typeof data.count).toBe('number');
      expect(Array.isArray(data.destinations)).toBe(true);
      for (const dest of data.destinations) {
        expect(dest.id).toBeDefined();
        expect(dest.phoneMasked).toBeDefined();
        expect(dest.phoneMasked).toContain('***');
        expect(dest.status).toBeDefined();
      }
    });

    it('2.2: POST /api/v1/destinations registers a valid E.164 phone number', async () => {
      const res = await app.request('/api/v1/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneE164: testE164,
          label: 'Integration Test Line',
          notes: 'Added via overview test suite',
          approvedBy: 'Test Runner'
        })
      });

      expect(res.status).toBe(201);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.destination.phoneMasked).toContain('***');
      expect(data.destination.status).toBe('active');
      createdDestId = data.destination.id;

      // Verify that DestinationRegistryService reports it as verified
      const isVerified = await DestinationRegistryService.isDestinationVerified(testE164);
      expect(isVerified).toBe(true);
    });

    it('2.3: POST /api/v1/destinations rejects invalid phone numbers (non-E.164)', async () => {
      const invalidNumbers = ['123', 'invalid-phone', '555-0199', ''];

      for (const invalid of invalidNumbers) {
        const res = await app.request('/api/v1/destinations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneE164: invalid })
        });
        expect(res.status).toBe(400);
        const data = await res.json() as any;
        expect(data.error).toBeDefined();
      }
    });

    it('2.4: PATCH /api/v1/destinations/:id/revoke revokes an active destination', async () => {
      expect(createdDestId).toBeDefined();

      const res = await app.request(`/api/v1/destinations/${createdDestId}/revoke`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Test revocation' })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);

      // Verify that DestinationRegistryService no longer considers it verified
      const isVerified = await DestinationRegistryService.isDestinationVerified(testE164);
      expect(isVerified).toBe(false);
    });

    it('2.5: PATCH /api/v1/destinations/:id/revoke returns 404 for unknown id', async () => {
      const res = await app.request('/api/v1/destinations/00000000-0000-0000-0000-000000000000/revoke', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Test' })
      });
      expect(res.status).toBe(404);
    });
  });

  describe('3. Operational Settings Autodispatch & Health Diagnostics', () => {
    it('3.1: PATCH /api/v1/settings updates campaignAutodispatchEnabled', async () => {
      const res = await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignAutodispatchEnabled: true })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.campaignAutodispatchEnabled).toBe(true);

      // Revert back to false
      const revertRes = await app.request('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignAutodispatchEnabled: false })
      });
      expect(revertRes.status).toBe(200);
      const revertData = await revertRes.json() as any;
      expect(revertData.campaignAutodispatchEnabled).toBe(false);
    });

    it('3.2: GET /api/v1/integrations/health includes consoleSecurity diagnostic', async () => {
      const res = await app.request('/api/v1/integrations/health', { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.consoleSecurity).toBeDefined();
      expect(data.consoleSecurity.boundary).toBe('LOCAL_LOOPBACK_ONLY');
      expect(data.consoleSecurity.status).toBe('active');
      expect(data.consoleSecurity.accessModel).toContain('Direct Local Console');
      expect(data.consoleSecurity.explanation).toBeDefined();
    });
  });
});
