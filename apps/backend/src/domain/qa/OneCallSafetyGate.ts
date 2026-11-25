import { config } from '../../config';
import { maskPhoneE164 } from '../../index';

// ─── SINGLE-USE ONE-CALL AUTHORIZATION NONCE STORE ──────────────────────────
export interface OneCallAuthorizationNonce {
  nonce: string;
  authorizedBy: string;
  assistantId: string;
  destinationE164: string;
  createdAt: number;
  expiresAt: number;
  claimedAt?: number;
}

// In-memory atomic nonce registry for single-use owner authorization tokens
const activeAuthorizations = new Map<string, OneCallAuthorizationNonce>();

export function normalizeE164(phone?: string | null): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : '';
}

export function getAllowedTestDestinations(): string[] {
  return (config.ALLOWED_TEST_DESTINATIONS || '')
    .split(',')
    .map(s => normalizeE164(s))
    .filter(Boolean);
}

export function isDestinationAllowlisted(phone?: string | null): boolean {
  if (!phone) return false;
  const normalized = normalizeE164(phone);
  const allowed = getAllowedTestDestinations();
  return allowed.includes(normalized);
}

export class OneCallSafetyGate {
  /**
   * Evaluates all server-side prerequisites for a supervised QA voice dispatch.
   * Fails closed if any prerequisite, credential, or safety flag is missing.
   */
  static evaluatePreflight(requestedDestination?: string | null) {
    const rawAllowed = getAllowedTestDestinations();
    const selectedDestination = requestedDestination
      ? normalizeE164(requestedDestination)
      : rawAllowed[0] || normalizeE164(config.VERIFIED_PHONE_NUMBER) || '+15555550199';

    const isAllowlisted = rawAllowed.includes(selectedDestination);

    // 1. Safety Locks
    const productionCallsEnabled = config.PRODUCTION_CALLS_ENABLED;
    const supervisedQaVoiceEnabled = config.SUPERVISED_QA_VOICE_ENABLED;
    const safetyLockActive = !productionCallsEnabled || !supervisedQaVoiceEnabled;

    // 2. Dedicated QA Assistant (Must be set and different from frozen production assistant)
    const liveProductionAssistantId = config.VAPI_ASSISTANT_ID || 'e990ce6c-c8ef-4148-97e2-a680b465a66d';
    const qaAssistantId = config.VAPI_QA_ASSISTANT_ID || '';
    const isDedicatedQaAssistantConfigured = Boolean(qaAssistantId && qaAssistantId !== liveProductionAssistantId);

    // 3. Credentials presence (Presence only, not authentication claim)
    const vapiApiKeyConfigured = Boolean(config.VAPI_PRIVATE_API_KEY);
    const vapiSecretConfigured = Boolean(config.VAPI_WEBHOOK_SECRET);
    const twilioSidConfigured = Boolean(config.TWILIO_ACCOUNT_SID);
    const twilioTokenConfigured = Boolean(config.TWILIO_AUTH_TOKEN);
    const twilioVoiceNumberConfigured = Boolean(config.TWILIO_VOICE_NUMBER);
    const operatorPasswordConfigured = Boolean(config.OPERATOR_PASSWORD);

    // 4. Carrier route eligibility check (Twilio non-Indian CLI rule for Indian destination)
    const isTargetIndia = selectedDestination.startsWith('+91');
    const isVoiceNumberUsCanada = (config.TWILIO_VOICE_NUMBER || '').startsWith('+1');
    // Twilio guidelines state outbound calls to India must originate from an international (non-Indian) number.
    const compliesWithNonIndianCliRule = isTargetIndia ? isVoiceNumberUsCanada : true;

    // 5. Actionable Blockers
    const blockers: string[] = [];
    if (!productionCallsEnabled) {
      blockers.push('PRODUCTION_CALLS_ENABLED is false; live telephony and SMS are prohibited');
    }
    if (!supervisedQaVoiceEnabled) {
      blockers.push('SUPERVISED_QA_VOICE_ENABLED is false; supervised voice QA dispatch gate is locked');
    }
    if (!isDedicatedQaAssistantConfigured) {
      blockers.push('VAPI_QA_ASSISTANT_ID is missing or matches frozen production assistant (e990ce6c-c8ef-4148-97e2-a680b465a66d is protected)');
    }
    if (!isAllowlisted) {
      blockers.push(`TARGET_NOT_ALLOWLISTED: Destination ${maskPhoneE164(selectedDestination)} is not in ALLOWED_TEST_DESTINATIONS`);
    }
    if (!operatorPasswordConfigured) {
      blockers.push('MISSING_OPERATOR_PASSWORD: Dedicated operator credential is required');
    }
    if (!vapiSecretConfigured) {
      blockers.push('MISSING_VAPI_WEBHOOK_SECRET: Dashboard server secret must be configured');
    }
    if (isTargetIndia && !compliesWithNonIndianCliRule) {
      blockers.push('CARRIER_CLI_RESTRICTION: Twilio requires non-Indian CLI for outbound calls to India');
    }
    blockers.push('EXPLICIT_OWNER_APPROVAL_REQUIRED: Supervised single-call dispatch requires documented owner approval and authorization nonce');
    blockers.push('PROVIDER_DASHBOARD_VERIFICATION_REQUIRED: Saved assistant webhook URL and credentials must be verified in Vapi/Twilio dashboard');

    // 6. Synthetic Request Preview (Strictly synthetic data, masked phone, no inline serverUrl or secrets)
    const syntheticRequestPreview = {
      provider: 'vapi',
      endpoint: 'https://api.vapi.ai/call',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer [MASKED_VAPI_KEY]',
        'Content-Type': 'application/json'
      },
      payload: {
        assistantId: qaAssistantId || '[SEPARATELY_CONFIGURED_QA_ASSISTANT_ID_REQUIRED]',
        customer: {
          number: maskPhoneE164(selectedDestination)
        },
        phoneNumberId: config.VAPI_PHONE_NUMBER_ID || '[TWILIO_INTEGRATED_PHONE_NUMBER_ID]',
        serverUrlAuthMode: 'SAVED_SERVER_CONFIG (Dashboard Secret Validation)',
        assistantOverrides: {
          variableValues: {
            qa_scenario_type: 'INTERNAL_QA_SUPERVISED_TEST',
            synthetic_borrower_name: 'QA Test Recipient (Synthetic)',
            synthetic_reference_id: 'QA-SYN-001',
            test_disclaimer: 'THIS IS AN INTERNAL SYSTEM TEST — NOT A COLLECTION CALL'
          }
        }
      }
    };

    return {
      status: 'READY_WITH_BLOCKERS',
      readyForOwnerReview: true,
      readyForLiveDispatch: false,
      readyForSupervisedLiveCall: false,
      safetyLockActive,
      callControl: {
        enabled: false,
        reason: 'Not enabled — owner approval and a separately configured QA assistant are required.'
      },
      facets: {
        safetyInterlock: {
          productionCallsEnabled,
          supervisedQaVoiceEnabled,
          status: 'ENFORCED_FAIL_CLOSED'
        },
        credentials: {
          vapiApiKeyConfigured,
          vapiSecretConfigured,
          twilioSidConfigured,
          twilioTokenConfigured,
          twilioVoiceNumberConfigured,
          operatorPasswordConfigured,
          presenceClaimOnly: 'Presence verified; reachability and authorization require human dashboard check.'
        },
        qaAssistantSeparation: {
          frozenProductionAssistantId: liveProductionAssistantId,
          qaAssistantIdConfigured: Boolean(qaAssistantId),
          isSeparated: isDedicatedQaAssistantConfigured,
          draftPromptLocation: 'docs/VAPI_QA_SYSTEM_PROMPT_DRAFT.md',
          status: isDedicatedQaAssistantConfigured ? 'SEPARATED' : 'MISSING_BLOCKER'
        },
        allowlist: {
          targetTested: maskPhoneE164(selectedDestination),
          isAllowlisted,
          allowedCount: rawAllowed.length,
          carrierVerified: 'NOT_VERIFIED_AS_CARRIER_RECIPIENT',
          borrowerConsent: 'NOT_BORROWER_CONSENT',
          disclaimer: 'Test destination allowlisting is not borrower consent, does NOT constitute borrower consent, and does not authorize automated calling.'
        },
        carrierRouting: {
          destinationCountry: isTargetIndia ? '+91 (India)' : 'International',
          configuredCallerIdType: isVoiceNumberUsCanada ? '+1 (US/Canada International CLI)' : 'Other',
          compliesWithNonIndianCliRule,
          accountPermissionsVerified: false,
          routingAssessment: 'CODE_COMPLIANT_PROVIDER_PERMISSIONS_UNVERIFIED',
          notice: 'Twilio rules permit outbound calls to India from international numbers. International dialing permissions and trial account caller ID status must be verified in Twilio Console.'
        },
        webhookSecurity: {
          authModel: 'SAVED_SERVER_CONFIG',
          serverUrlInCallPayload: false,
          serverSecretDashboardEnforced: true,
          notice: 'No webhook URL or secret is passed in per-call payload. Assistant must use saved server credentials in Vapi dashboard.'
        },
        operatorAuth: {
          dedicatedPasswordConfigured: operatorPasswordConfigured,
          tokenStorageMode: 'SHA-256 Hashed',
          rateLimitingMode: 'DUAL_KEY (IP and Target Username)',
          maxFailedAttempts: 5
        },
        toolEndpointSecurity: {
          middleware: 'requireProviderAuth (Strict x-vapi-secret)',
          callAttemptBinding: true,
          loanCrossContextProtection: true,
          testOverrideRestriction: 'TEST_ONLY (Blocked in Production & Non-Disposable DB)'
        }
      },
      blockers,
      syntheticRequestPreview
    };
  }

  /**
   * Attempts to execute the single supervised call dispatch.
   * Strictly enforces fail-closed safety gate:
   * Returns HTTP 423 Locked or 403 Forbidden with callDispatched: false.
   */
  static async attemptDispatch(params: {
    targetPhone?: string;
    scenarioType?: string;
    operatorUser: string;
    oneCallNonce?: string;
    loanId?: string;
  }): Promise<{ status: number; body: any }> {
    // 1. Mandatory Safety Flag Verification
    if (!config.PRODUCTION_CALLS_ENABLED || !config.SUPERVISED_QA_VOICE_ENABLED) {
      return {
        status: 423,
        body: {
          error: 'SUPERVISED_QA_CALLS_DISABLED',
          message: 'Not enabled — owner approval and a separately configured QA assistant are required.',
          callDispatched: false,
          safetyLockActive: true
        }
      };
    }

    // 2. Dedicated QA Assistant Check (Cannot use frozen production assistant)
    const liveProductionAssistantId = config.VAPI_ASSISTANT_ID || 'e990ce6c-c8ef-4148-97e2-a680b465a66d';
    if (!config.VAPI_QA_ASSISTANT_ID || config.VAPI_QA_ASSISTANT_ID === liveProductionAssistantId) {
      return {
        status: 423,
        body: {
          error: 'QA_ASSISTANT_NOT_CONFIGURED',
          message: 'A separately configured QA assistant is required. Production assistant cannot be used for QA calls.',
          callDispatched: false
        }
      };
    }

    // 3. Exact Destination Allowlist Enforcement
    const targetE164 = normalizeE164(params.targetPhone);
    if (!isDestinationAllowlisted(targetE164)) {
      return {
        status: 403,
        body: {
          error: 'DESTINATION_NOT_ALLOWLISTED',
          message: `Destination ${maskPhoneE164(targetE164)} is not in ALLOWED_TEST_DESTINATIONS.`,
          callDispatched: false
        }
      };
    }

    // 4. Anti-Tampering Check: Reject operational baseline loans
    if (params.loanId && /^LN-1000\d{2}$/i.test(params.loanId)) {
      return {
        status: 403,
        body: {
          error: 'OPERATIONAL_BASELINE_PROTECTED',
          message: 'Baseline operational loan records (LN-100001–LN-100030) cannot be used for supervised live dispatch.',
          callDispatched: false
        }
      };
    }

    // 5. Single-use Owner Authorization Nonce Verification
    if (!params.oneCallNonce) {
      return {
        status: 403,
        body: {
          error: 'OWNER_AUTHORIZATION_REQUIRED',
          message: 'Explicit owner written approval and a valid single-use authorization nonce are required for live dispatch.',
          callDispatched: false
        }
      };
    }

    const authRecord = activeAuthorizations.get(params.oneCallNonce);
    const now = Date.now();

    if (!authRecord) {
      return {
        status: 403,
        body: {
          error: 'INVALID_AUTHORIZATION_NONCE',
          message: 'Provided authorization nonce is invalid or has expired.',
          callDispatched: false
        }
      };
    }

    if (authRecord.expiresAt < now) {
      activeAuthorizations.delete(params.oneCallNonce);
      return {
        status: 403,
        body: {
          error: 'AUTHORIZATION_NONCE_EXPIRED',
          message: 'Provided authorization nonce has expired.',
          callDispatched: false
        }
      };
    }

    // Atomic claim: check if already claimed
    if (authRecord.claimedAt) {
      return {
        status: 409,
        body: {
          error: 'AUTHORIZATION_NONCE_ALREADY_USED',
          message: 'This authorization nonce was already claimed. Each test call requires a fresh, separate owner authorization.',
          callDispatched: false
        }
      };
    }

    // Verify nonce binding (must match destination and assistant)
    if (authRecord.destinationE164 !== targetE164 || authRecord.assistantId !== config.VAPI_QA_ASSISTANT_ID) {
      return {
        status: 403,
        body: {
          error: 'AUTHORIZATION_NONCE_MISMATCH',
          message: 'Authorization nonce is not bound to the selected destination and assistant.',
          callDispatched: false
        }
      };
    }

    // Mark nonce claimed atomically
    authRecord.claimedAt = now;

    // In dry-run / Phase 7, live call dispatch remains disabled
    return {
      status: 423,
      body: {
        error: 'SUPERVISED_QA_CALLS_DISABLED',
        message: 'Not enabled — owner approval and a separately configured QA assistant are required.',
        callDispatched: false
      }
    };
  }

  /**
   * Helper for test suites to register a mock authorization nonce for testing verification logic.
   */
  static registerTestAuthorization(nonce: OneCallAuthorizationNonce) {
    activeAuthorizations.set(nonce.nonce, nonce);
  }

  static clearTestAuthorizations() {
    activeAuthorizations.clear();
  }
}
