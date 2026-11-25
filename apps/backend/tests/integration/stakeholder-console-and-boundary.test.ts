import { describe, it, expect, beforeAll } from 'bun:test';
import { app } from '../../src/index';
import { db } from '../../src/db/client';
import { config } from '../../src/config';
import { assertDisposableTestDatabase } from '../test-cleanup';

describe('Stakeholder Console & Network Boundary Security Suite', () => {
  beforeAll(async () => {
    await assertDisposableTestDatabase();
  });

  // ─── 1. DIRECT CONSOLE ACCESS (NO OPERATOR LOGIN) ──────────────────────────
  describe('1. Direct Console Access (Zero Operator Login)', () => {
    it('1.1: Local loopback requests to sensitive console routes succeed directly without auth token or session', async () => {
      const routes = [
        '/api/v1/accounts',
        '/api/v1/campaigns',
        '/api/v1/dashboard/summary',
        '/api/v1/eligibility/queue',
        '/api/v1/callbacks',
        '/api/v1/audit/timeline'
      ];

      for (const route of routes) {
        const res = await app.request(route, { method: 'GET' });
        expect(res.status).toBe(200);
      }
    }, 15000);

    it('1.2: Session endpoint returns authenticated console state directly', async () => {
      const res = await app.request('/api/v1/auth/session', { method: 'GET' });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.authenticated).toBe(true);
      expect(data.operator.role).toBe('console');
      expect(data.operator.username).toBe('Stakeholder');
    });

    it('1.3: Login endpoint reports retired status cleanly without credentials', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Stakeholder' })
      });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.message).toContain('retired');
    });

    it('1.4: Logout endpoint reports retired status cleanly', async () => {
      const res = await app.request('/api/v1/auth/logout', { method: 'POST' });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.message).toContain('retired');
    });
  });

  // ─── 2. NETWORK BOUNDARY ENFORCEMENT (PUBLIC TUNNEL ISOLATION) ─────────────
  describe('2. Network Boundary Enforcement (Public Tunnel vs Local Loopback)', () => {
    it('2.1: Blocks public tunnel request with ngrok-trace-id from console routes with HTTP 403', async () => {
      const res = await app.request('/api/v1/accounts', {
        headers: { 'ngrok-trace-id': 'simulated-ngrok-header-12345' }
      });
      expect(res.status).toBe(403);
      const data = await res.json() as any;
      expect(data.error).toBe('FORBIDDEN_PUBLIC_TUNNEL_ACCESS');
    });

    it('2.2: Blocks public tunnel request with external x-forwarded-host from console routes with HTTP 403', async () => {
      const res = await app.request('/api/v1/dashboard/summary', {
        headers: { 'x-forwarded-host': 'my-poc.ngrok-free.app' }
      });
      expect(res.status).toBe(403);
      const data = await res.json() as any;
      expect(data.error).toBe('FORBIDDEN_PUBLIC_TUNNEL_ACCESS');
    });

    it('2.3: Blocks public tunnel request with non-loopback Host header from console routes with HTTP 403', async () => {
      const res = await app.request('/api/v1/campaigns', {
        headers: { 'Host': 'poc-tunnel.loca.lt' }
      });
      expect(res.status).toBe(403);
      const data = await res.json() as any;
      expect(data.error).toBe('FORBIDDEN_PUBLIC_TUNNEL_ACCESS');
    });

    it('2.4: Blocks simulated public tunnel header on audit timeline endpoint with HTTP 403', async () => {
      const res = await app.request('/api/v1/audit/timeline', {
        headers: { 'x-simulate-public-tunnel': 'true' }
      });
      expect(res.status).toBe(403);
      const data = await res.json() as any;
      expect(data.error).toBe('FORBIDDEN_PUBLIC_TUNNEL_ACCESS');
    });

    it('2.5: Allows authenticated Vapi tool requests through public tunnel with x-vapi-secret', async () => {
      const res = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-trace-id': 'vapi-tool-call-trace',
          'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
        },
        body: JSON.stringify({ callAttemptId: '00000000-0000-0000-0000-000000000099' })
      });
      // 404 means the tool route was REACHED through the tunnel (not 403 tunnel blocked)
      expect(res.status).toBe(404);
      const data = await res.json() as any;
      expect(data.error).toBe('INVALID_CALL_CONTEXT');
    });

    it('2.6: Rejects unauthenticated Vapi tool requests through public tunnel with HTTP 401', async () => {
      const res = await app.request('/api/v1/tools/get-borrower-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-trace-id': 'vapi-tool-call-trace'
        },
        body: JSON.stringify({ callAttemptId: '00000000-0000-0000-0000-000000000099' })
      });
      expect(res.status).toBe(401);
      const data = await res.json() as any;
      expect(data.error).toBe('UNAUTHORIZED_PROVIDER_CALL');
    });

    it('2.7: Allows authenticated Vapi webhooks through public tunnel with x-vapi-secret', async () => {
      const res = await app.request('/api/v1/webhooks/vapi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-trace-id': 'vapi-webhook-trace',
          'x-vapi-secret': config.VAPI_WEBHOOK_SECRET
        },
        body: JSON.stringify({
          message: {
            type: 'status-update',
            status: 'ended',
            call: { id: 'call_tunnel_test_123', status: 'ended' }
          }
        })
      });
      // Webhook should process and return 200
      expect(res.status).toBe(200);
    });
  });

  // ─── 3. SINGLE CANONICAL VAPI ASSISTANT ARCHITECTURE ───────────────────────
  describe('3. Single Canonical Assistant Architecture', () => {
    it('3.1: web-qa-config returns single canonical assistant ID and no QA assistant divergence', async () => {
      const res = await app.request('/api/v1/integrations/web-qa-config');
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.assistantId).toBe(config.VAPI_ASSISTANT_ID);
      expect(data.assistantConfigured).toBe(true);
      expect(data).not.toHaveProperty('qaAssistantId');
    });

    it('3.2: web-qa-session delivers canonical assistant ID and synthetic session context', async () => {
      const prevMode = process.env.VAPI_WEB_QA_MODE;
      const prevPub = process.env.VAPI_PUBLIC_KEY;
      process.env.VAPI_WEB_QA_MODE = 'enable';
      process.env.VAPI_PUBLIC_KEY = 'vapi_test_pubkey';
      try {
        const res = await app.request('/api/v1/integrations/web-qa-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.success).toBe(true);
        expect(data.assistantId).toBe(config.VAPI_ASSISTANT_ID);
        expect(data.syntheticContext).toBeDefined();
        expect(data.syntheticContext.borrower_first_name).toBe('Alex');
      } finally {
        process.env.VAPI_WEB_QA_MODE = prevMode;
        process.env.VAPI_PUBLIC_KEY = prevPub;
      }
    });
  });

  // ─── 4. STAKEHOLDER AUDIT TIMELINE & SECRET REDACTION ──────────────────────
  describe('4. Stakeholder Audit Timeline & Secret Redaction', () => {
    it('4.1: GET /api/v1/audit/timeline returns structured events with required facets', async () => {
      const res = await app.request('/api/v1/audit/timeline');
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(Array.isArray(data.events)).toBe(true);
      expect(typeof data.totalEvents).toBe('number');

      if (data.events.length > 0) {
        const event = data.events[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('category');
        expect(event).toHaveProperty('title');
        expect(event).toHaveProperty('summary');
        expect(event).toHaveProperty('isSimulated');
      }
    });

    it('4.2: GET /api/v1/audit/timeline filters cleanly by loanId', async () => {
      const baselineLoan = await db.query.loans.findFirst({
        where: (l, { eq }) => eq(l.loanNumber, 'LN-100001')
      });
      expect(baselineLoan).toBeDefined();

      const res = await app.request(`/api/v1/audit/timeline?loanId=${baselineLoan!.id}`);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(Array.isArray(data.events)).toBe(true);
      for (const ev of data.events) {
        if (ev.loanId) {
          expect(ev.loanId).toBe(baselineLoan!.id);
        }
      }
    });

    it('4.3: Health integration reports clean stakeholder voice & SMS status', async () => {
      const res = await app.request('/api/v1/integrations/health');
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.voiceChannel).toBe('BROWSER_TESTING_ONLY');
      expect(data.smsState).toBe('OFF');
      expect(data.outboundPhoneCalls).toBe('OFF');
    });
  });
});
