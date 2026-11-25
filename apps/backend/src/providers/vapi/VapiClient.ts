import { config } from '../../config';

export class VapiClient {
  private static baseUrl = 'https://api.vapi.ai';

  private static getHeaders() {
    return {
      'Authorization': `Bearer ${config.VAPI_PRIVATE_API_KEY}`,
      'Content-Type': 'application/json'
    };
  }

  static async getAssistant(assistantId?: string) {
    const id = assistantId || config.VAPI_ASSISTANT_ID;
    if (!id || !config.VAPI_PRIVATE_API_KEY) {
      return { ok: false, error: 'VAPI_ASSISTANT_ID or VAPI_PRIVATE_API_KEY not configured' };
    }

    try {
      const res = await fetch(`${this.baseUrl}/assistant/${id}`, {
        headers: this.getHeaders()
      });
      if (!res.ok) {
        return { ok: false, status: res.status, error: await res.text() };
      }
      const data = await res.json();
      return { ok: true, data };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  static async initiateOutboundCall(params: {
    toNumber: string;
    customerName?: string;
    contextVariables?: Record<string, any>;
  }) {
    // Phase 5 Safety Lock: Real outbound telephony dispatch is prohibited during Phase 5 integration readiness
    if (!config.PRODUCTION_CALLS_ENABLED) {
      throw new Error('PHASE5_SAFETY_LOCK: Real outbound telephony dispatch is prohibited during Phase 5 integration readiness. Use isolated QA Simulator or dry-run preview.');
    }

    // Safety check against allowed destinations
    const allowed = config.ALLOWED_TEST_DESTINATIONS.split(',').map(s => s.trim());
    if (!allowed.includes(params.toNumber)) {
      throw new Error(`SAFETY_INTERLOCK: Destination ${params.toNumber} is not in ALLOWED_TEST_DESTINATIONS`);
    }

    const payload: any = {
      assistantId: config.VAPI_ASSISTANT_ID,
      customer: {
        number: params.toNumber,
        name: params.customerName || 'Borrower'
      },
      assistantOverrides: {
        variableValues: params.contextVariables || {}
      }
    };

    if (config.TWILIO_VOICE_NUMBER) {
      payload.phoneNumber = {
        twilioPhoneNumber: config.TWILIO_VOICE_NUMBER,
        twilioAccountSid: config.TWILIO_ACCOUNT_SID,
        twilioAuthToken: config.TWILIO_AUTH_TOKEN
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/call`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorText = await res.text();
        return { success: false, error: errorText };
      }
      const data = await res.json();
      return { success: true, callId: data.id, providerData: data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
