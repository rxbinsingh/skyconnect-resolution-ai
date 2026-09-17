# SkyConnect ResolutionAI
### AIONOS Assignment 3 — Customer-Facing Resolution Agent (Airline Disruption)


---

## What This Is

Most chatbots answer questions. This is a **Disruption Resolution Platform** — a system that enforces policy consistency, generates compliance-ready audit trails, shows its reasoning at every step, and produces post-resolution analytics.

The same system that handles one customer can handle 300 simultaneously during a disruption event, with zero policy violations.

---

## The Real Problem It Solves

When a flight is cancelled or delayed, an airline faces 300 customers at once. The actual pain points:

| Problem | How this system solves it |
|---|---|
| Agents apply policy inconsistently | Policy grounding check on every turn — no hallucinated entitlements |
| No audit trail for disputes | Timestamped action receipts with policy citation for every action |
| Angry customers escalate unnecessarily | Sentiment classification drives tone — de-escalation before solution |
| Human agents get no context on handoff | Structured escalation brief generated automatically |
| No visibility across a disruption event | Supervisor dashboard with fleet-wide compliance scores |

---

## Architecture

### AI Pipeline (3 LLM calls per turn)

```
Customer message
      ↓
[Call 1] Sentiment Classifier
      → sentiment, intensity, tone recommendation, legal threat detection
      ↓
[Call 2] Reasoning Engine
      → customer identified, flight status, entitlements check,
        beyond-policy requests, policy grounding, actions to take
      ↓
Policy Grounding Check (deterministic — no LLM)
      → validates every proposed action against rules before responding
      ↓
[Call 3] Response Generator
      → tone-adjusted customer-facing message
      ↓
Compliance Scorer (deterministic)
      → per-resolution compliance score with per-action breakdown
```

Each call has a single responsibility. The reasoning trace is the actual decision process — not a post-hoc explanation.

### Stack

```
backend/
├── agent.py    — 3-call AI pipeline, all data, policy engine, audit trail
└── main.py     — FastAPI: /chat, /customers, /session, /supervisor, /health

frontend/
└── src/
    ├── App.tsx                      — 3-panel layout, session management
    └── components/
        ├── ChatPanel.tsx            — chat UI, sentiment badge, typing indicator
        ├── ActionLog.tsx            — live action receipts with policy citations
        ├── ReasoningTrace.tsx       — collapsible per-turn agent reasoning
        ├── EscalationCard.tsx       — structured human handoff brief
        └── SupervisorDashboard.tsx  — fleet view, auto-refreshes every 15s
```

**LLM:** Groq (Llama 3.3 70B) — free tier, sub-second inference  
**Frontend:** React 18 + TypeScript + Tailwind CSS + Vite  
**Backend:** FastAPI + Python 3.11+

---

## Run Locally (One Command Each)

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

---

## Scenarios Covered

### Scenario 1 — Priya Nair (Gold, SK4821X)
Flight SK-204 Delhi→Goa **CANCELLED**. Priya gets angry mid-conversation and demands a full cash refund + free business class upgrade on her return.

Agent correctly: offers refund ✅ | offers rebooking ✅ | declines business upgrade ❌ (not in policy) | stays empathetic throughout

### Scenario 2 — Arvind Kulkarni (Silver, TR1190B)  
Flight SK-118 Mumbai→Bengaluru **DELAYED 4h**. Arvind asks for hotel accommodation "since it's been such a long delay."

Agent correctly: issues meal voucher ✅ | issues lounge access ✅ | denies hotel ❌ (only >5h qualifies) | explains policy without being dismissive

### Scenario 3 — Meher Kaur (Platinum, WL7742)
Flight SK-305 Delhi→Hyderabad **DELAYED 6h**. Meher asks for a full night's hotel stay + wants to switch to a higher-fare flight (₹2,000 fare difference).

Agent correctly: issues meal voucher + lounge ✅ | arranges partial hotel stay ✅ | denies full night ❌ (policy: delayed hours only) | escalates fare waiver ⚠️ (>₹1,500 requires supervisor)

---

## Key Features

| Feature | Why it matters |
|---|---|
| **3-call AI pipeline** | Separates sensing, reasoning, and communication — a real agentic pattern |
| **Reasoning trace toggle** | Shows the agent's decision process — not just the output |
| **Policy citation on every action** | Compliance-ready — every action traceable to a rule |
| **Compliance score per resolution** | Ops visibility — did this case get handled correctly? |
| **Sentiment trajectory** | De-escalation monitoring — did the agent calm them down? |
| **Escalation handoff brief** | Human agents get full context — what was asked, offered, denied |
| **Supervisor dashboard** | Fleet view — all cases, escalations, compliance scores live |
| **Legal threat detection** | Immediate escalation — zero tolerance for missed legal signals |

---

## AI Tools Used

| Tool | How |
|---|---|
| Groq (Llama 3.3 70B) | All 3 LLM calls — sentiment, reasoning, response |

---

## Project Structure

```
aionos_assignment/
├── README.md
├── backend/
│   ├── agent.py          ← AI engine
│   ├── main.py           ← FastAPI server
│   ├── requirements.txt
│   └── .env              ← API keys (not committed)
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx
        ├── types.ts
        ├── index.css
        ├── main.tsx
        └── components/
            ├── ChatPanel.tsx
            ├── ActionLog.tsx
            ├── ReasoningTrace.tsx
            ├── EscalationCard.tsx
            └── SupervisorDashboard.tsx
```
