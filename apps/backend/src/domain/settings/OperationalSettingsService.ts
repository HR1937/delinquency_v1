import { db } from '../../db/client';
import { operationalSettings, stateChangeLog } from '../../db/schema';
import { config, isTwilioSmsEnabled } from '../../config';
import { eq } from 'drizzle-orm';

export type VoiceMode = 'OFF' | 'BROWSER_TESTING' | 'OUTBOUND_CALLS';

export interface OperationalSettingsPayload {
  voiceMode?: VoiceMode;
  smsEnabled?: boolean;
  campaignAutodispatchEnabled?: boolean;
}

export interface EffectiveSettings {
  voiceMode: VoiceMode;
  smsEnabled: boolean;
  campaignAutodispatchEnabled: boolean;
  effective: {
    browserTesting: boolean;
    outboundCalls: boolean;
    sms: boolean;
    campaignAutodispatch: boolean;
  };
  ceilings: {
    productionCallsEnabled: boolean;
    twilioSmsMode: string;
    campaignAutodispatchEnabled: boolean;
    verifiedCallDestinationsCount: number;
  };
  lockReasons: {
    outboundCalls: string | null;
    sms: string | null;
    campaignAutodispatch: string | null;
  };
  updatedAt: string;
  updatedBy: string;
}

export class OperationalSettingsService {
  static async getSettings(): Promise<EffectiveSettings> {
    let row = await db.query.operationalSettings.findFirst({
      where: (s, { eq }) => eq(s.id, 'default')
    });

    if (!row) {
      try {
        const [inserted] = await db.insert(operationalSettings).values({
          id: 'default',
          voiceMode: 'BROWSER_TESTING',
          smsEnabled: false,
          updatedBy: 'system'
        }).onConflictDoNothing().returning();
        row = inserted || await db.query.operationalSettings.findFirst({
          where: (s, { eq }) => eq(s.id, 'default')
        });
      } catch {
        row = await db.query.operationalSettings.findFirst({
          where: (s, { eq }) => eq(s.id, 'default')
        });
      }
    }

    const persistedVoiceMode: VoiceMode = (row?.voiceMode as VoiceMode) || 'BROWSER_TESTING';
    const persistedSmsEnabled: boolean = Boolean(row?.smsEnabled);
    const persistedAutodispatch: boolean = Boolean(row?.campaignAutodispatchEnabled);

    // Ceilings from immutable deployment configuration
    const productionCallsEnabled = Boolean(process.env.PRODUCTION_CALLS_ENABLED === 'true' || config.PRODUCTION_CALLS_ENABLED);
    const twilioSmsEnabled = isTwilioSmsEnabled();

    // Lock reasons
    const outboundLockReason = !productionCallsEnabled
      ? 'DEPLOYMENT_CEILING_LOCKED: Outbound PSTN calling is disabled by server safety ceiling (PRODUCTION_CALLS_ENABLED=false).'
      : null;

    const smsLockReason = !twilioSmsEnabled
      ? `DEPLOYMENT_CEILING_LOCKED: SMS messaging is disabled by server safety ceiling (TWILIO_SMS_MODE=${process.env.TWILIO_SMS_MODE || config.TWILIO_SMS_MODE}).`
      : null;

    const autodispatchLockReason = !config.CAMPAIGN_AUTODISPATCH_ENABLED
      ? 'DEPLOYMENT_CEILING_LOCKED: Campaign autodispatch is disabled by server safety ceiling (CAMPAIGN_AUTODISPATCH_ENABLED=false).'
      : null;

    // Effective runtime states
    // Legacy test override support: if process.env.VAPI_WEB_QA_MODE === 'disable', browser testing effective is false
    const webQaEnvDisabled = process.env.VAPI_WEB_QA_MODE === 'disable';
    const effectiveBrowserTesting = persistedVoiceMode === 'BROWSER_TESTING' && !webQaEnvDisabled;
    const effectiveOutboundCalls = persistedVoiceMode === 'OUTBOUND_CALLS' && productionCallsEnabled;
    const effectiveSms = persistedSmsEnabled && twilioSmsEnabled;
    const effectiveAutodispatch = persistedAutodispatch && Boolean(config.CAMPAIGN_AUTODISPATCH_ENABLED);

    return {
      voiceMode: persistedVoiceMode,
      smsEnabled: persistedSmsEnabled,
      campaignAutodispatchEnabled: persistedAutodispatch,
      effective: {
        browserTesting: effectiveBrowserTesting,
        outboundCalls: effectiveOutboundCalls,
        sms: effectiveSms,
        campaignAutodispatch: effectiveAutodispatch
      },
      ceilings: {
        productionCallsEnabled,
        twilioSmsMode: process.env.TWILIO_SMS_MODE || config.TWILIO_SMS_MODE,
        campaignAutodispatchEnabled: Boolean(config.CAMPAIGN_AUTODISPATCH_ENABLED),
        verifiedCallDestinationsCount: Array.isArray(config.VERIFIED_CALL_DESTINATIONS_E164) ? config.VERIFIED_CALL_DESTINATIONS_E164.length : 0
      },
      lockReasons: {
        outboundCalls: outboundLockReason,
        sms: smsLockReason,
        campaignAutodispatch: autodispatchLockReason
      },
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
      updatedBy: row?.updatedBy || 'operator'
    };
  }

  static async updateSettings(
    payload: OperationalSettingsPayload,
    operator: string = 'operator'
  ): Promise<{ success: boolean; data?: EffectiveSettings; error?: string; reason?: string; message?: string }> {
    const current = await this.getSettings();

    // 1. Validate requested voiceMode
    if (payload.voiceMode !== undefined) {
      const targetMode = payload.voiceMode;
      if (!['OFF', 'BROWSER_TESTING', 'OUTBOUND_CALLS'].includes(targetMode)) {
        return {
          success: false,
          error: 'INVALID_VOICE_MODE',
          reason: 'UNSUPPORTED_VOICE_MODE',
          message: `Voice mode '${targetMode}' is not supported. Must be 'OFF', 'BROWSER_TESTING', or 'OUTBOUND_CALLS'.`
        };
      }
    }

    // 2. Persist operational settings update without blocking UI toggles
    const newVoiceMode = payload.voiceMode !== undefined ? payload.voiceMode : current.voiceMode;
    const newSmsEnabled = payload.smsEnabled !== undefined ? payload.smsEnabled : current.smsEnabled;
    const newAutodispatch = payload.campaignAutodispatchEnabled !== undefined ? payload.campaignAutodispatchEnabled : current.campaignAutodispatchEnabled;

    await db.insert(operationalSettings).values({
      id: 'default',
      voiceMode: newVoiceMode,
      smsEnabled: newSmsEnabled,
      campaignAutodispatchEnabled: newAutodispatch,
      updatedAt: new Date(),
      updatedBy: operator
    }).onConflictDoUpdate({
      target: operationalSettings.id,
      set: {
        voiceMode: newVoiceMode,
        smsEnabled: newSmsEnabled,
        campaignAutodispatchEnabled: newAutodispatch,
        updatedAt: new Date(),
        updatedBy: operator
      }
    });

    // 4. Audit logging in stateChangeLog
    await db.insert(stateChangeLog).values({
      fieldName: 'operational_settings',
      previousValue: {
        voiceMode: current.voiceMode,
        smsEnabled: current.smsEnabled,
        campaignAutodispatchEnabled: current.campaignAutodispatchEnabled
      },
      newValue: {
        voiceMode: newVoiceMode,
        smsEnabled: newSmsEnabled,
        campaignAutodispatchEnabled: newAutodispatch
      },
      changedBy: operator
    });

    const updated = await this.getSettings();
    return {
      success: true,
      data: updated
    };
  }
}
