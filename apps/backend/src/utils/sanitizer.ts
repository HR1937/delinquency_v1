/**
 * Sensitive Data Sanitizer
 * Redacts Payment Card PANs, CVVs, SSNs, and sensitive payment payload data
 * from durable records, transcripts, logs, and frontend responses.
 */

// Matches 13 to 19 digit card numbers formatted with spaces, dashes, or plain digits
const CARD_PAN_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;

// Matches explicit CVV patterns like "cvv: 123", "cvv 1234", "security code: 123", "cvv is 123", "card code - 456"
const CVV_PATTERN_REGEX = /\b(?:cvv|cvc|security\s*code|card\s*code)[\s:=is-]+(\d{3,4})\b/gi;

// Matches US Social Security Numbers (SSNs) formatted as XXX-XX-XXXX or XXX XX XXXX
const SSN_REGEX = /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g;

// Matches explicit raw 9-digit SSN when preceded by an explicit SSN / social security label
const LABELED_RAW_SSN_REGEX = /\b(?:ssn|social\s*security(?:\s*number)?)\s*[:=\s-]+\s*(\d{9})\b/gi;

const SENSITIVE_KEY_REGEX = /^(?:card_?number|credit_?card|pan|cvv|cvc|security_?code|card_?code|expiry|exp_?date|ssn|social_?security|bank_?account|routing_?number|account_?number|pin|passcode|secret|password|card_?holder)$/i;

const PRESERVED_ID_KEYS = /^(?:id|vapi_?call_?id|call_?id|external_?id|run_?id|loan_?id|borrower_?id|campaign_?id|phone_?number_?id|reference_?number|loan_?number|servicer_?reference_?number|url|timestamp|due_?date|amount|ptp_?amount|balance)$/i;

/**
 * Standard Luhn algorithm verification for credit card PANs.
 * Prevents false-positive redaction of Unix timestamps (e.g. Date.now()).
 */
export function passesLuhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (isNaN(n)) return false;
    if (alternate) {
      n *= 2;
      if (n > 9) n = (n % 10) + 1;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function sanitizeText(text?: string | null): string {
  if (!text) return '';
  // Fail closed on unsupported input sizes (> 512KB)
  if (text.length > 512 * 1024) {
    return '[PAYLOAD_TOO_LARGE_REDACTED]';
  }
  let sanitized = text;

  // Redact delimited SSN references (hyphen or space)
  sanitized = sanitized.replace(SSN_REGEX, '[REDACTED_SSN]');

  // Redact labeled raw 9-digit SSN
  sanitized = sanitized.replace(LABELED_RAW_SSN_REGEX, (match) => {
    return match.replace(/\d{9}/, '[REDACTED_SSN]');
  });

  // Redact CVV references
  sanitized = sanitized.replace(CVV_PATTERN_REGEX, (match) => {
    return match.replace(/\d{3,4}/, '[REDACTED_CVV]');
  });

  // Redact PANs that pass Luhn check
  sanitized = sanitized.replace(CARD_PAN_REGEX, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && passesLuhn(digitsOnly)) {
      return '[REDACTED_PAYMENT_CARD]';
    }
    return match;
  });

  return sanitized;
}

export function sanitizePayload<T = any>(obj: T, depth = 0, seen = new WeakSet()): T {
  if (obj === null || obj === undefined) return obj;

  // Prevent stack overflow on deep nesting or circular references
  if (depth > 20) {
    return '[MAX_DEPTH_REDACTED]' as any;
  }

  if (typeof obj === 'string') {
    return sanitizeText(obj) as any;
  }

  if (typeof obj === 'number') {
    const s = String(obj);
    if (s.length >= 13 && s.length <= 19 && passesLuhn(s)) {
      return '[REDACTED_PAYMENT_CARD]' as any;
    }
    return obj;
  }

  if (typeof obj === 'object') {
    if (seen.has(obj as any)) {
      return '[CIRCULAR_REDACTED]' as any;
    }
    seen.add(obj as any);

    if (Array.isArray(obj)) {
      return obj.map(item => sanitizePayload(item, depth + 1, seen)) as any;
    }

    const copy: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (PRESERVED_ID_KEYS.test(key)) {
        copy[key] = value;
      } else if (SENSITIVE_KEY_REGEX.test(key)) {
        copy[key] = '[REDACTED_SENSITIVE_PAYMENT_DATA]';
      } else {
        copy[key] = sanitizePayload(value, depth + 1, seen);
      }
    }
    return copy as T;
  }

  return obj;
}

