export const DispositionEnum = {
  RPC_PAYMENT_PROMISED: 'RPC_PAYMENT_PROMISED',
  RPC_PAYMENT_MADE_DURING_CALL: 'RPC_PAYMENT_MADE_DURING_CALL',
  RPC_PAYMENT_LINK_SENT: 'RPC_PAYMENT_LINK_SENT',
  RPC_DISPUTE: 'RPC_DISPUTE',
  RPC_HARDSHIP_REFERRED: 'RPC_HARDSHIP_REFERRED',
  RPC_REFUSED: 'RPC_REFUSED',
  RPC_CALLBACK_REQUESTED: 'RPC_CALLBACK_REQUESTED',
  RPC_NO_RESOLUTION: 'RPC_NO_RESOLUTION',
  RPC_SCRA_PROTECTED: 'RPC_SCRA_PROTECTED',
  RPC_LEGAL_TRIGGER: 'RPC_LEGAL_TRIGGER',
  RPC_SAFETY_ESCALATED: 'RPC_SAFETY_ESCALATED',
  RPC_WRONG_NUMBER: 'RPC_WRONG_NUMBER',
  NO_RPC_VOICEMAIL: 'NO_RPC_VOICEMAIL',
  NO_RPC_NO_ANSWER: 'NO_RPC_NO_ANSWER',
  NO_RPC_WRONG_NUMBER: 'NO_RPC_WRONG_NUMBER',
  NO_RPC_DNC_REQUESTED: 'NO_RPC_DNC_REQUESTED',
  NO_RPC_THIRD_PARTY: 'NO_RPC_THIRD_PARTY',
  NO_RPC_VERIFICATION_FAILURE: 'NO_RPC_VERIFICATION_FAILURE',
  TECH_FAILURE: 'TECH_FAILURE',
  BLOCKED_PRE_DIAL: 'BLOCKED_PRE_DIAL'
} as const;
export type Disposition = keyof typeof DispositionEnum;

export const BlockReasonEnum = {
  ELIGIBLE_TO_DIAL: 'ELIGIBLE_TO_DIAL',
  BLOCKED_OUT_OF_SCOPE: 'BLOCKED_OUT_OF_SCOPE',
  BLOCKED_BANKRUPTCY: 'BLOCKED_BANKRUPTCY',
  BLOCKED_LITIGATION: 'BLOCKED_LITIGATION',
  BLOCKED_DECEASED: 'BLOCKED_DECEASED',
  BLOCKED_LOSS_MITIGATION: 'BLOCKED_LOSS_MITIGATION',
  BLOCKED_ACTIVE_DISPUTE: 'BLOCKED_ACTIVE_DISPUTE',
  BLOCKED_DNC_ACCOUNT: 'BLOCKED_DNC_ACCOUNT',
  BLOCKED_DNC_NUMBER: 'BLOCKED_DNC_NUMBER',
  BLOCKED_PHONE_HYGIENE: 'BLOCKED_PHONE_HYGIENE',
  BLOCKED_KNOWN_LITIGATOR: 'BLOCKED_KNOWN_LITIGATOR',
  BLOCKED_NO_CONSENT: 'BLOCKED_NO_CONSENT',
  BLOCKED_TIMEZONE_MISSING: 'BLOCKED_TIMEZONE_MISSING',
  BLOCKED_TIMEZONE_UNVERIFIED: 'BLOCKED_TIMEZONE_UNVERIFIED',
  BLOCKED_LEGAL_CALLING_WINDOW: 'BLOCKED_LEGAL_CALLING_WINDOW',
  BLOCKED_PREFERRED_CONTACT_WINDOW: 'BLOCKED_PREFERRED_CONTACT_WINDOW',
  BLOCKED_V1_RESTRICTION: 'BLOCKED_V1_RESTRICTION',
  BLOCKED_COOLDOWN: 'BLOCKED_COOLDOWN',
  BLOCKED_DAILY_CAP: 'BLOCKED_DAILY_CAP',
  BLOCKED_WEEKLY_CAP: 'BLOCKED_WEEKLY_CAP',
  BLOCKED_MAX_ATTEMPTS: 'BLOCKED_MAX_ATTEMPTS',
  BLOCKED_REGULATORY_FREQUENCY: 'BLOCKED_REGULATORY_FREQUENCY',
  BLOCKED_CALLBACK_PENDING: 'BLOCKED_CALLBACK_PENDING',
  BLOCKED_CAPACITY: 'BLOCKED_CAPACITY',
  BLOCKED_OTHER: 'BLOCKED_OTHER'
} as const;
export type BlockReason = keyof typeof BlockReasonEnum;

export const LineTypeEnum = {
  mobile: 'mobile',
  landline: 'landline',
  voip: 'voip',
  unknown: 'unknown'
} as const;
export type LineType = keyof typeof LineTypeEnum;

export const VerificationStatusEnum = {
  not_attempted: 'not_attempted',
  verified: 'verified',
  failed: 'failed',
  refused: 'refused',
  wrong_number: 'wrong_number'
} as const;
export type VerificationStatus = keyof typeof VerificationStatusEnum;

export const DncScopeEnum = {
  account: 'account',
  number: 'number',
  both: 'both'
} as const;
export type DncScope = keyof typeof DncScopeEnum;

export const ComplianceEventTypeEnum = {
  DNC_REQUEST: 'DNC_REQUEST',
  LEGAL_TRIGGER: 'LEGAL_TRIGGER',
  DISPUTE_ASSERTION: 'DISPUTE_ASSERTION',
  SCRA_IDENTIFIED: 'SCRA_IDENTIFIED',
  SAFETY_ESCALATION: 'SAFETY_ESCALATION',
  RECORDING_DISCLOSURE_SKIPPED: 'RECORDING_DISCLOSURE_SKIPPED'
} as const;
export type ComplianceEventType = keyof typeof ComplianceEventTypeEnum;

export const CallStatusEnum = {
  initiated: 'initiated',
  ringing: 'ringing',
  answered: 'answered',
  completed: 'completed',
  failed: 'failed',
  no_answer: 'no_answer',
  busy: 'busy',
  voicemail: 'voicemail',
  tech_failure: 'tech_failure'
} as const;
export type CallStatus = keyof typeof CallStatusEnum;

export const SmsStatusEnum = {
  queued: 'queued',
  sent: 'sent',
  delivered: 'delivered',
  failed: 'failed',
  undelivered: 'undelivered'
} as const;
export type SmsStatus = keyof typeof SmsStatusEnum;

export const HumanQueueReasonEnum = {
  DISPUTE_RESEARCH: 'DISPUTE_RESEARCH',
  HARDSHIP_LOSS_MITIGATION: 'HARDSHIP_LOSS_MITIGATION',
  SCRA_PROTECTED: 'SCRA_PROTECTED',
  LEGAL_ROUTE: 'LEGAL_ROUTE',
  SAFETY_ESCALATION: 'SAFETY_ESCALATION',
  HUMAN_REQUESTED: 'HUMAN_REQUESTED',
  TECH_FAILURE_REMEDIATION: 'TECH_FAILURE_REMEDIATION',
  VERIFICATION_REMEDIATION: 'VERIFICATION_REMEDIATION',
  WRONG_NUMBER_REMEDIATION: 'WRONG_NUMBER_REMEDIATION'
} as const;
export type HumanQueueReason = keyof typeof HumanQueueReasonEnum;

export const PtpStatusEnum = {
  pending: 'pending',
  kept: 'kept',
  missed: 'missed',
  cancelled: 'cancelled',
  partial: 'partial'
} as const;
export type PtpStatus = keyof typeof PtpStatusEnum;

export const ConsentStateEnum = {
  GRANTED: 'GRANTED',
  MISSING: 'MISSING',
  REVOKED: 'REVOKED',
  UNKNOWN: 'UNKNOWN',
  NOT_APPLICABLE_TO_MOBILE_AUTODIAL_CONSENT: 'NOT_APPLICABLE_TO_MOBILE_AUTODIAL_CONSENT'
} as const;
export type ConsentState = keyof typeof ConsentStateEnum;

export const NextActionEnum = {
  DIAL: 'DIAL',
  WAIT_UNTIL: 'WAIT_UNTIL',
  FIX_CONTACT_DATA: 'FIX_CONTACT_DATA',
  SUPPRESS: 'SUPPRESS',
  REFER: 'REFER',
  CAPACITY_QUEUE: 'CAPACITY_QUEUE'
} as const;
export type NextAction = keyof typeof NextActionEnum;

export const CallbackSourceTypeEnum = {
  BORROWER_REQUEST_FROM_REAL_CALL: 'BORROWER_REQUEST_FROM_REAL_CALL',
  OPERATOR_FOLLOWUP: 'OPERATOR_FOLLOWUP',
  QA_SCENARIO: 'QA_SCENARIO'
} as const;
export type CallbackSourceType = keyof typeof CallbackSourceTypeEnum;

export const QaSimulationOutcomeEnum = {
  BLOCKED_DNC: 'BLOCKED_DNC',
  ACTIVE_DISPUTE: 'ACTIVE_DISPUTE',
  PROHIBITED_BANKRUPTCY_DECEASED: 'PROHIBITED_BANKRUPTCY_DECEASED',
  V1_TIME_RESTRICTION: 'V1_TIME_RESTRICTION',
  ACTIVE_CALLBACK: 'ACTIVE_CALLBACK',
  COOLDOWN_BLOCK: 'COOLDOWN_BLOCK',
  COOLDOWN_PASS: 'COOLDOWN_PASS',
  MOCK_RPC_PTP: 'MOCK_RPC_PTP',
  MOCK_RPC_CALLBACK_REQUESTED: 'MOCK_RPC_CALLBACK_REQUESTED',
  MOCK_HARDSHIP_REFERRAL: 'MOCK_HARDSHIP_REFERRAL',
  MOCK_WRONG_NUMBER: 'MOCK_WRONG_NUMBER',
  MOCK_PROVIDER_TECHNICAL_FAILURE: 'MOCK_PROVIDER_TECHNICAL_FAILURE'
} as const;
export type QaSimulationOutcome = keyof typeof QaSimulationOutcomeEnum;


