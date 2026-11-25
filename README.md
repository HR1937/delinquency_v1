# Early-Stage Delinquency AI Voice Agent — Operations & Development Guide

## Project Overview
This project is an **early-stage delinquency outbound AI voice agent PoC** (1–59 DPD) with an enterprise servicing workflow:
- **Backend:** Bun + Hono + TypeScript
- **Database:** PostgreSQL (with Drizzle ORM)
- **Voice AI:** Vapi API + Webhooks
- **Telephony & SMS:** Twilio Voice & Messaging API
- **Frontend Console:** React + Vite + TypeScript (Enterprise Servicing Console)

---

## 1. Quick Start

### Prerequisites
- [Bun](https://bun.sh/) `v1.3.14+`
- [Node.js](https://nodejs.org/) `v20+`
- PostgreSQL service running on `localhost:5432`

### Setup & Run
```bash
# 1. Install all monorepo dependencies
bun install

# 2. Configure .env (already populated with PoC credentials)
cp .env.example .env # (or inspect current .env)

# 3. Apply database schema and seed 30 test loan accounts
bun run --cwd apps/backend db:push --force
bun run --cwd apps/backend db:seed

# 4. Run automated test suite
bun test apps/backend/tests/unit/

# 5. Start backend development server (Port 3000)
bun run --cwd apps/backend dev

# 6. Start frontend operations console (Port 5173)
bun run --cwd apps/frontend dev
```

---

## 2. Pre-Dial Deterministic Eligibility Gate (12 Categories)
All 12 checks run deterministically before every dial:
1. `C1_CAMPAIGN_SCOPE`: 1–59 Days Past Due within active campaign parameters
2. `C2a_HARD_EXCLUSION`: Immediate block on Bankruptcy, Litigation, or Deceased
3. `C2b_LOSS_MITIGATION`: Excluded from early dialer; routed to Loss Mitigation queue
4. `C2c_ACTIVE_DISPUTE`: Automated contact suppressed; routed to human research
5. `C3_DNC`: Enforces both account-level and number-level Do-Not-Call suppression
6. `C4_PHONE_HYGIENE`: Requires validated line type and hygiene verification
7. `C5_TCPA_CONSENT`: Mobile autodial strictly requires documented express consent
8. `C6_TIMEZONE`: Verified IANA borrower timezone (fails closed if missing/invalid)
9. `C7_CALLING_WINDOW`: Legal calling window between 08:00 and 21:00 borrower local time
10. `C8_PREFERRED_CONTACT_WINDOW`: Respects borrower-requested contact windows
11. `C9_V1_RESTRICTIONS`: Temporal no-call restrictions captured from previous calls
12. `C10_COOLDOWN_CAPS`: Enforces minimum 4-hour cooldown and attempt caps (N=3)
13. `C11_CALLBACK`: Defers if a scheduled callback is pending in the future
14. `C12_CAPACITY`: Enforces pacing limits on concurrent calls

---

## 3. Synchronizing the Vapi Assistant Prompt
The versioned prompt is located at `docs/VAPI_SYSTEM_PROMPT.md`.
```bash
# Preview changes (Dry run)
bun run docs/scripts/sync-vapi-prompt.ts

# Apply changes to the live Vapi assistant (verified name: "Borrower Delinquency")
bun run docs/scripts/sync-vapi-prompt.ts --confirm
```

---

## 4. Safety Interlock
To protect against unauthorized outbound calls during testing:
- Outbound voice dials and SMS messages are restricted to `ALLOWED_TEST_DESTINATIONS` (`+919328234331`, `+916353191726`).
- Any attempt to dial an unverified number outside this allow-list fails immediately with `SAFETY_INTERLOCK`.
