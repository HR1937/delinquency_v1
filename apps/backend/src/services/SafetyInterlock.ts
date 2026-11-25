import { config } from '../config';

export interface SafetyValidationResult {
  allowed: boolean;
  destination: string;
  reason?: string;
  productionMode: boolean;
}

export class SafetyInterlock {
  /**
   * Validates if an outbound destination is permitted under current environment rules.
   * In non-production mode, only explicitly allowlisted test destinations can be dialed.
   */
  static validateDestination(phoneE164: string): SafetyValidationResult {
    const isProduction = !!config.PRODUCTION_CALLS_ENABLED;

    if (isProduction) {
      return {
        allowed: true,
        destination: phoneE164,
        productionMode: true
      };
    }

    const allowedList = (config.ALLOWED_TEST_DESTINATIONS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const isMatch = allowedList.includes(phoneE164);

    if (!isMatch) {
      return {
        allowed: false,
        destination: phoneE164,
        reason: `Safety interlock active: destination ${phoneE164 ? phoneE164.replace(/\d(?=\d{4})/g, 'x') : 'empty'} is not in ALLOWED_TEST_DESTINATIONS. Live calls are blocked in test mode.`,
        productionMode: false
      };
    }

    return {
      allowed: true,
      destination: phoneE164,
      productionMode: false
    };
  }

  /**
   * Returns current safety interlock configuration status without exposing raw secrets.
   */
  static getStatus() {
    const allowed = (config.ALLOWED_TEST_DESTINATIONS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    return {
      productionEnabled: !!config.PRODUCTION_CALLS_ENABLED,
      configuredTestDestinationsCount: allowed.length,
      allowlistActive: !config.PRODUCTION_CALLS_ENABLED,
      destinationsMasked: allowed.map(d => d.replace(/\d(?=\d{4})/g, 'x'))
    };
  }
}
