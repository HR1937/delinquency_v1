import crypto from 'crypto';
import type { Context, Next } from 'hono';
import { db } from '../db/client';
import { operatorSessions } from '../db/schema';
import { config } from '../config';
import { eq, and, gt, or } from 'drizzle-orm';

/**
 * Constant-time safe string comparison to prevent timing attacks.
 */
export function safeCompare(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison to keep constant execution time
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * SHA-256 hash for session tokens to avoid storing plaintext bearer tokens in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── LOGIN ATTEMPT RATE LIMITER ─────────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkLoginRateLimit(ipOrKey: string): { allowed: boolean; remainingAttempts: number; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ipOrKey);
  if (record) {
    if (record.lockedUntil > now) {
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
    }
    if (record.lockedUntil <= now && record.count >= 5) {
      // lock expired, reset
      loginAttempts.delete(ipOrKey);
    }
  }
  const currentCount = record && record.lockedUntil <= now ? 0 : (record?.count || 0);
  return { allowed: true, remainingAttempts: Math.max(0, 5 - currentCount) };
}

export function recordFailedLogin(ipOrKey: string) {
  const now = Date.now();
  const record = loginAttempts.get(ipOrKey) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15 min lockout
  }
  loginAttempts.set(ipOrKey, record);
}

export function resetLoginAttempts(ipOrKey: string) {
  loginAttempts.delete(ipOrKey);
}

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

/**
 * Origin and CSRF validation for browser mutation requests.
 */
export async function csrfAndOriginCheck(c: Context, next: Next) {
  const method = c.req.method.toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const origin = c.req.header('origin');
    if (origin) {
      try {
        const parsedOrigin = new URL(origin).origin;
        if (!ALLOWED_ORIGINS.includes(parsedOrigin)) {
          console.warn(`[Security] Untrusted origin blocked by CSRF guard: ${origin}`);
          return c.json({
            error: 'CSRF_ORIGIN_FORBIDDEN',
            message: 'Cross-origin request blocked by local security policy.'
          }, 403);
        }
      } catch {
        return c.json({
          error: 'CSRF_ORIGIN_FORBIDDEN',
          message: 'Malformed origin header.'
        }, 403);
      }
    }
  }
  await next();
}

const ALLOWED_PUBLIC_PREFIXES = [
  '/api/v1/webhooks/',
  '/api/v1/tools/',
  '/health'
];

export function isAllowedPublicPath(pathname: string): boolean {
  if (pathname === '/health') return true;
  return ALLOWED_PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

/**
 * Detect whether incoming request originates from a public tunnel (e.g. ngrok) or external host.
 */
export function isPublicTunnelRequest(c: Context): boolean {
  // 1. Explicit ngrok trace header injected by ngrok edge
  if (c.req.header('ngrok-trace-id')) {
    return true;
  }

  // 2. Forwarded host header from reverse proxy or tunnel
  const fwdHost = c.req.header('x-forwarded-host');
  if (fwdHost && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(fwdHost.trim())) {
    return true;
  }

  // 3. Direct Host header check (reject non-loopback domains such as *.ngrok-free.app, *.ngrok.io)
  const host = c.req.header('host') || '';
  if (host && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host.trim())) {
    return true;
  }

  // 4. Reverse-proxy forwarded protocol and non-loopback client IP
  const proto = c.req.header('x-forwarded-proto');
  const fwdFor = c.req.header('x-forwarded-for');
  if (proto && fwdFor) {
    const clientIp = fwdFor.split(',')[0].trim();
    if (!/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1|localhost)$/i.test(clientIp)) {
      return true;
    }
  }

  // 5. Explicit simulation header for automated integration test coverage
  if (c.req.header('x-simulate-public-tunnel') === 'true') {
    return true;
  }

  return false;
}

/**
 * Local Internal Console Boundary Middleware
 *
 * Enforces that internal operations console endpoints (campaign orchestration, accounts,
 * eligibility queue, schedules, outbox, etc.) can only be accessed from the local internal
 * network (direct loopback), completely eliminating the need for an operator login form
 * or human credentials while strictly prohibiting public tunnel / ngrok traffic from
 * reaching unauthenticated management routes.
 */
export async function enforceInternalConsoleBoundary(c: Context, next: Next) {
  const url = new URL(c.req.url);
  const pathname = url.pathname;

  if (isPublicTunnelRequest(c)) {
    if (!isAllowedPublicPath(pathname)) {
      return c.json({
        error: 'FORBIDDEN_PUBLIC_TUNNEL_ACCESS',
        message: 'Operations console endpoints are restricted to local internal access only and are not accessible via public tunnels or external hosts.'
      }, 403);
    }
  }

  c.set('operatorUser', 'internal_console_user');
  c.set('operatorRole', 'console');
  return await next();
}

/**
 * Retain requireOperatorAuth alias pointing to internal console boundary
 * so existing console route definitions remain protected by network boundary without human login.
 */
export const requireOperatorAuth = enforceInternalConsoleBoundary;

/**
 * Check if the active database target is an approved disposable test database.
 * Used to guarantee test overrides cannot run against operational delinquency_poc.
 */
export function isDisposableTestDatabaseTarget(): boolean {
  try {
    const rawUrl = config.DATABASE_URL || process.env.DATABASE_URL || '';
    if (!rawUrl) return false;
    let decoded = '';
    try {
      decoded = decodeURIComponent(rawUrl).toLowerCase();
    } catch {
      decoded = rawUrl.toLowerCase();
    }
    // Strictly reject any appearance of delinquency_poc
    if (decoded.includes('delinquency_poc')) return false;

    // Must match disposable pattern
    const isApprovedDisposable = /(?:_test|_disposable|tmp_test)/i.test(decoded);
    const optIn = process.env.TEST_DISPOSABLE_DB_OPT_IN === 'true';

    return isApprovedDisposable && optIn;
  } catch {
    return false;
  }
}

/**
 * Strict Provider Authentication Middleware
 * Used for provider voice tool callbacks (/api/v1/tools/*).
 * Requires a valid x-vapi-secret header matching the configured webhook secret.
 * Operator sessions are NOT accepted on provider-only tool endpoints.
 *
 * Test-only override requirement:
 * The override is enabled ONLY when ALL of the following are simultaneously true:
 * 1. A test runtime is detected (NODE_ENV === 'test')
 * 2. An explicit server-side test flag is set (ENABLE_PROVIDER_TOOL_TEST_OVERRIDE === 'true')
 * 3. The target database is proven disposable and opted-in (isDisposableTestDatabaseTarget() === true)
 * 4. An explicit request header 'x-provider-tool-test-override: true' is supplied.
 * A request header alone is NEVER sufficient in development, staging, or production.
 */
export async function requireProviderAuth(c: Context, next: Next) {
  const vapiSecret = c.req.header('x-vapi-secret');
  if (vapiSecret && config.VAPI_WEBHOOK_SECRET && safeCompare(vapiSecret, config.VAPI_WEBHOOK_SECRET)) {
    c.set('operatorUser', 'vapi_provider_assistant');
    c.set('operatorRole', 'provider_assistant');
    return await next();
  }

  // Multi-gated test-only override check
  const isTestRuntime = process.env.NODE_ENV === 'test' || (typeof Bun !== 'undefined' && Bun.env.NODE_ENV === 'test');
  const isServerOverrideEnabled = process.env.ENABLE_PROVIDER_TOOL_TEST_OVERRIDE === 'true';
  const hasHeaderOverride = c.req.header('x-provider-tool-test-override') === 'true';

  if (isTestRuntime && isServerOverrideEnabled && hasHeaderOverride && isDisposableTestDatabaseTarget()) {
    return await requireOperatorAuth(c, next);
  }

  return c.json({
    error: 'UNAUTHORIZED_PROVIDER_CALL',
    message: 'Valid x-vapi-secret header matching provider configuration is required for voice tool endpoints.'
  }, 401);
}

/**
 * Provider or Operator Authentication Middleware
 * Used for dual-access endpoints.
 */
export async function requireProviderOrOperatorAuth(c: Context, next: Next) {
  // 1. Check for x-vapi-secret header from Vapi voice engine
  const vapiSecret = c.req.header('x-vapi-secret');
  if (vapiSecret && config.VAPI_WEBHOOK_SECRET && safeCompare(vapiSecret, config.VAPI_WEBHOOK_SECRET)) {
    c.set('operatorUser', 'vapi_provider_assistant');
    c.set('operatorRole', 'provider_assistant');
    return await next();
  }

  // 2. Fall back to standard operator authentication
  return await requireOperatorAuth(c, next);
}
