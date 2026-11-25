import { z } from 'zod';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Determine if running under test runner
const isTestEnv = process.env.NODE_ENV === 'test' ||
  (typeof Bun !== 'undefined' && Bun.env.NODE_ENV === 'test') ||
  process.env.TEST_DISPOSABLE_DB_OPT_IN === 'true';

const testEnvPath = path.resolve(process.cwd(), '.env.test');
const defaultEnvPath = path.resolve(process.cwd(), '.env');

if (isTestEnv && fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true });
} else if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
} else {
  dotenv.config({ path: '../../.env' });
}

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  VAPI_PRIVATE_API_KEY: z.string().default(''),
  VAPI_PUBLIC_KEY: z.string().default(''),
  VAPI_ASSISTANT_ID: z.string().default(''),
  VAPI_PHONE_NUMBER_ID: z.string().default(''),
  VAPI_SIP_URI: z.string().default(''),
  VAPI_WEBHOOK_SECRET: z.string().default('vapi_poc_webhook_secret_2026'),
  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),
  TWILIO_VOICE_NUMBER: z.string().default(''),
  TWILIO_SMS_FROM_NUMBER: z.string().default(''),
  TWILIO_SMS_MODE: z.string().default('disable').transform(v => {
    const clean = (v || '').trim().toLowerCase();
    return clean === 'enable' ? 'enable' : 'disable';
  }),
  VERIFIED_PHONE_NUMBER: z.string().default('+919328234331'),
  ALLOWED_TEST_DESTINATIONS: z.string().default('+919328234331,+916353191726'),
  VERIFIED_CALL_DESTINATIONS_E164: z.string().default('').transform(v => {
    return (v || '').split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.startsWith('+') ? s : `+${s.replace(/\D/g, '')}`)
      .filter(s => /^\+[1-9]\d{7,14}$/.test(s));
  }),
  PRODUCTION_CALLS_ENABLED: z.string().default('false').transform(v => v === 'true'),
  SUPERVISED_QA_VOICE_ENABLED: z.string().default('false').transform(v => v === 'true'),
  CAMPAIGN_AUTODISPATCH_ENABLED: z.string().default('false').transform(v => v === 'true'),
  VAPI_WEB_QA_MODE: z.string().default('disable').transform(v => {
    const clean = (v || '').trim().toLowerCase();
    return clean === 'enable' ? 'enable' : 'disable';
  }),
  VAPI_QA_SERVER_URL: z.string().default(''),
  PUBLIC_BASE_URL: z.string().default('http://localhost:3000'),
  PORT: z.string().default('3000').transform(Number),
  ADMIN_SECRET: z.string().default('c6b24505f9923e445339f4ad59e9a4f6be592db44ce8832a818314953bf6da4b'),
  PAYMENT_PORTAL_BASE_URL: z.string().optional().default(''),
  SECURE_IVR_NUMBER: z.string().optional().default(''),
  HUMAN_QUEUE_DESTINATION: z.string().optional().default('')
});

export const config = ConfigSchema.parse(process.env);

export function isTwilioSmsEnabled(): boolean {
  const current = (process.env.TWILIO_SMS_MODE !== undefined ? process.env.TWILIO_SMS_MODE : config.TWILIO_SMS_MODE || '').trim().toLowerCase();
  return current === 'enable';
}

export function isWebQaEnabled(): boolean {
  const current = (process.env.VAPI_WEB_QA_MODE !== undefined ? process.env.VAPI_WEB_QA_MODE : config.VAPI_WEB_QA_MODE || '').trim().toLowerCase();
  return current === 'enable';
}

export function getVerifiedCallDestinations(): string[] {
  const raw = process.env.VERIFIED_CALL_DESTINATIONS_E164 !== undefined
    ? process.env.VERIFIED_CALL_DESTINATIONS_E164
    : (Array.isArray(config.VERIFIED_CALL_DESTINATIONS_E164) ? config.VERIFIED_CALL_DESTINATIONS_E164.join(',') : '');
  return (raw || '').split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.startsWith('+') ? s : `+${s.replace(/\D/g, '')}`)
    .filter(s => /^\+[1-9]\d{7,14}$/.test(s));
}

export function isVerifiedCallDestination(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = phone.trim().replace(/\D/g, '');
  const e164 = phone.trim().startsWith('+') ? `+${digits}` : `+${digits}`;
  return getVerifiedCallDestinations().includes(e164);
}
