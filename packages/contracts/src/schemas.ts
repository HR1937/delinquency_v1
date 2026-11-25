import { z } from 'zod';
import {
  DispositionEnum,
  BlockReasonEnum,
  LineTypeEnum,
  VerificationStatusEnum,
  DncScopeEnum,
  ComplianceEventTypeEnum,
  CallStatusEnum,
  SmsStatusEnum,
  HumanQueueReasonEnum,
  PtpStatusEnum,
  ConsentStateEnum,
  NextActionEnum
} from './enums';

export const DispositionSchema = z.nativeEnum(DispositionEnum);
export const BlockReasonSchema = z.nativeEnum(BlockReasonEnum);
export const LineTypeSchema = z.nativeEnum(LineTypeEnum);
export const VerificationStatusSchema = z.nativeEnum(VerificationStatusEnum);
export const DncScopeSchema = z.nativeEnum(DncScopeEnum);
export const ComplianceEventTypeSchema = z.nativeEnum(ComplianceEventTypeEnum);
export const CallStatusSchema = z.nativeEnum(CallStatusEnum);
export const SmsStatusSchema = z.nativeEnum(SmsStatusEnum);
export const HumanQueueReasonSchema = z.nativeEnum(HumanQueueReasonEnum);
export const PtpStatusSchema = z.nativeEnum(PtpStatusEnum);
export const ConsentStateSchema = z.nativeEnum(ConsentStateEnum);
export const NextActionSchema = z.nativeEnum(NextActionEnum);

export const CheckResultItemSchema = z.object({
  check: z.string(),
  result: z.enum(['pass', 'fail', 'skip']),
  reason: z.string().nullable().optional(),
  evaluatedAt: z.string()
});
export type CheckResultItem = z.infer<typeof CheckResultItemSchema>;

export const StructuredOutcomeSchema = z.object({
  disposition: DispositionSchema,
  rpc: z.boolean(),
  verificationStatus: VerificationStatusSchema,
  ptpAmount: z.number().optional(),
  ptpDate: z.string().optional(),
  paymentLinkSent: z.boolean().optional(),
  paymentConfirmed: z.boolean().optional(),
  paymentConfirmationSource: z.string().optional(),
  callbackRequestedAt: z.string().optional(),
  callbackScheduledFor: z.string().optional(),
  callbackTimezone: z.string().optional(),
  v1Restriction: z.object({
    type: z.string(),
    note: z.string(),
    start: z.string().optional(),
    end: z.string().optional()
  }).optional(),
  v2Callback: z.object({
    requestedAt: z.string(),
    scheduledFor: z.string(),
    timezone: z.string(),
    humanReadableNote: z.string().optional()
  }).optional(),
  hardshipType: z.string().optional(),
  disputeRecorded: z.boolean().optional(),
  dnc: z.object({
    scope: DncScopeSchema,
    recordedAt: z.string()
  }).optional(),
  escalationReason: z.string().optional(),
  humanRouteRequired: z.boolean().optional(),
  complianceFlags: z.array(ComplianceEventTypeSchema).optional(),
  borrowerStatedReason: z.string().optional(),
  sentiment: z.string().optional(),
  toolActionsConfirmed: z.array(z.object({
    tool: z.string(),
    result: z.enum(['success', 'failed', 'not_attempted'])
  })).optional(),
  extractionConfidence: z.enum(['high', 'medium', 'low']).optional(),
  notes: z.object({
    reasonSummary: z.string(),
    actionTaken: z.string(),
    nextStep: z.string(),
    importantUncertainty: z.string().optional()
  })
});
export type StructuredOutcome = z.infer<typeof StructuredOutcomeSchema>;

// Tool Request & Response Schemas
export const VerifyIdentityRequestSchema = z.object({
  callAttemptId: z.string(),
  method: z.enum(['dob_address', 'reference_number']),
  response: z.object({
    dob: z.string().optional(),
    address: z.string().optional(),
    referenceNumber: z.string().optional()
  })
});

export const SendPaymentLinkRequestSchema = z.object({
  callAttemptId: z.string(),
  loanId: z.string()
});

export const ScheduleCallbackRequestSchema = z.object({
  callAttemptId: z.string(),
  scheduledTime: z.string(),
  timezone: z.string(),
  note: z.string().optional()
});

export const TransferToAgentRequestSchema = z.object({
  callAttemptId: z.string(),
  reason: HumanQueueReasonSchema,
  priority: z.number().default(5),
  notes: z.string().optional()
});

export const LogDispositionRequestSchema = z.object({
  callAttemptId: z.string(),
  disposition: DispositionSchema,
  structuredOutcome: StructuredOutcomeSchema
});

export const FlagComplianceEventRequestSchema = z.object({
  callAttemptId: z.string(),
  eventType: ComplianceEventTypeSchema,
  details: z.record(z.any()).default({})
});
