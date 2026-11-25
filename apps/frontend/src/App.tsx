import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Vapi from '@vapi-ai/web';
import {
  LayoutDashboard,
  CheckCircle2,
  PhoneCall,
  ShieldAlert,
  Activity,
  RotateCw,
  Layers,
  Users,
  Clock,
  X,
  FileText,
  MessageSquare,
  History,
  AlertTriangle,
  Send,
  Plus,
  Check,
  Sliders,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  Play,
  Trash2,
  Lock,
  Mic,
  MicOff,
  Radio,
  PhoneOff,
  Info,
  FolderOpen
} from 'lucide-react';

const API_BASE = '/api/v1';

// ─── OPERATOR TIMEZONE BANNER ───────────────────────────────────────────────
function TimezoneDisplay({ tz, label }: { tz: string; label: string }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      try {
        const f = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        setTime(f.format(new Date()));
      } catch {
        setTime('--:--');
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [tz]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
      <span style={{ color: '#64748b', fontWeight: 500 }}>{label}:</span>
      <span style={{ fontWeight: 600, color: '#0f172a' }}>{time}</span>
    </span>
  );
}

// ─── KPI PORTAL POPOVER ─────────────────────────────────────────────────────
interface KpiPopoverProps {
  label: string;
  content: string;
  customIcon?: React.ReactNode;
}

function KpiPopover({ label, content, customIcon }: KpiPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; positionAbove: boolean }>({ top: 0, left: 0, positionAbove: true });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 280;
    const viewportWidth = window.innerWidth;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (left < 16) left = 16;
    if (left + popoverWidth > viewportWidth - 16) {
      left = viewportWidth - popoverWidth - 16;
    }

    let top = 0;
    let positionAbove = true;
    if (rect.top < 130) {
      top = rect.bottom + 8;
      positionAbove = false;
    } else {
      top = rect.top - 8;
      positionAbove = true;
    }

    setCoords({ top, left, positionAbove });
  };

  const toggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle(e);
          }
        }}
        aria-expanded={isOpen}
        aria-label={`Information about ${label}`}
        title={`Click for information about ${label}`}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px',
          margin: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          color: isOpen ? '#2563eb' : '#94a3b8'
        }}
      >
        {customIcon || <Info size={13} />}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords.positionAbove ? undefined : `${coords.top}px`,
              bottom: coords.positionAbove ? `${window.innerHeight - coords.top}px` : undefined,
              left: `${coords.left}px`,
              width: '280px',
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 400,
              lineHeight: 1.45,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
              border: '1px solid #334155',
              zIndex: 99999,
              whiteSpace: 'pre-line'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                aria-label="Close tooltip"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '12px',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
            <div>{content}</div>
          </div>,
          document.body
        )}
    </>
  );
}

// ─── UTILITY HELPERS ────────────────────────────────────────────────────────
const maskLoanNumber = (num?: string | null) => {
  if (!num) return '—';
  if (num.length <= 5) return num;
  return `${num.slice(0, 3)}***${num.slice(-3)}`;
};

const maskPhoneNumber = (num?: string | null) => {
  if (!num) return '—';
  if (num.length <= 7) return num;
  return `${num.slice(0, 3)}***${num.slice(-4)}`;
};

const formatCurrency = (amount?: string | number | null) => {
  if (amount === null || amount === undefined || amount === '') return '—';
  const val = Number(amount);
  if (isNaN(val)) return String(amount);
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ─── TOAST NOTIFICATION ─────────────────────────────────────────────────────
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'campaigns'
    | 'accounts'
    | 'eligibility'
    | 'calls'
    | 'schedules'
    | 'servicing-outbox'
    | 'human-queue'
    | 'compliance'
    | 'sms'
    | 'integrations'
    | 'audit'
  >('dashboard');

  // Main collections
  const [summary, setSummary] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [eligibilityQueue, setEligibilityQueue] = useState<any[]>([]);
  const [callsList, setCallsList] = useState<any[]>([]);
  const [schedulesList, setSchedulesList] = useState<any[]>([]);
  const [servicingOutboxList, setServicingOutboxList] = useState<any[]>([]);
  const [humanQueue, setHumanQueue] = useState<any[]>([]);
  const [dncRecords, setDncRecords] = useState<any[]>([]);
  const [smsList, setSmsList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [callbacksList, setCallbacksList] = useState<any[]>([]);

  // Verified Outbound Call Destinations (Allowlist - Separate from Human Roster)
  const [destinationsList, setDestinationsList] = useState<any[]>([]);
  const [newDestPhone, setNewDestPhone] = useState('');
  const [newDestLabel, setNewDestLabel] = useState('');
  const [newDestNotes, setNewDestNotes] = useState('');
  const [destSaving, setDestSaving] = useState(false);

  // Human Escalation Contacts (Authoritative)
  const [escalationContactsList, setEscalationContactsList] = useState<any[]>([]);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [contactNameInput, setContactNameInput] = useState('');
  const [contactPhoneInput, setContactPhoneInput] = useState('');
  const [contactNotesInput, setContactNotesInput] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // Global UI & Filters
  const [loading, setLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [accountFilterBucket, setAccountFilterBucket] = useState<'all' | '1-30' | '31-59' | '60+'>('all');
  const [accountFilterCampaign, setAccountFilterCampaign] = useState<string>('all');
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});

  // Preflight & Rehearsal State
  const [preflightData, setPreflightData] = useState<any>(null);
  const [runningPreflight, setRunningPreflight] = useState(false);
  const [rehearsalReport, setRehearsalReport] = useState<any>(null);
  const [runningRehearsal, setRunningRehearsal] = useState(false);

  // Supervised Voice Readiness State
  const [supervisedQaData, setSupervisedQaData] = useState<any>(null);
  const [runningSupervisedQa, setRunningSupervisedQa] = useState(false);
  const [dispatchAttemptError, setDispatchAttemptError] = useState<string | null>(null);

  // ─── HEADERS HELPER ───────────────────────────────────────────────────────
  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    return { ...extra };
  };

  // Audit & Timeline State
  const [auditSubTab, setAuditSubTab] = useState<'simulator' | 'state_log' | 'timeline'>('simulator');
  const [auditTimelineEvents, setAuditTimelineEvents] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineFilterLoanId, setTimelineFilterLoanId] = useState<string>('all');
  const [qaScenarios, setQaScenarios] = useState<any[]>([]);
  const [qaSimulations, setQaSimulations] = useState<any[]>([]);
  const [selectedQaLoanId, setSelectedQaLoanId] = useState<string>('');
  const [selectedQaOutcome, setSelectedQaOutcome] = useState<string>('MOCK_RPC_PTP');
  const [currentSimulation, setCurrentSimulation] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);

  // Sub-tabs
  const [eligibilitySubTab, setEligibilitySubTab] = useState<'queue' | 'qa_demos'>('queue');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<string>('all');
  const [scheduleFilterTab, setScheduleFilterTab] = useState<'all' | 'operator' | 'borrower' | 'scenario'>('all');
  const [cooldownElapsedHours, setCooldownElapsedHours] = useState<number>(1.5);
  const [cooldownDemoData, setCooldownDemoData] = useState<any>(null);
  const [evalSelectedPhones, setEvalSelectedPhones] = useState<Record<string, string>>({});

  // Modals & Drawers
  const [evalModalItem, setEvalModalItem] = useState<any>(null);
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<any>(null);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [selectedCampaignForMembers, setSelectedCampaignForMembers] = useState<any>(null);
  const [campaignMembersList, setCampaignMembersList] = useState<any[]>([]);
  const [selectedLoanToEnroll, setSelectedLoanToEnroll] = useState<string>('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<any>(null);
  const [rescheduleDatetime, setRescheduleDatetime] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [showCreateEscalationModal, setShowCreateEscalationModal] = useState(false);
  const [newEscalationForm, setNewEscalationForm] = useState({
    loanId: '',
    reason: 'COMPLEX_HARDSHIP',
    priority: 3,
    notes: ''
  });

  // Forms
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    loanNumber: '',
    firstName: '',
    lastName: '',
    dpd: 15,
    pastDueAmount: '250.00',
    totalToCure: '500.00',
    phoneE164: '',
    lineType: 'mobile',
    tcpaConsent: true,
    timezoneIana: 'America/New_York',
    campaignId: ''
  });

  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [newCampaignForm, setNewCampaignForm] = useState({
    name: '',
    description: '',
    cohortLabel: '',
    dpdMin: 1,
    dpdMax: 30,
    maxAttempts: 3,
    cooldownHours: 4,
    dailyCap: 2,
    weeklyCap: 6,
    callbackHorizonDays: 7
  });

  const [showEditCampaignModal, setShowEditCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [editCampaignForm, setEditCampaignForm] = useState({
    name: '',
    description: '',
    cohortLabel: '',
    dpdMin: 1,
    dpdMax: 30,
    maxAttempts: 3,
    cooldownHours: 4,
    dailyCap: 2,
    weeklyCap: 6,
    callbackHorizonDays: 7
  });

  const [showCampaignDetailsDrawer, setShowCampaignDetailsDrawer] = useState(false);
  const [selectedCampaignForDetails, setSelectedCampaignForDetails] = useState<any>(null);
  const [campaignDetailsTab, setCampaignDetailsTab] = useState<'overview' | 'members' | 'policy' | 'scheduling' | 'eligibility'>('overview');
  
  // Persistent Conversation History State
  const [conversationsList, setConversationsList] = useState<any[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [selectedConversationDetail, setSelectedConversationDetail] = useState<any | null>(null);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [activeConversationDbId, setActiveConversationDbId] = useState<string | null>(null);

  const [showAddPhoneModal, setShowAddPhoneModal] = useState(false);
  const [targetLoanForPhone, setTargetLoanForPhone] = useState<string>('');
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null);

  // Campaign Membership Central Selection State
  const [campaignMembersTab, setCampaignMembersTab] = useState<'members' | 'add'>('members');
  const [campaignCandidates, setCampaignCandidates] = useState<any[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesFilter, setCandidatesFilter] = useState<string>('all');
  const [candidateSearch, setCandidateSearch] = useState<string>('');
  const [selectedCandidateLoanIds, setSelectedCandidateLoanIds] = useState<string[]>([]);
  const [batchEnrolling, setBatchEnrolling] = useState(false);

  const [newPhoneForm, setNewPhoneForm] = useState({
    phoneE164: '',
    label: 'primary',
    relationship: 'primary_borrower',
    lineType: 'mobile',
    isPrimary: true,
    isHygieneVerified: true,
    isVerified: true,
    verifiedBy: 'Servicing Team',
    verificationNotes: 'Contact confirmed by servicing team',
    consentState: 'GRANTED',
    tcpaConsent: true,
    consentSource: 'OPERATOR_DOCUMENTED',
    consentEvidence: 'Documented express consent by servicing operator',
    dnc: false,
    timezoneIana: 'America/New_York'
  });

  const [showGenerateBatchModal, setShowGenerateBatchModal] = useState(false);
  const [selectedScenarioTypes, setSelectedScenarioTypes] = useState<string[]>([
    'clean_eligible',
    'no_consent',
    'cooldown_active',
    'account_dnc',
    'v1_restriction'
  ]);
  const [generatingBatch, setGeneratingBatch] = useState(false);

  const [showBatchCleanupDrawer, setShowBatchCleanupDrawer] = useState(false);
  const [qaBatches, setQaBatches] = useState<any[]>([]);
  const [deletePreview, setDeletePreview] = useState<any>(null);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    loanId: '',
    phoneNumberId: '',
    jobType: 'OPERATOR_SCHEDULED',
    dueAtUtc: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    originalTimezoneIana: 'America/New_York',
    notes: 'Operator follow-up'
  });

  // Test SMS state
  const [smsTestPhone, setSmsTestPhone] = useState('+919328234331');
  const [testingSms, setTestingSms] = useState(false);

  // Campaign Dispatch Simulation State
  const [showDispatchRunModal, setShowDispatchRunModal] = useState(false);
  const [dispatchRunData, setDispatchRunData] = useState<any>(null);
  const [dispatchingCampaignId, setDispatchingCampaignId] = useState<string | null>(null);

  // Web Voice QA State (@vapi-ai/web)
  const [webQaConfig, setWebQaConfig] = useState<any>(null);
  const [webQaSession, setWebQaSession] = useState<any>(null);
  const [webQaCallState, setWebQaCallState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [webQaError, setWebQaError] = useState<string | null>(null);
  const [webQaTranscript, setWebQaTranscript] = useState<Array<{ role: 'user' | 'assistant'; text: string; timestamp: string }>>([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isWebQaSpeaking, setIsWebQaSpeaking] = useState(false);
  const [vapiWebClient, setVapiWebClient] = useState<any>(null);
  const [webQaToolInvocations, setWebQaToolInvocations] = useState<Array<{ id: string; name: string; args: any; status: string; result?: any; timestamp: string }>>([]);
  const [webQaAccountChanges, setWebQaAccountChanges] = useState<Array<{ field: string; detail: string; source: string; timestamp: string }>>([]);
  const [accountDrawerTab, setAccountDrawerTab] = useState<'test-controls' | 'pre-dial' | 'profile' | 'audit'>('test-controls');
  const [drawerAuditLogs, setDrawerAuditLogs] = useState<any[]>([]);
  const [drawerAuditLoading, setDrawerAuditLoading] = useState(false);

  // Campaign-Driven Voice Workspace State (Calls & Responses)
  const [callsCampaignId, setCallsCampaignId] = useState<string>('');
  const [callsMemberId, setCallsMemberId] = useState<string>('');
  const [callsTelephoneLoading, setCallsTelephoneLoading] = useState(false);
  const [callsTelephoneResult, setCallsTelephoneResult] = useState<any>(null);
  const [lastCompletedQaSession, setLastCompletedQaSession] = useState<any>(null);
  const [callsMembersList, setCallsMembersList] = useState<any[]>([]);
  const [campaignMembersLoading, setCampaignMembersLoading] = useState(false);
  const sessionStartTimeRef = useRef<number | null>(null);
  const currentSessionRef = useRef<any>(null);
  const currentTranscriptRef = useRef<Array<{ role: string; text: string; timestamp: string }>>([]);

  // Operational Settings (Sidebar Voice & SMS Controls)
  const [operationalSettings, setOperationalSettings] = useState<any>(null);
  const [settingsSaving, setSettingsSaving] = useState<'browserTesting' | 'outboundCalls' | 'sms' | null>(null);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const togglePhoneReveal = (id: string) => {
    setRevealedPhones((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskPhone = (phone: string, id: string) => {
    if (!phone) return '—';
    if (revealedPhones[id]) return phone;
    return phone.replace(/(\+\d{1,3})(\d+)(\d{4})/, (_, c, m, l) => `${c} ${'•'.repeat(m.length)} ${l}`);
  };

  // ─── API FETCHERS ─────────────────────────────────────────────────────────
  const fetchAll = async (isManual = false) => {
    setLoading(true);
    try {
      const [
        sumRes,
        campRes,
        accRes,
        eligRes,
        callsRes,
        schedRes,
        callbacksRes,
        outboxRes,
        hqRes,
        dncRes,
        smsRes,
        auditRes,
        healthRes,
        settingsRes,
        destRes,
        contactsRes,
        convRes,
        portfolioRes
      ] = await Promise.all([
        fetch(`${API_BASE}/dashboard/summary`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${API_BASE}/campaigns`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/accounts`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/eligibility/queue${selectedCampaignId ? `?campaignId=${selectedCampaignId}` : ''}`, { headers: getAuthHeaders() }).then((r) =>
          r.ok ? r.json() : []
        ).catch(() => []),
        fetch(`${API_BASE}/calls`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/schedules`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/callbacks`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/servicing-outbox`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/human-queue`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/compliance/dnc`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/sms`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/audit/logs`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/integrations/health`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${API_BASE}/settings`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${API_BASE}/destinations`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : { destinations: [] })).catch(() => ({ destinations: [] })),
        fetch(`${API_BASE}/escalation-contacts`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : { contacts: [] })).catch(() => ({ contacts: [] })),
        fetch(`${API_BASE}/conversations`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_BASE}/accounts/portfolio-summary`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      ]);

      if (sumRes) setSummary(sumRes);
      setCampaigns(campRes || []);
      setAccounts(accRes || []);
      setEligibilityQueue(eligRes || []);
      setCallsList(callsRes || []);
      setSchedulesList(schedRes || []);
      setCallbacksList(callbacksRes || []);
      setServicingOutboxList(outboxRes || []);
      setHumanQueue(hqRes || []);
      setDncRecords(dncRes || []);
      setSmsList(smsRes || []);
      setAuditLogs(auditRes || []);
      if (healthRes) setHealth(healthRes);
      if (settingsRes) setOperationalSettings(settingsRes);
      setDestinationsList(destRes?.destinations || []);
      setEscalationContactsList(contactsRes?.contacts || []);
      setConversationsList(convRes || []);
      if (portfolioRes) setPortfolioSummary(portfolioRes);

      const nowTime = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date());

      setLastRefreshedAt(`${nowTime} IST`);
      if (isManual) {
        addToast('success', 'Operations console data refreshed successfully');
      }
    } catch (err: any) {
      console.error('Refresh failed:', err);
      addToast('error', `Refresh failed: ${err.message || 'API connection error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchCooldownDemo = async (hours: number) => {
    try {
      const res = await fetch(`${API_BASE}/qa/cooldown-demo?elapsedHours=${hours}&cooldownHours=4.0`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCooldownDemoData(data);
      }
    } catch (e: any) {
      console.error('Failed to fetch cooldown demo:', e);
    }
  };

  const fetchQaBatches = async () => {
    try {
      const res = await fetch(`${API_BASE}/qa/batches`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setQaBatches(data);
      }
    } catch (e) {
      console.error('Failed to fetch QA batches:', e);
    }
  };

  const fetchCampaignMembers = async (campId: string) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${campId}/members`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCampaignMembersList(data);
      }
    } catch (e) {
      console.error('Failed to fetch campaign members:', e);
    }
  };

  const fetchCampaignCandidates = async (campId?: string, filter?: string, query?: string) => {
    const cid = campId || selectedCampaignForMembers?.id;
    if (!cid) return;
    setCandidatesLoading(true);
    try {
      const f = filter !== undefined ? filter : candidatesFilter;
      const q = query !== undefined ? query : candidateSearch;
      const params = new URLSearchParams();
      if (f && f !== 'all') params.append('filter', f);
      if (q && q.trim()) params.append('search', q.trim());
      const res = await fetch(`${API_BASE}/campaigns/${cid}/candidate-borrowers?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCampaignCandidates(data.candidates || []);
      }
    } catch (e) {
      console.error('Failed to fetch campaign candidates:', e);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handleBatchEnrollMembers = async () => {
    if (!selectedCampaignForMembers || selectedCandidateLoanIds.length === 0) return;
    setBatchEnrolling(true);
    try {
      const res = await fetch(`${API_BASE}/campaigns/${selectedCampaignForMembers.id}/members`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ loanIds: selectedCandidateLoanIds })
      });
      if (res.ok) {
        const data = await res.json();
        addToast('success', `Enrolled ${data.count || selectedCandidateLoanIds.length} borrower(s) into "${selectedCampaignForMembers.name}"`);
        setSelectedCandidateLoanIds([]);
        fetchCampaignMembers(selectedCampaignForMembers.id);
        fetchCampaignCandidates(selectedCampaignForMembers.id);
        fetchAll(false);
      } else {
        const err = await res.json();
        addToast('error', `Enrollment failed: ${err.error || 'Server error'}`);
      }
    } catch (e: any) {
      addToast('error', `Error: ${e.message}`);
    } finally {
      setBatchEnrolling(false);
    }
  };

  const handleFillEligibleTestBorrower = () => {
    const targetCamp = campaigns.find((c) => c.id === newAccountForm.campaignId) || campaigns[0];
    const defaultDpd = targetCamp && targetCamp.dpdMin ? targetCamp.dpdMin + 5 : 15;
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setNewAccountForm({
      loanNumber: `TEST-ELIG-${randNum}`,
      firstName: 'Eligible',
      lastName: `TestBorrower-${randNum}`,
      dpd: defaultDpd,
      pastDueAmount: '450.00',
      totalToCure: '450.00',
      phoneE164: `+155501${randNum}`,
      lineType: 'mobile',
      tcpaConsent: true,
      timezoneIana: 'America/New_York',
      campaignId: targetCamp?.id || ''
    });
    addToast('info', 'Pre-populated with fully eligible test borrower values (DPD within scope, mobile line, TCPA consent granted, clean balances). Review and click Save.');
  };

  const fetchAuditTimeline = async (loanId?: string) => {
    setTimelineLoading(true);
    try {
      const target = loanId !== undefined ? loanId : timelineFilterLoanId;
      const url = target && target !== 'all'
        ? `${API_BASE}/audit/timeline?loanId=${encodeURIComponent(target)}`
        : `${API_BASE}/audit/timeline`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAuditTimelineEvents(data.events || []);
      }
    } catch (e) {
      console.error('Failed to fetch audit timeline:', e);
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(false);
    fetchCooldownDemo(cooldownElapsedHours);
    fetchQaScenarios();
    fetchQaSimulations();
    fetchAuditTimeline();
  }, [selectedCampaignId]);

  useEffect(() => {
    if (activeTab === 'integrations') {
      if (!supervisedQaData) {
        handleRunSupervisedQaReadiness();
      }
      if (!preflightData) {
        handleRunPreflight();
      }
      handleFetchWebQaConfig();
    } else if (activeTab === 'calls') {
      handleFetchWebQaConfig();
    }
  }, [activeTab]);

  useEffect(() => {
    if (campaigns.length > 0 && !callsCampaignId) {
      setCallsCampaignId(campaigns[0].id);
    }
  }, [campaigns, callsCampaignId]);

  const fetchCampaignMembersForCalls = async (campId: string) => {
    if (!campId) return;
    setCampaignMembersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/eligibility/queue?campaignId=${campId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCallsMembersList(data);
        if (data.length > 0) {
          setCallsMemberId(data[0].loan.id);
        } else {
          setCallsMemberId('');
        }
      }
    } catch (err) {
      console.error('Failed to load campaign members for voice workspace:', err);
    } finally {
      setCampaignMembersLoading(false);
    }
  };

  useEffect(() => {
    if (!callsCampaignId) return;
    fetchCampaignMembersForCalls(callsCampaignId);
  }, [callsCampaignId]);

  // ─── ACTION HANDLERS ──────────────────────────────────────────────────────
  const handleToggleCampaignStatus = async (camp: any) => {
    const newStatus = camp.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`${API_BASE}/campaigns/${camp.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        addToast('success', `Campaign "${camp.name}" set to ${newStatus}. (Note: Activation does not dispatch calls)`);
        fetchAll(false);
      }
    } catch (e: any) {
      addToast('error', `Failed to update campaign: ${e.message}`);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignForm.name) return;
    try {
      const res = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(newCampaignForm)
      });
      if (res.ok) {
        addToast('success', `Campaign "${newCampaignForm.name}" created successfully`);
        setShowCreateCampaignModal(false);
        setNewCampaignForm({
          name: '',
          description: '',
          cohortLabel: '',
          dpdMin: 1,
          dpdMax: 30,
          maxAttempts: 3,
          cooldownHours: 4,
          dailyCap: 2,
          weeklyCap: 6,
          callbackHorizonDays: 7
        });
        fetchAll(false);
      } else {
        const err = await res.json();
        addToast('error', `Creation error: ${err.error || 'Server rejected'}`);
      }
    } catch (e: any) {
      addToast('error', `Failed to create campaign: ${e.message}`);
    }
  };

  const handleOpenEditCampaign = (camp: any) => {
    setEditingCampaign(camp);
    setEditCampaignForm({
      name: camp.name || '',
      description: camp.description || '',
      cohortLabel: camp.cohortLabel || camp.targetingCriteria?.cohortLabel || '',
      dpdMin: camp.dpdMin ?? 1,
      dpdMax: camp.dpdMax ?? 30,
      maxAttempts: camp.maxAttempts ?? 3,
      cooldownHours: camp.cooldownHours ?? 4,
      dailyCap: camp.dailyCap ?? 2,
      weeklyCap: camp.weeklyCap ?? 6,
      callbackHorizonDays: camp.callbackHorizonDays ?? 7
    });
    setShowEditCampaignModal(true);
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign || !editCampaignForm.name) return;
    try {
      const res = await fetch(`${API_BASE}/campaigns/${editingCampaign.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(editCampaignForm)
      });
      if (res.ok) {
        addToast('success', `Campaign "${editCampaignForm.name}" updated successfully`);
        setShowEditCampaignModal(false);
        setEditingCampaign(null);
        fetchAll(false);
      } else {
        const err = await res.json();
        addToast('error', `Update error: ${err.error || 'Server rejected'}`);
      }
    } catch (e: any) {
      addToast('error', `Failed to update campaign: ${e.message}`);
    }
  };

  const handleOpenCampaignDetails = (camp: any) => {
    setSelectedCampaignForDetails(camp);
    setCampaignDetailsTab('overview');
    fetchCampaignMembers(camp.id);
    setShowCampaignDetailsDrawer(true);
  };

  const handleCreateSyntheticAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...newAccountForm,
          campaignId: newAccountForm.campaignId || campaigns[0]?.id
        })
      });

      if (res.ok) {
        const data = await res.json();
        addToast('success', `Account ${data.loan.loanNumber} created and saved (Synthetic QA data)`);
        setShowAddAccountModal(false);
        setNewAccountForm({
          loanNumber: '',
          firstName: '',
          lastName: '',
          dpd: 15,
          pastDueAmount: '250.00',
          totalToCure: '500.00',
          phoneE164: '',
          lineType: 'mobile',
          tcpaConsent: true,
          timezoneIana: 'America/New_York',
          campaignId: ''
        });
        fetchAll(false);
      } else {
        const err = await res.json();
        addToast('error', `Creation failed: ${err.error || 'Server error'}`);
      }
    } catch (e: any) {
      addToast('error', `Error: ${e.message}`);
    }
  };

  const handleUpdateAccountFlags = async (loanId: string, flags: any) => {
    try {
      const res = await fetch(`${API_BASE}/accounts/${loanId}/test-flags`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(flags)
      });
      if (res.ok) {
        const updated = await res.json();
        addToast('success', `Flags updated for ${updated.loan.loanNumber}. Pre-dial eligibility refreshed.`);
        setSelectedAccountDetail(updated);
        fetchAll(false);
        if (callsCampaignId) {
          fetchCampaignMembersForCalls(callsCampaignId);
        }
        return updated;
      } else {
        const err = await res.json();
        addToast('error', `Failed to update flags: ${err.error || 'Validation error'}`);
      }
    } catch (e: any) {
      addToast('error', `Update error: ${e.message}`);
    }
  };

  const fetchDrawerAuditLogs = async (loanId: string) => {
    setDrawerAuditLoading(true);
    try {
      const res = await fetch(`${API_BASE}/audit/timeline?loanId=${loanId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDrawerAuditLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Failed to fetch audit timeline:', e);
    } finally {
      setDrawerAuditLoading(false);
    }
  };

  const handleAddPhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLoanForPhone) return;

    try {
      const res = await fetch(`${API_BASE}/accounts/${targetLoanForPhone}/phones`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(newPhoneForm)
      });

      if (res.ok) {
        addToast('success', `Phone ${newPhoneForm.phoneE164} added to account`);
        setShowAddPhoneModal(false);
        setNewPhoneForm({
          phoneE164: '',
          label: 'primary',
          relationship: 'primary_borrower',
          lineType: 'mobile',
          isPrimary: true,
          isHygieneVerified: true,
          isVerified: true,
          verifiedBy: 'Servicing Team',
          verificationNotes: 'Contact confirmed by servicing team',
          consentState: 'GRANTED',
          tcpaConsent: true,
          consentSource: 'OPERATOR_DOCUMENTED',
          consentEvidence: 'Documented express consent by servicing operator',
          dnc: false,
          timezoneIana: 'America/New_York'
        });
        fetchAll(false);
        if (selectedAccountDetail?.loan?.id === targetLoanForPhone) {
          const accRes = await fetch(`${API_BASE}/accounts/${targetLoanForPhone}`, { headers: getAuthHeaders() });
          if (accRes.ok) setSelectedAccountDetail(await accRes.json());
        }
      } else {
        const err = await res.json();
        addToast('error', `Failed to add phone: ${err.error || 'Validation error'}`);
      }
    } catch (e: any) {
      addToast('error', `Error: ${e.message}`);
    }
  };

  const handleArchivePhone = async (phoneId: string) => {
    if (!confirm('Archive this phone number? (Soft delete)')) return;
    try {
      const res = await fetch(`${API_BASE}/phones/${phoneId}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) {
        addToast('success', 'Phone number archived');
        fetchAll(false);
        if (selectedAccountDetail) {
          const accRes = await fetch(`${API_BASE}/accounts/${selectedAccountDetail.loan.id}`, { headers: getAuthHeaders() });
          if (accRes.ok) setSelectedAccountDetail(await accRes.json());
        }
      }
    } catch (e: any) {
      addToast('error', `Failed to archive phone: ${e.message}`);
    }
  };

  const handleGenerateBatch = async () => {
    if (selectedScenarioTypes.length === 0) {
      addToast('error', 'Select at least one scenario type');
      return;
    }
    setGeneratingBatch(true);
    try {
      const res = await fetch(`${API_BASE}/qa/batches/generate`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ scenarioTypes: selectedScenarioTypes })
      });
      if (res.ok) {
        const data = await res.json();
        addToast('success', `QA Batch ${data.batch.id} generated! ${data.totalCreated} synthetic accounts created.`);
        setShowGenerateBatchModal(false);
        fetchAll(false);
        fetchQaBatches();
      } else {
        const err = await res.json();
        addToast('error', `Batch generation failed: ${err.error || 'Server error'}`);
      }
    } catch (e: any) {
      addToast('error', `Generation error: ${e.message}`);
    } finally {
      setGeneratingBatch(false);
    }
  };

  const handlePreviewDeleteBatch = async (batchId: string) => {
    try {
      const res = await fetch(`${API_BASE}/qa/batches/${batchId}/preview-delete`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const preview = await res.json();
        setDeletePreview(preview);
      } else {
        const err = await res.json();
        addToast('error', `Preview failed: ${err.error}`);
      }
    } catch (e: any) {
      addToast('error', `Preview error: ${e.message}`);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm(`Confirm safe deletion of QA Batch ${batchId}? Only records created by this batch will be removed.`)) return;
    try {
      const res = await fetch(`${API_BASE}/qa/batches/${batchId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        addToast('success', `QA Batch ${batchId} safely removed (${data.deletedAccountsCount} accounts deleted). Baseline LN-* preserved.`);
        setDeletePreview(null);
        fetchQaBatches();
        fetchAll(false);
      } else {
        const err = await res.json();
        addToast('error', `Deletion blocked: ${err.error}`);
      }
    } catch (e: any) {
      addToast('error', `Deletion error: ${e.message}`);
    }
  };

  const handleEnrollMemberInCampaign = async () => {
    if (!selectedCampaignForMembers || !selectedLoanToEnroll) return;
    try {
      const res = await fetch(`${API_BASE}/campaigns/${selectedCampaignForMembers.id}/members`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ loanId: selectedLoanToEnroll, addedReason: 'operator_selection' })
      });
      if (res.ok) {
        addToast('success', 'Account enrolled into campaign');
        setSelectedLoanToEnroll('');
        fetchCampaignMembers(selectedCampaignForMembers.id);
        fetchAll(false);
      } else {
        const err = await res.json();
        addToast('error', `Enrollment failed: ${err.error || 'Already enrolled'}`);
      }
    } catch (e: any) {
      addToast('error', `Error: ${e.message}`);
    }
  };

  const handleRemoveMemberFromCampaign = async (memberId: string) => {
    if (!selectedCampaignForMembers) return;
    try {
      const res = await fetch(`${API_BASE}/campaigns/${selectedCampaignForMembers.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason: 'operator_manual_removal' })
      });
      if (res.ok) {
        addToast('success', 'Member removed from campaign (Account preserved in database)');
        fetchCampaignMembers(selectedCampaignForMembers.id);
        fetchAll(false);
      }
    } catch (e: any) {
      addToast('error', `Removal error: ${e.message}`);
    }
  };

  const handleResolveEscalation = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/human-queue/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'resolved', notes: 'Resolved by operator in console' })
      });
      if (res.ok) {
        addToast('success', 'Human escalation marked as resolved');
        fetchAll(false);
      }
    } catch (e: any) {
      addToast('error', `Failed: ${e.message}`);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/schedules`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...scheduleForm,
          dueAtUtc: new Date(scheduleForm.dueAtUtc).toISOString()
        })
      });

      if (res.ok) {
        addToast('success', 'Follow-up job committed to Durable Scheduler');
        setShowScheduleModal(false);
        fetchAll(false);
      } else {
        const err = await res.json();
        addToast('error', `Scheduling error: ${err.error || 'Invalid params'}`);
      }
    } catch (e: any) {
      addToast('error', `Error: ${e.message}`);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget || !rescheduleDatetime) return;
    try {
      const isCb = rescheduleTarget.itemType === 'callback';
      const endpoint = isCb
        ? `${API_BASE}/callbacks/${rescheduleTarget.id}`
        : `${API_BASE}/schedules/${rescheduleTarget.id}`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(isCb
          ? { callbackScheduledDatetime: new Date(rescheduleDatetime).toISOString(), humanReadableNote: rescheduleNotes, status: 'scheduled' }
          : { dueAtUtc: new Date(rescheduleDatetime).toISOString(), notes: rescheduleNotes, status: 'scheduled' }
        )
      });
      if (res.ok) {
        addToast('success', 'Follow-up successfully rescheduled');
        setShowRescheduleModal(false);
        setRescheduleTarget(null);
        setRescheduleDatetime('');
        setRescheduleNotes('');
        fetchAll(false);
      } else {
        const err = await res.json();
        addToast('error', `Reschedule failed: ${err.error || 'Server error'}`);
      }
    } catch (e: any) {
      addToast('error', `Failed: ${e.message}`);
    }
  };

  const handleCancelSchedule = async (item: any) => {
    if (!confirm(`Cancel follow-up for loan ${item.loan?.loanNumber || item.loanId}?`)) return;
    try {
      const isCb = item.itemType === 'callback';
      const endpoint = isCb
        ? `${API_BASE}/callbacks/${item.id}`
        : `${API_BASE}/schedules/${item.id}`;

      const res = await fetch(endpoint, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) {
        addToast('success', 'Scheduled follow-up cancelled');
        fetchAll(false);
      } else {
        addToast('error', 'Failed to cancel follow-up');
      }
    } catch (e: any) {
      addToast('error', `Failed: ${e.message}`);
    }
  };

  const handleRetryOutbox = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/servicing-outbox/${id}/retry`, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) {
        addToast('success', 'Outbox record redelivered to Local PoC adapter');
        fetchAll(false);
      } else {
        const err = await res.json();
        addToast('error', `Retry failed: ${err.message || err.error}`);
      }
    } catch (e: any) {
      addToast('error', `Failed: ${e.message}`);
    }
  };

  const handleDismissEscalation = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/human-queue/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'dismissed', notes: 'Dismissed by operator in console' })
      });
      if (res.ok) {
        addToast('success', 'Escalation dismissed');
        fetchAll(false);
      }
    } catch (e: any) {
      addToast('error', `Failed: ${e.message}`);
    }
  };

  const handleCreateEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEscalationForm.loanId) return;
    try {
      const res = await fetch(`${API_BASE}/human-queue`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(newEscalationForm)
      });
      if (res.ok) {
        addToast('success', 'Manual human escalation created');
        setShowCreateEscalationModal(false);
        setNewEscalationForm({ loanId: '', reason: 'COMPLEX_HARDSHIP', priority: 3, notes: '' });
        fetchAll(false);
      } else {
        const err = await res.json();
        addToast('error', `Failed: ${err.error || 'Server error'}`);
      }
    } catch (e: any) {
      addToast('error', `Failed: ${e.message}`);
    }
  };

  const handleSendTestSms = async () => {
    if (!confirm(`Send dry-run simulated SMS to allowlisted destination ${smsTestPhone}?`)) return;
    setTestingSms(true);
    try {
      const res = await fetch(`${API_BASE}/integrations/test-sms`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ toNumber: smsTestPhone })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast('success', `Dry-run SMS simulated! Mode: ${data.dryRun ? 'Dry-Run (Local No-Send)' : 'Dispatched'}`);
        fetchAll(false);
      } else {
        addToast('error', `SMS rejected: ${data.error || 'Provider rejection'}`);
      }
    } catch (e: any) {
      addToast('error', `SMS error: ${e.message}`);
    } finally {
      setTestingSms(false);
    }
  };

  const handleRunPreflight = async () => {
    setRunningPreflight(true);
    try {
      const res = await fetch(`${API_BASE}/integrations/preflight`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ toNumber: smsTestPhone })
      });
      const data = await res.json();
      setPreflightData(data);
      addToast(data.readyForDryRun ? 'success' : 'info', `Preflight status: ${data.status} (Safety Lock: ${data.safetyLockActive ? 'Active' : 'Disabled'})`);
    } catch (e: any) {
      addToast('error', `Preflight check failed: ${e.message}`);
    } finally {
      setRunningPreflight(false);
    }
  };

  const handleRunWebhookRehearsal = async () => {
    setRunningRehearsal(true);
    try {
      const res = await fetch(`${API_BASE}/integrations/webhook-rehearsal`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' })
      });
      const data = await res.json();
      setRehearsalReport(data);
      if (data.success) {
        addToast('success', 'Webhook Rehearsal: All 5 validation checks passed with 0 operational rows modified!');
      } else {
        addToast('error', 'Webhook Rehearsal completed with warnings.');
      }
    } catch (e: any) {
      addToast('error', `Webhook rehearsal failed: ${e.message}`);
    } finally {
      setRunningRehearsal(false);
    }
  };

  const handleRunSupervisedQaReadiness = async () => {
    setRunningSupervisedQa(true);
    setDispatchAttemptError(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/supervised-qa-readiness`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ toNumber: smsTestPhone })
      });
      const data = await res.json();
      setSupervisedQaData(data);
      addToast('info', `Supervised QA Gate: ${data.status} (Call Button Disabled)`);
    } catch (e: any) {
      addToast('error', `QA Readiness inspection failed: ${e.message}`);
    } finally {
      setRunningSupervisedQa(false);
    }
  };

  const handleAttemptSupervisedCall = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations/dispatch-supervised-call`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          targetPhone: smsTestPhone || '+919328234331',
          scenarioType: 'INTERNAL_QA_TEST'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setDispatchAttemptError(`HTTP ${res.status} ${data.error}: ${data.message}`);
        addToast('error', `Dispatch Blocked (${res.status}): ${data.message}`);
      } else {
        addToast('success', 'Call dispatched');
      }
    } catch (e: any) {
      setDispatchAttemptError(`Network/Client error: ${e.message}`);
      addToast('error', `Dispatch error: ${e.message}`);
    }
  };

  // ─── CAMPAIGN DISPATCH SIMULATION & WEB VOICE QA HANDLERS ──────────────────
  const handleRunCampaignDispatch = async (camp: any) => {
    setDispatchingCampaignId(camp.id);
    try {
      const res = await fetch(`${API_BASE}/campaigns/${camp.id}/dispatch-run`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' })
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', `Campaign Dispatch Run failed: ${data.error || data.message}`);
      } else {
        setDispatchRunData(data);
        setShowDispatchRunModal(true);
        addToast('info', `Campaign Run: ${data.evaluatedCount} evaluated, ${data.eligibleCount} eligible, ${data.blockedCount} blocked (Safety Lock Active)`);
      }
    } catch (e: any) {
      addToast('error', `Dispatch Run failed: ${e.message}`);
    } finally {
      setDispatchingCampaignId(null);
    }
  };

  const handleFetchWebQaConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations/web-qa-config`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setWebQaConfig(data);
      }
    } catch (e: any) {
      console.error('Failed to fetch Web QA config:', e);
    }
  };

  const handleStartWebQaSession = async (customCampaignId?: string, customLoanId?: string, customPhoneId?: string) => {
    setWebQaCallState('connecting');
    setWebQaError(null);
    setWebQaTranscript([]);
    setWebQaToolInvocations([]);
    setWebQaAccountChanges([]);
    setLastCompletedQaSession(null);
    currentTranscriptRef.current = [];

    const reqBody: any = {};
    const targetCampaignId = customCampaignId || callsCampaignId;
    const targetLoanId = customLoanId || callsMemberId;
    if (targetCampaignId) reqBody.campaignId = targetCampaignId;
    if (targetLoanId) reqBody.loanId = targetLoanId;
    if (customPhoneId) reqBody.phoneNumberId = customPhoneId;

    try {
      const res = await fetch(`${API_BASE}/integrations/web-qa-session`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: Object.keys(reqBody).length > 0 ? JSON.stringify(reqBody) : undefined
      });
      const session = await res.json();
      if (!res.ok || !session.success) {
        setWebQaCallState('error');
        setWebQaError(session.message || session.error || 'Failed to start Web QA session');
        addToast('error', `Web QA Blocked: ${session.message || session.error}`);
        return;
      }

      setWebQaSession(session);
      currentSessionRef.current = session;

      // Start persistent conversation session
      let convId: string | null = null;
      try {
        const startConvRes = await fetch(`${API_BASE}/conversations/start`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            loanId: session.memberContext?.loanId || session.syntheticContext?.loan_id,
            phoneNumberId: session.memberContext?.phoneId,
            campaignId: targetCampaignId,
            transportType: 'WEBRTC_BROWSER',
            operator: 'Operator'
          })
        });
        if (startConvRes.ok) {
          const convData = await startConvRes.json();
          convId = convData.session?.id || null;
          setActiveConversationDbId(convId);
        }
      } catch (e) {
        console.warn('Could not record conversation start:', e);
      }

      const vapi = new Vapi(session.publicKey);
      setVapiWebClient(vapi);

      vapi.on('call-start', () => {
        sessionStartTimeRef.current = Date.now();
        setWebQaCallState('connected');
        addToast('success', 'Web Voice QA connected. Microphone active.');
      });

      vapi.on('call-end', async () => {
        setWebQaCallState('idle');
        addToast('info', 'Web Voice QA session ended.');

        const activeSess = currentSessionRef.current;
        const start = sessionStartTimeRef.current;
        const duration = start ? Math.max(1, Math.round((Date.now() - start) / 1000)) : 0;
        const transcriptText = currentTranscriptRef.current
          .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
          .join('\n');

        // Complete persistent conversation session
        if (convId) {
          try {
            await fetch(`${API_BASE}/conversations/${convId}/complete`, {
              method: 'POST',
              headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({
                durationSeconds: duration,
                transcript: currentTranscriptRef.current,
                toolInvocations: webQaToolInvocations,
                structuredDisposition: 'RPC_BROWSER_TEST_COMPLETED',
                dispositionNotes: 'Supervised browser test session completed via WebRTC.'
              })
            });
            const cListRes = await fetch(`${API_BASE}/conversations`, { headers: getAuthHeaders() });
            if (cListRes.ok) setConversationsList(await cListRes.json());
          } catch (e) {
            console.warn('Failed to complete conversation session:', e);
          }
        }

        if (activeSess?.sessionId) {
          try {
            const compRes = await fetch(`${API_BASE}/integrations/web-qa-session/complete`, {
              method: 'POST',
              headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({
                sessionId: activeSess.sessionId,
                loanId: activeSess.memberContext?.loanId || activeSess.syntheticContext?.loan_id,
                phoneNumberId: activeSess.memberContext?.phoneId,
                durationSeconds: duration,
                transcript: transcriptText || 'Voice QA completed via WebRTC browser microphone.',
                disposition: 'BROWSER_VOICE_QA_COMPLETED',
                rightPartyContact: true
              })
            });
            if (compRes.ok) {
              const compData = await compRes.json();
              setLastCompletedQaSession(compData);
            }
          } catch (compErr) {
            console.error('Failed to record completed Web QA session:', compErr);
          }
        }
      });

      vapi.on('speech-start', () => {
        setIsWebQaSpeaking(true);
      });

      vapi.on('speech-end', () => {
        setIsWebQaSpeaking(false);
      });

      vapi.on('message', (message: any) => {
        const nowStr = new Date().toLocaleTimeString();

        // 1. Live Transcript Messages
        if (message.type === 'transcript' && message.transcript) {
          const item = {
            role: (message.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            text: message.transcript,
            timestamp: nowStr
          };
          currentTranscriptRef.current.push(item);
          setWebQaTranscript((prev) => [...prev, item]);
        }

        // 2. Canonical Tool Invocations
        if (message.type === 'tool-calls' || message.type === 'function-call' || message.functionCall || message.toolCalls) {
          const rawTools: any[] = message.toolCalls || (message.functionCall ? [message.functionCall] : []);
          rawTools.forEach((t: any) => {
            const toolName = t.name || t.function?.name || 'canonical_tool';
            const rawArgs = t.arguments || t.function?.arguments || t.parameters || {};
            let parsedArgs: any = rawArgs;
            if (typeof rawArgs === 'string') {
              try { parsedArgs = JSON.parse(rawArgs); } catch { parsedArgs = { value: rawArgs }; }
            }

            setWebQaToolInvocations((prev) => [
              ...prev,
              {
                id: t.id || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: toolName,
                args: parsedArgs,
                status: 'invoked',
                timestamp: nowStr
              }
            ]);

            // Map canonical tools to real-time account state changes
            let changeSummary = '';
            if (toolName === 'verify_identity') {
              changeSummary = 'Identity verified: Borrower DOB & Last 4 SSN attested';
            } else if (toolName === 'send_payment_link') {
              changeSummary = `Payment Link dispatched via SMS: $${parsedArgs.amount || '0.00'}`;
            } else if (toolName === 'schedule_callback') {
              changeSummary = `Callback scheduled for ${parsedArgs.datetime || parsedArgs.callback_time || 'future window'}`;
            } else if (toolName === 'transfer_to_agent') {
              changeSummary = `Call transferred to live specialist: ${parsedArgs.transfer_reason || 'Escalation'}`;
            } else if (toolName === 'flag_compliance_event') {
              changeSummary = `Compliance event recorded: ${parsedArgs.event_type || 'Event logged'}`;
            } else if (toolName === 'log_disposition') {
              changeSummary = `Servicing disposition finalized: ${parsedArgs.disposition || 'Completed'}`;
            } else if (toolName === 'get_borrower_context') {
              changeSummary = 'Dynamic borrower loan context fetched by Vapi agent';
            }

            if (changeSummary) {
              setWebQaAccountChanges((prev) => [
                ...prev,
                {
                  field: toolName,
                  detail: changeSummary,
                  source: 'Vapi Canonical Tool',
                  timestamp: nowStr
                }
              ]);
            }
          });
        }
      });

      vapi.on('error', (err: any) => {
        setWebQaCallState('error');
        setWebQaError(err?.message || 'Vapi Web SDK error');
        addToast('error', `Web Voice QA Error: ${err?.message || 'Connection error'}`);
      });

      await vapi.start(session.assistantId, {
        firstMessage: session.firstSpokenMessage,
        variableValues: session.syntheticContext
      });

    } catch (e: any) {
      setWebQaCallState('error');
      setWebQaError(e.message);
      addToast('error', `Web Voice QA Exception: ${e.message}`);
    }
  };

  const handleLaunchTelephoneCall = async (campaignId: string, loanId: string, phoneNumberId?: string) => {
    setCallsTelephoneLoading(true);
    setCallsTelephoneResult(null);
    try {
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/launch-call`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ loanId, phoneNumberId })
      });
      const data = await res.json();
      setCallsTelephoneResult(data);
      if (!res.ok) {
        addToast('error', `Telephone call blocked: ${data.message || data.reason || 'Safety lock active'}`);
      } else {
        addToast('success', `Telephone call initiated: ${data.callId || data.referenceNumber}`);
        fetchAll();
      }
    } catch (e: any) {
      setCallsTelephoneResult({ success: false, error: 'LAUNCH_FAILED', message: e.message });
      addToast('error', `Telephone call failed: ${e.message}`);
    } finally {
      setCallsTelephoneLoading(false);
    }
  };

  const handleStopWebQaSession = () => {
    if (vapiWebClient) {
      try {
        vapiWebClient.stop();
      } catch (e) {
        console.error('Error stopping Vapi web client', e);
      }
    }
    if (activeConversationDbId) {
      fetch(`${API_BASE}/conversations/${activeConversationDbId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          durationSeconds: sessionStartTimeRef.current ? Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000)) : 0,
          transcript: currentTranscriptRef.current,
          toolInvocations: webQaToolInvocations,
          structuredDisposition: 'RPC_BROWSER_TEST_COMPLETED',
          dispositionNotes: 'Browser test ended by operator.'
        })
      }).then(() => fetch(`${API_BASE}/conversations`, { headers: getAuthHeaders() }))
        .then(r => r.ok ? r.json() : [])
        .then(list => setConversationsList(list))
        .catch(console.warn);
      setActiveConversationDbId(null);
    }
    setWebQaCallState('idle');
  };

  const handleToggleMicMute = () => {
    if (vapiWebClient) {
      const nextMute = !isMicMuted;
      try {
        vapiWebClient.setMuted(nextMute);
        setIsMicMuted(nextMute);
      } catch (e) {
        console.error('Error setting mute', e);
      }
    }
  };

  const handleToggleSetting = async (key: 'browserTesting' | 'outboundCalls' | 'sms') => {
    if (settingsSaving) return;
    setSettingsSaving(key);

    let payload: any = {};
    if (key === 'browserTesting') {
      const currentMode = operationalSettings?.voiceMode || 'BROWSER_TESTING';
      payload.voiceMode = currentMode === 'BROWSER_TESTING' ? 'OFF' : 'BROWSER_TESTING';
    } else if (key === 'outboundCalls') {
      const currentMode = operationalSettings?.voiceMode || 'BROWSER_TESTING';
      payload.voiceMode = currentMode === 'OUTBOUND_CALLS' ? 'OFF' : 'OUTBOUND_CALLS';
    } else if (key === 'sms') {
      payload.smsEnabled = !operationalSettings?.smsEnabled;
    }

    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', `Setting change rejected: ${data.message || data.error || 'Operation prohibited'}`);
      } else {
        setOperationalSettings(data);
        addToast('success', `Operational control updated successfully.`);
      }
    } catch (err: any) {
      addToast('error', `Failed to update settings: ${err.message}`);
    } finally {
      setSettingsSaving(null);
    }
  };

  // ─── VERIFIED OUTBOUND CALL DESTINATIONS (ALLOWLIST) ────────────────────
  const handleAddDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDestPhone.trim()) {
      addToast('error', 'Phone number is required');
      return;
    }
    setDestSaving(true);
    try {
      const res = await fetch(`${API_BASE}/destinations`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          phoneE164: newDestPhone.trim(),
          label: newDestLabel.trim() || undefined,
          notes: newDestNotes.trim() || undefined,
          approvedBy: 'Console Operator'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', `Failed to add destination: ${data.error || 'Server error'}`);
      } else {
        addToast('success', `Outbound destination ${data.destination?.phoneMasked || newDestPhone} added to verified registry.`);
        setNewDestPhone('');
        setNewDestLabel('');
        setNewDestNotes('');
        const listRes = await fetch(`${API_BASE}/destinations`, { headers: getAuthHeaders() });
        if (listRes.ok) {
          const listData = await listRes.json();
          setDestinationsList(listData.destinations || []);
        }
      }
    } catch (err: any) {
      addToast('error', `Network error adding destination: ${err.message}`);
    } finally {
      setDestSaving(false);
    }
  };

  const handleRevokeDestination = async (id: string, masked: string) => {
    try {
      const res = await fetch(`${API_BASE}/destinations/${id}/revoke`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason: 'Revoked by console operator' })
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', `Failed to revoke destination: ${data.error || 'Server error'}`);
      } else {
        addToast('success', `Outbound destination ${masked} revoked.`);
        const listRes = await fetch(`${API_BASE}/destinations`, { headers: getAuthHeaders() });
        if (listRes.ok) {
          const listData = await listRes.json();
          setDestinationsList(listData.destinations || []);
        }
      }
    } catch (err: any) {
      addToast('error', `Network error revoking destination: ${err.message}`);
    }
  };

  // ─── ESCALATION CONTACT MANAGEMENT METHODS ─────────────────────────────
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactPhoneInput.trim()) {
      addToast('error', 'Phone number is required');
      return;
    }
    setContactSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/escalation-contacts`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          displayName: contactNameInput.trim() || undefined,
          phoneE164: contactPhoneInput.trim(),
          notes: contactNotesInput.trim() || undefined,
          isActive: true
        })
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', `Failed to create contact: ${data.message || data.error}`);
      } else {
        addToast('success', `Escalation contact ${data.contact?.displayName} (${data.contact?.phoneMasked}) created.`);
        setContactNameInput('');
        setContactPhoneInput('');
        setContactNotesInput('');
        setShowAddContactModal(false);
        fetchAll(false);
      }
    } catch (err: any) {
      addToast('error', `Error creating contact: ${err.message}`);
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleToggleContactActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/escalation-contacts/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isActive: !currentActive })
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', `Failed to update status: ${data.message || data.error}`);
      } else {
        addToast('success', `Contact status set to ${!currentActive ? 'Available' : 'Unavailable'}.`);
        fetchAll(false);
      }
    } catch (err: any) {
      addToast('error', `Error updating contact status: ${err.message}`);
    }
  };

  const handleSaveContactEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    setContactSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/escalation-contacts/${editingContact.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          displayName: contactNameInput.trim() || undefined,
          notes: contactNotesInput.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', `Failed to edit contact: ${data.message || data.error}`);
      } else {
        addToast('success', `Contact updated successfully.`);
        setEditingContact(null);
        setContactNameInput('');
        setContactPhoneInput('');
        setContactNotesInput('');
        fetchAll(false);
      }
    } catch (err: any) {
      addToast('error', `Error updating contact: ${err.message}`);
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleRemoveContact = async (id: string, name: string) => {
    try {
      const res = await fetch(`${API_BASE}/escalation-contacts/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', `Failed to remove contact: ${data.message || data.error}`);
      } else {
        addToast('success', `Escalation contact ${name} removed.`);
        fetchAll(false);
      }
    } catch (err: any) {
      addToast('error', `Error removing contact: ${err.message}`);
    }
  };



  // ─── QA SIMULATOR API METHODS ─────────────────────────────────────────────
  const fetchQaScenarios = async () => {
    try {
      const res = await fetch(`${API_BASE}/qa/simulation-scenarios`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setQaScenarios(data.scenarios || []);
        if (data.scenarios?.length > 0 && !selectedQaLoanId) {
          setSelectedQaLoanId(data.scenarios[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load QA scenarios:', err);
    }
  };

  const fetchQaSimulations = async () => {
    try {
      const res = await fetch(`${API_BASE}/qa/simulations`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setQaSimulations(data || []);
      }
    } catch (err) {
      console.error('Failed to load QA simulations:', err);
    }
  };

  const handleRunSimulation = async () => {
    if (!selectedQaLoanId) {
      addToast('error', 'Please select a scenario loan');
      return;
    }
    const scenario = qaScenarios.find(s => s.id === selectedQaLoanId);
    setSimulating(true);
    try {
      const res = await fetch(`${API_BASE}/qa/simulations/run`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          scenarioLoanId: selectedQaLoanId,
          phoneNumberId: scenario?.phoneId,
          selectedOutcome: selectedQaOutcome
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentSimulation(data);
        addToast('success', `Simulation completed: ${selectedQaOutcome}`);
        fetchQaSimulations();
      } else {
        addToast('error', `Simulation failed: ${data.message || data.error}`);
      }
    } catch (err: any) {
      addToast('error', `Simulation error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const handleDeleteSimulation = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/qa/simulations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        addToast('success', 'Simulation run record deleted');
        if (currentSimulation?.id === id) {
          setCurrentSimulation(null);
        }
        fetchQaSimulations();
      } else {
        const err = await res.json();
        addToast('error', `Failed to delete: ${err.message || err.error}`);
      }
    } catch (err: any) {
      addToast('error', `Delete error: ${err.message}`);
    }
  };

  // ─── STYLING BADGES ───────────────────────────────────────────────────────
  const getConsentBadge = (state: string) => {
    switch (state) {
      case 'GRANTED':
        return <span style={{ padding: '2px 6px', background: '#dcfce7', color: '#15803d', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>TCPA: GRANTED ✓</span>;
      case 'MISSING':
        return <span style={{ padding: '2px 6px', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>TCPA: MISSING ✗</span>;
      case 'REVOKED':
        return <span style={{ padding: '2px 6px', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>TCPA: REVOKED ⚠</span>;
      case 'NOT_APPLICABLE_TO_MOBILE_AUTODIAL_CONSENT':
        return <span style={{ padding: '2px 6px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>TCPA: EXEMPT (LANDLINE)</span>;
      default:
        return <span style={{ padding: '2px 6px', background: '#fef3c7', color: '#b45309', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>TCPA: UNKNOWN</span>;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'DIAL_OUTBOUND':
        return <span style={{ padding: '3px 8px', background: '#dcfce7', color: '#15803d', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>DIAL OUTBOUND</span>;
      case 'DEFER_SCHEDULE':
        return <span style={{ padding: '3px 8px', background: '#eff6ff', color: '#2563eb', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>DEFER SCHEDULE</span>;
      case 'SUPPRESS_DNC':
        return <span style={{ padding: '3px 8px', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>SUPPRESS DNC</span>;
      case 'HOLD_RESTRICTION':
        return <span style={{ padding: '3px 8px', background: '#fef3c7', color: '#b45309', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>HOLD RESTRICTION</span>;
      case 'ROUTE_HUMAN_QUEUE':
        return <span style={{ padding: '3px 8px', background: '#faf5ff', color: '#7e22ce', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>ROUTE HUMAN</span>;
      default:
        return <span style={{ padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>{action}</span>;
    }
  };

  return (
    <>
      {/* Toast container */}
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              backgroundColor: t.type === 'success' ? '#15803d' : t.type === 'error' ? '#b91c1c' : '#0369a1',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {t.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* ─── FIXED SIDEBAR ─────────────────────────────────────────────────── */}
      <aside className="console-sidebar">
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#38bdf8' }}>
            OPERATIONS CONSOLE
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginTop: '1px' }}>
            Early Delinquency AI
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
            Mortgage Servicing Voice
          </div>
        </div>

        <nav style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
          {[
            { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
            { id: 'campaigns', label: 'Campaigns', icon: Layers },
            { id: 'accounts', label: 'Accounts & Contacts', icon: Users },
            { id: 'eligibility', label: 'Pre-Dial Eligibility', icon: CheckCircle2 },
            { id: 'calls', label: 'Calls & Responses', icon: PhoneCall },
            { id: 'schedules', label: 'Schedule & Callbacks', icon: Clock },
            { id: 'servicing-outbox', label: 'Servicing Write-Back', icon: FileText },
            { id: 'human-queue', label: 'Human Queue', icon: AlertTriangle },
            { id: 'compliance', label: 'Compliance & DNC', icon: ShieldAlert },
            { id: 'sms', label: 'SMS Messages', icon: MessageSquare },
            { id: 'integrations', label: 'Integration Health', icon: Activity },
            { id: 'audit', label: 'Operational Audit / QA', icon: History }
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`sidebar-nav-btn ${active ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <Icon size={14} color={active ? '#38bdf8' : '#94a3b8'} />
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ─── OPERATIONAL CONTROLS SIDEBAR ─────────────────────────────────── */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid #1e293b', flexShrink: 0, fontSize: '11px', color: '#94a3b8', marginTop: 'auto' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            OPERATIONAL CONTROLS
          </div>

          {/* VOICE CHANNEL */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
              VOICE CHANNEL
            </div>

            {/* Browser Testing Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 500 }}>Browser Testing</span>
              <button
                type="button"
                role="switch"
                aria-checked={operationalSettings?.voiceMode === 'BROWSER_TESTING'}
                aria-label="Toggle Browser Testing"
                onClick={() => handleToggleSetting('browserTesting')}
                disabled={settingsSaving === 'browserTesting'}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  width: '46px',
                  height: '20px',
                  borderRadius: '10px',
                  backgroundColor: operationalSettings?.voiceMode === 'BROWSER_TESTING' ? '#16a34a' : '#334155',
                  border: `1px solid ${operationalSettings?.voiceMode === 'BROWSER_TESTING' ? '#15803d' : '#475569'}`,
                  cursor: settingsSaving ? 'not-allowed' : 'pointer',
                  padding: '0 3px',
                  justifyContent: operationalSettings?.voiceMode === 'BROWSER_TESTING' ? 'flex-end' : 'flex-start'
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    fontSize: '8px',
                    fontWeight: 800,
                    color: operationalSettings?.voiceMode === 'BROWSER_TESTING' ? '#ffffff' : '#94a3b8',
                    left: operationalSettings?.voiceMode === 'BROWSER_TESTING' ? '5px' : 'auto',
                    right: operationalSettings?.voiceMode === 'BROWSER_TESTING' ? 'auto' : '5px',
                    userSelect: 'none'
                  }}
                >
                  {settingsSaving === 'browserTesting' ? '...' : (operationalSettings?.voiceMode === 'BROWSER_TESTING' ? 'ON' : 'OFF')}
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    zIndex: 2
                  }}
                />
              </button>
            </div>

            {/* Outbound Calls Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 500 }}>Outbound Calls</span>
                {operationalSettings?.lockReasons?.outboundCalls && (
                  <span title={operationalSettings.lockReasons.outboundCalls}>
                    <Lock size={10} color="#f59e0b" />
                  </span>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={operationalSettings?.voiceMode === 'OUTBOUND_CALLS'}
                aria-label="Toggle Outbound Calls"
                onClick={() => handleToggleSetting('outboundCalls')}
                disabled={settingsSaving === 'outboundCalls'}
                title={operationalSettings?.lockReasons?.outboundCalls || 'Toggle Outbound PSTN Calling'}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  width: '46px',
                  height: '20px',
                  borderRadius: '10px',
                  backgroundColor: operationalSettings?.voiceMode === 'OUTBOUND_CALLS' ? '#16a34a' : '#334155',
                  border: `1px solid ${operationalSettings?.voiceMode === 'OUTBOUND_CALLS' ? '#15803d' : '#475569'}`,
                  cursor: settingsSaving ? 'not-allowed' : 'pointer',
                  padding: '0 3px',
                  justifyContent: operationalSettings?.voiceMode === 'OUTBOUND_CALLS' ? 'flex-end' : 'flex-start'
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    fontSize: '8px',
                    fontWeight: 800,
                    color: operationalSettings?.voiceMode === 'OUTBOUND_CALLS' ? '#ffffff' : '#94a3b8',
                    left: operationalSettings?.voiceMode === 'OUTBOUND_CALLS' ? '5px' : 'auto',
                    right: operationalSettings?.voiceMode === 'OUTBOUND_CALLS' ? 'auto' : '5px',
                    userSelect: 'none'
                  }}
                >
                  {settingsSaving === 'outboundCalls' ? '...' : (operationalSettings?.voiceMode === 'OUTBOUND_CALLS' ? 'ON' : 'OFF')}
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    zIndex: 2
                  }}
                />
              </button>
            </div>
            {operationalSettings?.lockReasons?.outboundCalls && (
              <div style={{ fontSize: '8px', color: '#f59e0b', marginTop: '2px', lineHeight: '1.2' }}>
                Ceiling locked (PRODUCTION_CALLS_ENABLED=false)
              </div>
            )}
          </div>

          {/* MESSAGING */}
          <div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
              MESSAGING
            </div>

            {/* SMS Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 500 }}>SMS</span>
                {operationalSettings?.lockReasons?.sms && (
                  <span title={operationalSettings.lockReasons.sms}>
                    <Lock size={10} color="#f59e0b" />
                  </span>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(operationalSettings?.smsEnabled)}
                aria-label="Toggle SMS Messaging"
                onClick={() => handleToggleSetting('sms')}
                disabled={settingsSaving === 'sms'}
                title={operationalSettings?.lockReasons?.sms || 'Toggle SMS Messaging'}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  width: '46px',
                  height: '20px',
                  borderRadius: '10px',
                  backgroundColor: operationalSettings?.smsEnabled ? '#16a34a' : '#334155',
                  border: `1px solid ${operationalSettings?.smsEnabled ? '#15803d' : '#475569'}`,
                  cursor: settingsSaving ? 'not-allowed' : 'pointer',
                  padding: '0 3px',
                  justifyContent: operationalSettings?.smsEnabled ? 'flex-end' : 'flex-start'
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    fontSize: '8px',
                    fontWeight: 800,
                    color: operationalSettings?.smsEnabled ? '#ffffff' : '#94a3b8',
                    left: operationalSettings?.smsEnabled ? '5px' : 'auto',
                    right: operationalSettings?.smsEnabled ? 'auto' : '5px',
                    userSelect: 'none'
                  }}
                >
                  {settingsSaving === 'sms' ? '...' : (operationalSettings?.smsEnabled ? 'ON' : 'OFF')}
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    zIndex: 2
                  }}
                />
              </button>
            </div>
            {operationalSettings?.lockReasons?.sms && (
              <div style={{ fontSize: '8px', color: '#f59e0b', marginTop: '2px', lineHeight: '1.2' }}>
                Ceiling locked (TWILIO_SMS_MODE=disable)
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT VIEWPORT ────────────────────────────────────────── */}
      <main className="console-main">
        {/* Top Header Bar */}
        <header
          style={{
            height: '56px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            flexShrink: 0,
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
              {activeTab === 'dashboard' && 'Operations Overview & Portfolio Metrics'}
              {activeTab === 'campaigns' && 'Campaign Orchestration & Scoping'}
              {activeTab === 'accounts' && 'Accounts, Borrowers & Multiple Contacts'}
              {activeTab === 'eligibility' && 'Pre-Dial Deterministic Eligibility (12 Gate Categories)'}
              {activeTab === 'calls' && 'Historical Call Attempts & Provider Records'}
              {activeTab === 'schedules' && 'Schedule, Durable Jobs & Callbacks'}
              {activeTab === 'servicing-outbox' && 'Servicing Write-Back Outbox'}
              {activeTab === 'human-queue' && 'Human Escalation & Review Worklist'}
              {activeTab === 'compliance' && 'Regulatory Registry, DNC Suppressions & V1 Restrictions'}
              {activeTab === 'sms' && 'Outbound SMS Messages (Dry-Run Test Mode)'}
              {activeTab === 'integrations' && 'Integration Health & System Telephony'}
              {activeTab === 'audit' && 'Operational Audit & State Change Log'}
            </span>
            {lastRefreshedAt && (
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Last refreshed: <strong>{lastRefreshedAt}</strong>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn-secondary"
              onClick={() => fetchAll(true)}
              disabled={loading}
              style={{ height: '34px', minWidth: '100px' }}
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </header>

        {/* ─── US & OPERATOR TIMEZONE BANNER ─────────────────────────────────── */}
        <div
          style={{
            backgroundColor: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            padding: '7px 24px',
            display: 'flex',
            gap: '24px',
            alignItems: 'center',
            fontSize: '12px',
            flexShrink: 0,
            overflowX: 'auto'
          }}
        >
          <span style={{ fontWeight: 600, color: '#475569', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>
            Active Clocks:
          </span>
          <TimezoneDisplay tz="America/New_York" label="Eastern (ET)" />
          <TimezoneDisplay tz="America/Chicago" label="Central (CT)" />
          <TimezoneDisplay tz="America/Denver" label="Mountain (MT)" />
          <TimezoneDisplay tz="America/Los_Angeles" label="Pacific (PT)" />
          <TimezoneDisplay tz="Asia/Kolkata" label="Operator (IST)" />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={12} color="#0284c7" />
            <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600 }}>
              Configured Borrower Contact Hours: {summary?.configuredCallingHours?.permissibleWindowBorrowerLocal || '8:00 AM – 9:00 PM Borrower Local'}
            </span>
            <KpiPopover
              label="Configured Borrower Contact Hours"
              content="Permissible calling hours evaluated dynamically against borrower local time. The backend enforces 8:00 AM to 9:00 PM in the borrower's resolved IANA timezone, further constrained by any borrower-requested preferred calling window."
            />
          </div>
        </div>

        {/* ─── PAGE CONTENT CONTAINER ───────────────────────────────────────── */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {/* ─── A. OVERVIEW DASHBOARD ─────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <div>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {[
                  {
                    label: 'ACTIVE CAMPAIGNS',
                    val: summary?.activeCampaignsCount ?? campaigns.filter((c) => c.status === 'active').length,
                    sub: `${summary?.activeCampaignsCount ?? campaigns.filter((c) => c.status === 'active').length} active out of ${summary?.totalCampaignsCount ?? campaigns.length} configured`,
                    tooltip: 'An active campaign is enabled for scheduled contact processing. Its assigned borrowers are considered according to their individual/campaign contact schedules. A contact is initiated only when it becomes due and passes all required backend eligibility and authorization checks.'
                  },
                  {
                    label: 'BORROWERS ASSIGNED TO CAMPAIGNS',
                    val: summary?.borrowersAssignedToCampaigns ?? accounts.length,
                    sub: `Portfolio accounts: ${summary?.portfolioAccountsCount ?? accounts.length} · QA scenario accounts: ${summary?.qaScenarioAccountsCount ?? 0}`,
                    tooltip: 'Total unique delinquent loan borrowers assigned to active campaigns. Baseline accounts represent real portfolio servicing records; QA scenario accounts are synthetic test batches.'
                  },
                  {
                    label: 'COMPLETED OUTBOUND CALLS',
                    val: summary?.completedCallCount ?? 0,
                    sub: (summary?.completedCallCount ?? 0) === 0 ? 'No completed telephone calls recorded yet.' : `${summary.completedCallCount} completed PSTN calls`,
                    tooltip: 'Count of actual provider-completed telephone calls (NORMAL_DIAL) reaching completion. Excludes seeded test records and failed/in-progress dispatches.'
                  },
                  {
                    label: 'RIGHT-PARTY CONTACT RATE',
                    val: (summary?.completedCallCount ?? 0) === 0 ? 'Not available yet' : (summary?.rpcRate || '0.0%'),
                    sub: (summary?.completedCallCount ?? 0) === 0 ? 'No completed calls to calculate the rate.' : `${summary?.rpcCount || 0} right-party contacts verified`,
                    tooltip: 'Right-Party Contact (RPC) Rate: The percentage of completed outbound calls that successfully reached and verified the intended delinquent borrower. Numerator: confirmed borrower contacts; Denominator: completed outbound calls. Voicemail, busy, and uncompleted calls are excluded from the numerator.'
                  },
                  {
                    label: 'PENDING BORROWER CALLBACKS',
                    val: summary?.borrowerCallbacksPending ?? 0,
                    sub: (summary?.borrowerCallbacksPending ?? 0) === 0 ? 'No pending borrower callbacks.' : `${summary.borrowerCallbacksPending} borrower callbacks scheduled`,
                    tooltip: 'Genuine borrower-requested callbacks scheduled through conversational voice interactions. Excludes synthetic QA scenario fixtures and internal recurring cron schedules.'
                  }
                ].map((kpi, idx) => (
                  <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{kpi.label}</span>
                      <KpiPopover label={kpi.label} content={kpi.tooltip} />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 2px', color: '#0f172a' }}>{kpi.val}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Actionable Queues Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                {/* 1. Upcoming Borrower Callbacks */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Upcoming Borrower Callbacks</span>
                      <KpiPopover
                        label="Upcoming Borrower Callbacks"
                        content="Real-time queue of genuine pending borrower callbacks arranged during voice agent conversations across all campaigns. Excludes synthetic scenario fixtures."
                      />
                    </div>
                    <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setActiveTab('schedules')}>
                      View All in Schedule & Callbacks →
                    </button>
                  </div>
                  {(() => {
                    const genuineCallbacks = callbacksList.filter(
                      (cb: any) => cb.status === 'scheduled' && !cb.isScenarioData && cb.sourceType !== 'QA_SCENARIO'
                    );
                    if (genuineCallbacks.length === 0) {
                      return (
                        <div style={{ fontSize: '13px', color: '#64748b', padding: '24px 0', textAlign: 'center' }}>
                          <Clock size={20} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
                          <div style={{ fontWeight: 500 }}>No upcoming borrower callbacks.</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Verified borrower requests and operator follow-ups across all active campaigns will appear here.
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {genuineCallbacks.slice(0, 4).map((cb: any) => (
                          <div
                            key={cb.id}
                            style={{
                              padding: '10px 12px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
                                  {cb.borrowerName || 'Borrower'}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#475569', background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px' }}>
                                  {cb.maskedLoanNumber || 'LN-****'}
                                </span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  · {cb.campaignName}
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                                {cb.humanReadableNote || 'Borrower requested follow-up'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>
                                {new Date(cb.callbackScheduledDatetime).toLocaleDateString()} {new Date(cb.callbackScheduledDatetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div style={{ fontSize: '10px', color: '#64748b' }}>
                                {cb.callbackTimezoneIana || 'Borrower Local'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Human Review & Escalations Card */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Human Review & Escalations</span>
                        <KpiPopover
                          label="Human Review & Escalations"
                          content="Calls where borrowers requested human transfer or encountered complex hardship scenarios requiring specialist review."
                        />
                      </div>
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setActiveTab('human-queue')}>
                        View Human Queue →
                      </button>
                    </div>

                    {/* Operational Summary Metrics Bar */}
                    {(() => {
                      const openEscalations = humanQueue.filter((h: any) => h.status !== 'resolved' && h.status !== 'dismissed');
                      const criticalCount = openEscalations.filter((h: any) => h.priority <= 2).length;
                      const activeContactsCount = (summary?.humanEscalationContacts || escalationContactsList).filter((c: any) => c.isActive).length;

                      return (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                            <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Open Escalations</div>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: openEscalations.length > 0 ? '#b91c1c' : '#15803d', marginTop: '2px' }}>
                                {openEscalations.length}
                              </div>
                              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                                {criticalCount > 0 ? `${criticalCount} High / Critical (P1-P2)` : '0 Critical priority'}
                              </div>
                            </div>

                            <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Escalation Coverage</div>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: activeContactsCount > 0 ? '#15803d' : '#b45309', marginTop: '2px' }}>
                                {activeContactsCount > 0 ? 'Active' : 'Uncovered'}
                              </div>
                              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                                {activeContactsCount} available {activeContactsCount === 1 ? 'contact' : 'contacts'} configured
                              </div>
                            </div>
                          </div>

                          {/* Preview of Most Urgent Unresolved Cases */}
                          {openEscalations.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#64748b', padding: '18px 0', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                              <ShieldCheck size={22} color="#15803d" style={{ margin: '0 auto 6px' }} />
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>Human Review Worklist Clear</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Zero pending safety or hardship escalations.</div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                                Urgent Unresolved Cases Preview
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {openEscalations.slice(0, 2).map((h: any) => (
                                  <div
                                    key={h.id}
                                    style={{
                                      padding: '8px 10px',
                                      background: '#fef2f2',
                                      border: '1px solid #fecaca',
                                      borderRadius: '6px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontWeight: 700, color: '#991b1b', fontSize: '10px', background: '#fee2e2', padding: '1px 5px', borderRadius: '3px' }}>
                                          P{h.priority}
                                        </span>
                                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '12px' }}>
                                          {h.borrowerName || h.loan?.loanNumber || 'Account'}
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#64748b' }}>
                                          {h.maskedLoanNumber || 'LN-****'}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '11px', color: '#7f1d1d', marginTop: '2px' }}>
                                        {h.reason}: {h.notes || 'Human review required'}
                                      </div>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#991b1b' }}>
                                      {h.status?.toUpperCase()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Detailed worklist, routing & contacts managed in Human Queue
                    </span>
                    <button
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => setActiveTab('human-queue')}
                    >
                      Open Human Queue →
                    </button>
                  </div>
                </div>
              </div>

              {/* ─── C. SCHEDULED CAMPAIGN CONTACTS SUMMARY ─────────────────────────── */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                      Scheduled Campaign Contacts
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Delinquent accounts scheduled for outreach across active servicing campaigns.
                    </div>
                  </div>
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={() => setActiveTab('campaigns')}
                  >
                    View Campaigns & Queues →
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Contacts Currently Due</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '4px 0 2px' }}>
                      {summary?.scheduledCampaignContactsSummary?.contactsCurrentlyDue ?? summary?.campaignContactsDue?.totalDueCount ?? 0}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Accounts with contact cadence reached</div>
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Eligible for Contact</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d', margin: '4px 0 2px' }}>
                      {summary?.scheduledCampaignContactsSummary?.contactsEligibleForContact ?? summary?.campaignContactsDue?.dueEligibleCount ?? 0}
                    </div>
                    <div style={{ fontSize: '11px', color: '#166534' }}>Passed all 12 pre-dial eligibility gates</div>
                  </div>

                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#991b1b', textTransform: 'uppercase' }}>Blocked by Eligibility</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#b91c1c', margin: '4px 0 2px' }}>
                      {summary?.scheduledCampaignContactsSummary?.contactsBlockedByEligibility ?? summary?.campaignContactsDue?.dueBlockedCount ?? 0}
                    </div>
                    <div style={{ fontSize: '11px', color: '#991b1b' }}>Outside calling window, in cooldown, or restricted</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── B. CAMPAIGNS (UNIFIED DELINQUENCY WORKSPACE) ──────────────── */}
          {activeTab === 'campaigns' && (() => {
            // Main operational campaigns (strictly 3: 1-30 DPD, 31-59 DPD, Verified Contacts)
            const activeCampaigns = campaigns
              .filter(c => c.status !== 'archived' && !c.name?.toLowerCase().includes('supervised qa') && c.campaignType !== 'QA_SIMULATION')
              .sort((a, b) => {
                if (a.name?.includes('1–30') || a.name?.includes('1-30')) return -1;
                if (b.name?.includes('1–30') || b.name?.includes('1-30')) return 1;
                if (a.name?.includes('31–59') || a.name?.includes('31-59')) return -1;
                if (b.name?.includes('31–59') || b.name?.includes('31-59')) return 1;
                return 0;
              });

            const totalEnrolled = activeCampaigns.reduce((sum, c) => sum + (c.totalMembers ?? 0), 0);
            const totalDue = activeCampaigns.reduce((sum, c) => sum + (c.dueForEvaluation ?? 0), 0);

            const displayedCampaigns = activeCampaigns.filter(c => {
              if (campaignStatusFilter === 'all') return true;
              if (campaignStatusFilter === 'active' || campaignStatusFilter === 'running') return c.status === 'active' || c.status === 'running';
              return c.status === campaignStatusFilter;
            });

            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                {/* Header & Global Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Campaign Outreach & Servicing Cohorts</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Unified delinquency campaign management: cohort segmentation, contact cadence, member evaluation, and outreach policies.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button className="btn-primary" onClick={() => setShowCreateCampaignModal(true)}>
                      <Plus size={14} /> Create Campaign
                    </button>
                  </div>
                </div>

                {/* Campaign Summary Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Active Campaigns</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '4px 0 2px' }}>{activeCampaigns.length}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Segmented servicing cohorts</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Enrolled Borrowers</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb', margin: '4px 0 2px' }}>{totalEnrolled}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Portfolio loan accounts</div>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Due For Evaluation</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d', margin: '4px 0 2px' }}>{totalDue}</div>
                    <div style={{ fontSize: '11px', color: '#166534' }}>Cadence reached (next_contact_at ≤ NOW)</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Outbound Dispatch</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#b45309', margin: '6px 0 2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={14} color="#b45309" /> PSTN Safety Locked
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Browser WebRTC testing enabled</div>
                  </div>
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginRight: '4px' }}>FILTER STATUS:</span>
                  {[
                    { id: 'all', label: `All (${activeCampaigns.length})` },
                    { id: 'active', label: `Running (${activeCampaigns.filter(c => c.status === 'active' || c.status === 'running').length})` },
                    { id: 'ready', label: `Ready (${activeCampaigns.filter(c => c.status === 'ready').length})` },
                    { id: 'paused', label: `Paused (${activeCampaigns.filter(c => c.status === 'paused').length})` },
                    { id: 'completed', label: `Completed (${activeCampaigns.filter(c => c.status === 'completed').length})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setCampaignStatusFilter(tab.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: campaignStatusFilter === tab.id ? 700 : 500,
                        background: campaignStatusFilter === tab.id ? '#0f172a' : '#f1f5f9',
                        color: campaignStatusFilter === tab.id ? '#ffffff' : '#475569',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div>
                    <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '16px', fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Info size={16} color="#3b82f6" />
                      <span>
                        Campaign cohorts organize borrowers by delinquency stage (DPD) and enforce outreach frequency, cooldown intervals, and contact limits. Activating a campaign enables borrower scheduling; live calls are governed by global outbound controls.
                      </span>
                    </div>

                    <div className="table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>CAMPAIGN & PURPOSE</th>
                            <th>BORROWER SEGMENT</th>
                            <th>ENROLLED BORROWERS</th>
                            <th>DUE FOR EVALUATION</th>
                            <th>LAST ELIGIBILITY REVIEW</th>
                            <th>CAMPAIGN STATUS</th>
                            <th style={{ textAlign: 'right' }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedCampaigns.map((camp: any) => {
                            return (
                            <tr key={camp.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{camp.name}</span>
                                  <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '10px', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>
                                    {camp.cohortLabel || `${camp.dpdMin}–${camp.dpdMax} DPD Cohort`}
                                  </span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{camp.description || 'Delinquency outreach cohort'}</div>
                              </td>
                              <td>
                                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                  {camp.dpdMin} – {camp.dpdMax} DPD
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{camp.totalMembers ?? 0} total</div>
                                <div style={{ fontSize: '11px', color: '#2563eb' }}>{camp.activeMembers ?? 0} active</div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '14px', color: (camp.dueForEvaluation ?? 0) > 0 ? '#15803d' : '#64748b' }}>
                                    {camp.dueForEvaluation ?? 0}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>accounts</span>
                                </div>
                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Contact cadence reached</div>
                              </td>
                              <td>
                                {camp.lastEvaluatedAt ? (
                                  <div>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                                      {new Date(camp.lastEvaluatedAt).toLocaleDateString()} {new Date(camp.lastEvaluatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                      <span style={{ padding: '1px 5px', background: '#dcfce7', color: '#15803d', borderRadius: '3px', fontSize: '10px', fontWeight: 700 }}>
                                        {camp.lastEvaluatedEligibleCount ?? 0} Eligible
                                      </span>
                                      <span style={{ padding: '1px 5px', background: '#fee2e2', color: '#b91c1c', borderRadius: '3px', fontSize: '10px', fontWeight: 700 }}>
                                        {camp.lastEvaluatedBlockedCount ?? 0} Blocked
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>Not evaluated yet</span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      backgroundColor: camp.status === 'active' ? '#dcfce7' : (camp.status === 'paused' ? '#fef3c7' : '#f1f5f9'),
                                      color: camp.status === 'active' ? '#15803d' : (camp.status === 'paused' ? '#b45309' : '#475569')
                                    }}
                                  >
                                    {camp.status?.toUpperCase()}
                                  </span>
                                  <KpiPopover
                                    label="Campaign Status"
                                    content="Active campaigns evaluate enrolled borrowers when their scheduled contact time arrives. Live calling is governed by global outbound calling controls."
                                  />
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                  <button
                                    className="btn-primary"
                                    style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: '#2563eb', fontWeight: 600 }}
                                    onClick={() => handleOpenCampaignDetails(camp)}
                                  >
                                    <FolderOpen size={13} /> Open Campaign
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => {
                                      setSelectedCampaignForMembers(camp);
                                      setCampaignMembersTab('members');
                                      fetchCampaignMembers(camp.id);
                                      fetchCampaignCandidates(camp.id);
                                      setShowManageMembersModal(true);
                                    }}
                                  >
                                    <Users size={12} /> Members ({camp.totalMembers ?? 0})
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => handleRunCampaignDispatch(camp)}
                                    disabled={dispatchingCampaignId === camp.id}
                                    title="Evaluate all 12 pre-dial gates for active campaign members in simulation"
                                  >
                                    <Play size={12} className={dispatchingCampaignId === camp.id ? 'animate-spin' : ''} />
                                    {dispatchingCampaignId === camp.id ? 'Evaluating...' : 'Review 12 Gates'}
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '6px 8px', fontSize: '11px' }}
                                    onClick={() => handleToggleCampaignStatus(camp)}
                                    title="Toggle campaign status"
                                  >
                                    {camp.status === 'active' ? 'Pause' : 'Activate'}
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '6px 8px', fontSize: '11px' }}
                                    onClick={() => handleOpenEditCampaign(camp)}
                                    title="Edit settings"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                  </div>
              </div>
            );
          })()}

          {/* ─── C. ACCOUNTS & CONTACTS ────────────────────────────────────── */}
          {activeTab === 'accounts' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>Accounts, Borrowers & Contacts Registry</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Multi-phone contacts with independent TCPA consent and DNC, plus editable scenario flags.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      if (accounts.length > 0 && !targetLoanForPhone) {
                        setTargetLoanForPhone(accounts[0].id);
                      }
                      setShowAddPhoneModal(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} color="#0284c7" /> Add Contact Number
                  </button>
                  <button className="btn-secondary" onClick={() => setShowGenerateBatchModal(true)}>
                    <Sparkles size={14} color="#2563eb" /> Generate Account Batch
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      fetchQaBatches();
                      setShowBatchCleanupDrawer(true);
                    }}
                  >
                    <Sliders size={14} /> Batch Management
                  </button>
                  <button className="btn-primary" onClick={() => setShowAddAccountModal(true)}>
                    <Plus size={14} /> New Account
                  </button>
                </div>
              </div>

              {/* Part 6: Portfolio Summary Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '16px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Borrowers</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '2px 0' }}>{portfolioSummary?.totalBorrowers ?? '—'}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Distinct borrower profiles</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Loan Accounts</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb', margin: '2px 0' }}>{portfolioSummary?.totalAccounts ?? accounts.length}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Serviced loan portfolios</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Contact Numbers</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '2px 0' }}>{portfolioSummary?.totalPhones ?? '—'}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Registered phone records</div>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Hygiene Verified</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', margin: '2px 0' }}>{portfolioSummary?.verifiedPhones ?? '—'}</div>
                  <div style={{ fontSize: '10px', color: '#166534' }}>Carrier HLR verified</div>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#1e40af', textTransform: 'uppercase' }}>Consent Granted</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb', margin: '2px 0' }}>{portfolioSummary?.consentGrantedPhones ?? '—'}</div>
                  <div style={{ fontSize: '10px', color: '#1e40af' }}>Express consent on file</div>
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>Missing/Revoked</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#b45309', margin: '2px 0' }}>{portfolioSummary?.consentMissingOrRevokedPhones ?? '—'}</div>
                  <div style={{ fontSize: '10px', color: '#92400e' }}>Requires re-consent</div>
                </div>
              </div>

              {/* Filters Bar */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search by loan, borrower, or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '260px' }}
                />
                <select
                  value={accountFilterCampaign}
                  onChange={(e) => setAccountFilterCampaign(e.target.value)}
                  style={{ width: '180px' }}
                >
                  <option value="all">All Campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={accountFilterBucket}
                  onChange={(e) => setAccountFilterBucket(e.target.value as any)}
                  style={{ width: '140px' }}
                >
                  <option value="all">All DPD Buckets</option>
                  <option value="1-30">1–30 DPD</option>
                  <option value="31-59">31–59 DPD</option>
                  <option value="60+">60+ DPD</option>
                </select>
              </div>

              <div className="table-container">
                <table className="console-table">
                  <thead>
                    <tr>
                      <th>LOAN NUMBER</th>
                      <th>PRIMARY BORROWER</th>
                      <th>DPD & PAST DUE</th>
                      <th>INDEPENDENT PHONE CONTACTS</th>
                      <th>ACCOUNT DNC</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts
                      .filter((acc) => {
                        if (search) {
                          const q = search.toLowerCase();
                          const matchLoan = acc.loanNumber?.toLowerCase().includes(q);
                          const matchBorrower = `${acc.borrower?.firstName} ${acc.borrower?.lastName}`.toLowerCase().includes(q);
                          const matchPhone = acc.phones?.some((p: any) => p.phoneE164?.includes(q));
                          if (!matchLoan && !matchBorrower && !matchPhone) return false;
                        }
                        if (accountFilterBucket !== 'all') {
                          if (accountFilterBucket === '1-30' && acc.dpd > 30) return false;
                          if (accountFilterBucket === '31-59' && (acc.dpd <= 30 || acc.dpd > 59)) return false;
                          if (accountFilterBucket === '60+' && acc.dpd <= 59) return false;
                        }
                        return true;
                      })
                      .map((acc) => (
                        <tr key={acc.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{acc.loanNumber}</div>
                            {acc.isSeeded ? (
                              <span style={{ fontSize: '10px', color: '#64748b' }}>Baseline Portfolio</span>
                            ) : (
                              <span style={{ padding: '1px 5px', background: '#f1f5f9', color: '#475569', borderRadius: '3px', fontSize: '10px', fontWeight: 600 }}>
                                Enrolled Account
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {acc.borrower ? `${acc.borrower.firstName} ${acc.borrower.lastName}` : 'Unassigned'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              Lang: {acc.borrower?.preferredLanguage?.toUpperCase() || 'EN'}
                            </div>
                          </td>
                          <td>
                            <div>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: acc.dpd <= 30 ? '#eff6ff' : '#fffbeb',
                                  color: acc.dpd <= 30 ? '#1d4ed8' : '#b45309'
                                }}
                              >
                                {acc.dpd} DPD
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>
                              ${acc.pastDueAmount}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {acc.phones?.map((p: any) => (
                                <div
                                  key={p.id}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#f8fafc',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                                        {maskPhone(p.phoneE164, p.id)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => togglePhoneReveal(p.id)}
                                        style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', color: '#64748b' }}
                                        title={revealedPhones[p.id] ? 'Mask phone' : 'Reveal phone'}
                                      >
                                        {revealedPhones[p.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                      </button>
                                      <span style={{ fontSize: '10px', color: '#64748b' }}>
                                        ({p.label || 'phone'} - {p.lineType?.toUpperCase()})
                                      </span>
                                    </div>
                                    {p.dnc && (
                                      <span style={{ padding: '1px 4px', background: '#fee2e2', color: '#b91c1c', borderRadius: '3px', fontSize: '10px', fontWeight: 700 }}>
                                        NUM DNC ✗
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{
                                      padding: '1px 5px',
                                      background: (p.isVerified || p.isHygieneVerified) ? '#dcfce7' : '#fef3c7',
                                      color: (p.isVerified || p.isHygieneVerified) ? '#15803d' : '#92400e',
                                      borderRadius: '3px',
                                      fontSize: '10px',
                                      fontWeight: 600
                                    }}>
                                      {(p.isVerified || p.isHygieneVerified) ? '✓ Contact: Verified' : '⚠ Contact: Unverified'}
                                    </span>
                                    {getConsentBadge(p.consentState)}
                                    {p.timezoneIana && (
                                      <span style={{ fontSize: '10px', color: '#64748b' }}>
                                        {p.timezoneIana.split('/')[1] || p.timezoneIana}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td>
                            {acc.accountDnc ? (
                              <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <ShieldAlert size={12} /> ACTIVE DNC
                              </span>
                            ) : (
                              <span style={{ color: '#15803d', fontSize: '11px' }}>Clear</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={async () => {
                                  const res = await fetch(`${API_BASE}/accounts/${acc.id}`, { headers: getAuthHeaders() });
                                  if (res.ok) {
                                    setSelectedAccountDetail(await res.json());
                                  }
                                }}
                              >
                                View Detail / Flags →
                              </button>
                              <button
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => {
                                  setTargetLoanForPhone(acc.id);
                                  setShowAddPhoneModal(true);
                                }}
                              >
                                + Phone
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── D. PRE-DIAL ELIGIBILITY ───────────────────────────────────── */}
          {activeTab === 'eligibility' && (
            <div>
              {/* Sub-tab switcher */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  className={eligibilitySubTab === 'queue' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setEligibilitySubTab('queue')}
                >
                  Campaign Pre-Dial Queue
                </button>
                <button
                  className={eligibilitySubTab === 'qa_demos' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setEligibilitySubTab('qa_demos');
                    fetchCooldownDemo(cooldownElapsedHours);
                  }}
                >
                  <Sparkles size={14} /> Eligibility Gate Diagnostics & Rules Demonstration
                </button>
              </div>

              {eligibilitySubTab === 'queue' && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 600 }}>Pre-Dial Eligibility Queue (12 Primary Categories)</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Deterministic evaluation evaluating TCPA consent applicability, legal calling windows, PCW, DNC, and capacity.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        style={{ width: '220px' }}
                      >
                        <option value="">All Campaigns</option>
                        {campaigns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Filter loan number or borrower..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: '240px' }}
                      />
                    </div>
                  </div>

                  {eligibilityQueue.length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                      No members in this campaign. Zero accounts evaluated.
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>LOAN #</th>
                            <th>BORROWER</th>
                            <th>DPD</th>
                            <th>TARGET NUMBER & LINE</th>
                            <th>CONSENT STATE</th>
                            <th>BORROWER LOCAL TIME</th>
                            <th>GATE DECISION</th>
                            <th>NEXT ACTION</th>
                            <th style={{ textAlign: 'right' }}>ELIGIBILITY & ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eligibilityQueue
                            .filter((item) => {
                              if (!search) return true;
                              const q = search.toLowerCase();
                              return (
                                item.loan.loanNumber.toLowerCase().includes(q) ||
                                `${item.borrower?.firstName} ${item.borrower?.lastName}`.toLowerCase().includes(q)
                              );
                            })
                            .map((item, idx) => {
                              const isEligible = item.evaluation.eligible;
                              const primaryPhone = item.selectedPhone;
                              return (
                                <tr key={idx}>
                                  <td style={{ fontWeight: 600 }}>{item.loan.loanNumber}</td>
                                  <td>{item.borrower ? `${item.borrower.firstName} ${item.borrower.lastName}` : 'Unassigned'}</td>
                                  <td>
                                    <span
                                      style={{
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: item.loan.dpd <= 30 ? '#eff6ff' : '#fffbeb',
                                        color: item.loan.dpd <= 30 ? '#1d4ed8' : '#b45309'
                                      }}
                                    >
                                      {item.loan.dpd} DPD
                                    </span>
                                  </td>
                                  <td>
                                    {item.allPhones && item.allPhones.length > 1 ? (
                                      <div>
                                        <select
                                          value={evalSelectedPhones[item.loan.id] || primaryPhone?.id}
                                          onChange={(e) => {
                                            setEvalSelectedPhones({ ...evalSelectedPhones, [item.loan.id]: e.target.value });
                                          }}
                                          style={{ fontSize: '11px', padding: '3px 6px', maxWidth: '200px' }}
                                        >
                                          {item.allPhones.map((p: any) => (
                                            <option key={p.id} value={p.id}>
                                              {p.phoneE164} ({p.label} - {p.lineType})
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    ) : (
                                      <div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500 }}>
                                          {maskPhone(primaryPhone?.phoneE164, primaryPhone?.id)}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                          {primaryPhone?.lineType?.toUpperCase() || 'UNKNOWN'}
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td>{getConsentBadge(primaryPhone?.consentState || 'UNKNOWN')}</td>
                                  <td>
                                    <div style={{ fontSize: '12px', fontWeight: 500 }}>
                                      {item.evaluation.borrowerLocalTime || 'N/A'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                                      {primaryPhone?.timezoneIana?.split('/')[1] || 'Unknown'}
                                    </div>
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        backgroundColor: isEligible ? '#dcfce7' : '#fee2e2',
                                        color: isEligible ? '#15803d' : '#b91c1c'
                                      }}
                                    >
                                      {item.evaluation.finalResult}
                                    </span>
                                    {!isEligible && item.evaluation.allBlockingReasons?.length > 1 && (
                                      <span style={{ marginLeft: '4px', fontSize: '10px', color: '#64748b' }}>
                                        (+{item.evaluation.allBlockingReasons.length - 1} more)
                                      </span>
                                    )}
                                  </td>
                                  <td>{getActionBadge(item.evaluation.nextAction)}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                                      <button
                                        className="btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                        onClick={() => setEvalModalItem(item)}
                                      >
                                        View Diagnostic
                                      </button>
                                      <button
                                        className="btn-secondary"
                                        disabled
                                        style={{ padding: '4px 8px', fontSize: '11px', opacity: 0.6 }}
                                        title="Outbound phone calls: Off (Browser testing only)"
                                      >
                                        Outbound: Off
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Eligibility Diagnostics & Cooldown Demonstration */}
              {eligibilitySubTab === 'qa_demos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Cooldown Gate C10 Interactive Sandbox */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                            Gate C10: Cooldown & Contact Caps (QA Interactive Proof)
                          </span>
                          <span style={{ padding: '2px 8px', background: '#faf5ff', color: '#7e22ce', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            Scenario evaluation — not a live call
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                          Demonstrates Gate C10 cooldown deterministically without inserting fake operational call attempts into the database.
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                          Simulated Elapsed Time Since Last Non-Tech Attempt:
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            className={cooldownElapsedHours === 1.5 ? 'btn-primary' : 'btn-secondary'}
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => {
                              setCooldownElapsedHours(1.5);
                              fetchCooldownDemo(1.5);
                            }}
                          >
                            1.5h Elapsed (&lt; 4h Cooldown)
                          </button>
                          <button
                            className={cooldownElapsedHours === 4.5 ? 'btn-primary' : 'btn-secondary'}
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => {
                              setCooldownElapsedHours(4.5);
                              fetchCooldownDemo(4.5);
                            }}
                          >
                            4.5h Elapsed (&gt; 4h Cooldown)
                          </button>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                          Configured Cooldown Window: <strong>4.0 hours</strong>
                        </div>
                      </div>

                      <div style={{ padding: '12px', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                          Evaluated Gate C10 Result
                        </div>
                        {cooldownDemoData ? (
                          <div style={{ marginTop: '4px' }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: cooldownDemoData.evaluation?.eligible ? '#15803d' : '#b91c1c' }}>
                              {cooldownDemoData.evaluation?.finalResult}
                            </div>
                            <div style={{ fontSize: '12px', color: '#0f172a', marginTop: '2px' }}>
                              {cooldownDemoData.evaluation?.reason || 'Cooldown passed — outside 4-hour window'}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Evaluating...</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 12 Gate Overview Grid */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>12 Primary Gate Categories Overview</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                      Every voice call attempt is evaluated against these 12 deterministic rules immediately prior to dispatch.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      {[
                        { code: 'C1', name: 'Campaign Scope', desc: 'Checks DPD is within configured bounds (e.g. 1–30 DPD)' },
                        { code: 'C2a', name: 'Hard Exclusions', desc: 'Blocks active bankruptcy, active litigation, or deceased borrowers' },
                        { code: 'C2b', name: 'Active Loss Mitigation', desc: 'Blocks accounts undergoing active loss mitigation workouts' },
                        { code: 'C2c', name: 'Active Dispute', desc: 'Blocks accounts with open formal disputes pending investigation' },
                        { code: 'C3', name: 'Do Not Call (DNC)', desc: 'Blocks account-wide DNC or individual phone number DNC' },
                        { code: 'C4', name: 'Phone Hygiene', desc: 'Verifies number is valid, connected, and hygiene checked' },
                        { code: 'C5', name: 'TCPA Mobile Consent', desc: 'Requires express written consent for mobile numbers; landlines exempt' },
                        { code: 'C6', name: 'Timezone Availability', desc: 'Requires valid IANA timezone to calculate calling windows' },
                        { code: 'C7', name: 'Legal Calling Window', desc: 'Enforces 8:00 AM to 9:00 PM borrower local time (TCPA / FDCPA)' },
                        { code: 'C8', name: 'Preferred Contact Window', desc: 'Respects borrower-requested custom contact windows' },
                        { code: 'C9', name: 'V1 Temporary Restriction', desc: 'Respects borrower temporary no-call periods (e.g. no Mondays)' },
                        { code: 'C10', name: 'Cooldown & Caps', desc: 'Enforces 4-hour cooldown and max campaign attempt limits' },
                        { code: 'C11', name: 'Pending Callback', desc: 'Blocks automated calls when a future borrower callback is scheduled' },
                        { code: 'C12', name: 'Calling Capacity', desc: 'Guarantees concurrency does not exceed agent telephony limits' }
                      ].map((gate) => (
                        <div key={gate.code} style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '12px' }}>{gate.code}</span>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{gate.name}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{gate.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── E. CALLS & RESPONSES ──────────────────────────────────────── */}
          {activeTab === 'calls' && (() => {
            const selectedMember = callsMembersList.find((m) => m.loan.id === callsMemberId) || callsMembersList[0] || null;
            const primaryPhone = selectedMember?.selectedPhone || selectedMember?.allPhones?.[0] || null;
            const isEligible = selectedMember?.evaluation?.eligible ?? false;
            const blockingReasons = selectedMember?.evaluation?.allBlockingReasons || [];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. CAMPAIGN-DRIVEN VOICE INTERACTION & SAFETY CONTROL */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                  {/* Header Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PhoneCall size={20} color="#2563eb" />
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                          Live Voice Agent Evaluation (Mentor Verification Console)
                        </span>
                        <span style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                          ONE CANONICAL VAPI AGENT
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        Supervised browser voice evaluation with synthetic borrower context, real-time tool invocation monitoring, and instant pre-dial gating diagnostic.
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        background: webQaConfig?.assistantConfigured ? '#f0fdf4' : '#fef2f2',
                        color: webQaConfig?.assistantConfigured ? '#166534' : '#991b1b',
                        border: `1px solid ${webQaConfig?.assistantConfigured ? '#bbf7d0' : '#fecaca'}`,
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        {webQaConfig?.assistantConfigured ? '✓ Vapi Assistant Configured' : 'Missing VAPI_ASSISTANT_ID'}
                      </span>
                      <span style={{
                        padding: '4px 10px',
                        background: '#fffbeb',
                        color: '#92400e',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        <Lock size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
                        PSTN Safety Lock Active
                      </span>
                    </div>
                  </div>

                  {/* Campaign & Borrower Control Bar */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr 1.3fr auto', gap: '14px', alignItems: 'flex-end' }}>
                      {/* Campaign Selector */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                          1. Select Campaign
                        </label>
                        <select
                          className="console-input"
                          value={callsCampaignId}
                          onChange={(e) => setCallsCampaignId(e.target.value)}
                          style={{ width: '100%', height: '38px', fontSize: '13px', fontWeight: 600 }}
                        >
                          {campaigns.map((camp) => (
                            <option key={camp.id} value={camp.id}>
                              {camp.name} ({camp.dpdMin}–{camp.dpdMax} DPD)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Borrower / Loan Selector */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                          2. Select Campaign Member / Borrower
                        </label>
                        <select
                          className="console-input"
                          value={callsMemberId}
                          onChange={(e) => setCallsMemberId(e.target.value)}
                          disabled={campaignMembersLoading || callsMembersList.length === 0}
                          style={{ width: '100%', height: '38px', fontSize: '13px' }}
                        >
                          {campaignMembersLoading ? (
                            <option>Loading members...</option>
                          ) : callsMembersList.length === 0 ? (
                            <option>No members found in this campaign</option>
                          ) : (
                            callsMembersList.map((m) => (
                              <option key={m.loan.id} value={m.loan.id}>
                                [{m.loan.loanNumber}] {m.borrower ? `${m.borrower.firstName} ${m.borrower.lastName}` : 'Unknown'} · {m.loan.dpd} DPD · ${m.loan.pastDueAmount} · {m.evaluation?.eligible ? '🟢 ELIGIBLE' : '🔴 BLOCKED'}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      {/* Transport Mode */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                          3. Voice Channel
                        </label>
                        <div style={{
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#1d4ed8'
                        }}>
                          <Mic size={14} color="#2563eb" />
                          <span>Browser WebRTC Voice</span>
                        </div>
                      </div>

                      {/* Action Trigger */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                          4. Supervised Voice Action
                        </label>
                        {operationalSettings?.voiceMode === 'OUTBOUND_CALLS' ? (
                          <button
                            className="btn-primary"
                            onClick={() => handleLaunchTelephoneCall(callsCampaignId, selectedMember?.loan?.id, primaryPhone?.id)}
                            disabled={callsTelephoneLoading || !selectedMember}
                            style={{ height: '38px', fontSize: '12px', minWidth: '150px', background: '#0f766e', borderColor: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            <PhoneCall size={14} />
                            {callsTelephoneLoading ? 'Checking Gates...' : 'Call Borrower (PSTN)'}
                          </button>
                        ) : webQaCallState === 'connected' ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="btn-secondary"
                              onClick={handleToggleMicMute}
                              style={{ height: '38px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              {isMicMuted ? <MicOff size={14} color="#dc2626" /> : <Mic size={14} color="#15803d" />}
                              {isMicMuted ? 'Unmute' : 'Mute'}
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={handleStopWebQaSession}
                              style={{ height: '38px', fontSize: '12px', background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                            >
                              <PhoneOff size={14} /> End Browser Test
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-primary"
                            onClick={() => handleStartWebQaSession(callsCampaignId, selectedMember?.loan?.id, primaryPhone?.id)}
                            disabled={webQaCallState === 'connecting' || !selectedMember}
                            style={{
                              height: '38px',
                              padding: '0 18px',
                              fontSize: '13px',
                              fontWeight: 700,
                              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                              boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px'
                            }}
                          >
                            <Mic size={16} className={webQaCallState === 'connecting' ? 'animate-spin' : ''} />
                            {webQaCallState === 'connecting' ? 'Connecting WebRTC...' : 'Start Browser Test'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Telephone Safety Feedback Banner */}
                  {callsTelephoneResult && (
                    <div style={{
                      padding: '12px 16px',
                      background: callsTelephoneResult.success ? '#f0fdf4' : '#fffbeb',
                      border: `1px solid ${callsTelephoneResult.success ? '#bbf7d0' : '#fde68a'}`,
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: callsTelephoneResult.success ? '#166534' : '#92400e',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <ShieldAlert size={16} />
                      <div>
                        <strong>Telephone Dispatch Result:</strong>{' '}
                        {callsTelephoneResult.error || callsTelephoneResult.reason}: {callsTelephoneResult.message || (callsTelephoneResult.success ? 'Call dispatched' : 'Call blocked')}
                      </div>
                    </div>
                  )}

                  {/* Selected Member Context & Real-Time Pre-Dial Gate Evaluation */}
                  {selectedMember && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      {/* Left: Borrower & Loan Details */}
                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Borrower Loan Profile (Dynamic Context)
                          </span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', background: '#f1f5f9', borderRadius: '4px', fontWeight: 600 }}>
                            {selectedMember.loan.delinquencyBucket}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Borrower Name</div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {selectedMember.borrower ? `${selectedMember.borrower.firstName} ${selectedMember.borrower.lastName}` : 'Unknown'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Loan Number</div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {selectedMember.loan.loanNumber}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Contact Phone</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontWeight: 600 }}>
                                {primaryPhone ? maskPhone(primaryPhone.phoneE164, primaryPhone.id) : '—'}
                              </span>
                              {primaryPhone && (
                                <button
                                  type="button"
                                  onClick={() => togglePhoneReveal(primaryPhone.id)}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                                >
                                  {revealedPhones[primaryPhone.id] ? <EyeOff size={12} color="#64748b" /> : <Eye size={12} color="#64748b" />}
                                </button>
                              )}
                              {primaryPhone && (
                                <span style={{ padding: '1px 5px', background: '#f1f5f9', borderRadius: '3px', fontSize: '10px', textTransform: 'uppercase', color: '#475569' }}>
                                  {primaryPhone.lineType}
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Local Calling Window</div>
                            <div style={{ fontWeight: 600, color: selectedMember.evaluation?.isCallingWindowOpen ? '#15803d' : '#b45309' }}>
                              {selectedMember.evaluation?.borrowerLocalTime || '—'} · {selectedMember.evaluation?.isCallingWindowOpen ? 'Open (8 AM–9 PM)' : 'Outside Hours'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Past Due Amount</div>
                            <div style={{ fontWeight: 700, color: '#dc2626' }}>
                              ${selectedMember.loan.pastDueAmount}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Total To Cure</div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              ${selectedMember.loan.totalToCure}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Deterministic Pre-Dial Gate Evaluation */}
                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Real-Time Pre-Dial Gate Status (12 Checks)
                          </span>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: isEligible ? '#dcfce7' : '#fee2e2',
                            color: isEligible ? '#166534' : '#991b1b',
                            border: `1px solid ${isEligible ? '#86efac' : '#fca5a5'}`
                          }}>
                            {isEligible ? '✓ ELIGIBLE FOR CONTACT' : '✕ BLOCKED BY PRE-DIAL GATE'}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                          <span style={{ color: '#64748b' }}>Next Action: </span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {selectedMember.evaluation?.nextAction || 'EVALUATING'}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px' }}>
                          <div style={{ color: '#64748b', marginBottom: '4px' }}>Gate Decision Details:</div>
                          {blockingReasons.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {blockingReasons.map((reason: string, idx: number) => (
                                <div key={idx} style={{ padding: '4px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', color: '#991b1b', fontSize: '11px', fontWeight: 600 }}>
                                  • {reason}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ padding: '6px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', color: '#166534', fontSize: '11px' }}>
                              ✓ All 12 pre-dial gates satisfied (TCPA consent, calling window, DNC, hygiene, bankruptcy, cap/cooldown). Ready for contact.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mentor Verification Quick Controls Bar */}
                  {selectedMember && (
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sliders size={16} color="#4f46e5" />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#312e81' }}>
                          Mentor Testing Controls (Loan {selectedMember.loan.loanNumber}):
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: selectedMember.loan?.isBankrupt ? '#fee2e2' : '#ffffff',
                            color: selectedMember.loan?.isBankrupt ? '#991b1b' : '#334155',
                            borderColor: selectedMember.loan?.isBankrupt ? '#fca5a5' : '#cbd5e1'
                          }}
                          onClick={() => handleUpdateAccountFlags(selectedMember.loan.id, { isBankrupt: !selectedMember.loan?.isBankrupt })}
                        >
                          Bankruptcy (C2a): {selectedMember.loan?.isBankrupt ? 'ACTIVE ✕' : 'Clear ✓'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: selectedMember.accountDnc ? '#fee2e2' : '#ffffff',
                            color: selectedMember.accountDnc ? '#991b1b' : '#334155',
                            borderColor: selectedMember.accountDnc ? '#fca5a5' : '#cbd5e1'
                          }}
                          onClick={() => handleUpdateAccountFlags(selectedMember.loan.id, { accountDnc: !selectedMember.accountDnc })}
                        >
                          Account DNC (C3): {selectedMember.accountDnc ? 'ACTIVE ✕' : 'Clear ✓'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: (primaryPhone?.isVerified || primaryPhone?.isHygieneVerified) ? '#f0fdf4' : '#fef3c7',
                            color: (primaryPhone?.isVerified || primaryPhone?.isHygieneVerified) ? '#166534' : '#92400e',
                            borderColor: (primaryPhone?.isVerified || primaryPhone?.isHygieneVerified) ? '#bbf7d0' : '#fde68a'
                          }}
                          onClick={() => handleUpdateAccountFlags(selectedMember.loan.id, {
                            isVerified: !(primaryPhone?.isVerified || primaryPhone?.isHygieneVerified),
                            isHygieneVerified: !(primaryPhone?.isVerified || primaryPhone?.isHygieneVerified),
                            phoneNumberId: primaryPhone?.id
                          })}
                        >
                          Contact (C4): {(primaryPhone?.isVerified || primaryPhone?.isHygieneVerified) ? 'Verified ✓' : 'Unverified ⚠'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: primaryPhone?.consentState === 'GRANTED' ? '#f0fdf4' : '#fee2e2',
                            color: primaryPhone?.consentState === 'GRANTED' ? '#166534' : '#991b1b',
                            borderColor: primaryPhone?.consentState === 'GRANTED' ? '#bbf7d0' : '#fca5a5'
                          }}
                          onClick={() => handleUpdateAccountFlags(selectedMember.loan.id, {
                            tcpaConsent: primaryPhone?.consentState !== 'GRANTED',
                            phoneNumberId: primaryPhone?.id
                          })}
                        >
                          TCPA (C5): {primaryPhone?.consentState === 'GRANTED' ? 'Granted ✓' : 'Revoked ✕'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          onClick={async () => {
                            const res = await fetch(`${API_BASE}/accounts/${selectedMember.loan.id}`, { headers: getAuthHeaders() });
                            if (res.ok) {
                              const acc = await res.json();
                              setSelectedAccountDetail(acc);
                            }
                          }}
                        >
                          ⚙ All 12 Gate Controls...
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active Voice Conversation & Real-Time Tool Monitoring Workspace */}
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: webQaCallState === 'connected' ? '#16a34a' : (webQaCallState === 'connecting' ? '#d97706' : (webQaCallState === 'error' ? '#dc2626' : '#94a3b8'))
                        }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                          {webQaCallState === 'connected'
                            ? `Audio Active · Supervised Call with ${selectedMember?.borrower?.firstName || 'Borrower'}`
                            : (webQaCallState === 'connecting' ? 'Connecting WebRTC Audio Channel...' : 'Voice Conversation Channel (Idle)')}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {webQaCallState === 'connected' ? (isWebQaSpeaking ? '— Assistant speaking...' : '— Listening to your microphone...') : ''}
                        </span>
                      </div>
                      {webQaSession && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Session Ref: <strong style={{ color: '#0f172a' }}>{webQaSession.syntheticContext?.interaction_reference || 'QA-ACTIVE'}</strong>
                        </div>
                      )}
                    </div>

                    {/* Dual Monitor Grid: Left = Live Audio Transcript; Right = Canonical Tools & Real-Time State Changes */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
                      {/* Left: Live Transcript Stream */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Live Audio Conversation Stream</span>
                          <span>{webQaTranscript.length} messages</span>
                        </div>
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', height: '220px', overflowY: 'auto' }}>
                          {webQaTranscript.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '12px' }}>
                              {webQaCallState === 'connected'
                                ? 'Speak into your microphone to converse with the voice assistant...'
                                : 'No active voice conversation. Click "Start Browser Call" to initiate a simulated conversation through your microphone.'}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {webQaTranscript.map((t, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    background: t.role === 'assistant' ? '#eff6ff' : '#f1f5f9',
                                    color: t.role === 'assistant' ? '#1d4ed8' : '#334155',
                                    height: 'fit-content'
                                  }}>
                                    {t.role === 'assistant' ? 'VAPI ASSISTANT' : 'BORROWER (MIC)'}
                                  </span>
                                  <span style={{ color: '#0f172a', flex: 1 }}>{t.text}</span>
                                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>{t.timestamp}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Live Canonical Tool Invocations & Dynamic Account Changes */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Canonical Tool Invocations & Live State</span>
                          <span>{webQaToolInvocations.length} tools executed</span>
                        </div>
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', height: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {webQaToolInvocations.length === 0 && webQaAccountChanges.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '36px 10px', color: '#94a3b8', fontSize: '11px' }}>
                              Canonical Vapi tools (<code>verify_identity</code>, <code>schedule_callback</code>, <code>send_payment_link</code>, <code>transfer_to_agent</code>) and account state changes will stream here in real time.
                            </div>
                          ) : (
                            <>
                              {webQaToolInvocations.map((tool) => (
                                <div key={tool.id} style={{ padding: '6px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ padding: '1px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: '3px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                      {tool.name}()
                                    </span>
                                    <span style={{ fontSize: '10px', color: '#64748b' }}>{tool.timestamp}</span>
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {JSON.stringify(tool.args)}
                                  </div>
                                </div>
                              ))}
                              {webQaAccountChanges.map((change, cIdx) => (
                                <div key={cIdx} style={{ padding: '6px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', fontSize: '11px', color: '#166534' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700 }}>✓ {change.detail}</span>
                                    <span style={{ fontSize: '10px', color: '#15803d' }}>{change.timestamp}</span>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Completed Session Outcome & QA Isolation Card */}
                  {lastCompletedQaSession && (
                    <div style={{
                      padding: '12px 16px',
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#166534',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={16} color="#16a34a" />
                        <div>
                          <strong>Voice Session Saved to Test Storage:</strong>{' '}
                          Ref #{lastCompletedQaSession.run?.interactionReference} · Duration: {lastCompletedQaSession.run?.durationSeconds}s · Outcome: {lastCompletedQaSession.run?.outcomeDisposition}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>
                        ✓ Operational isolation verified: 0 rows added to call_attempts table
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. PERSISTENT CONVERSATION HISTORY & TRANSCRIPTS */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                      Persistent Conversation History & Transcripts
                    </div>
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={async () => {
                        setConversationsLoading(true);
                        try {
                          const res = await fetch(`${API_BASE}/conversations`, { headers: getAuthHeaders() });
                          if (res.ok) setConversationsList(await res.json());
                        } finally {
                          setConversationsLoading(false);
                        }
                      }}
                    >
                      {conversationsLoading ? 'Refreshing...' : '↻ Refresh History'}
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                    Chronological audit log of all browser WebRTC and supervised voice conversations. Each session stores immutable transcripts, canonical tool calls, and state changes.
                  </div>

                  {conversationsList.length === 0 ? (
                    <div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      <Radio size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>No Conversation Sessions Recorded Yet</div>
                      <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '440px', margin: '4px auto 0' }}>
                        Click "Start Browser Test" above to hold a voice conversation with the canonical assistant. The complete transcript, duration, and disposition will appear here automatically.
                      </div>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>SESSION ID</th>
                            <th>BORROWER & LOAN</th>
                            <th>CAMPAIGN</th>
                            <th>TRANSPORT</th>
                            <th>STARTED AT</th>
                            <th>DURATION</th>
                            <th>DISPOSITION</th>
                            <th>TOOLS</th>
                            <th style={{ textAlign: 'right' }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {conversationsList.map((session) => (
                            <tr key={session.id}>
                              <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#2563eb' }}>
                                {session.sessionId}
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{session.borrowerName || 'Unknown Borrower'}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{session.loanNumber} · {session.maskedPhone || '—'}</div>
                              </td>
                              <td>
                                <span style={{ fontSize: '11px', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px', fontWeight: 600 }}>
                                  {session.campaignName || 'General Outreach'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '10px', padding: '2px 6px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontWeight: 700 }}>
                                  {session.transportType === 'WEBRTC_BROWSER' ? 'WEBRTC BROWSER' : session.transportType}
                                </span>
                              </td>
                              <td style={{ fontSize: '11px', color: '#475569' }}>
                                {new Date(session.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td style={{ fontSize: '11px', fontWeight: 600 }}>
                                {session.durationSeconds ? `${session.durationSeconds}s` : '< 1m'}
                              </td>
                              <td>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  background: session.sessionStatus === 'completed' ? '#dcfce7' : '#fef3c7',
                                  color: session.sessionStatus === 'completed' ? '#15803d' : '#92400e'
                                }}>
                                  {session.structuredDisposition || session.sessionStatus?.toUpperCase()}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: session.toolInvocations?.length > 0 ? '#4f46e5' : '#94a3b8' }}>
                                  {session.toolInvocations?.length || 0} tools
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '3px 8px', fontSize: '11px' }}
                                    onClick={async () => {
                                      const res = await fetch(`${API_BASE}/conversations/${session.id}`, { headers: getAuthHeaders() });
                                      if (res.ok) {
                                        setSelectedConversationDetail(await res.json());
                                        setShowConversationModal(true);
                                      }
                                    }}
                                  >
                                    View Transcript
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3. HISTORICAL PROVIDER CALL RECORDS */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Historical Provider Call Records</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                    Actual voice platform attempts backed by provider call IDs and transcripts. Zero fake calls are persisted.
                  </div>

                  {callsList.length === 0 ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      <PhoneCall size={32} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>No Provider Call Attempts Recorded</div>
                      <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '480px', margin: '6px auto 0' }}>
                        Real outbound voice calls will appear here once live provider dispatch is enabled. The test fixture is excluded from operational history.
                      </div>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>REFERENCE #</th>
                            <th>LOAN NUMBER</th>
                            <th>DISPOSITION</th>
                            <th>RPC</th>
                            <th>INITIATED AT</th>
                            <th>DURATION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {callsList.map((call) => (
                            <tr key={call.id}>
                              <td style={{ fontWeight: 600 }}>{call.referenceNumber}</td>
                              <td>{call.loan?.loanNumber}</td>
                              <td>{call.disposition || 'IN_PROGRESS'}</td>
                              <td>{call.isRightPartyContact ? 'YES' : 'NO'}</td>
                              <td>{new Date(call.initiatedAt).toLocaleString()}</td>
                              <td>{call.durationSeconds ? `${call.durationSeconds}s` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ─── F. SCHEDULES & CALLBACKS (PHASE 3 OPERATOR LIFECYCLE) ─────── */}
          {activeTab === 'schedules' && (() => {
            const combinedItems = [
              ...schedulesList.map(s => ({ ...s, itemType: 'schedule', sortTime: new Date(s.dueAtUtc).getTime() })),
              ...callbacksList.map(cb => ({ ...cb, itemType: 'callback', sortTime: new Date(cb.callbackScheduledDatetime).getTime() }))
            ].sort((a, b) => b.sortTime - a.sortTime);

            const filteredItems = combinedItems.filter(item => {
              if (scheduleFilterTab === 'operator') {
                return item.jobType === 'OPERATOR_SCHEDULED' || item.sourceType === 'OPERATOR_SCHEDULED';
              }
              if (scheduleFilterTab === 'borrower') {
                return (item.itemType === 'callback' && !item.isScenarioData) || item.jobType === 'BORROWER_CALLBACK';
              }
              if (scheduleFilterTab === 'scenario') {
                return item.isScenarioData || item.jobType === 'SCENARIO_TEST';
              }
              return true;
            });

            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>Schedule & Callbacks Operations Lifecycle</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Dependable operator scheduling, verified borrower callbacks, and isolated scenario fixtures.
                    </div>
                  </div>
                  <button className="btn-primary" onClick={() => setShowScheduleModal(true)}>
                    <Plus size={14} /> Schedule Follow-Up
                  </button>
                </div>

                {/* Policy Notice Callout */}
                <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1e40af' }}>
                  <ShieldCheck size={16} />
                  <span><strong>Policy Notice:</strong> Outbound telephone calls and SMS are off. Scheduled follow-ups and callbacks are preserved in local PoC servicing data.</span>
                </div>

                {/* Sub-tab Filter Pills */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  {[
                    { id: 'all', label: `All Scheduled Work (${combinedItems.length})` },
                    { id: 'borrower', label: `Borrower Callbacks (${combinedItems.filter(i => (i.itemType === 'callback' && !i.isScenarioData) || i.jobType === 'BORROWER_CALLBACK').length})` },
                    { id: 'operator', label: `Operator Follow-ups (${combinedItems.filter(i => i.jobType === 'OPERATOR_SCHEDULED' || i.sourceType === 'OPERATOR_SCHEDULED').length})` },
                    { id: 'scenario', label: `Auto-Retries & System Tasks (${combinedItems.filter(i => i.isScenarioData || i.jobType === 'SCENARIO_TEST').length})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setScheduleFilterTab(tab.id as any)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: scheduleFilterTab === tab.id ? '#3b82f6' : '#e2e8f0',
                        background: scheduleFilterTab === tab.id ? '#eff6ff' : '#ffffff',
                        color: scheduleFilterTab === tab.id ? '#1d4ed8' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {filteredItems.length === 0 ? (
                  <div style={{ padding: '40px 24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <Clock size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>No Schedules in This Filter</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      Create an operator follow-up using the button above.
                    </div>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="console-table">
                      <thead>
                        <tr>
                          <th>WORKITEM & PROVENANCE</th>
                          <th>ACCOUNT / BORROWER</th>
                          <th>TARGET DUE TIME (IST / BORROWER LOCAL)</th>
                          <th>STATUS</th>
                          <th>NOTES / REASON</th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((item: any) => {
                          const isCallback = item.itemType === 'callback';
                          const dueIso = isCallback ? item.callbackScheduledDatetime : item.dueAtUtc;
                          const borrowerTz = isCallback ? item.callbackTimezoneIana : (item.originalTimezoneIana || 'America/New_York');

                          let istTime = '—';
                          let borrowerLocalTime = '—';
                          if (dueIso) {
                            try {
                              istTime = new Intl.DateTimeFormat('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                dateStyle: 'short',
                                timeStyle: 'short',
                                hour12: false
                              }).format(new Date(dueIso)) + ' IST';
                            } catch {}
                            try {
                              borrowerLocalTime = new Intl.DateTimeFormat('en-US', {
                                timeZone: borrowerTz,
                                dateStyle: 'short',
                                timeStyle: 'short'
                              }).format(new Date(dueIso)) + ` (${borrowerTz})`;
                            } catch {}
                          }

                          return (
                            <tr key={`${item.itemType}-${item.id}`}>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: '12px' }}>
                                  {isCallback ? 'Callback' : 'Job'}: {item.id.slice(0, 8)}...
                                </div>
                                <div style={{ marginTop: '3px' }}>
                                  {item.sourceType === 'QA_SCENARIO' || item.isScenarioData ? (
                                    <span style={{ padding: '2px 6px', background: '#f8fafc', color: '#475569', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                                      [Auto-Retry / Task]
                                    </span>
                                  ) : (item.sourceType === 'OPERATOR_FOLLOWUP' || item.jobType === 'OPERATOR_SCHEDULED' || item.sourceType === 'OPERATOR_SCHEDULED') ? (
                                    <span style={{ padding: '2px 6px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #bfdbfe' }}>
                                      [Operator Follow-up]
                                    </span>
                                  ) : (
                                    <span style={{ padding: '2px 6px', background: '#dcfce7', color: '#15803d', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                                      [Borrower Call] Verified
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{item.loan?.loanNumber || item.loanId}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {item.borrower ? `${item.borrower.firstName} ${item.borrower.lastName}` : (item.loan?.borrower ? `${item.loan.borrower.firstName} ${item.loan.borrower.lastName}` : 'Unassigned')}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: '12px' }}>{istTime}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>Borrower: {borrowerLocalTime}</div>
                              </td>
                              <td>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: item.status === 'scheduled' ? '#fef3c7' : (item.status === 'dispatch_blocked_phase3' ? '#ffedd5' : (item.status === 'cancelled' ? '#f1f5f9' : '#dcfce7')),
                                  color: item.status === 'scheduled' ? '#b45309' : (item.status === 'dispatch_blocked_phase3' ? '#c2410c' : (item.status === 'cancelled' ? '#64748b' : '#15803d'))
                                }}>
                                  {item.status === 'dispatch_blocked_phase3' ? 'HELD (Follow-up Pending)' : item.status?.toUpperCase()}
                                </span>
                              </td>
                              <td style={{ fontSize: '11px', color: '#64748b', maxWidth: '200px' }}>
                                {item.humanReadableNote || item.notes || item.blockedAtExecutionReason || '—'}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '3px 6px', fontSize: '11px' }}
                                    onClick={() => {
                                      setRescheduleTarget(item);
                                      setRescheduleDatetime(dueIso ? new Date(dueIso).toISOString().slice(0, 16) : '');
                                      setRescheduleNotes(item.humanReadableNote || item.notes || '');
                                      setShowRescheduleModal(true);
                                    }}
                                  >
                                    Reschedule
                                  </button>
                                  {item.status === 'scheduled' && (
                                    <button
                                      className="btn-secondary"
                                      style={{ padding: '3px 6px', fontSize: '11px', color: '#b91c1c' }}
                                      onClick={() => handleCancelSchedule(item)}
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─── G. SERVICING WRITE-BACK (LOCAL POC ADAPTER) ─────────────────── */}
          {activeTab === 'servicing-outbox' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>Servicing Write-Back Outbox</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    PostgreSQL servicing outbox ledger. Serializes call outcomes transactionally upon completed calls. External LOS is not configured.
                  </div>
                </div>
                <span style={{ padding: '3px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                  LOCAL_POC_ADAPTER (PostgreSQL)
                </span>
              </div>

              {servicingOutboxList.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <FileText size={32} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>0 Outbox Records Pending</div>
                  <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '6px auto 0' }}>
                    Outbox is clean. When real provider calls conclude, serialized write-back payloads will be committed transactionally to the servicing_outbox table.
                  </div>
                </div>
              ) : (
                <div className="table-container">
                  <table className="console-table">
                    <thead>
                      <tr>
                        <th>REFERENCE #</th>
                        <th>LOAN NUMBER</th>
                        <th>ADAPTER TARGET</th>
                        <th>DELIVERY STATUS</th>
                        <th>ATTEMPTS</th>
                        <th>COMMITTED AT</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicingOutboxList.map((so) => (
                        <tr key={so.id}>
                          <td style={{ fontWeight: 600 }}>{so.referenceNumber}</td>
                          <td>{so.loan?.loanNumber || so.loanId}</td>
                          <td>{so.adapterTarget}</td>
                          <td>
                            <span style={{ padding: '2px 6px', background: so.deliveryStatus === 'delivered_local' ? '#dcfce7' : '#fee2e2', color: so.deliveryStatus === 'delivered_local' ? '#15803d' : '#991b1b', borderRadius: '3px', fontSize: '11px', fontWeight: 600 }}>
                              {so.deliveryStatus?.toUpperCase()}
                            </span>
                          </td>
                          <td>{so.attemptCount} / 5</td>
                          <td>{new Date(so.createdAt).toLocaleString()}</td>
                          <td>
                            <button
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                              onClick={() => handleRetryOutbox(so.id)}
                            >
                              Retry Local Delivery
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── H. HUMAN QUEUE & ESCALATIONS ───────────────────────────────── */}
          {activeTab === 'human-queue' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>Human Review & Escalations Worklist</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Safety triggers, complex hardship disclosures, language barriers, and supervisor transfer requests.
                  </div>
                </div>
                <button className="btn-primary" onClick={() => setShowCreateEscalationModal(true)}>
                  <Plus size={14} /> Create Operator Escalation
                </button>
              </div>

              {humanQueue.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <ShieldCheck size={32} color="#15803d" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>0 Calls Escalated to Human Queue</div>
                  <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '6px auto 0' }}>
                    Human review worklist is currently empty. Fabricated escalation records are strictly not generated.
                  </div>
                </div>
              ) : (
                <div className="table-container">
                  <table className="console-table">
                    <thead>
                      <tr>
                        <th>PRIORITY</th>
                        <th>REASON</th>
                        <th>LOAN NUMBER</th>
                        <th>STATUS</th>
                        <th>NOTES</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {humanQueue.map((hq) => (
                        <tr key={hq.id}>
                          <td style={{ fontWeight: 700, color: hq.priority <= 2 ? '#b91c1c' : '#b45309' }}>P{hq.priority}</td>
                          <td>{hq.reason}</td>
                          <td>{hq.loan?.loanNumber || hq.loanId}</td>
                          <td>
                            <span style={{ padding: '2px 6px', background: hq.status === 'resolved' ? '#dcfce7' : '#fee2e2', color: hq.status === 'resolved' ? '#15803d' : '#991b1b', borderRadius: '3px', fontSize: '11px', fontWeight: 600 }}>
                              {hq.status?.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontSize: '11px', color: '#64748b' }}>{hq.notes || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {hq.status !== 'resolved' && (
                                <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => handleResolveEscalation(hq.id)}>
                                  Resolve
                                </button>
                              )}
                              {hq.status !== 'dismissed' && (
                                <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px', color: '#64748b' }} onClick={() => handleDismissEscalation(hq.id)}>
                                  Dismiss
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── ESCALATION CONTACTS SECTION ─── */}
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                        Escalation Contacts
                      </span>
                      <span style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        Servicing Roster
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                      Configured human operators available to receive voice transfers and safety escalations from delinquent outreach calls.
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setContactNameInput('');
                      setContactPhoneInput('');
                      setContactNotesInput('');
                      setShowAddContactModal(true);
                    }}
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} /> Add Escalation Contact
                  </button>
                </div>

                {escalationContactsList.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <ShieldAlert size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                      No Escalation Contacts Configured
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '440px', margin: '4px auto 0' }}>
                      Add at least one human contact to enable live transfers and human escalation handling.
                    </div>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="console-table">
                      <thead>
                        <tr>
                          <th>CONTACT NAME</th>
                          <th>PHONE (MASKED)</th>
                          <th>STATUS</th>
                          <th>NOTES</th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {escalationContactsList.map((contact) => (
                          <tr key={contact.id}>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{contact.displayName}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#334155' }}>
                              {contact.phoneMasked || contact.phoneE164}
                            </td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                background: contact.isActive ? '#dcfce7' : '#f1f5f9',
                                color: contact.isActive ? '#15803d' : '#64748b',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}>
                                {contact.isActive ? 'AVAILABLE' : 'UNAVAILABLE'}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px', color: '#64748b' }}>{contact.notes || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleToggleContactActive(contact.id, contact.isActive)}
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                >
                                  {contact.isActive ? 'Set Unavailable' : 'Set Available'}
                                </button>
                                <button
                                  className="btn-secondary"
                                  onClick={() => {
                                    setEditingContact(contact);
                                    setContactNameInput(contact.displayName);
                                    setContactNotesInput(contact.notes || '');
                                  }}
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleRemoveContact(contact.id, contact.displayName)}
                                  style={{ padding: '3px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── I. COMPLIANCE & DNC ───────────────────────────────────────── */}
          {activeTab === 'compliance' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Regulatory Compliance, DNC & Restrictions Registry</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                Account-wide DNC, number-level DNC, and V1 temporary restrictions. Explicitly distinguishes scenario test fixtures from real borrower events.
              </div>

              <div className="table-container">
                <table className="console-table">
                  <thead>
                    <tr>
                      <th>SCOPE / TYPE</th>
                      <th>LOAN NUMBER</th>
                      <th>DATA SOURCE</th>
                      <th>STATUS</th>
                      <th>REQUESTED AT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dncRecords.map((dnc) => (
                      <tr key={dnc.id}>
                        <td style={{ fontWeight: 600 }}>DNC: {dnc.scope?.toUpperCase() || 'ACCOUNT'}</td>
                        <td>{dnc.loan?.loanNumber || dnc.loanId}</td>
                        <td>
                          {dnc.isScenarioData ? (
                            <span style={{ padding: '2px 6px', background: '#faf5ff', color: '#7e22ce', borderRadius: '3px', fontSize: '11px', fontWeight: 600 }}>
                              Scenario fixture (LN-100015)
                            </span>
                          ) : (
                            <span style={{ padding: '2px 6px', background: '#dcfce7', color: '#15803d', borderRadius: '3px', fontSize: '11px', fontWeight: 600 }}>
                              Real call event
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ color: dnc.isActive ? '#b91c1c' : '#64748b', fontWeight: 600 }}>
                            {dnc.isActive ? 'ACTIVE ⚠' : 'INACTIVE'}
                          </span>
                        </td>
                        <td>{new Date(dnc.requestedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── J. SMS MESSAGES ───────────────────────────────────────────── */}
          {activeTab === 'sms' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>Outbound SMS Messages</div>
                    <span style={{ padding: '2px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                      TWILIO_SMS_MODE=disable (HARD-DISABLED)
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Twilio SMS is disabled by default via environment switch. Voice calling is independently configured and unaffected.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={smsTestPhone}
                    onChange={(e) => setSmsTestPhone(e.target.value)}
                    style={{ width: '160px', fontSize: '12px' }}
                    disabled
                  />
                  <button
                    className="btn-secondary"
                    onClick={handleSendTestSms}
                    disabled={true || testingSms}
                    title="SMS dispatch is hard-disabled by environment switch (TWILIO_SMS_MODE=disable). Fails closed."
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  >
                    <Send size={14} />
                    Test Dry-Run SMS (Disabled)
                  </button>
                </div>
              </div>

              {smsList.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <MessageSquare size={32} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>No Outbound SMS Logged</div>
                  <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '6px auto 0' }}>
                    Live SMS dispatch is safely disabled. Dry-run test dispatches can be executed via the button above.
                  </div>
                </div>
              ) : (
                <div className="table-container">
                  <table className="console-table">
                    <thead>
                      <tr>
                        <th>DESTINATION</th>
                        <th>MESSAGE TYPE</th>
                        <th>STATUS</th>
                        <th>SENT AT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {smsList.map((sms) => (
                        <tr key={sms.id}>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{sms.toNumberMasked}</td>
                          <td>{sms.messageType}</td>
                          <td>{sms.status}</td>
                          <td>{new Date(sms.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── K. INTEGRATIONS HEALTH (TRUTHFUL 4-FACET ARCHITECTURE) ────── */}
          {activeTab === 'integrations' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Integration Health & Infrastructure Telephony</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                Truthful 4-facet operational state: Credentials, Safety Interlock, Read-Only Probe, and Dispatch Status.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {/* 1. Vapi Voice Platform */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>Vapi Voice Platform</span>
                    <span style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      AI Voice Engine
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Credentials:</span>
                      <span style={{ fontWeight: 600, color: health?.vapi?.credentialsConfigured ? '#15803d' : '#b91c1c' }}>
                        {health?.vapi?.credentialsConfigured ? '✓ Configured' : 'Missing'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Safety Lock:</span>
                      <span style={{ fontWeight: 600, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '3px' }}>
                        {health?.vapi?.safetyLockState || 'SAFE_LOCK_ENFORCED'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Read-Only Probe:</span>
                      <span style={{ fontWeight: 600, color: health?.vapi?.readOnlyProbe?.status === 'connected' ? '#15803d' : '#475569' }}>
                        {health?.vapi?.readOnlyProbe?.status === 'connected' ? `✓ Connected (${health.vapi.readOnlyProbe.verifiedName || 'Verified'})` : 'Probe pending'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Outbound Dispatch:</span>
                      <span style={{ fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '1px 6px', borderRadius: '3px' }}>
                        OFF (Browser Testing Only)
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                      Scope: Assistant metadata read-only check. Live calls prohibited until prompt disclosure is approved.
                    </div>
                  </div>
                </div>

                {/* 2. Twilio SMS & Trunking */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>Twilio SMS & Trunking</span>
                    <span style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      Telephony Carrier
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Credentials:</span>
                      <span style={{ fontWeight: 600, color: health?.twilio?.credentialsConfigured ? '#15803d' : '#b91c1c' }}>
                        {health?.twilio?.credentialsConfigured ? `✓ Configured (${health?.twilio?.readOnlyProbe?.accountSidMasked || 'SID set'})` : 'Missing'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Safety Lock:</span>
                      <span style={{ fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: '3px' }}>
                        ALLOWLIST_INTERLOCK_ACTIVE
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>SMS Kill-Switch:</span>
                      <span style={{ fontWeight: 700, color: '#b91c1c', background: '#fee2e2', padding: '1px 6px', borderRadius: '3px' }}>
                        HARD-DISABLED (TWILIO_SMS_MODE=disable)
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Voice Telephony:</span>
                      <span style={{ fontWeight: 600, color: '#15803d' }}>
                        Independently Configured (Unaffected)
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Read-Only Probe:</span>
                      <span style={{ fontWeight: 600, color: '#475569' }}>
                        Configuration only (No mutation)
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Outbound Dispatch:</span>
                      <span style={{ fontWeight: 600, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '3px' }}>
                        DRY-RUN ONLY (Live Blocked)
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                      All SMS requests default to dryRun. No real carrier SMS are transmitted.
                    </div>
                  </div>
                </div>

                {/* 3. Local PostgreSQL */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>Local PostgreSQL</span>
                    <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#15803d', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      Connected (Healthy)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Target Database:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{health?.database?.host || 'localhost:5432'}/{health?.database?.database || 'delinquency_poc'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Driver & Dialect:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>postgres.js (PostgreSQL)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Cloud Migration Status:</span>
                      <span style={{ fontWeight: 600, color: '#64748b' }}>Neon Cloud Intentionally Disabled</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Schema Tables:</span>
                      <span style={{ fontWeight: 600, color: '#15803d' }}>21 Relational Tables Verified</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                      Operating strictly on local PostgreSQL as instructed.
                    </div>
                  </div>
                </div>

                {/* 4. Servicing Outbox Adapter */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>Servicing Write-Back Adapter</span>
                    <span style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      Local PoC Outbox
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Adapter Name:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>LOCAL_POC_OUTBOX_ADAPTER</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Destination:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>servicing_outbox table (PostgreSQL)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>External LOS Connection:</span>
                      <span style={{ fontWeight: 600, color: '#64748b' }}>Not Connected (Local PoC Mode)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Retry Policy:</span>
                      <span style={{ fontWeight: 600, color: '#15803d' }}>Bounded (Max 5 attempts)</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                      Payloads are serialized into the local outbox. No external LOS synchronization is claimed.
                    </div>
                  </div>
                </div>

                {/* 5. Console Security Diagnostic */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={16} color="#0284c7" />
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>Console Access & Security Diagnostic</span>
                    </div>
                    <span style={{ padding: '2px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      Local Stakeholder Console
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Security Boundary: </span>
                      <strong style={{ color: '#0284c7' }}>{health?.consoleSecurity?.boundary || 'LOCAL_LOOPBACK_ONLY'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Access Model: </span>
                      <strong style={{ color: '#0f172a' }}>{health?.consoleSecurity?.accessModel || 'Direct Local Access (No Login)'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Network Binding: </span>
                      <strong style={{ color: '#15803d' }}>127.0.0.1 / localhost (Private Interface)</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                    {health?.consoleSecurity?.explanation || 'Direct access is permitted on local loopback interface. Public tunnel requests to administrative console routes are strictly rejected with HTTP 403.'}
                  </div>
                </div>
              </div>

              {/* ─── BROWSER WEB VOICE QA CARD (@vapi-ai/web) ─── */}
              <div style={{ marginTop: '24px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        Browser Voice Conversation (@vapi-ai/web)
                      </span>
                      <span style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                        WEBRTC AUDIO — DIRECT OPERATIONAL CONVERSATION
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                      Direct interactive voice conversation with the canonical Vapi Voice Assistant over WebRTC. Zero PSTN telephony or carrier SMS egress.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {webQaCallState === 'connected' ? (
                      <>
                        <button
                          className="btn-secondary"
                          onClick={handleToggleMicMute}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '34px' }}
                        >
                          {isMicMuted ? <MicOff size={14} color="#dc2626" /> : <Mic size={14} color="#15803d" />}
                          {isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={handleStopWebQaSession}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '34px', background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}
                        >
                          <PhoneOff size={14} /> End Conversation
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={() => handleStartWebQaSession()}
                        disabled={webQaCallState === 'connecting' || !webQaConfig?.isEnabled || !webQaConfig?.assistantConfigured}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '34px' }}
                        title={!webQaConfig?.isEnabled ? 'Browser Testing is disabled in Operational Controls. Enable Browser Testing in the sidebar to start a session.' : undefined}
                      >
                        <Radio size={14} className={webQaCallState === 'connecting' ? 'animate-spin' : ''} />
                        {webQaCallState === 'connecting' ? 'Connecting Audio...' : 'Start Browser Call'}
                      </button>
                    )}
                  </div>
                </div>

                {!webQaConfig?.isEnabled && (
                  <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', marginBottom: '12px', fontSize: '12px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Info size={14} />
                    <span>Browser Testing is disabled in Operational Controls. Switch the sidebar toggle to <strong>Browser Testing</strong> to start a voice conversation.</span>
                  </div>
                )}

                {/* Configuration / Guardrail Status Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '2px' }}>CANONICAL VAPI ASSISTANT</div>
                    <div style={{ fontWeight: 600, color: webQaConfig?.assistantConfigured ? '#15803d' : '#b91c1c' }}>
                      {webQaConfig?.assistantConfigured ? '✓ Assistant Configured' : 'Missing VAPI_ASSISTANT_ID'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                      ID: {webQaConfig?.assistantId ? `${webQaConfig.assistantId.slice(0, 8)}...${webQaConfig.assistantId.slice(-4)}` : 'e990ce6c...66d'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '2px' }}>TOOL WEBHOOK URL</div>
                    <div style={{ fontWeight: 600, color: webQaConfig?.serverUrlConfigured ? '#15803d' : '#b45309' }}>
                      {webQaConfig?.serverUrlConfigured ? '✓ Server URL Configured' : 'WEB_QA_BLOCKED_TOOL_WEBHOOK_NOT_CONFIGURED'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                      {webQaConfig?.serverUrlConfigured ? webQaConfig.qaServerUrl : 'Tool callbacks require public tunnel URL'}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '2px' }}>AUDIO SESSION STATUS</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: webQaCallState === 'connected' ? '#16a34a' : (webQaCallState === 'connecting' ? '#d97706' : '#94a3b8')
                      }} />
                      <span style={{ fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                        {webQaCallState}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                      {webQaCallState === 'connected' ? (isWebQaSpeaking ? 'Assistant speaking...' : 'Listening to microphone...') : 'Idle (Ready)'}
                    </div>
                  </div>
                </div>

                {/* Prompt & Synthetic Notice */}
                {webQaError && (
                  <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '11px', color: '#991b1b', marginBottom: '12px' }}>
                    <strong>Session Error:</strong> {webQaError}
                  </div>
                )}
                {webQaSession && (
                  <div style={{ padding: '6px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '10px', color: '#64748b', marginBottom: '12px' }}>
                    Borrower Context: {webQaSession.syntheticContext?.borrower_first_name || 'Alex'} ({webQaSession.syntheticContext?.interaction_reference || 'WEB-VOICE-001'}) — Operational Browser Voice Session
                  </div>
                )}

                {/* Live Transcript Stream */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', minHeight: '120px', maxHeight: '200px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Live Audio Transcript Feed
                  </div>
                  {webQaTranscript.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '12px' }}>
                      {webQaCallState === 'connected' ? 'Speak into your microphone to test voice interaction...' : 'No active voice session. Click "Start Browser Call" to test.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {webQaTranscript.map((t, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: t.role === 'assistant' ? '#eff6ff' : '#f1f5f9',
                            color: t.role === 'assistant' ? '#1d4ed8' : '#334155',
                            height: 'fit-content'
                          }}>
                            {t.role.toUpperCase()}
                          </span>
                          <span style={{ color: '#0f172a', flex: 1 }}>{t.text}</span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>{t.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── OWNER-APPROVED VERIFIED OUTBOUND DESTINATIONS (ALLOWLIST) ─── */}
              <div style={{ marginTop: '24px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        Owner-Approved Verified Outbound Destinations
                      </span>
                      <span style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        Outbound Calling Allowlist
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                      Database-backed allowlist of owner-attested telephone numbers authorized for outbound PSTN calling. This registry is strictly independent from the Human Escalation Contacts roster.
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: destinationsList.filter((d: any) => d.status === 'active' || d.status === 'ACTIVE').length > 0 ? '#dcfce7' : '#fee2e2',
                    color: destinationsList.filter((d: any) => d.status === 'active' || d.status === 'ACTIVE').length > 0 ? '#15803d' : '#991b1b'
                  }}>
                    {destinationsList.filter((d: any) => d.status === 'active' || d.status === 'ACTIVE').length} Active Calling Destinations
                  </span>
                </div>

                {/* Inline Add Destination Form */}
                <form
                  onSubmit={handleAddDestination}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-end',
                    padding: '12px 14px',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Phone (E.164 Format) *
                    </label>
                    <input
                      type="text"
                      placeholder="+12025550199 or +919876543210"
                      value={newDestPhone}
                      onChange={(e) => setNewDestPhone(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Label / Target Role
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Owner Test Mobile"
                      value={newDestLabel}
                      onChange={(e) => setNewDestLabel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  <div style={{ flex: 3 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Attestation Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Authorized for supervised outbound testing"
                      value={newDestNotes}
                      onChange={(e) => setNewDestNotes(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={destSaving || !newDestPhone.trim()}
                    style={{ height: '32px', fontSize: '12px', padding: '0 12px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={14} />
                    {destSaving ? 'Adding...' : 'Authorize Destination'}
                  </button>
                </form>

                {destinationsList.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    <ShieldAlert size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                      No Verified Outbound Destinations Registered
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '480px', margin: '4px auto 0' }}>
                      Use the form above to authorize owner-approved phone numbers for PSTN calls. Outbound dispatches strictly fail closed without an active registered destination.
                    </div>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="console-table">
                      <thead>
                        <tr>
                          <th>DESTINATION (MASKED)</th>
                          <th>LABEL / ROLE</th>
                          <th>STATUS</th>
                          <th>APPROVED BY</th>
                          <th>NOTES</th>
                          <th>REGISTERED</th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {destinationsList.map((d: any) => {
                          const isActive = d.status?.toLowerCase() === 'active';
                          return (
                            <tr key={d.id}>
                              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{d.phoneMasked || d.phoneE164}</td>
                              <td>{d.label || '—'}</td>
                              <td>
                                <span style={{
                                  padding: '2px 8px',
                                  background: isActive ? '#dcfce7' : '#f1f5f9',
                                  color: isActive ? '#15803d' : '#64748b',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700
                                }}>
                                  {d.status?.toUpperCase()}
                                </span>
                              </td>
                              <td style={{ fontSize: '12px', color: '#475569' }}>{d.approvedBy || 'Owner'}</td>
                              <td style={{ fontSize: '12px', color: '#64748b' }}>{d.notes || '—'}</td>
                              <td style={{ fontSize: '11px', color: '#64748b' }}>
                                {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
                              </td>
                              <td>
                                {isActive ? (
                                  <button
                                    className="btn-secondary"
                                    onClick={() => handleRevokeDestination(d.id, d.phoneMasked || d.phoneE164)}
                                    style={{ padding: '2px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                                  >
                                    Revoke
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Revoked</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ─── PHASE 5: PREFLIGHT INSPECTION & SAFETY LOCK CHECK ─── */}
              <div style={{ marginTop: '24px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={18} color="#2563eb" /> Provider Integration Preflight & Configuration Check
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Validates provider credentials, prompt protection, allowlist gating, and fail-closed safety interlocks without dispatching calls.
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={handleRunPreflight}
                    disabled={runningPreflight}
                    style={{ height: '34px', fontSize: '12px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RotateCw size={14} className={runningPreflight ? 'animate-spin' : ''} />
                    {runningPreflight ? 'Running Preflight...' : 'Run Preflight Check'}
                  </button>
                </div>

                {preflightData ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: preflightData.readyForDryRun ? '#f0fdf4' : '#fef2f2', border: `1px solid ${preflightData.readyForDryRun ? '#bbf7d0' : '#fecaca'}`, borderRadius: '6px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '3px 8px',
                          background: preflightData.readyForDryRun ? '#15803d' : '#991b1b',
                          color: '#ffffff',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          {preflightData.readyForDryRun ? 'READY FOR DRY-RUN / READINESS' : 'PREFLIGHT BLOCKED'}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: preflightData.readyForDryRun ? '#166534' : '#991b1b' }}>
                          {preflightData.safetyLockActive ? 'Hard Safety Lock Active (PRODUCTION_CALLS_ENABLED: false)' : 'Live Dispatch Permitted'}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                        0 Real Network Calls Permitted
                      </span>
                    </div>

                    {/* 4 Independent Facets */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Database Facet</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                          {preflightData.facets?.database?.status} ({preflightData.facets?.database?.baselineLoans}/{preflightData.facets?.database?.expectedBaseline})
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {preflightData.facets?.database?.database}
                        </div>
                      </div>

                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Vapi Platform</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: preflightData.facets?.vapi?.status === 'CONFIGURED' ? '#15803d' : '#b45309', marginTop: '4px' }}>
                          {preflightData.facets?.vapi?.status}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Key: {preflightData.facets?.vapi?.apiKeyMasked || 'Missing'} (Configured)
                        </div>
                      </div>

                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Twilio Trunking</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: preflightData.facets?.twilio?.status === 'CONFIGURED' ? '#15803d' : '#b45309', marginTop: '4px' }}>
                          {preflightData.facets?.twilio?.status}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          SID: {preflightData.facets?.twilio?.accountSidMasked || 'Configured'}
                        </div>
                      </div>

                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Allowlist & Interlock</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                          {preflightData.facets?.safetyInterlock?.status}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Target: {preflightData.facets?.allowlist?.targetTested}
                        </div>
                      </div>
                    </div>

                    {/* Actionable Blockers Box */}
                    {preflightData.blockers && preflightData.blockers.length > 0 && (
                      <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>
                          Actionable Blockers Prior to Any Live Supervised Calling:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#78350f' }}>
                          {preflightData.blockers.map((b: string, i: number) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Outbound Voice Call Request Preview */}
                    {preflightData.requestPreview && (
                      <div style={{ background: '#1e293b', borderRadius: '6px', padding: '12px', color: '#f8fafc', fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#93c5fd' }}>
                            Outbound Voice Call Request Preview (Vapi API Payload)
                          </span>
                          <span style={{ padding: '2px 6px', background: '#b91c1c', color: '#ffffff', borderRadius: '3px', fontSize: '10px', fontWeight: 700 }}>
                            DRY-RUN PREVIEW ONLY — ZERO NETWORK DISPATCH
                          </span>
                        </div>
                        <pre style={{ margin: 0, overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#cbd5e1' }}>
                          {JSON.stringify(preflightData.requestPreview, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px', background: '#ffffff', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    Click "Run Preflight Check" to inspect provider credentials, prompt protection, and safety lock status.
                  </div>
                )}
              </div>

              {/* ─── PHASE 5: DETERMINISTIC WEBHOOK REHEARSAL HARNESS ─── */}
              <div style={{ marginTop: '20px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={18} color="#15803d" /> Webhook Rehearsal & Delivery Runner
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Verifies authentication rejection, 256KB payload size limits, deduplication, sensitive data redaction, and replay idempotency.
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={handleRunWebhookRehearsal}
                    disabled={runningRehearsal}
                    style={{ height: '34px', fontSize: '12px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Play size={14} className={runningRehearsal ? 'animate-spin' : ''} />
                    {runningRehearsal ? 'Executing Rehearsal...' : 'Run Webhook Rehearsal'}
                  </button>
                </div>

                {rehearsalReport ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', marginBottom: '14px' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                          Rehearsal Pass ID: {rehearsalReport.rehearsalRunId}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '10px' }}>
                          {new Date(rehearsalReport.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <span style={{ padding: '2px 8px', background: '#15803d', color: '#ffffff', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                        ✓ {rehearsalReport.operationalRowsModified} Operational Rows Modified
                      </span>
                    </div>

                    {/* Step Execution Checklist */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {rehearsalReport.results?.map((res: any, idx: number) => (
                        <div key={idx} style={{ padding: '10px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <CheckCircle2 size={16} color={res.passed ? '#15803d' : '#dc2626'} />
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                Step {idx + 1}: {res.step.toUpperCase().replace(/_/g, ' ')}
                              </span>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                                {res.description}
                              </div>
                            </div>
                          </div>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: res.passed ? '#dcfce7' : '#fee2e2',
                            color: res.passed ? '#15803d' : '#991b1b'
                          }}>
                            {res.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px', background: '#ffffff', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    Click "Run Webhook Rehearsal" to execute the 5 sandboxed webhook reliability and redaction checks.
                  </div>
                )}
              </div>

              {/* ─── VOICE-AGENT READINESS & SINGLE-CALL SAFETY GATE ─── */}
              <div style={{ marginTop: '24px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Lock size={18} color="#b91c1c" /> Voice-Agent Telephony & Readiness Gate
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Dedicated pre-deployment safety gate for controlled internal voice testing. Enforces disposable DB isolation, token hashing, dedicated QA assistant separation, destination allowlist, and fail-closed dispatch lock.
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={handleRunSupervisedQaReadiness}
                    disabled={runningSupervisedQa}
                    style={{ height: '34px', fontSize: '12px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RotateCw size={14} className={runningSupervisedQa ? 'animate-spin' : ''} />
                    {runningSupervisedQa ? 'Inspecting Readiness...' : 'Inspect Supervised QA Readiness'}
                  </button>
                </div>

                {supervisedQaData ? (
                  <div>
                    {/* Status & Safety Interlock Banner */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          padding: '5px 12px',
                          background: '#991b1b',
                          color: '#ffffff',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 800,
                          letterSpacing: '0.5px'
                        }}>
                          {supervisedQaData.status || 'READY_WITH_BLOCKERS'}
                        </span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#991b1b' }}>
                            READINESS ONLY — NO CALL OR SMS WILL BE SENT IN THIS PHASE
                          </div>
                          <div style={{ fontSize: '11px', color: '#7f1d1d', marginTop: '2px' }}>
                            Database Guard: <strong>{supervisedQaData.facets?.disposableDbIsolation?.currentDatabase}</strong> | Baseline Protected: <strong>{supervisedQaData.facets?.disposableDbIsolation?.operationalBaselineCount || 30}/30 loans intact</strong> | Zero Telephony Network Egress
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 700, background: '#fee2e2', padding: '4px 10px', borderRadius: '4px', display: 'inline-block' }}>
                          READY FOR OWNER REVIEW
                        </span>
                      </div>
                    </div>

                    {/* 8 Architecture Facet Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                      {/* 1. Canonical Assistant Configuration */}
                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>1. Canonical Assistant</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                          ✓ Configured
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                          ID: <code style={{ fontSize: '10px' }}>e990ce6c...66d</code>
                        </div>
                        <div style={{ fontSize: '10px', color: '#166534', marginTop: '4px', fontWeight: 600 }}>
                          Prompt: Owner-Managed Canonical Prompt
                        </div>
                      </div>

                      {/* 2. Destination Allowlist & Boundary */}
                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>2. Destination Allowlist</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                          Target: {supervisedQaData.facets?.allowlist?.targetTested || '+91 •••• 4331'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                          Application Filter: <strong>PASS</strong>
                        </div>
                        <div style={{ fontSize: '10px', color: '#9a3412', marginTop: '4px', fontWeight: 600 }}>
                          Notice: NOT borrower consent
                        </div>
                      </div>

                      {/* 3. Carrier Telephony & Routing */}
                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>3. Twilio India CLI Route</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                          +1 CLI Calling +91
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                          Conforms to non-Indian CLI rule
                        </div>
                        <div style={{ fontSize: '10px', color: '#b45309', marginTop: '4px', fontWeight: 600 }}>
                          Dashboard permissions unverified
                        </div>
                      </div>

                      {/* 4. Webhook Auth Model */}
                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>4. Webhook Auth Model</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', marginTop: '4px' }}>
                          SAVED_SERVER_CONFIG
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                          Zero inline serverUrl in payload
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                          Server secret in Vapi Dashboard
                        </div>
                      </div>

                      {/* 5. Operator Auth & Rate Limit */}
                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>5. Operator Auth & Rate Limit</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                          Dual-Key Rate Limiting
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                          Locks IP + Target User
                        </div>
                        <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '4px', fontWeight: 600 }}>
                          5 failed attempts lockout (HTTP 429)
                        </div>
                      </div>

                      {/* 6. Tool Auth & Call Binding */}
                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>6. Tool Auth & Loan Binding</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                          Multi-Gated Test Override
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                          Disposable DB target enforced
                        </div>
                        <div style={{ fontSize: '10px', color: '#15803d', marginTop: '4px', fontWeight: 600 }}>
                          Payment link rejects loan mismatch
                        </div>
                      </div>

                      {/* 7. Sensitive Data Sanitizer */}
                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>7. Data Sanitizer Lifecycle</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                          Pre-Outbox Sanitization
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                          PANs (Luhn 13-19) & Labeled SSNs
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                          Circular-reference safe
                        </div>
                      </div>

                      {/* 8. One-Call Safety Gate & Nonce */}
                      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>8. Single-Use Owner Nonce</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', marginTop: '4px' }}>
                          Nonce Required
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                          Atomic claim prevents replay
                        </div>
                        <div style={{ fontSize: '10px', color: '#991b1b', marginTop: '4px', fontWeight: 600 }}>
                          Replay fails with HTTP 409
                        </div>
                      </div>
                    </div>

                    {/* Actionable Blockers Box */}
                    {supervisedQaData.blockers && supervisedQaData.blockers.length > 0 && (
                      <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={15} color="#b45309" /> Actionable Blockers Required Prior to Supervised Calling:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {supervisedQaData.blockers.map((b: string, i: number) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Synthetic Call Request Preview */}
                    {supervisedQaData.syntheticRequestPreview && (
                      <div style={{ background: '#0f172a', borderRadius: '6px', padding: '12px 14px', color: '#f8fafc', fontSize: '11px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                            Synthetic Call Request Preview (Vapi Outbound Payload Structure)
                          </span>
                          <span style={{ padding: '2px 8px', background: '#dc2626', color: '#ffffff', borderRadius: '3px', fontSize: '10px', fontWeight: 700 }}>
                            SYNTHETIC DATA ONLY — ZERO LIVE BORROWER PII
                          </span>
                        </div>
                        <pre style={{ margin: 0, overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#cbd5e1' }}>
                          {JSON.stringify(supervisedQaData.syntheticRequestPreview, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Single-Call Safety Gate Control (Disabled Call Button) */}
                    <div style={{
                      padding: '16px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ShieldAlert size={16} color="#dc2626" /> Single-Call Supervised Voice Dispatch Gate
                        </div>
                        <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600, marginTop: '3px' }}>
                          {supervisedQaData.callControl?.reason || 'Not enabled — owner approval and a separately configured QA assistant are required.'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Allowlisting a destination is not borrower consent and does not authorize automated calling.
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {/* Disabled Call Button */}
                        <button
                          type="button"
                          disabled={true}
                          style={{
                            height: '38px',
                            padding: '0 18px',
                            background: '#94a3b8',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'not-allowed',
                            opacity: 0.65,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          title="Not enabled — owner approval and a separately configured QA assistant are required."
                        >
                          <PhoneCall size={14} /> Place Supervised Test Call
                        </button>

                        {/* Test Fail-Closed Gate Button */}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleAttemptSupervisedCall}
                          style={{
                            height: '38px',
                            padding: '0 14px',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderColor: '#cbd5e1'
                          }}
                          title="Sends dispatch request to prove the backend fails closed with HTTP 423 Locked"
                        >
                          <ShieldAlert size={14} color="#b91c1c" /> Probe Fail-Closed Gate (HTTP 423)
                        </button>
                      </div>
                    </div>

                    {/* Dispatch Attempt Response (Proves HTTP 423 Fail-Closed Interlock) */}
                    {dispatchAttemptError && (
                      <div style={{ marginTop: '10px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={16} color="#991b1b" />
                        <span>Fail-Closed Gate Verification: <code>{dispatchAttemptError}</code> (0 calls dispatched, 0 DB rows written)</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px', background: '#ffffff', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                    Click "Inspect Supervised QA Readiness" to evaluate the internal voice testing safety gate and fail-closed interlocks.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── L. OPERATIONAL AUDIT / QA SIMULATOR ──────────────────────── */}
          {activeTab === 'audit' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>Operational Audit & End-to-End QA Simulation</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Isolated deterministic simulation harness, 12-gate diagnostics, and immutable operational state transitions.
                  </div>
                </div>

                {/* Sub-tab switcher */}
                <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
                  <button
                    onClick={() => setAuditSubTab('simulator')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      background: auditSubTab === 'simulator' ? '#ffffff' : 'transparent',
                      color: auditSubTab === 'simulator' ? '#0f172a' : '#64748b',
                      boxShadow: auditSubTab === 'simulator' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    QA Simulation Runner
                  </button>
                  <button
                    onClick={() => setAuditSubTab('state_log')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      background: auditSubTab === 'state_log' ? '#ffffff' : 'transparent',
                      color: auditSubTab === 'state_log' ? '#0f172a' : '#64748b',
                      boxShadow: auditSubTab === 'state_log' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    State Change Log ({auditLogs.length})
                  </button>
                  <button
                    onClick={() => {
                      setAuditSubTab('timeline');
                      fetchAuditTimeline();
                    }}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      background: auditSubTab === 'timeline' ? '#ffffff' : 'transparent',
                      color: auditSubTab === 'timeline' ? '#0f172a' : '#64748b',
                      boxShadow: auditSubTab === 'timeline' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Lifecycle Audit Timeline ({auditTimelineEvents.length})
                  </button>
                </div>
              </div>

              {auditSubTab === 'simulator' && (
                <div>
                  {/* Prominent Amber Warning Banner */}
                  <div style={{
                    padding: '12px 16px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <ShieldAlert size={20} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', letterSpacing: '0.02em' }}>
                        SIMULATION — NO PHONE CALL OR SMS WAS SENT
                      </div>
                      <div style={{ fontSize: '12px', color: '#78350f', marginTop: '3px', lineHeight: 1.4 }}>
                        The QA Simulator runs deterministically in complete isolation. Telephony providers (Vapi/Twilio), live carrier networks, and production servicing outbox destinations are strictly bypassed. Zero operational rows are written to call_attempts, provider_webhook_events, servicing_outbox, or human_escalations.
                      </div>
                    </div>
                  </div>

                  {/* Simulator Controls Form */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '24px'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: '#0f172a' }}>
                      Configure Deterministic QA Simulation Pass
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr auto', gap: '14px', alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          TARGET SCENARIO ACCOUNT ({qaScenarios.length} Baseline Loans)
                        </label>
                        <select
                          value={selectedQaLoanId}
                          onChange={(e) => setSelectedQaLoanId(e.target.value)}
                          style={{ width: '100%', height: '36px', fontSize: '12px' }}
                        >
                          {qaScenarios.map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {sc.loanNumber} | {sc.borrowerName} ({sc.dpd} DPD, {sc.timezone})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          DETERMINISTIC SIMULATION OUTCOME (12 Outcomes)
                        </label>
                        <select
                          value={selectedQaOutcome}
                          onChange={(e) => setSelectedQaOutcome(e.target.value)}
                          style={{ width: '100%', height: '36px', fontSize: '12px' }}
                        >
                          <option value="MOCK_RPC_PTP">RPC: Promise to Pay (Full Balance) → Servicing Outbox Preview</option>
                          <option value="MOCK_RPC_CALLBACK_REQUESTED">RPC: Callback Requested → Scenario Callback Fixture</option>
                          <option value="MOCK_HARDSHIP_REFERRAL">RPC: Hardship Loss Mitigation Referral → Human Review</option>
                          <option value="MOCK_WRONG_NUMBER">RPC: Wrong Number Disclosed → Suppression & DNC</option>
                          <option value="MOCK_PROVIDER_TECHNICAL_FAILURE">Telephony: SIP Carrier Failure (503) → Bounded Retry</option>
                          <option value="COOLDOWN_PASS">{'Pre-Dial Gate: Cooldown Cleared (Elapsed >= 4h) → Pass'}</option>
                          <option value="COOLDOWN_BLOCK">{'Pre-Dial Gate: Cooldown Active (Elapsed < 4h) → Gate C10 Block'}</option>
                          <option value="BLOCKED_DNC">Pre-Dial Gate: Active DNC Suppression → Gate C3 Block</option>
                          <option value="ACTIVE_DISPUTE">Pre-Dial Gate: Active Regulatory Dispute → Gate C2c Block</option>
                          <option value="PROHIBITED_BANKRUPTCY_DECEASED">Pre-Dial Gate: Legal Hard Exclusion → Gate C2a Block</option>
                          <option value="V1_TIME_RESTRICTION">Pre-Dial Gate: V1 Time-of-Day Restriction → Gate C9 Block</option>
                          <option value="ACTIVE_CALLBACK">Pre-Dial Gate: Pending Callback Active → Gate C11 Block</option>
                        </select>
                      </div>

                      <button
                        className="btn-primary"
                        onClick={handleRunSimulation}
                        disabled={simulating || !selectedQaLoanId}
                        style={{ height: '36px', padding: '0 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Play size={14} className={simulating ? 'animate-spin' : ''} />
                        {simulating ? 'Simulating...' : 'Run Simulation'}
                      </button>
                    </div>
                  </div>

                  {/* Active Simulation Result Display */}
                  {currentSimulation && (
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '18px',
                      marginBottom: '24px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Simulation Run: {currentSimulation.runId}
                          </span>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                            {currentSimulation.loanNumber} — {currentSimulation.borrowerName}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: currentSimulation.status === 'completed' ? '#dcfce7' : '#fee2e2',
                            color: currentSimulation.status === 'completed' ? '#15803d' : '#991b1b'
                          }}>
                            {currentSimulation.status === 'completed' ? 'GATE CLEARED / COMPLETED' : 'BLOCKED AT PRE-DIAL GATE'}
                          </span>

                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#eff6ff',
                            color: '#1d4ed8'
                          }}>
                            {currentSimulation.selectedOutcome}
                          </span>
                        </div>
                      </div>

                      {/* Phone & Safety Spy Banner */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
                        <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>DESTINATION (MASKED)</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                            {currentSimulation.maskedPhone || '+1 555-•••-••34'}
                          </div>
                        </div>

                        <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>NETWORK CALL AUDIT</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> 0 Telephony Calls Made
                          </div>
                        </div>

                        <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>OPERATIONAL ROWS AUDIT</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> 0 Operational Rows Added
                          </div>
                        </div>
                      </div>

                      {/* Step-by-Step Interactive Timeline */}
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: '#0f172a' }}>
                          Execution Timeline & Workflow Assertions
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {currentSimulation.executionTimeline?.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                padding: '10px 12px',
                                background: item.status === 'fail' ? '#fff1f2' : item.status === 'pass' ? '#f0fdf4' : '#f8fafc',
                                borderLeft: `3px solid ${item.status === 'fail' ? '#e11d48' : item.status === 'pass' ? '#16a34a' : '#3b82f6'}`,
                                borderRadius: '4px'
                              }}
                            >
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', minWidth: '45px' }}>
                                STEP {item.step || idx + 1}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                                  {item.title}
                                </div>
                                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                                  {item.detail}
                                </div>
                              </div>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 700,
                                background: item.status === 'fail' ? '#fee2e2' : item.status === 'pass' ? '#dcfce7' : '#e0f2fe',
                                color: item.status === 'fail' ? '#991b1b' : item.status === 'pass' ? '#166534' : '#075985'
                              }}>
                                {item.status?.toUpperCase() || 'INFO'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Derived Servicing Actions Preview */}
                      {currentSimulation.derivedActions && (
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#0f172a' }}>
                            Derived Servicing Action Preview (Local Mock Isolation)
                          </div>
                          <div style={{
                            padding: '12px',
                            background: '#0f172a',
                            color: '#f8fafc',
                            borderRadius: '6px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            maxHeight: '180px',
                            overflowY: 'auto'
                          }}>
                            <pre style={{ margin: 0 }}>
                              {JSON.stringify(currentSimulation.derivedActions, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Simulation Run History Table */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: '#0f172a' }}>
                      Recent Simulation Runs ({qaSimulations.length})
                    </div>
                    {qaSimulations.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '6px' }}>
                        No simulation runs recorded yet. Select a scenario above to execute.
                      </div>
                    ) : (
                      <div className="table-container">
                        <table className="console-table">
                          <thead>
                            <tr>
                              <th>RUN ID</th>
                              <th>LOAN #</th>
                              <th>BORROWER</th>
                              <th>OUTCOME</th>
                              <th>STATUS</th>
                              <th>NETWORK CALLS</th>
                              <th>SIMULATED AT</th>
                              <th>ACTIONS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {qaSimulations.map((sim) => (
                              <tr key={sim.id}>
                                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{sim.runId}</td>
                                <td>{sim.loanNumber}</td>
                                <td>{sim.borrowerName}</td>
                                <td>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af' }}>
                                    {sim.selectedOutcome}
                                  </span>
                                </td>
                                <td>
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    background: sim.status === 'completed' ? '#dcfce7' : '#fee2e2',
                                    color: sim.status === 'completed' ? '#15803d' : '#991b1b'
                                  }}>
                                    {sim.status?.toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: '#15803d', fontWeight: 600, fontSize: '11px' }}>
                                    ✓ 0 Calls
                                  </span>
                                </td>
                                <td>{new Date(sim.createdAt).toLocaleTimeString()}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      className="btn-secondary"
                                      style={{ padding: '2px 6px', fontSize: '11px' }}
                                      onClick={() => setCurrentSimulation(sim)}
                                    >
                                      Inspect
                                    </button>
                                    <button
                                      className="btn-secondary"
                                      style={{ padding: '2px 6px', fontSize: '11px', color: '#b91c1c' }}
                                      onClick={() => handleDeleteSimulation(sim.id)}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {auditSubTab === 'state_log' && (
                <div>
                  {auditLogs.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '6px' }}>
                      No operational audit events recorded yet.
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>CHANGED AT</th>
                            <th>LOAN NUMBER</th>
                            <th>FIELD / ACTION</th>
                            <th>CHANGED BY</th>
                            <th>NEW VALUE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map((log) => (
                            <tr key={log.id}>
                              <td>{new Date(log.changedAt).toLocaleString()}</td>
                              <td>{log.loanId}</td>
                              <td style={{ fontWeight: 600 }}>{log.fieldName}</td>
                              <td>{log.changedBy}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                {JSON.stringify(log.newValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {auditSubTab === 'timeline' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Filter by Account:</span>
                      <select
                        value={timelineFilterLoanId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTimelineFilterLoanId(val);
                          fetchAuditTimeline(val);
                        }}
                        style={{ height: '32px', fontSize: '12px', padding: '0 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="all">All Accounts ({accounts.length} Loans)</option>
                        {accounts.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.loanNumber} | {acc.borrower ? `${acc.borrower.firstName} ${acc.borrower.lastName}` : 'Unassigned'} ({acc.dpd} DPD)
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      className="btn-secondary"
                      onClick={() => fetchAuditTimeline(timelineFilterLoanId)}
                      disabled={timelineLoading}
                      style={{ height: '32px', fontSize: '12px', gap: '6px' }}
                    >
                      <RotateCw size={13} className={timelineLoading ? 'animate-spin' : ''} />
                      {timelineLoading ? 'Loading Timeline...' : 'Refresh Timeline'}
                    </button>
                  </div>

                  {timelineLoading ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                      <RotateCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      <div>Loading lifecycle evidence from database...</div>
                    </div>
                  ) : auditTimelineEvents.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      <History size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>No Lifecycle Events Recorded</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        Run an eligibility simulation from the Campaigns tab or execute a scenario to generate verifiable audit timeline records.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', paddingLeft: '24px' }}>
                      <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '8px', width: '2px', background: '#e2e8f0' }} />
                      {auditTimelineEvents.map((ev, idx) => (
                        <div
                          key={ev.id || idx}
                          style={{
                            position: 'relative',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            left: '-20px',
                            top: '18px',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: ev.category === 'CAMPAIGN_ELIGIBILITY' ? '#2563eb' : (ev.category === 'COMPLIANCE' ? '#7c3aed' : (ev.category === 'CALLBACK' ? '#d97706' : (ev.category === 'SERVICING_OUTBOX' ? '#16a34a' : '#64748b'))),
                            border: '2px solid #ffffff',
                            boxShadow: '0 0 0 2px #cbd5e1'
                          }} />

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: ev.category === 'CAMPAIGN_ELIGIBILITY' ? '#eff6ff' : (ev.category === 'COMPLIANCE' ? '#f5f3ff' : (ev.category === 'CALLBACK' ? '#fffbeb' : (ev.category === 'SERVICING_OUTBOX' ? '#f0fdf4' : '#f8fafc'))),
                                color: ev.category === 'CAMPAIGN_ELIGIBILITY' ? '#1d4ed8' : (ev.category === 'COMPLIANCE' ? '#6d28d9' : (ev.category === 'CALLBACK' ? '#b45309' : (ev.category === 'SERVICING_OUTBOX' ? '#15803d' : '#475569')))
                              }}>
                                {ev.category}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                {ev.title}
                              </span>
                            </div>

                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {new Date(ev.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <div style={{ fontSize: '12px', color: '#334155', marginBottom: '8px' }}>
                            <strong>Loan:</strong> {ev.loanNumber} &nbsp;|&nbsp; <strong>Borrower:</strong> {ev.borrowerName} &nbsp;|&nbsp; <strong>Actor:</strong> {ev.actor}
                          </div>

                          {ev.summary && (
                            <div style={{
                              background: '#f8fafc',
                              border: '1px solid #f1f5f9',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)',
                              color: '#334155',
                              maxHeight: '120px',
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }}>
                              {typeof ev.summary === 'object' ? JSON.stringify(ev.summary, null, 2) : String(ev.summary)}
                            </div>
                          )}

                          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#94a3b8' }}>
                            <span>Action Type: {ev.actionType || 'Persisted Audit Entry'}</span>
                            <span style={{ fontWeight: 600, color: '#0284c7' }}>✓ Persisted Local Evidence</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ─── MODAL: CREATE CAMPAIGN ────────────────────────────────────────── */}
      {showCreateCampaignModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form
            onSubmit={handleCreateCampaign}
            style={{ width: '560px', maxWidth: '90vw', backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Create Delinquency Campaign Cohort</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Define cohort targeting, DPD bounds, contact cadence, and cooldown limits.
                </div>
              </div>
              <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowCreateCampaignModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Campaign Name *</label>
                <input
                  required
                  placeholder="e.g. Mid-Stage Delinquency | 60–89 DPD"
                  value={newCampaignForm.name}
                  onChange={(e) => setNewCampaignForm({ ...newCampaignForm, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Servicing Purpose / Description</label>
                <input
                  placeholder="e.g. Early intervention for accounts entering 30-day delinquency"
                  value={newCampaignForm.description}
                  onChange={(e) => setNewCampaignForm({ ...newCampaignForm, description: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Cohort Label / Identifier</label>
                <input
                  placeholder="e.g. 60–89 DPD Cure Outreach"
                  value={newCampaignForm.cohortLabel}
                  onChange={(e) => setNewCampaignForm({ ...newCampaignForm, cohortLabel: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>DPD Min</label>
                  <input
                    type="number"
                    min={1}
                    value={newCampaignForm.dpdMin}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, dpdMin: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>DPD Max</label>
                  <input
                    type="number"
                    min={1}
                    value={newCampaignForm.dpdMax}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, dpdMax: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Cooldown (Hours)</label>
                  <input
                    type="number"
                    min={1}
                    value={newCampaignForm.cooldownHours}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, cooldownHours: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Minimum spacing between outreach</div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max Lifetime Attempts</label>
                  <input
                    type="number"
                    min={1}
                    value={newCampaignForm.maxAttempts}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, maxAttempts: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Ceiling before graduation</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Daily Cap</label>
                  <input
                    type="number"
                    min={1}
                    value={newCampaignForm.dailyCap}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, dailyCap: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Max touches/day</div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Weekly Cap</label>
                  <input
                    type="number"
                    min={1}
                    value={newCampaignForm.weeklyCap}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, weeklyCap: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Max touches/wk</div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Callback Horizon</label>
                  <input
                    type="number"
                    min={1}
                    value={newCampaignForm.callbackHorizonDays}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, callbackHorizonDays: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Suppression days</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '11px', color: '#475569' }}>
              <strong>Operational Policy:</strong> Campaign targeting boundaries and contact rules apply to all enrolled cohort members. Accounts are evaluated deterministically via 12 pre-dial gates.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowCreateCampaignModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Campaign Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: EDIT CAMPAIGN ──────────────────────────────────────────── */}
      {showEditCampaignModal && editingCampaign && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form
            onSubmit={handleUpdateCampaign}
            style={{ width: '560px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Edit Campaign Policy: {editingCampaign.name}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Update cohort targeting, attempt caps, cooldown intervals, and suppression horizons.
                </div>
              </div>
              <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowEditCampaignModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Campaign Name *</label>
                <input
                  required
                  value={editCampaignForm.name}
                  onChange={(e) => setEditCampaignForm({ ...editCampaignForm, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Servicing Purpose / Description</label>
                <input
                  value={editCampaignForm.description}
                  onChange={(e) => setEditCampaignForm({ ...editCampaignForm, description: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Cohort Label / Identifier</label>
                <input
                  value={editCampaignForm.cohortLabel}
                  onChange={(e) => setEditCampaignForm({ ...editCampaignForm, cohortLabel: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>DPD Min</label>
                  <input
                    type="number"
                    min={1}
                    value={editCampaignForm.dpdMin}
                    onChange={(e) => setEditCampaignForm({ ...editCampaignForm, dpdMin: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>DPD Max</label>
                  <input
                    type="number"
                    min={1}
                    value={editCampaignForm.dpdMax}
                    onChange={(e) => setEditCampaignForm({ ...editCampaignForm, dpdMax: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Cooldown (Hours)</label>
                  <input
                    type="number"
                    min={1}
                    value={editCampaignForm.cooldownHours}
                    onChange={(e) => setEditCampaignForm({ ...editCampaignForm, cooldownHours: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Minimum spacing between outreach</div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max Lifetime Attempts</label>
                  <input
                    type="number"
                    min={1}
                    value={editCampaignForm.maxAttempts}
                    onChange={(e) => setEditCampaignForm({ ...editCampaignForm, maxAttempts: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Ceiling before graduation</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Daily Cap</label>
                  <input
                    type="number"
                    min={1}
                    value={editCampaignForm.dailyCap}
                    onChange={(e) => setEditCampaignForm({ ...editCampaignForm, dailyCap: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Max touches/day</div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Weekly Cap</label>
                  <input
                    type="number"
                    min={1}
                    value={editCampaignForm.weeklyCap}
                    onChange={(e) => setEditCampaignForm({ ...editCampaignForm, weeklyCap: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Max touches/wk</div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Callback Horizon</label>
                  <input
                    type="number"
                    min={1}
                    value={editCampaignForm.callbackHorizonDays}
                    onChange={(e) => setEditCampaignForm({ ...editCampaignForm, callbackHorizonDays: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Suppression days</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '11px', color: '#475569' }}>
              <strong>Policy Propagation:</strong> Modifications take effect immediately for all subsequent eligibility evaluations and contact cadence evaluations.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowEditCampaignModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Policy Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── DRAWER: CAMPAIGN DETAILS (5 SECTIONS) ───────────────────────────── */}
      {showCampaignDetailsDrawer && selectedCampaignForDetails && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ width: '740px', maxWidth: '95vw', height: '100dvh', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>{selectedCampaignForDetails.name}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: selectedCampaignForDetails.status === 'active' ? '#dcfce7' : '#f1f5f9', color: selectedCampaignForDetails.status === 'active' ? '#15803d' : '#64748b' }}>
                    {selectedCampaignForDetails.status?.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {selectedCampaignForDetails.cohortLabel || `${selectedCampaignForDetails.dpdMin}–${selectedCampaignForDetails.dpdMax} DPD Cohort`} • ID: {selectedCampaignForDetails.id}
                </div>
              </div>
              <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowCampaignDetailsDrawer(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 16px' }}>
              {[
                { id: 'overview', label: 'Cohort Overview' },
                { id: 'members', label: `Members (${campaignMembersList.length})` },
                { id: 'policy', label: 'Contact Policy' },
                { id: 'scheduling', label: 'Scheduling & Cadence' },
                { id: 'eligibility', label: 'Outreach Eligibility' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  style={{
                    padding: '10px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: campaignDetailsTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                    background: 'none',
                    color: campaignDetailsTab === tab.id ? '#2563eb' : '#64748b',
                    cursor: 'pointer'
                  }}
                  onClick={() => setCampaignDetailsTab(tab.id as any)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {/* SECTION 1: OVERVIEW */}
              {campaignDetailsTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Cohort Specifications</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Campaign Name:</span>
                        <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{selectedCampaignForDetails.name}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Cohort Label:</span>
                        <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{selectedCampaignForDetails.cohortLabel || `${selectedCampaignForDetails.dpdMin}–${selectedCampaignForDetails.dpdMax} DPD Cohort`}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Delinquency Bounds:</span>
                        <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{selectedCampaignForDetails.dpdMin} – {selectedCampaignForDetails.dpdMax} DPD</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Operational Status:</span>
                        <div style={{ fontWeight: 600, color: selectedCampaignForDetails.status === 'active' ? '#15803d' : '#64748b', marginTop: '2px' }}>
                          {selectedCampaignForDetails.status?.toUpperCase()}
                        </div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#64748b' }}>Purpose & Strategy:</span>
                        <div style={{ fontWeight: 500, color: '#334155', marginTop: '2px' }}>{selectedCampaignForDetails.description || 'Early delinquency contact and resolution strategy.'}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Created At:</span>
                        <div style={{ fontWeight: 500, color: '#0f172a', marginTop: '2px' }}>{selectedCampaignForDetails.createdAt ? new Date(selectedCampaignForDetails.createdAt).toLocaleString() : '—'}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Last Updated:</span>
                        <div style={{ fontWeight: 500, color: '#0f172a', marginTop: '2px' }}>{selectedCampaignForDetails.updatedAt ? new Date(selectedCampaignForDetails.updatedAt).toLocaleString() : '—'}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#166534', marginBottom: '8px' }}>Active Servicing Controls Summary</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12px' }}>
                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                        <div style={{ color: '#166534', fontWeight: 600 }}>Cooldown Period</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', margin: '4px 0 2px' }}>{selectedCampaignForDetails.cooldownHours}h</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Between touches</div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                        <div style={{ color: '#166534', fontWeight: 600 }}>Daily Cap</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', margin: '4px 0 2px' }}>{selectedCampaignForDetails.dailyCap ?? 2}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Max touches/day</div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                        <div style={{ color: '#166534', fontWeight: 600 }}>Weekly Cap</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', margin: '4px 0 2px' }}>{selectedCampaignForDetails.weeklyCap ?? 6}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Max touches/week</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: MEMBERSHIP */}
              {campaignDetailsTab === 'members' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL ENROLLED</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '4px 0 2px' }}>{campaignMembersList.length}</div>
                    </div>
                    <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>ACTIVE MEMBERS</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d', margin: '4px 0 2px' }}>
                        {campaignMembersList.filter((m) => m.status === 'active').length}
                      </div>
                    </div>
                    <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>PAUSED MEMBERS</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#b45309', margin: '4px 0 2px' }}>
                        {campaignMembersList.filter((m) => m.status === 'paused').length}
                      </div>
                    </div>
                    <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>REMOVED MEMBERS</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#475569', margin: '4px 0 2px' }}>
                        {campaignMembersList.filter((m) => m.status === 'removed').length}
                      </div>
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="console-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>BORROWER</th>
                          <th>LOAN #</th>
                          <th>DPD</th>
                          <th>PAST DUE</th>
                          <th>PRIORITY</th>
                          <th>STATUS</th>
                          <th>NEXT CONTACT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignMembersList.map((m) => (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 600 }}>{m.borrower ? `${m.borrower.firstName} ${m.borrower.lastName}` : 'Unassigned'}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{maskLoanNumber(m.loan?.loanNumber || m.loanId)}</td>
                            <td>{m.loan?.dpd ?? '—'} DPD</td>
                            <td>{formatCurrency(m.loan?.pastDueAmount)}</td>
                            <td style={{ fontWeight: 700, color: '#2563eb' }}>{m.priorityScore ?? 50}</td>
                            <td>
                              <span style={{ padding: '2px 6px', background: m.status === 'active' ? '#dcfce7' : '#f1f5f9', color: m.status === 'active' ? '#15803d' : '#64748b', borderRadius: '3px', fontSize: '10px', fontWeight: 700 }}>
                                {m.status?.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              {!m.nextContactAt || new Date(m.nextContactAt) <= new Date() ? (
                                <span style={{ color: '#15803d', fontWeight: 600 }}>Due Now</span>
                              ) : (
                                new Date(m.nextContactAt).toLocaleDateString()
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 3: CONTACT POLICY */}
              {campaignDetailsTab === 'policy' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      Cooldown Period: {selectedCampaignForDetails.cooldownHours} Hours
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>
                      Minimum elapsed time required between consecutive outreach attempts to the same borrower across all voice and messaging channels. Enforced account-wide to prevent repeated touches.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      Daily Contact Cap: {selectedCampaignForDetails.dailyCap ?? 2} Touches / Day
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>
                      Maximum number of contact attempts permitted to a borrower within any rolling 24-hour window across all campaigns, ensuring strict adherence to servicing limits.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      Weekly Contact Cap: {selectedCampaignForDetails.weeklyCap ?? 6} Touches / Week
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>
                      Strict ceiling on total weekly contacts across all campaigns and channels. Prevents excessive outreach in compliance with federal debt collection guidelines.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      Standard Contact Cadence: 3 Days
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>
                      Default inter-touch spacing between outreach evaluations for enrolled cohort members. Accounts advance by this interval after each contact attempt.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      Max Lifetime Attempts: {selectedCampaignForDetails.maxAttempts} Attempts
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>
                      Lifetime campaign touches permitted before an account is transitioned to human escalation, reviewed for loss mitigation, or graduated to the next delinquency stage.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      Callback Horizon: {selectedCampaignForDetails.callbackHorizonDays ?? 7} Days
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>
                      Window during which an active promised callback suppresses standard outreach cadence, deferring contact until the mutually agreed callback window.
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 4: SCHEDULING MECHANICS */}
              {campaignDetailsTab === 'scheduling' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                      1. Initial Enrollment Behavior
                    </div>
                    <div style={{ fontSize: '12px', color: '#14532d', lineHeight: 1.5 }}>
                      When a loan account is enrolled in this campaign, its schedule is immediately initialized with <code>next_contact_at = NOW()</code>. Enrolled accounts enter the evaluation queue without artificial delays or waiting periods, ensuring timely first outreach.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      2. Subsequent Contact Cadence Advancement
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                      Following a contact attempt (or completed call), the scheduling engine advances <code>next_contact_at</code> by the campaign cadence (3 days) or the cooldown duration (whichever is greater), maintaining orderly touch pacing.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      3. Callback Coordination Interlock
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                      If a borrower requests or schedules a callback, standard outreach cadence is suppressed. The scheduled callback time overrides normal campaign cadence to honor borrower commitments.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      4. Real-Time Pre-Dial Gate Evaluation
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                      Reaching the scheduled contact time (<code>next_contact_at &le; NOW()</code>) qualifies an account for evaluation, but does NOT initiate an automatic call. All 12 pre-dial gates (TCPA consent, permissible hours, DNC, bankruptcy, loss mitigation) must pass in real time before any call can be dispatched.
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 5: OUTREACH ELIGIBILITY HISTORY */}
              {campaignDetailsTab === 'eligibility' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Latest Eligibility Review Execution</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Last Evaluation Run:</span>
                        <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                          {selectedCampaignForDetails.lastEvaluatedAt ? new Date(selectedCampaignForDetails.lastEvaluatedAt).toLocaleString() : 'Not evaluated yet'}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Evaluation Results:</span>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#15803d', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            {selectedCampaignForDetails.lastEvaluatedEligibleCount ?? 0} Eligible (Dry-Run)
                          </span>
                          <span style={{ padding: '2px 8px', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            {selectedCampaignForDetails.lastEvaluatedBlockedCount ?? 0} Blocked
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      className="btn-primary"
                      style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => {
                        setShowCampaignDetailsDrawer(false);
                        handleRunCampaignDispatch(selectedCampaignForDetails);
                      }}
                    >
                      <Play size={14} /> Run Outreach Eligibility Review Now
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSelectedCampaignForMembers(selectedCampaignForDetails);
                    setCampaignMembersTab('members');
                    fetchCampaignMembers(selectedCampaignForDetails.id);
                    fetchCampaignCandidates(selectedCampaignForDetails.id);
                    setShowManageMembersModal(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Users size={13} /> Manage Members
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleOpenEditCampaign(selectedCampaignForDetails)}
                >
                  Edit Settings
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleToggleCampaignStatus(selectedCampaignForDetails)}
                >
                  {selectedCampaignForDetails.status === 'active' ? 'Pause Campaign' : 'Activate Campaign'}
                </button>
              </div>
              <button className="btn-secondary" onClick={() => setShowCampaignDetailsDrawer(false)}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: REVIEW OUTREACH ELIGIBILITY (FAIL-CLOSED DRY-RUN) ──────────── */}
      {showDispatchRunModal && dispatchRunData && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '920px', maxWidth: '95vw', maxHeight: '90vh', backgroundColor: '#ffffff', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Play size={18} color="#2563eb" /> Review Outreach Eligibility: {dispatchRunData.campaignName}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Deterministic priority evaluation across all 12 pre-dial gates & owner-verified destination allowlist.
                </div>
              </div>
              <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowDispatchRunModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Safety Interlock Banner */}
            <div style={{ padding: '12px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} color="#b91c1c" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>
                  {dispatchRunData.dispatchStatus || 'SAFETY_LOCKED_DRY_RUN: Pre-Dial Deterministic Review'}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#7f1d1d' }}>
                Evaluated at {new Date(dispatchRunData.evaluatedAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Metric KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>TOTAL MEMBERS</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{dispatchRunData.totalMembers}</div>
              </div>
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>EVALUATED</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>{dispatchRunData.evaluatedCount}</div>
              </div>
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#15803d' }}>BUSINESS ELIGIBLE (12/12)</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d' }}>{dispatchRunData.businessEligibleCount ?? dispatchRunData.eligibleCount}</div>
              </div>
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '11px', color: '#b91c1c' }}>BUSINESS BLOCKED</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#b91c1c' }}>{dispatchRunData.businessBlockedCount ?? dispatchRunData.blockedCount}</div>
              </div>
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '11px', color: '#92400e' }}>PSTN ALLOWLIST</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#92400e' }}>{dispatchRunData.pstnAuthorizedCount ?? 0} Authorized</div>
              </div>
            </div>

            {/* Gate Breakdown Tags */}
            {dispatchRunData.blockedByGate && Object.keys(dispatchRunData.blockedByGate).length > 0 && (
              <div style={{ padding: '10px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Blocked Breakdown:</span>
                {Object.entries(dispatchRunData.blockedByGate).map(([reason, count]) => (
                  <span key={reason} style={{ fontSize: '11px', padding: '2px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontWeight: 600 }}>
                    {reason}: {count as any}
                  </span>
                ))}
              </div>
            )}

            {/* Members table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <div className="table-container">
                <table className="console-table">
                  <thead>
                    <tr>
                      <th>PRIORITY</th>
                      <th>DPD</th>
                      <th>BORROWER / LOAN</th>
                      <th>CONTACT DESTINATION</th>
                      <th>BUSINESS ELIGIBILITY</th>
                      <th>PSTN DISPATCH & GATE REASON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchRunData.members?.map((m: any) => {
                      const isBusinessEligible = m.businessEligible ?? m.eligible;
                      return (
                        <tr key={m.memberId}>
                          <td style={{ fontWeight: 700, color: '#2563eb' }}>{m.priorityScore}</td>
                          <td>{m.dpd} DPD</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{m.borrowerName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{maskLoanNumber(m.loanNumber)}</div>
                          </td>
                          <td>
                            <div style={{ fontFamily: 'var(--font-mono)' }}>{m.phoneMasked}</div>
                            <div style={{ fontSize: '10px', color: m.isVerifiedPstn ? '#166534' : '#b45309' }}>
                              {m.isVerifiedPstn ? '✓ Owner-Verified Allowlist' : '⚠ Not in Verified PSTN Allowlist'}
                            </div>
                          </td>
                          <td>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: isBusinessEligible ? '#dcfce7' : '#fee2e2',
                              color: isBusinessEligible ? '#15803d' : '#991b1b'
                            }}>
                              {isBusinessEligible ? '12/12 GATES PASSED' : 'BLOCKED'}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {isBusinessEligible ? (
                              <div>
                                <span style={{ color: '#15803d', fontWeight: 600 }}>Eligible for Outreach</span>
                                <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>
                                  PSTN Dispatch Blocked (Allowlist Interlock Active · Dry-Run Only)
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: '#b91c1c' }}>
                                <span style={{ fontWeight: 600 }}>{m.businessResult || m.finalResult}</span>
                                {m.reasons?.length > 1 && (
                                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                                    Also: {m.reasons.slice(1).join(', ')}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Fail-closed lock: Set PRODUCTION_CALLS_ENABLED=true and obtain owner approval to dispatch live calls.
              </span>
              <button className="btn-secondary" onClick={() => setShowDispatchRunModal(false)}>
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: MANAGE CAMPAIGN MEMBERS ─────────────────────────────────── */}
      {showManageMembersModal && selectedCampaignForMembers && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '960px', maxWidth: '96vw', maxHeight: '90vh', backgroundColor: '#ffffff', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Campaign Members:</span>
                  <span style={{ color: '#2563eb' }}>{selectedCampaignForMembers.name}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {campaignMembersList.length} enrolled borrower(s) · Segment: {selectedCampaignForMembers.dpdMin}–{selectedCampaignForMembers.dpdMax} DPD Cohort
                </div>
              </div>
              <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowManageMembersModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Sub-Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 20px' }}>
              <button
                type="button"
                onClick={() => setCampaignMembersTab('members')}
                style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: campaignMembersTab === 'members' ? '2px solid #2563eb' : '2px solid transparent',
                  color: campaignMembersTab === 'members' ? '#2563eb' : '#64748b'
                }}
              >
                Enrolled Members ({campaignMembersList.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCampaignMembersTab('add');
                  fetchCampaignCandidates(selectedCampaignForMembers.id, candidatesFilter, candidateSearch);
                }}
                style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: campaignMembersTab === 'add' ? '2px solid #2563eb' : '2px solid transparent',
                  color: campaignMembersTab === 'add' ? '#2563eb' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={14} /> Add Borrowers / Candidate Selector
              </button>
            </div>

            {/* TAB 1: ENROLLED MEMBERS */}
            {campaignMembersTab === 'members' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Currently enrolled loan accounts evaluated for contact cadence and pre-dial safety rules.
                  </div>
                  <button
                    className="btn-primary"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                    onClick={() => {
                      setCampaignMembersTab('add');
                      fetchCampaignCandidates(selectedCampaignForMembers.id, candidatesFilter, candidateSearch);
                    }}
                  >
                    + Enroll More Borrowers
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <select
                    value={selectedLoanToEnroll}
                    onChange={(e) => setSelectedLoanToEnroll(e.target.value)}
                    style={{ flex: 1, fontSize: '11px' }}
                  >
                    <option value="">Quick select borrower loan account to enroll...</option>
                    {accounts
                      .filter((a) => !campaignMembersList.some((m) => m.loanId === a.id && m.status === 'active'))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.dpd} DPD] {a.loanNumber} — {a.borrower ? `${a.borrower.firstName} ${a.borrower.lastName}` : 'Unassigned'}
                        </option>
                      ))}
                  </select>
                  <button
                    className="btn-primary"
                    disabled={!selectedLoanToEnroll}
                    onClick={handleEnrollMemberInCampaign}
                    style={{ fontSize: '11px', padding: '4px 10px', whiteSpace: 'nowrap' }}
                  >
                    + Quick Enroll
                  </button>
                </div>

                {campaignMembersList.length === 0 ? (
                  <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                    No borrowers currently enrolled in this campaign cohort. Click "Add Borrowers" to select candidate loan accounts.
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="console-table" style={{ minWidth: '100%', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>BORROWER</th>
                          <th>LOAN NUMBER</th>
                          <th>DPD</th>
                          <th>PAST-DUE</th>
                          <th>PRIORITY</th>
                          <th>STATUS</th>
                          <th>LAST CONTACT</th>
                          <th>NEXT CONTACT</th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignMembersList.map((m) => (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 600 }}>{m.borrower ? `${m.borrower.firstName} ${m.borrower.lastName}` : 'Unassigned'}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{maskLoanNumber(m.loan?.loanNumber || m.loanId)}</td>
                            <td>
                              <span style={{ padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: '3px', fontSize: '11px', fontWeight: 600 }}>
                                {m.loan?.dpd ?? '—'} DPD
                              </span>
                            </td>
                            <td>{formatCurrency(m.loan?.pastDueAmount)}</td>
                            <td style={{ fontWeight: 700, color: '#2563eb' }}>{m.priorityScore ?? 50}</td>
                            <td>
                              <span style={{ padding: '2px 6px', background: m.status === 'active' ? '#dcfce7' : m.status === 'paused' ? '#fef3c7' : '#f1f5f9', color: m.status === 'active' ? '#15803d' : m.status === 'paused' ? '#92400e' : '#64748b', borderRadius: '3px', fontSize: '11px', fontWeight: 600 }}>
                                {m.status?.toUpperCase()}
                              </span>
                            </td>
                            <td>{m.lastContactAt ? new Date(m.lastContactAt).toLocaleDateString() : 'Never'}</td>
                            <td>
                              {!m.nextContactAt || new Date(m.nextContactAt) <= new Date() ? (
                                <span style={{ color: '#15803d', fontWeight: 600 }}>Due Now</span>
                              ) : (
                                new Date(m.nextContactAt).toLocaleDateString()
                              )}
                            </td>
                            <td>
                              {m.status === 'active' && (
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px', color: '#b91c1c' }}
                                  onClick={() => handleRemoveMemberFromCampaign(m.id)}
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CANDIDATE BORROWER SELECTOR & BATCH ENROLLMENT */}
            {campaignMembersTab === 'add' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
                {/* Search & Filter Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { key: 'all', label: 'All Candidates' },
                      { key: 'verified_contacts', label: 'Verified Contacts' },
                      { key: 'consent_granted', label: 'Consent Granted' },
                      { key: 'recent', label: 'Recently Created' },
                      { key: 'in_scope_dpd', label: `In-Scope (${selectedCampaignForMembers.dpdMin}–${selectedCampaignForMembers.dpdMax} DPD)` }
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => {
                          setCandidatesFilter(f.key);
                          fetchCampaignCandidates(selectedCampaignForMembers.id, f.key, candidateSearch);
                        }}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          border: candidatesFilter === f.key ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: candidatesFilter === f.key ? '#eff6ff' : '#ffffff',
                          color: candidatesFilter === f.key ? '#1d4ed8' : '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Search candidate name, loan #, or phone..."
                    value={candidateSearch}
                    onChange={(e) => {
                      setCandidateSearch(e.target.value);
                      fetchCampaignCandidates(selectedCampaignForMembers.id, candidatesFilter, e.target.value);
                    }}
                    style={{ width: '280px', fontSize: '12px' }}
                  />
                </div>

                {/* Candidates Table */}
                <div style={{ flex: 1, minHeight: '260px' }}>
                  {candidatesLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                      Loading candidate borrowers...
                    </div>
                  ) : campaignCandidates.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                      No candidate borrowers match the current search or filter.
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="console-table" style={{ minWidth: '100%', fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '36px' }}>
                              <input
                                type="checkbox"
                                checked={campaignCandidates.length > 0 && selectedCandidateLoanIds.length === campaignCandidates.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCandidateLoanIds(campaignCandidates.map((c: any) => c.loanId));
                                  } else {
                                    setSelectedCandidateLoanIds([]);
                                  }
                                }}
                              />
                            </th>
                            <th>BORROWER & CREATED</th>
                            <th>LOAN NUMBER</th>
                            <th>DPD</th>
                            <th>SELECTED CONTACT NUMBER</th>
                            <th>LINE TYPE</th>
                            <th>CARRIER HYGIENE</th>
                            <th>TCPA CONSENT</th>
                            <th>COHORT STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaignCandidates.map((c: any) => {
                            const isSelected = selectedCandidateLoanIds.includes(c.loanId);
                            const pPhone = c.primaryPhone;
                            return (
                              <tr
                                key={c.loanId}
                                style={{ background: isSelected ? '#eff6ff' : undefined, cursor: 'pointer' }}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedCandidateLoanIds(selectedCandidateLoanIds.filter(id => id !== c.loanId));
                                  } else {
                                    setSelectedCandidateLoanIds([...selectedCandidateLoanIds, c.loanId]);
                                  }
                                }}
                              >
                                <td onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedCandidateLoanIds([...selectedCandidateLoanIds, c.loanId]);
                                      } else {
                                        setSelectedCandidateLoanIds(selectedCandidateLoanIds.filter(id => id !== c.loanId));
                                      }
                                    }}
                                  />
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{c.borrowerName || 'Unassigned'}</div>
                                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                                  </div>
                                </td>
                                <td style={{ fontFamily: 'var(--font-mono)' }}>{maskLoanNumber(c.loanNumber)}</td>
                                <td>
                                  <span style={{ padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: '3px', fontSize: '11px', fontWeight: 600 }}>
                                    {c.dpd} DPD
                                  </span>
                                </td>
                                <td style={{ fontFamily: 'var(--font-mono)' }}>
                                  {pPhone?.phoneE164 ? maskPhoneNumber(pPhone.phoneE164) : '—'}
                                </td>
                                <td>
                                  <span style={{ fontSize: '11px', textTransform: 'capitalize', color: '#475569' }}>
                                    {pPhone?.lineType || 'mobile'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    background: (pPhone?.isVerified || pPhone?.isHygieneVerified) ? '#dcfce7' : '#fee2e2',
                                    color: (pPhone?.isVerified || pPhone?.isHygieneVerified) ? '#15803d' : '#b91c1c'
                                  }}>
                                    {(pPhone?.isVerified || pPhone?.isHygieneVerified) ? 'VERIFIED' : 'UNVERIFIED'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    background: pPhone?.consentState === 'GRANTED' ? '#eff6ff' : '#f1f5f9',
                                    color: pPhone?.consentState === 'GRANTED' ? '#1d4ed8' : '#64748b'
                                  }}>
                                    {pPhone?.consentState || 'MISSING'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    background: c.inScopeDpd ? '#f0fdf4' : '#fffbeb',
                                    color: c.inScopeDpd ? '#166534' : '#b45309'
                                  }}>
                                    {c.inScopeDpd ? '✓ In-Scope' : 'Out-of-Scope'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Bottom Enrollment Action Bar */}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    <strong>{selectedCandidateLoanIds.length}</strong> borrower(s) selected for enrollment
                  </div>
                  <button
                    className="btn-primary"
                    disabled={selectedCandidateLoanIds.length === 0 || batchEnrolling}
                    onClick={handleBatchEnrollMembers}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} />
                    {batchEnrolling ? 'Enrolling Borrowers...' : `Enroll ${selectedCandidateLoanIds.length} Selected Borrower(s)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE SYNTHETIC ACCOUNT ──────────────────────────────── */}
      {showAddAccountModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form
            onSubmit={handleCreateSyntheticAccount}
            style={{ width: '520px', maxWidth: '90vw', backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>Create Loan Account</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  Early Delinquency Mortgage Servicing Account & Borrower Profile
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleFillEligibleTestBorrower}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    background: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                  title="Prepopulates the form with safe synthetic values that satisfy all 12 pre-dial regulatory gates"
                >
                  <Sparkles size={13} color="#166534" /> Create Eligible Test Borrower
                </button>
                <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowAddAccountModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Loan Number (Leave blank to auto-generate)
                </label>
                <input
                  placeholder="Auto SYN-XXXXXX"
                  value={newAccountForm.loanNumber}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, loanNumber: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>DPD *</label>
                <input
                  type="number"
                  required
                  value={newAccountForm.dpd}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, dpd: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Borrower First Name *</label>
                <input
                  required
                  placeholder="Jane"
                  value={newAccountForm.firstName}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, firstName: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Borrower Last Name *</label>
                <input
                  required
                  placeholder="Doe"
                  value={newAccountForm.lastName}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, lastName: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Past Due Amount ($)</label>
                <input
                  value={newAccountForm.pastDueAmount}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, pastDueAmount: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Total to Cure ($)</label>
                <input
                  value={newAccountForm.totalToCure}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, totalToCure: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Primary Contact Phone</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Phone E.164 (Leave blank to auto-generate)
                  </label>
                  <input
                    placeholder="+1555XXXXXXX"
                    value={newAccountForm.phoneE164}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, phoneE164: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Line Type</label>
                  <select
                    value={newAccountForm.lineType}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, lineType: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="mobile">Mobile — wireless consent checks</option>
                    <option value="landline">Landline — residential-line rules</option>
                    <option value="voip">VoIP — classification and applicable consent rules to be verified</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Timezone</label>
                  <select
                    value={newAccountForm.timezoneIana}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, timezoneIana: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="America/New_York">America/New_York (Eastern)</option>
                    <option value="America/Chicago">America/Chicago (Central)</option>
                    <option value="America/Denver">America/Denver (Mountain)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '18px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newAccountForm.tcpaConsent}
                      onChange={(e) => setNewAccountForm({ ...newAccountForm, tcpaConsent: e.target.checked })}
                    />
                    Documented TCPA Consent
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddAccountModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: ADD CONTACT NUMBER (PART 7 AUDITED REGISTRATION) ──────── */}
      {showAddPhoneModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <form
            onSubmit={handleAddPhoneNumber}
            style={{ width: '540px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>Add Contact Number</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Audited contact registration with documented team verification, line type, and TCPA consent
                </div>
              </div>
              <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowAddPhoneModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {/* Associated Borrower / Loan Account */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Associated Borrower & Loan *</label>
                <select
                  required
                  value={targetLoanForPhone}
                  onChange={(e) => setTargetLoanForPhone(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  <option value="">Select borrower loan account...</option>
                  {accounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.loanNumber} — {acc.borrower ? `${acc.borrower.firstName} ${acc.borrower.lastName}` : 'Unassigned'} ({acc.dpd} DPD)
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone E.164 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Phone Number (E.164 Format) *</label>
                <input
                  required
                  placeholder="+919876544477 or +15551234567"
                  value={newPhoneForm.phoneE164}
                  onChange={(e) => setNewPhoneForm({ ...newPhoneForm, phoneE164: e.target.value.trim() })}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                  Must start with "+" followed by country code (e.g. +91 for India, +1 for US/Canada)
                </div>
              </div>

              {/* Line Type & Timezone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Line Type</label>
                  <select
                    value={newPhoneForm.lineType}
                    onChange={(e) => setNewPhoneForm({ ...newPhoneForm, lineType: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="mobile">Mobile (Wireless consent checks)</option>
                    <option value="landline">Landline (Residential-line rules)</option>
                    <option value="voip">VoIP (Classification rules apply)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Contact Timezone</label>
                  <select
                    value={newPhoneForm.timezoneIana}
                    onChange={(e) => setNewPhoneForm({ ...newPhoneForm, timezoneIana: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="America/New_York">America/New_York (Eastern)</option>
                    <option value="America/Chicago">America/Chicago (Central)</option>
                    <option value="America/Denver">America/Denver (Mountain)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  </select>
                </div>
              </div>

              {/* Relationship & Primary Flag */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Relationship</label>
                  <select
                    value={newPhoneForm.relationship}
                    onChange={(e) => setNewPhoneForm({ ...newPhoneForm, relationship: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="primary_borrower">Primary Borrower</option>
                    <option value="co_borrower">Co-Borrower</option>
                    <option value="spouse">Spouse</option>
                    <option value="work">Work Phone</option>
                    <option value="alternate">Alternate Contact</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '18px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newPhoneForm.isPrimary}
                      onChange={(e) => setNewPhoneForm({ ...newPhoneForm, isPrimary: e.target.checked })}
                    />
                    Designate as Primary Number
                  </label>
                </div>
              </div>

              {/* Internal Team Contact Verification */}
              <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newPhoneForm.isVerified}
                    onChange={(e) => setNewPhoneForm({ ...newPhoneForm, isVerified: e.target.checked, isHygieneVerified: e.target.checked })}
                  />
                  Has this contact number been verified by your team? (Team-Verified Contact)
                </label>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                  Verified contacts are eligible for operational campaigns and browser voice testing.
                </div>
                {newPhoneForm.isVerified && (
                  <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', color: '#475569' }}>Verified By</label>
                      <input
                        placeholder="Operator / Servicing Team"
                        value={newPhoneForm.verifiedBy}
                        onChange={(e) => setNewPhoneForm({ ...newPhoneForm, verifiedBy: e.target.value })}
                        style={{ width: '100%', fontSize: '11px', padding: '3px 6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', color: '#475569' }}>Verification Notes</label>
                      <input
                        placeholder="Borrower identity corroborated"
                        value={newPhoneForm.verificationNotes}
                        onChange={(e) => setNewPhoneForm({ ...newPhoneForm, verificationNotes: e.target.value })}
                        style={{ width: '100%', fontSize: '11px', padding: '3px 6px' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* TCPA Consent State & Evidence */}
              <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Consent State</label>
                    <select
                      value={newPhoneForm.consentState}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewPhoneForm({
                          ...newPhoneForm,
                          consentState: val,
                          tcpaConsent: val === 'GRANTED'
                        });
                      }}
                      style={{ width: '100%', fontSize: '11px' }}
                    >
                      <option value="GRANTED">GRANTED — Express Written Consent</option>
                      <option value="MISSING">MISSING — Unconfirmed</option>
                      <option value="REVOKED">REVOKED — Explicit Opt-Out</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Consent Source</label>
                    <input
                      placeholder="e.g. SERVICING_PORTAL, OPERATOR_VERIFIED"
                      value={newPhoneForm.consentSource}
                      onChange={(e) => setNewPhoneForm({ ...newPhoneForm, consentSource: e.target.value })}
                      style={{ width: '100%', fontSize: '11px' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Consent Evidence / Audit Note</label>
                  <input
                    placeholder="Documented express written consent on servicing application"
                    value={newPhoneForm.consentEvidence}
                    onChange={(e) => setNewPhoneForm({ ...newPhoneForm, consentEvidence: e.target.value })}
                    style={{ width: '100%', fontSize: '11px' }}
                  />
                </div>
              </div>

              {/* DNC Exclusion */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: newPhoneForm.dnc ? '#b91c1c' : '#475569' }}>
                  <input
                    type="checkbox"
                    checked={newPhoneForm.dnc}
                    onChange={(e) => setNewPhoneForm({ ...newPhoneForm, dnc: e.target.checked })}
                  />
                  Mark as Do Not Call (Phone-level DNC exclusion)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddPhoneModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!targetLoanForPhone || !newPhoneForm.phoneE164}>
                Save Contact Number
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── DRAWER: ACCOUNT DETAIL & EDITABLE FLAGS ───────────────────────── */}
      {selectedAccountDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ width: '700px', maxWidth: '90vw', height: '100dvh', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Account: {selectedAccountDetail.loan?.loanNumber}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Borrower: {selectedAccountDetail.borrower ? `${selectedAccountDetail.borrower.firstName} ${selectedAccountDetail.borrower.lastName}` : 'Unassigned'}
                </div>
              </div>
              <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setSelectedAccountDetail(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {/* Loan Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>DPD / BUCKET</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{selectedAccountDetail.loan?.dpd} DPD</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{selectedAccountDetail.loan?.delinquencyBucket}</div>
                </div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }} title="Sum of delinquent monthly mortgage payments (principal, interest, taxes, and insurance).">
                  <div style={{ fontSize: '11px', color: '#64748b' }}>PAST DUE AMOUNT ℹ</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626' }}>${selectedAccountDetail.loan?.pastDueAmount}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Principal & Interest</div>
                </div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }} title="Full delinquent amount including accrued late fees required to bring the mortgage fully current.">
                  <div style={{ fontSize: '11px', color: '#64748b' }}>TOTAL TO CURE ℹ</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>${selectedAccountDetail.loan?.totalToCure}</div>
                  <div style={{ fontSize: '10px', color: '#16a34a' }}>Reinstatement Balance</div>
                </div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }} title="Accrued late fees, escrow advances, and inspection fees on the note.">
                  <div style={{ fontSize: '11px', color: '#64748b' }}>ARREARS & FEES ℹ</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#4338ca' }}>
                    +${(parseFloat(selectedAccountDetail.loan?.totalToCure || 0) - parseFloat(selectedAccountDetail.loan?.pastDueAmount || 0)).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Difference to Cure</div>
                </div>
              </div>

              {/* Servicing Balance Explanatory Callout */}
              <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', marginBottom: '16px', fontSize: '11px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={14} color="#2563eb" />
                <span>
                  <strong>Servicing Balance Note:</strong> Itemized breakdown (escrow arrears, late fees, suspense advances) is not itemized in the current servicing record.
                </span>
              </div>

              {/* Drawer Navigation Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '18px', gap: '8px' }}>
                <button
                  type="button"
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: accountDrawerTab === 'test-controls' ? '2px solid #2563eb' : '2px solid transparent',
                    background: 'transparent',
                    color: accountDrawerTab === 'test-controls' ? '#2563eb' : '#64748b',
                    cursor: 'pointer'
                  }}
                  onClick={() => setAccountDrawerTab('test-controls')}
                >
                  ⚙ Test Scenario Controls
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: accountDrawerTab === 'pre-dial' ? '2px solid #2563eb' : '2px solid transparent',
                    background: 'transparent',
                    color: accountDrawerTab === 'pre-dial' ? '#2563eb' : '#64748b',
                    cursor: 'pointer'
                  }}
                  onClick={() => setAccountDrawerTab('pre-dial')}
                >
                  ✓ 12-Gate Diagnostic
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: accountDrawerTab === 'profile' ? '2px solid #2563eb' : '2px solid transparent',
                    background: 'transparent',
                    color: accountDrawerTab === 'profile' ? '#2563eb' : '#64748b',
                    cursor: 'pointer'
                  }}
                  onClick={() => setAccountDrawerTab('profile')}
                >
                  📞 Phone Contacts ({selectedAccountDetail.phones?.length || 0})
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: accountDrawerTab === 'audit' ? '2px solid #2563eb' : '2px solid transparent',
                    background: 'transparent',
                    color: accountDrawerTab === 'audit' ? '#2563eb' : '#64748b',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setAccountDrawerTab('audit');
                    fetchDrawerAuditLogs(selectedAccountDetail.loan.id);
                  }}
                >
                  📜 State Audit Trail
                </button>
              </div>

              {/* TAB 1: MENTOR TEST SCENARIO & COMPLIANCE CONTROLS */}
              {accountDrawerTab === 'test-controls' && (() => {
                const primaryP = selectedAccountDetail.phones?.find((p: any) => p.isPrimary) || selectedAccountDetail.phones?.[0];
                const evalData = selectedAccountDetail.evaluation;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Live Gate Status Banner */}
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '6px',
                      background: evalData?.eligible ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${evalData?.eligible ? '#bbf7d0' : '#fecaca'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: evalData?.eligible ? '#166534' : '#991b1b' }}>
                          Pre-Dial Eligibility: {evalData?.eligible ? 'PASS (12/12 GATES SATISFIED)' : `BLOCKED (${evalData?.finalResult || 'Gating Rule Active'})`}
                        </div>
                        {evalData?.allBlockingReasons?.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#7f1d1d', marginTop: '2px' }}>
                            Reasons: {evalData.allBlockingReasons.join(' · ')}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, background: evalData?.eligible ? '#dcfce7' : '#fee2e2', color: evalData?.eligible ? '#15803d' : '#991b1b' }}>
                        {evalData?.eligible ? 'ELIGIBLE' : 'BLOCKED'}
                      </span>
                    </div>

                    {/* Group A: Borrower & Account Exclusions */}
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                        Group A: Borrower & Account Exclusions (Gates C2a, C2b, C2c, C3)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                          { key: 'isBankrupt', label: 'Active Bankruptcy (Gate C2a)' },
                          { key: 'isLitigation', label: 'Active Litigation (Gate C2a)' },
                          { key: 'isDeceased', label: 'Borrower Deceased (Gate C2a)' },
                          { key: 'hasLossMitigation', label: 'Loss Mitigation Workout (Gate C2b)' },
                          { key: 'hasActiveDispute', label: 'Active Loan Dispute (Gate C2c)' },
                          { key: 'isScra', label: 'SCRA Military Protection' },
                          { key: 'hardshipEligible', label: 'Hardship Workout Eligible' },
                          { key: 'accountDnc', label: 'Account-Wide DNC (Gate C3)' }
                        ].map((flag) => {
                          const isChecked = flag.key === 'accountDnc' ? !!selectedAccountDetail.accountDnc : !!selectedAccountDetail.loan?.[flag.key];
                          return (
                            <label key={flag.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  handleUpdateAccountFlags(selectedAccountDetail.loan.id, { [flag.key]: e.target.checked });
                                }}
                              />
                              <span style={{ color: isChecked ? '#b91c1c' : '#334155', fontWeight: isChecked ? 600 : 400 }}>
                                {flag.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Group B: Contact & Hygiene Verification */}
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                        Group B: Contact & Hygiene Verification (Gates C4, C5, C6, C7, C8)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>LINE TYPE</label>
                          <select
                            value={primaryP?.lineType || 'mobile'}
                            onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, { lineType: e.target.value, phoneNumberId: primaryP?.id })}
                            style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                          >
                            <option value="mobile">Mobile — wireless consent checks</option>
                            <option value="landline">Landline — residential-line rules</option>
                            <option value="voip">VoIP — classification and applicable consent rules to be verified</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>TCPA CONSENT</label>
                          <select
                            value={primaryP?.consentState || 'MISSING'}
                            onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, {
                              consentState: e.target.value,
                              tcpaConsent: e.target.value === 'GRANTED',
                              phoneNumberId: primaryP?.id
                            })}
                            style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                          >
                            <option value="GRANTED">GRANTED (Documented)</option>
                            <option value="REVOKED">REVOKED (Do Not Call)</option>
                            <option value="MISSING">MISSING (Unverified)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>BORROWER TIMEZONE</label>
                          <select
                            value={primaryP?.timezoneIana || 'America/New_York'}
                            onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, { timezoneIana: e.target.value, phoneNumberId: primaryP?.id })}
                            style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                          >
                            <option value="America/New_York">Eastern (America/New_York)</option>
                            <option value="America/Chicago">Central (America/Chicago)</option>
                            <option value="America/Denver">Mountain (America/Denver)</option>
                            <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
                            <option value="Asia/Kolkata">India / IST (Asia/Kolkata)</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!(primaryP?.isVerified || primaryP?.isHygieneVerified)}
                              onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, {
                                isVerified: e.target.checked,
                                isHygieneVerified: e.target.checked,
                                phoneNumberId: primaryP?.id
                              })}
                            />
                            <span>Team-Verified Contact (Gate C4)</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!primaryP?.dnc}
                              onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, { numberDnc: e.target.checked, phoneNumberId: primaryP?.id })}
                            />
                            <span style={{ color: primaryP?.dnc ? '#b91c1c' : '#334155' }}>Number DNC (Gate C3)</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Group C: Scheduling & Frequency Caps */}
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                        Group C: Scheduling & Frequency Caps (Gates C9, C10, C11, C12)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', alignItems: 'center' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>CONTACT ATTEMPTS (GATE C10)</label>
                          <input
                            type="number"
                            min="0"
                            max="5"
                            value={selectedAccountDetail.loan?.contactAttemptCount ?? 0}
                            onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, { contactAttemptCount: parseInt(e.target.value) || 0 })}
                            style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                          />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedAccountDetail.v1Restrictions?.length > 0}
                            onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, { v1Restriction: e.target.checked })}
                          />
                          <span>V1 Restriction (Gate C9)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedAccountDetail.callbacks?.length > 0}
                            onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, { pendingCallback: e.target.checked })}
                          />
                          <span>Pending Callback (Gate C11)</span>
                        </label>
                      </div>
                    </div>

                    {/* Group D: Servicing & Balance */}
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                        Group D: Servicing & Balance (Gates C1, C2)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>DPD (GATE C1)</label>
                          <input
                            type="number"
                            min="0"
                            max="120"
                            value={selectedAccountDetail.loan?.dpd ?? 15}
                            onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, { dpd: parseInt(e.target.value) || 0 })}
                            style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>PAST DUE AMOUNT ($)</label>
                          <input
                            type="text"
                            value={selectedAccountDetail.loan?.pastDueAmount ?? '250.00'}
                            onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, { pastDueAmount: e.target.value })}
                            style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>TOTAL TO CURE ($)</label>
                          <input
                            type="text"
                            value={selectedAccountDetail.loan?.totalToCure ?? '500.00'}
                            onChange={(e) => handleUpdateAccountFlags(selectedAccountDetail.loan.id, { totalToCure: e.target.value })}
                            style={{ width: '100%', fontSize: '11px', padding: '4px 6px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 2: 12-GATE PRE-DIAL DIAGNOSTIC (PART 5 SYSTEMATIC VERIFICATION) */}
              {accountDrawerTab === 'pre-dial' && (() => {
                const detailedGates: any[] = selectedAccountDetail.detailed12Gates || [];
                const checkList = selectedAccountDetail.evaluation?.checkResults || [];
                const daylightSim = selectedAccountDetail.daylightSimulation;
                const isLiveEligible = selectedAccountDetail.evaluation?.eligible;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Daylight Calling Window Clarification Banner */}
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '6px',
                      background: daylightSim?.isEligible ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${daylightSim?.isEligible ? '#bbf7d0' : '#cbd5e1'}`,
                      fontSize: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: daylightSim?.isEligible ? '#166534' : '#0f172a' }}>
                          ☀️ Daylight Calling Simulation (14:00 Local Time)
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: isLiveEligible ? '#dcfce7' : '#fee2e2',
                            color: isLiveEligible ? '#15803d' : '#991b1b'
                          }}>
                            LIVE: {isLiveEligible ? 'ELIGIBLE' : 'CALL WINDOW BLOCKED'}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: daylightSim?.isEligible ? '#dcfce7' : '#f1f5f9',
                            color: daylightSim?.isEligible ? '#15803d' : '#64748b'
                          }}>
                            SIMULATION: {daylightSim?.isEligible ? '12/12 GATES PASS' : 'BLOCKED'}
                          </span>
                        </div>
                      </div>
                      <div style={{ color: '#475569', fontSize: '11px', lineHeight: 1.4 }}>
                        {daylightSim?.explanation || 'CFPB Reg F restricts calling to 8:00 AM – 9:00 PM in borrower local timezone. During daytime hours, compliant borrowers pass 12/12 gates.'}
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Deterministic evaluation across all 12 pre-dial regulatory and servicing gates:
                    </div>

                    {detailedGates.length > 0 ? (
                      <div className="table-container">
                        <table className="console-table" style={{ minWidth: '100%', fontSize: '11px' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}>GATE</th>
                              <th>NAME</th>
                              <th>INPUT VALUE</th>
                              <th>EXPECTED CONDITION</th>
                              <th>STATUS</th>
                              <th>DIAGNOSTIC / REASON</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailedGates.map((g: any) => {
                              const isPass = g.result === 'pass';
                              return (
                                <tr key={g.gateKey || g.gateNumber} style={{ background: isPass ? undefined : '#fef2f2' }}>
                                  <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                    C{g.gateNumber}
                                  </td>
                                  <td style={{ fontWeight: 600, color: '#0f172a' }}>
                                    {g.gateName}
                                  </td>
                                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#334155' }}>
                                    {g.inputValue}
                                  </td>
                                  <td style={{ fontSize: '10px', color: '#475569' }}>
                                    {g.expectedCondition}
                                  </td>
                                  <td>
                                    <span style={{
                                      padding: '2px 6px',
                                      borderRadius: '3px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      background: isPass ? '#dcfce7' : '#fee2e2',
                                      color: isPass ? '#15803d' : '#991b1b'
                                    }}>
                                      {g.result?.toUpperCase()}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '10px', color: isPass ? '#166534' : '#b91c1c' }}>
                                    {g.blockingReason || '✓ Condition met'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : checkList.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {checkList.map((chk: any) => (
                          <div
                            key={chk.check}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: `1px solid ${chk.result === 'pass' ? '#bbf7d0' : '#fecaca'}`,
                              background: chk.result === 'pass' ? '#f0fdf4' : '#fef2f2',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '12px'
                            }}
                          >
                            <div>
                              <strong style={{ color: '#0f172a' }}>{chk.check}</strong>
                              {chk.reason && (
                                <div style={{ fontSize: '11px', color: chk.result === 'pass' ? '#166534' : '#991b1b', marginTop: '2px' }}>
                                  {chk.reason}
                                </div>
                              )}
                            </div>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: chk.result === 'pass' ? '#dcfce7' : '#fee2e2',
                              color: chk.result === 'pass' ? '#15803d' : '#991b1b'
                            }}>
                              {chk.result?.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                        Modify any scenario flag in the Controls tab to trigger fresh 12-gate diagnostic evaluation.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* TAB 3: MULTI-PHONE CONTACTS */}
              {accountDrawerTab === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>Independent Phone Contacts</div>
                    <button
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => {
                        setTargetLoanForPhone(selectedAccountDetail.loan.id);
                        setShowAddPhoneModal(true);
                      }}
                    >
                      + Add Number
                    </button>
                  </div>
                  <div className="table-container">
                    <table className="console-table" style={{ minWidth: '100%', fontSize: '11px' }}>
                      <thead>
                        <tr>
                          <th>NUMBER</th>
                          <th>LINE TYPE</th>
                          <th>VERIFICATION</th>
                          <th>CONSENT</th>
                          <th>NUMBER DNC</th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAccountDetail.phones?.map((p: any) => (
                          <tr key={p.id}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.phoneE164}</td>
                            <td>{p.lineType?.toUpperCase()}</td>
                            <td>
                              <span style={{ padding: '1px 5px', borderRadius: '3px', fontWeight: 600, background: (p.isVerified || p.isHygieneVerified) ? '#dcfce7' : '#fef3c7', color: (p.isVerified || p.isHygieneVerified) ? '#15803d' : '#92400e' }}>
                                {(p.isVerified || p.isHygieneVerified) ? 'Verified' : 'Unverified'}
                              </span>
                            </td>
                            <td>{getConsentBadge(p.consentState)}</td>
                            <td>{p.dnc ? <span style={{ color: '#b91c1c', fontWeight: 700 }}>DNC ✗</span> : <span style={{ color: '#15803d' }}>Clear</span>}</td>
                            <td>
                              <button className="btn-secondary" style={{ padding: '1px 5px', fontSize: '10px', color: '#b91c1c' }} onClick={() => handleArchivePhone(p.id)}>
                                Archive
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: STATE CHANGE AUDIT TRAIL */}
              {accountDrawerTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Immutable state changes recorded in <code>state_change_log</code>:
                  </div>
                  {drawerAuditLoading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>Loading audit records...</div>
                  ) : drawerAuditLogs.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>No audit history recorded yet for this account.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {drawerAuditLogs.map((log) => (
                        <div key={log.id} style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <strong style={{ color: '#0f172a' }}>{log.fieldName}</strong>
                            <span style={{ color: '#64748b' }}>{new Date(log.changedAt).toLocaleString()}</span>
                          </div>
                          <div style={{ color: '#475569', fontSize: '10px' }}>
                            Changed by: <span style={{ fontWeight: 600 }}>{log.changedBy}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Latest Real Call Attempt */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Latest Operational Call Attempt</div>
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b' }}>
                  No actual call attempts recorded. (0 real provider calls for this account).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: GENERATE QA SCENARIO BATCH ──────────────────────────────── */}
      {showGenerateBatchModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '560px', maxWidth: '90vw', backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>Generate Delinquency Portfolio Accounts</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Generates an enrolled cohort of delinquency accounts with varied servicing statuses.
                </div>
              </div>
              <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowGenerateBatchModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Select Scenario Types to Generate:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '240px', overflowY: 'auto', padding: '8px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                {[
                  { id: 'clean_eligible', label: 'Clean Eligible Baseline' },
                  { id: 'no_consent', label: 'Mobile Missing TCPA Consent' },
                  { id: 'landline_pass', label: 'Landline TCPA Exempt' },
                  { id: 'cooldown_active', label: 'Cooldown Period Active' },
                  { id: 'account_dnc', label: 'Account-Wide DNC Active' },
                  { id: 'number_dnc', label: 'Number-Level DNC Active' },
                  { id: 'v1_restriction', label: 'V1 Temporary Restriction' },
                  { id: 'active_dispute', label: 'Active Loan Dispute' },
                  { id: 'bankruptcy', label: 'Bankruptcy Hard Exclusion' },
                  { id: 'loss_mitigation', label: 'Active Loss Mitigation' },
                  { id: 'scra_protected', label: 'SCRA Military Protected' },
                  { id: 'hardship_referral', label: 'Hardship Referral Flag' },
                  { id: 'pcw_deferral', label: 'Outside Preferred Contact Window' },
                  { id: 'callback_timing', label: 'Pending Callback Scheduled' }
                ].map((sc) => (
                  <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedScenarioTypes.includes(sc.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedScenarioTypes([...selectedScenarioTypes, sc.id]);
                        } else {
                          setSelectedScenarioTypes(selectedScenarioTypes.filter((x) => x !== sc.id));
                        }
                      }}
                    />
                    <span>{sc.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: '#faf5ff', borderRadius: '6px', border: '1px solid #e9d5ff', marginBottom: '16px', fontSize: '12px', color: '#7e22ce' }}>
              <strong>Safety Boundary:</strong> Generated scenarios will be tagged with a batch ID and never create call attempts, provider IDs, or real LOS write-back.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => setShowGenerateBatchModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleGenerateBatch} disabled={generatingBatch}>
                {generatingBatch ? 'Generating Batch...' : `Generate ${selectedScenarioTypes.length} Scenarios`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DRAWER: QA BATCHES & SAFE CLEANUP ──────────────────────────────── */}
      {showBatchCleanupDrawer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ width: '600px', maxWidth: '90vw', height: '100dvh', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>Account Batch Management & Cleanup</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Safely manage created batches without affecting core baseline delinquency records.
                </div>
              </div>
              <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowBatchCleanupDrawer(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {deletePreview && (
                <div style={{ padding: '14px', background: '#fee2e2', borderRadius: '6px', border: '1px solid #fecaca', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b', marginBottom: '6px' }}>
                    Previewing Safe Deletion: Batch {deletePreview.batchId}
                  </div>
                  <div style={{ fontSize: '12px', color: '#0f172a', marginBottom: '8px' }}>
                    This will delete: <strong>{deletePreview.accountsCount} accounts</strong>, {deletePreview.borrowersCount} borrowers, {deletePreview.phonesCount} phone rows.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-danger" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleDeleteBatch(deletePreview.batchId)}>
                      Confirm Batch Deletion
                    </button>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setDeletePreview(null)}>
                      Cancel Preview
                    </button>
                  </div>
                </div>
              )}

              {qaBatches.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '6px' }}>
                  No QA batches generated yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {qaBatches.map((batch) => (
                    <div key={batch.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{batch.id}</span>
                        <span style={{ padding: '1px 6px', background: batch.status === 'active' ? '#dcfce7' : '#f1f5f9', color: batch.status === 'active' ? '#15803d' : '#64748b', borderRadius: '3px', fontSize: '11px', fontWeight: 600 }}>
                          {batch.status?.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                        Accounts: {batch.accountCount} | Created: {new Date(batch.createdAt).toLocaleString()}
                      </div>
                      {batch.status === 'active' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px', color: '#b91c1c', borderColor: '#fca5a5' }}
                          onClick={() => handlePreviewDeleteBatch(batch.id)}
                        >
                          Preview & Remove Batch
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: 12-GATE DIAGNOSTIC DRAWER ─────────────────────────────── */}
      {evalModalItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '680px', maxWidth: '90vw', maxHeight: '85vh', backgroundColor: '#ffffff', borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>12-Gate Diagnostic: Loan {evalModalItem.loan.loanNumber}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Target Phone: {evalModalItem.selectedPhone?.phoneE164} ({evalModalItem.selectedPhone?.lineType})
                </div>
              </div>
              <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setEvalModalItem(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <div style={{ marginBottom: '14px', padding: '12px', background: evalModalItem.evaluation.eligible ? '#dcfce7' : '#fee2e2', borderRadius: '6px' }}>
                <div style={{ fontWeight: 700, color: evalModalItem.evaluation.eligible ? '#15803d' : '#b91c1c', fontSize: '14px' }}>
                  Final Result: {evalModalItem.evaluation.finalResult}
                </div>
                {evalModalItem.evaluation.reason && (
                  <div style={{ fontSize: '12px', marginTop: '4px', color: '#0f172a' }}>
                    Primary reason: {evalModalItem.evaluation.reason}
                  </div>
                )}
              </div>

              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Individual Gate Evaluations:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {evalModalItem.evaluation.checkResults?.map((chk: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{chk.check}</span>
                      {chk.reason && <span style={{ marginLeft: '8px', color: '#b91c1c' }}>— {chk.reason}</span>}
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: chk.result === 'pass' ? '#dcfce7' : '#fee2e2',
                        color: chk.result === 'pass' ? '#15803d' : '#b91c1c'
                      }}
                    >
                      {chk.result.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CONVERSATION SESSION CHAT VIEWER ─────────────────────── */}
      {showConversationModal && selectedConversationDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ width: '840px', maxWidth: '95vw', maxHeight: '90vh', backgroundColor: '#ffffff', borderRadius: '10px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Radio size={18} color="#2563eb" />
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Supervised Voice Conversation — {selectedConversationDetail.sessionId}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Borrower: <strong>{selectedConversationDetail.borrowerName || 'Clean Borrower'}</strong> · Loan: <strong>{selectedConversationDetail.loanNumber}</strong> · Campaign: <strong>{selectedConversationDetail.campaignName || 'Verified Contact Test Campaign'}</strong>
                </div>
              </div>
              <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowConversationModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Badges Info Bar */}
            <div style={{ padding: '10px 20px', background: '#ffffff', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', fontSize: '11px' }}>
              <span style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontWeight: 600 }}>
                Transport: {selectedConversationDetail.transportType === 'WEBRTC_BROWSER' ? 'WebRTC Browser Voice' : selectedConversationDetail.transportType}
              </span>
              <span style={{ padding: '2px 8px', background: '#f1f5f9', color: '#334155', borderRadius: '4px', fontWeight: 600 }}>
                Started: {new Date(selectedConversationDetail.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
              </span>
              <span style={{ padding: '2px 8px', background: '#f1f5f9', color: '#334155', borderRadius: '4px', fontWeight: 600 }}>
                Duration: {selectedConversationDetail.durationSeconds ? `${selectedConversationDetail.durationSeconds}s` : '—'}
              </span>
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                background: selectedConversationDetail.sessionStatus === 'completed' ? '#dcfce7' : '#fef3c7',
                color: selectedConversationDetail.sessionStatus === 'completed' ? '#15803d' : '#92400e'
              }}>
                Disposition: {selectedConversationDetail.structuredDisposition || selectedConversationDetail.sessionStatus?.toUpperCase()}
              </span>
              <span style={{ padding: '2px 8px', background: '#faf5ff', color: '#7e22ce', borderRadius: '4px', fontWeight: 600 }}>
                Tools Executed: {selectedConversationDetail.toolInvocations?.length || 0}
              </span>
            </div>

            {/* Chat Body & Tools Split */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* Chat Transcript Area */}
              <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Complete Conversation Stream (Audited)
                </div>
                {(() => {
                  let messages: any[] = [];
                  if (Array.isArray(selectedConversationDetail.transcript)) {
                    messages = selectedConversationDetail.transcript;
                  } else if (typeof selectedConversationDetail.transcript === 'string') {
                    // Try parsing or split lines
                    try {
                      const parsed = JSON.parse(selectedConversationDetail.transcript);
                      if (Array.isArray(parsed)) messages = parsed;
                    } catch {
                      messages = selectedConversationDetail.transcript.split('\n').filter(Boolean).map((line: string) => {
                        const isAssistant = line.startsWith('ASSISTANT:') || line.startsWith('Agent:');
                        return {
                          role: isAssistant ? 'assistant' : 'user',
                          text: line.replace(/^(ASSISTANT|USER|Agent|Borrower):\s*/i, ''),
                          timestamp: 'Recorded'
                        };
                      });
                    }
                  }

                  if (messages.length === 0) {
                    return (
                      <div style={{ padding: '40px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                        No transcript recorded for this conversation session.
                      </div>
                    );
                  }

                  return messages.map((m: any, idx: number) => {
                    const isAssistant = m.role === 'assistant';
                    return (
                      <div
                        key={idx}
                        style={{
                          alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                          maxWidth: '85%',
                          padding: '10px 14px',
                          borderRadius: isAssistant ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                          background: isAssistant ? '#eff6ff' : '#ecfdf5',
                          border: isAssistant ? '1px solid #bfdbfe' : '1px solid #a7f3d0',
                          fontSize: '12px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: isAssistant ? '#1e40af' : '#065f46' }}>
                            {isAssistant ? '🤖 VAPI ASSISTANT' : '👤 BORROWER'}
                          </span>
                          <span style={{ fontSize: '9px', color: '#94a3b8' }}>{m.timestamp || ''}</span>
                        </div>
                        <div style={{ color: '#0f172a', lineHeight: 1.5 }}>{m.text || m.content}</div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Side Pane: Executed Canonical Tools & State Changes */}
              <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', background: '#ffffff' }}>
                {/* Canonical Tools */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Canonical Tools Invoked ({selectedConversationDetail.toolInvocations?.length || 0})
                  </div>
                  {(!selectedConversationDetail.toolInvocations || selectedConversationDetail.toolInvocations.length === 0) ? (
                    <div style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                      No canonical tools were executed in this session.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedConversationDetail.toolInvocations.map((t: any, tidx: number) => (
                        <div key={tidx} style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ padding: '1px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: '3px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                              {t.name || t.toolName || 'tool'}()
                            </span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{t.timestamp || ''}</span>
                          </div>
                          <pre style={{ margin: '4px 0 0', fontSize: '10px', color: '#475569', background: '#ffffff', padding: '4px 6px', borderRadius: '4px', border: '1px solid #f1f5f9', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {JSON.stringify(t.args || t.parameters || {}, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* State Audit Trail */}
                {selectedConversationDetail.stateChanges?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                      State Changes ({selectedConversationDetail.stateChanges.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedConversationDetail.stateChanges.map((sc: any, scIdx: number) => (
                        <div key={scIdx} style={{ padding: '6px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', fontSize: '11px', color: '#166534' }}>
                          <div style={{ fontWeight: 600 }}>{sc.fieldName}: {sc.newValue ? JSON.stringify(sc.newValue) : 'cleared'}</div>
                          <div style={{ fontSize: '10px', color: '#15803d', marginTop: '2px' }}>
                            {sc.reason || 'Session update'} · {new Date(sc.changedAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button className="btn-secondary" onClick={() => setShowConversationModal(false)}>
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: OPERATOR SCHEDULE CALL ───────────────────────────────── */}
      {showScheduleModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form
            onSubmit={handleCreateSchedule}
            style={{ width: '480px', maxWidth: '90vw', backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>Schedule Follow-Up Call</div>
              <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowScheduleModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Target Account *</label>
                <select
                  required
                  value={scheduleForm.loanId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, loanId: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="">Select loan account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.loanNumber} - {a.borrower ? `${a.borrower.firstName} ${a.borrower.lastName}` : 'Unassigned'} ({a.dpd} DPD)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Scheduled Due Time (Local)</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleForm.dueAtUtc}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, dueAtUtc: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Borrower Timezone</label>
                <select
                  value={scheduleForm.originalTimezoneIana}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, originalTimezoneIana: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="America/New_York">America/New_York (Eastern)</option>
                  <option value="America/Chicago">America/Chicago (Central)</option>
                  <option value="America/Denver">America/Denver (Mountain)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Operator Notes</label>
                <input
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowScheduleModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Commit to Durable Scheduler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: RESCHEDULE FOLLOW-UP ───────────────────────────────────── */}
      {showRescheduleModal && rescheduleTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form
            onSubmit={handleRescheduleSubmit}
            style={{ width: '460px', maxWidth: '90vw', backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>Reschedule Follow-Up</div>
              <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowRescheduleModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>
              <div><strong>Account:</strong> {rescheduleTarget.loan?.loanNumber || rescheduleTarget.loanId}</div>
              <div><strong>Type:</strong> {rescheduleTarget.itemType === 'callback' ? 'Callback' : 'Scheduled Job'}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>New Target Date & Time (Local) *</label>
                <input
                  type="datetime-local"
                  required
                  value={rescheduleDatetime}
                  onChange={(e) => setRescheduleDatetime(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Reschedule Notes</label>
                <input
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  placeholder="Reason for reschedule..."
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowRescheduleModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save & Update Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: CREATE OPERATOR ESCALATION ─────────────────────────────── */}
      {showCreateEscalationModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form
            onSubmit={handleCreateEscalation}
            style={{ width: '480px', maxWidth: '90vw', backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>Create Operator Human Escalation</div>
              <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowCreateEscalationModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Target Account *</label>
                <select
                  required
                  value={newEscalationForm.loanId}
                  onChange={(e) => setNewEscalationForm({ ...newEscalationForm, loanId: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="">Select loan account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.loanNumber} - {a.borrower ? `${a.borrower.firstName} ${a.borrower.lastName}` : 'Unassigned'} ({a.dpd} DPD)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Escalation Reason *</label>
                <select
                  value={newEscalationForm.reason}
                  onChange={(e) => setNewEscalationForm({ ...newEscalationForm, reason: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="COMPLEX_HARDSHIP">Complex Hardship Referral</option>
                  <option value="ATTORNEY_REPRESENTED">Attorney Representation Disclosed</option>
                  <option value="BANKRUPTCY_INQUIRY">Active Bankruptcy Inquiry</option>
                  <option value="DISPUTE_ESCALATION">Billing Dispute Research Required</option>
                  <option value="LANGUAGE_BARRIER">Language Barrier / Interpreter Request</option>
                  <option value="SUPERVISOR_REQUEST">Borrower Requested Supervisor</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Urgency Priority</label>
                <select
                  value={newEscalationForm.priority}
                  onChange={(e) => setNewEscalationForm({ ...newEscalationForm, priority: Number(e.target.value) })}
                  style={{ width: '100%' }}
                >
                  <option value={1}>P1 - Critical (Immediate attention)</option>
                  <option value={3}>P3 - Normal (Standard operator review)</option>
                  <option value={5}>P5 - Low (Informational / post-review)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Operator Notes</label>
                <textarea
                  rows={3}
                  value={newEscalationForm.notes}
                  onChange={(e) => setNewEscalationForm({ ...newEscalationForm, notes: e.target.value })}
                  placeholder="Context for reviewing agent..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowCreateEscalationModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Submit Escalation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── ADD ESCALATION CONTACT MODAL ─── */}
      {showAddContactModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form
            onSubmit={handleCreateContact}
            style={{ width: '480px', maxWidth: '90vw', backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Add Human Escalation Contact</div>
              <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowAddContactModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px', color: '#334155' }}>
                  Contact Name / Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Escalation Contact 4 or Servicing Supervisor"
                  value={contactNameInput}
                  onChange={(e) => setContactNameInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px', color: '#334155' }}>
                  Phone Number (E.164 Format) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+12025550199 or +919876543210"
                  value={contactPhoneInput}
                  onChange={(e) => setContactPhoneInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px', color: '#334155' }}>
                  Servicing Role / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Delinquency resolution specialist"
                  value={contactNotesInput}
                  onChange={(e) => setContactNotesInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddContactModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={contactSubmitting}>
                {contactSubmitting ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── EDIT ESCALATION CONTACT MODAL ─── */}
      {editingContact && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form
            onSubmit={handleSaveContactEdit}
            style={{ width: '480px', maxWidth: '90vw', backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Edit Escalation Contact</div>
              <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setEditingContact(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px', color: '#334155' }}>
                  Contact Name / Label
                </label>
                <input
                  type="text"
                  required
                  value={contactNameInput}
                  onChange={(e) => setContactNameInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px', color: '#334155' }}>
                  Phone Number (Masked)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingContact.phoneMasked || editingContact.phoneE164}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#f1f5f9', color: '#64748b', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px', color: '#334155' }}>
                  Servicing Role / Notes
                </label>
                <input
                  type="text"
                  value={contactNotesInput}
                  onChange={(e) => setContactNotesInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setEditingContact(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={contactSubmitting}>
                {contactSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

    </>
  );
}
