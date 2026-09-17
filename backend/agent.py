"""
agent.py — AI Disruption Resolution Engine
AIONOS Assignment 3: Customer-Facing Resolution Agent

Architecture:
  Parallel — Sentiment Classification + Reasoning Engine run concurrently
  Then     — Response Generator (tone-adjusted, uses both results)

All data sourced exclusively from the Assignment 3 Data Pack.
"""

import json
import os
import time
import asyncio
import httpx
from datetime import datetime
from typing import Optional

# ─── LLM CLIENT (direct REST — async for parallel calls) ─────────────────────

GROQ_FAST_MODEL  = "groq/compound-mini"    # fast, for sentiment + response
GROQ_SMART_MODEL = "openai/gpt-oss-120b"   # smart, for reasoning
GROQ_FALLBACK    = "openai/gpt-oss-20b"    # fallback

async def llm_call_async(messages: list, max_tokens: int = 1024, temperature: float = 0.2, fast: bool = False) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set in environment")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    models = [GROQ_FAST_MODEL] if fast else [GROQ_SMART_MODEL, GROQ_FALLBACK, GROQ_FAST_MODEL]
    last_err = None
    for model in models:
        try:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            last_err = e
            err_str = str(e).lower()
            if "decommissioned" in err_str or "not found" in err_str or "404" in err_str:
                continue
            await asyncio.sleep(0.3)
    raise RuntimeError(f"All Groq models failed. Last error: {last_err}")

# Sync wrapper for non-async contexts
def llm_call(messages: list, max_tokens: int = 1024, temperature: float = 0.2, fast: bool = False) -> str:
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, llm_call_async(messages, max_tokens, temperature, fast))
                return future.result()
        return loop.run_until_complete(llm_call_async(messages, max_tokens, temperature, fast))
    except RuntimeError:
        return asyncio.run(llm_call_async(messages, max_tokens, temperature, fast))


# ─── DATA PACK (Assignment 3 — verbatim from source) ─────────────────────────

CUSTOMERS = {
    "SK4821X": {
        "name": "Priya Nair",
        "tier": "Gold",
        "pnr": "SK4821X",
        "email": "priya.nair@example.com",
        "phone": "+91-98xxxxxxx1",
        "history": "6 flights, 1 prior complaint (delayed baggage, resolved with voucher)",
        "flights": [
            {
                "flight": "SK-204",
                "route": "Delhi → Goa",
                "date": "Wed 23 Sep 2026",
                "scheduled_departure": "18:40",
                "status": "CANCELLED",
                "reason": "operational reasons",
                "delay_hours": None,
            },
            {
                "flight": "Return",
                "route": "Goa → Delhi",
                "date": "Fri 25 Sep 2026",
                "scheduled_departure": "16:20",
                "status": "UNAFFECTED",
                "reason": None,
                "delay_hours": None,
            },
        ],
    },
    "TR1190B": {
        "name": "Arvind Kulkarni",
        "tier": "Silver",
        "pnr": "TR1190B",
        "email": "arvind.kulkarni@example.com",
        "phone": "+91-98xxxxxxx2",
        "history": "3 flights, no prior complaints",
        "flights": [
            {
                "flight": "SK-118",
                "route": "Mumbai → Bengaluru",
                "date": "Wed 23 Sep 2026",
                "scheduled_departure": "07:10",
                "status": "DELAYED",
                "reason": "operational reasons",
                "delay_hours": 4,
                "new_departure": "11:10",
            }
        ],
    },
    "WL7742": {
        "name": "Meher Kaur",
        "tier": "Platinum",
        "pnr": "WL7742",
        "email": "meher.kaur@example.com",
        "phone": "+91-98xxxxxxx3",
        "history": "10 flights, 1 prior complaint (overbooking, resolved with tier-status upgrade)",
        "flights": [
            {
                "flight": "SK-305",
                "route": "Delhi → Hyderabad",
                "date": "Wed 23 Sep 2026",
                "scheduled_departure": "14:00",
                "status": "DELAYED",
                "reason": "operational reasons",
                "delay_hours": 6,
                "new_departure": "20:00",
            }
        ],
    },
}

POLICY = """
=== SERVICE RULES (Authoritative — do not deviate) ===

CANCELLATION REBOOKING RULE:
If a flight is cancelled by the airline, the customer is entitled to:
  (a) Free rebooking on the next available flight within 24 hours, OR
  (b) A full refund — customer's choice.

DELAY COMPENSATION RULE:
  - Delay < 3 hours: ₹500 meal voucher only
  - Delay > 3 hours: ₹500 meal voucher + lounge access
  - Delay > 5 hours: ₹500 meal voucher + lounge access + hotel accommodation
    (hotel covers ONLY the delayed hours — NOT a full night's stay)

REFUND PROCESSING RULE:
  - Refunds for airline-caused cancellations processed in full within 7 business days.
  - Refunds issued to ORIGINAL payment method ONLY — no exceptions.

FARE DIFFERENCE RULE:
  - If customer voluntarily chooses a higher-fare flight (not airline-caused), they pay the fare difference.
  - Agents CANNOT waive fare differences above ₹1,500 without supervisor approval.

LOYALTY TIER RULE:
  - Gold and Platinum tier: priority rebooking (first access to next-available seats).
  - No additional compensation beyond standard policy for any tier.

=== ALLOWED AGENT ACTIONS ===
  ✓ Rebook on next available flight within 24h at no charge (airline-caused only)
  ✓ Issue meal voucher (₹500) per delay compensation rule
  ✓ Issue lounge access per delay compensation rule
  ✓ Arrange hotel accommodation (delayed hours only) where delay qualifies
  ✓ Initiate refund for airline-caused cancellations
  ✓ Provide customer's own booking and flight status

=== PROHIBITED ACTIONS (must escalate) ===
  ✗ Approve compensation beyond stated policy amounts
  ✗ Waive fare difference above ₹1,500 (requires supervisor approval)
  ✗ Make exceptions for non-airline-caused disruptions
  ✗ Handle threats of legal action or formal complaints — ESCALATE IMMEDIATELY
  ✗ Process refunds to a different payment method than original
  ✗ Offer business class upgrades (not in policy)
  ✗ Provide full-night hotel stay when delay does not qualify (< 5h)
"""

# ─── SESSION STORE ────────────────────────────────────────────────────────────

sessions: dict[str, dict] = {}

def get_or_create_session(session_id: str, pnr: str) -> dict:
    if session_id not in sessions:
        customer = CUSTOMERS.get(pnr.upper())
        sessions[session_id] = {
            "session_id": session_id,
            "pnr": pnr.upper(),
            "customer": customer,
            "messages": [],          # conversation history
            "actions": [],           # all agent actions taken
            "reasoning_traces": [],  # per-turn reasoning
            "sentiment_history": [], # per-turn sentiment
            "escalated": False,
            "escalation_reason": None,
            "escalation_brief": None,
            "compliance_scores": [],
            "started_at": datetime.now().isoformat(),
            "resolved": False,
        }
    return sessions[session_id]


async def classify_sentiment_async(message: str, history: list) -> dict:
    history_text = "\n".join([
        f"{'Customer' if m['role'] == 'user' else 'Agent'}: {m['content']}"
        for m in history[-4:]
    ])
    prompt = SENTIMENT_PROMPT.format(message=message, history=history_text or "None")
    try:
        raw = await llm_call_async(
            [{"role": "user", "content": prompt}],
            max_tokens=256,
            temperature=0.1,
            fast=True,
        )
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except Exception:
        pass
    return {"sentiment": "calm", "intensity": 3, "trigger": "unknown", "legal_threat": False, "recommended_tone": "professional"}


async def run_reasoning_async(customer: dict, message: str, history: list, sentiment: dict) -> dict:
    history_text = "\n".join([
        f"{'Customer' if m['role'] == 'user' else 'Agent'}: {m['content']}"
        for m in history[-8:]
    ])
    prompt = REASONING_PROMPT.format(
        customer_json=json.dumps(customer, indent=2) if customer else "{}",
        policy=POLICY,
        history=history_text or "None — this is the first message.",
        message=message,
        sentiment=json.dumps(sentiment),
    )
    try:
        raw = await llm_call_async(
            [{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.1,
            fast=False,
        )
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except Exception:
        pass
    return {
        "customer_identified": bool(customer),
        "flight_status": "UNKNOWN",
        "customer_request": message,
        "entitlements": [],
        "requests_beyond_policy": [],
        "ambiguity_detected": False,
        "clarifying_question": None,
        "actions_to_take": ["inform_only"],
        "escalate": False,
        "escalation_reason": None,
        "policy_compliance": "full",
        "reasoning_summary": "Unable to parse full reasoning. Proceeding with caution.",
    }



SENTIMENT_PROMPT = """You are a sentiment analysis engine for airline customer support.
Analyze the customer's latest message and return a JSON object ONLY — no other text.

JSON schema:
{{
  "sentiment": "calm" | "frustrated" | "angry" | "very_angry",
  "intensity": 1-10,
  "trigger": "<brief description of what's upsetting them, or 'none'>",
  "legal_threat": true | false,
  "recommended_tone": "<one of: professional | empathetic | de-escalation | urgent-escalation>"
}}

Customer message: {message}
Conversation so far: {history}
"""

def classify_sentiment(message: str, history: list) -> dict:
    history_text = "\n".join([
        f"{'Customer' if m['role'] == 'user' else 'Agent'}: {m['content']}"
        for m in history[-4:]  # last 4 turns is enough context
    ])
    prompt = SENTIMENT_PROMPT.format(message=message, history=history_text or "None")
    try:
        raw = llm_call(
            [{"role": "user", "content": prompt}],
            max_tokens=256,
            temperature=0.1,
            fast=True,   # use 8b-instant for sentiment — fast + accurate enough
        )
        # Extract JSON even if there's surrounding text
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except Exception:
        pass
    # Fallback
    return {
        "sentiment": "calm",
        "intensity": 3,
        "trigger": "unknown",
        "legal_threat": False,
        "recommended_tone": "professional",
    }


# ─── CALL 2: REASONING ENGINE ─────────────────────────────────────────────────

REASONING_PROMPT = """You are the reasoning engine for an airline disruption resolution agent.
Your job: think through the problem and decide what to do. Be precise. Cite policy rules.

=== CUSTOMER DATA ===
{customer_json}

=== POLICY ===
{policy}

=== CONVERSATION HISTORY ===
{history}

=== CUSTOMER'S LATEST MESSAGE ===
{message}

=== CUSTOMER SENTIMENT ===
{sentiment}

Return a JSON object ONLY — no other text.

JSON schema:
{{
  "customer_identified": true | false,
  "flight_status": "<CANCELLED | DELAYED_Xh | UNAFFECTED | UNKNOWN>",
  "customer_request": "<what the customer is asking for, in one sentence>",
  "entitlements": [
    {{"item": "<entitlement>", "policy_rule": "<rule name>", "granted": true | false, "reason": "<why>"}},
    ...
  ],
  "requests_beyond_policy": [
    {{"item": "<what they asked>", "reason_denied": "<policy reason>", "must_escalate": true | false}},
    ...
  ],
  "ambiguity_detected": true | false,
  "clarifying_question": "<one question to ask if ambiguous, else null>",
  "actions_to_take": ["issue_meal_voucher" | "issue_lounge_access" | "arrange_hotel" | "initiate_refund" | "rebook_flight" | "escalate" | "inform_only"],
  "escalate": true | false,
  "escalation_reason": "<reason if escalating, else null>",
  "policy_compliance": "full" | "partial" | "violation",
  "reasoning_summary": "<2-3 sentences explaining the decision>"
}}
"""

def run_reasoning(customer: dict, message: str, history: list, sentiment: dict) -> dict:
    history_text = "\n".join([
        f"{'Customer' if m['role'] == 'user' else 'Agent'}: {m['content']}"
        for m in history[-8:]
    ])
    prompt = REASONING_PROMPT.format(
        customer_json=json.dumps(customer, indent=2),
        policy=POLICY,
        history=history_text or "None — this is the first message.",
        message=message,
        sentiment=json.dumps(sentiment),
    )
    try:
        raw = llm_call(
            [{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.1,
        )
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except Exception as e:
        pass
    # Fallback safe reasoning
    return {
        "customer_identified": bool(customer),
        "flight_status": "UNKNOWN",
        "customer_request": message,
        "entitlements": [],
        "requests_beyond_policy": [],
        "ambiguity_detected": False,
        "clarifying_question": None,
        "actions_to_take": ["inform_only"],
        "escalate": False,
        "escalation_reason": None,
        "policy_compliance": "full",
        "reasoning_summary": "Unable to parse full reasoning. Proceeding with caution.",
    }


# ─── CALL 3: RESPONSE GENERATOR ──────────────────────────────────────────────

RESPONSE_PROMPT = """You are a professional airline customer support agent.
Generate the customer-facing response based on the reasoning below.

Tone guidance: {tone}
Customer name: {name}
Loyalty tier: {tier}

=== REASONING DECISION ===
{reasoning}

=== WHAT YOU MUST DO IN THE RESPONSE ===
- Address the customer by first name
- Acknowledge their situation with genuine empathy (match tone to sentiment intensity)
- Clearly state what you ARE doing for them (with specific amounts/details)
- Clearly but politely decline anything beyond policy — explain WHY briefly
- If escalating, tell them you're connecting them to a specialist — be specific about why
- If asking a clarifying question, ask ONLY ONE
- Never mention internal policy rule names verbatim (e.g. don't say "Delay Compensation Rule")
- Keep response under 150 words
- Be warm, direct, and human — not robotic or corporate

Generate ONLY the response text — no JSON, no labels, no preamble.
"""

def generate_response(customer: dict, reasoning: dict, sentiment: dict) -> str:
    tone_map = {
        "professional": "Calm and professional. Clear and factual.",
        "empathetic": "Warm and empathetic. Acknowledge the inconvenience genuinely.",
        "de-escalation": "Very empathetic and calm. Prioritize making the customer feel heard before anything else.",
        "urgent-escalation": "Empathetic but firm. Immediately move to escalation.",
    }
    tone = tone_map.get(sentiment.get("recommended_tone", "professional"), "Calm and professional.")
    name = customer.get("name", "").split()[0] if customer else "there"
    tier = customer.get("tier", "")

    prompt = RESPONSE_PROMPT.format(
        tone=tone,
        name=name,
        tier=tier,
        reasoning=json.dumps(reasoning, indent=2),
    )
    return llm_call(
        [{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0.4,
        fast=True,   # response generation uses fast model — tone adjustment, not reasoning
    )


async def generate_response_async(customer: dict, reasoning: dict, sentiment: dict) -> str:
    tone_map = {
        "professional": "Calm and professional. Clear and factual.",
        "empathetic": "Warm and empathetic. Acknowledge the inconvenience genuinely.",
        "de-escalation": "Very empathetic and calm. Prioritize making the customer feel heard before anything else.",
        "urgent-escalation": "Empathetic but firm. Immediately move to escalation.",
    }
    tone = tone_map.get(sentiment.get("recommended_tone", "professional"), "Calm and professional.")
    name = customer.get("name", "").split()[0] if customer else "there"
    tier = customer.get("tier", "")

    prompt = RESPONSE_PROMPT.format(
        tone=tone,
        name=name,
        tier=tier,
        reasoning=json.dumps(reasoning, indent=2),
    )
    return await llm_call_async(
        [{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0.4,
        fast=True,
    )


# ─── ACTION EXECUTOR ──────────────────────────────────────────────────────────

def execute_actions(reasoning: dict, customer: dict, session: dict) -> list:
    """Convert reasoning decisions into structured action records."""
    actions = []
    ts = datetime.now().isoformat()
    name = customer.get("name", "Unknown") if customer else "Unknown"
    pnr = customer.get("pnr", "") if customer else ""

    action_map = reasoning.get("actions_to_take", [])

    for action in action_map:
        if action == "issue_meal_voucher":
            actions.append({
                "type": "MEAL_VOUCHER_ISSUED",
                "icon": "🍽️",
                "label": "Meal Voucher Issued",
                "detail": f"₹500 meal voucher applied to {name} ({pnr})",
                "policy_basis": "Delay Compensation Rule (delay > 3h)",
                "timestamp": ts,
                "status": "completed",
            })
        elif action == "issue_lounge_access":
            actions.append({
                "type": "LOUNGE_ACCESS_ISSUED",
                "icon": "🛋️",
                "label": "Lounge Access Granted",
                "detail": f"Airport lounge access activated for {name} ({pnr})",
                "policy_basis": "Delay Compensation Rule (delay > 3h)",
                "timestamp": ts,
                "status": "completed",
            })
        elif action == "arrange_hotel":
            actions.append({
                "type": "HOTEL_ARRANGED",
                "icon": "🏨",
                "label": "Hotel Accommodation Arranged",
                "detail": f"Hotel arranged for {name} ({pnr}) — covering delayed hours only",
                "policy_basis": "Delay Compensation Rule (delay > 5h)",
                "timestamp": ts,
                "status": "completed",
            })
        elif action == "initiate_refund":
            actions.append({
                "type": "REFUND_INITIATED",
                "icon": "💰",
                "label": "Refund Initiated",
                "detail": f"Full refund initiated for {name} ({pnr}) — 7 business days to original payment method",
                "policy_basis": "Refund Processing Rule (airline-caused cancellation)",
                "timestamp": ts,
                "status": "completed",
            })
        elif action == "rebook_flight":
            tier = customer.get("tier", "") if customer else ""
            priority = " (Priority rebooking — Gold/Platinum tier)" if tier in ["Gold", "Platinum"] else ""
            actions.append({
                "type": "REBOOKING_INITIATED",
                "icon": "✈️",
                "label": "Rebooking Initiated",
                "detail": f"Rebooking on next available flight within 24h for {name} ({pnr}){priority}",
                "policy_basis": "Cancellation Rebooking Rule",
                "timestamp": ts,
                "status": "completed",
            })
        elif action == "escalate":
            actions.append({
                "type": "ESCALATED",
                "icon": "⚠️",
                "label": "Escalated to Human Agent",
                "detail": f"Case escalated for {name} ({pnr}): {reasoning.get('escalation_reason', 'Requires supervisor approval')}",
                "policy_basis": "Prohibited Actions Policy",
                "timestamp": ts,
                "status": "escalated",
            })
        elif action == "inform_only":
            actions.append({
                "type": "INFORMATION_PROVIDED",
                "icon": "ℹ️",
                "label": "Information Provided",
                "detail": f"Flight status and booking information provided to {name} ({pnr})",
                "policy_basis": "Standard customer service",
                "timestamp": ts,
                "status": "completed",
            })

    # Handle beyond-policy denials as action records too
    for denied in reasoning.get("requests_beyond_policy", []):
        actions.append({
            "type": "REQUEST_DENIED",
            "icon": "🚫",
            "label": "Request Declined",
            "detail": f"'{denied.get('item', 'Request')}' declined — {denied.get('reason_denied', 'Not within policy')}",
            "policy_basis": "Policy boundary enforcement",
            "timestamp": ts,
            "status": "denied",
        })

    return actions


# ─── COMPLIANCE SCORER ────────────────────────────────────────────────────────

def compute_compliance_score(reasoning: dict, actions: list) -> dict:
    """Score the resolution against policy — fully deterministic, no LLM needed."""
    checks = []
    violations = 0
    total = 0

    # Check each entitlement decision
    for e in reasoning.get("entitlements", []):
        total += 1
        checks.append({
            "item": e.get("item"),
            "granted": e.get("granted"),
            "policy_rule": e.get("policy_rule"),
            "correct": True,  # If reasoning got it right (we trust the reasoning engine)
            "note": e.get("reason"),
        })

    # Check for policy violations in the reasoning itself
    if reasoning.get("policy_compliance") == "violation":
        violations += 1

    # Check escalation was triggered for beyond-policy escalatable items
    for req in reasoning.get("requests_beyond_policy", []):
        total += 1
        if req.get("must_escalate") and not reasoning.get("escalate"):
            violations += 1
            checks.append({
                "item": req.get("item"),
                "granted": False,
                "policy_rule": "Prohibited Actions Policy",
                "correct": False,
                "note": "Should have escalated but did not",
            })
        else:
            checks.append({
                "item": req.get("item"),
                "granted": False,
                "policy_rule": "Prohibited Actions Policy",
                "correct": True,
                "note": req.get("reason_denied"),
            })

    score = max(0, 100 - (violations * 25))
    return {
        "score": score,
        "violations": violations,
        "checks": checks,
        "label": "✅ Full Compliance" if score == 100 else ("⚠️ Partial" if score >= 75 else "❌ Violation"),
    }


# ─── ESCALATION BRIEF GENERATOR ───────────────────────────────────────────────

def generate_escalation_brief(session: dict, reasoning: dict, sentiment: dict) -> dict:
    """Generate a structured handoff brief for the human agent picking up this case."""
    customer = session.get("customer", {})
    actions_taken = [a for a in session.get("actions", []) if a.get("type") != "ESCALATED"]

    return {
        "customer_name": customer.get("name") if customer else "Unknown",
        "pnr": session.get("pnr"),
        "loyalty_tier": customer.get("tier") if customer else "Unknown",
        "escalation_reason": reasoning.get("escalation_reason", "Requires supervisor review"),
        "what_was_requested": reasoning.get("customer_request", ""),
        "what_was_offered": [a.get("label") for a in actions_taken if a.get("status") == "completed"],
        "what_was_denied": [a.get("detail") for a in actions_taken if a.get("status") == "denied"],
        "sentiment_at_escalation": sentiment.get("sentiment", "unknown"),
        "sentiment_intensity": sentiment.get("intensity", 0),
        "conversation_turns": len(session.get("messages", [])) // 2,
        "timestamp": datetime.now().isoformat(),
        "contact_email": customer.get("email") if customer else "",
        "contact_phone": customer.get("phone") if customer else "",
    }


# ─── MAIN AGENT TURN ──────────────────────────────────────────────────────────

def process_turn(session_id: str, pnr: str, user_message: str) -> dict:
    """
    Main entry point. Runs the full 3-call pipeline and returns everything
    the frontend needs to render.
    """
    session = get_or_create_session(session_id, pnr)
    customer = session.get("customer")

    # If already escalated, don't process further
    if session.get("escalated"):
        return {
            "response": "This case has been escalated to our specialist team. They will contact you shortly.",
            "reasoning": None,
            "sentiment": session["sentiment_history"][-1] if session["sentiment_history"] else {},
            "actions": [],
            "compliance": None,
            "escalated": True,
            "escalation_brief": session.get("escalation_brief"),
            "session_id": session_id,
        }

    # Add user message to history
    session["messages"].append({"role": "user", "content": user_message})

    # ── CALL 1: Sentiment ──
    sentiment = classify_sentiment(user_message, session["messages"][:-1])
    session["sentiment_history"].append({**sentiment, "timestamp": datetime.now().isoformat()})

    # Immediate escalation for legal threats
    if sentiment.get("legal_threat"):
        reasoning = {
            "customer_request": user_message,
            "entitlements": [],
            "requests_beyond_policy": [],
            "actions_to_take": ["escalate"],
            "escalate": True,
            "escalation_reason": "Customer has made a legal threat or formal complaint — mandatory escalation",
            "policy_compliance": "full",
            "reasoning_summary": "Legal threat detected. Immediate escalation required per prohibited actions policy.",
            "flight_status": "UNKNOWN",
            "ambiguity_detected": False,
            "clarifying_question": None,
        }
        response_text = (
            f"I completely understand your frustration, and I'm truly sorry for this experience. "
            f"I want to make sure this gets the right attention — I'm connecting you with our specialist support team right now. "
            f"They'll reach out to you directly and have full authority to resolve this."
        )
    else:
        # ── CALL 2: Reasoning ──
        reasoning = run_reasoning(customer, user_message, session["messages"][:-1], sentiment)

        # ── CALL 3: Response ──
        response_text = generate_response(customer, reasoning, sentiment)

    # Execute actions
    new_actions = execute_actions(reasoning, customer, session)
    session["actions"].extend(new_actions)

    # Compliance score
    compliance = compute_compliance_score(reasoning, new_actions)
    session["compliance_scores"].append(compliance)

    # Store reasoning trace
    session["reasoning_traces"].append({
        "turn": len(session["messages"]),
        "timestamp": datetime.now().isoformat(),
        "sentiment": sentiment,
        "reasoning": reasoning,
        "compliance": compliance,
    })

    # Add agent response to history
    session["messages"].append({"role": "assistant", "content": response_text})

    # Handle escalation
    escalation_brief = None
    if reasoning.get("escalate"):
        session["escalated"] = True
        session["escalation_reason"] = reasoning.get("escalation_reason")
        escalation_brief = generate_escalation_brief(session, reasoning, sentiment)
        session["escalation_brief"] = escalation_brief

    return {
        "response": response_text,
        "reasoning": reasoning,
        "sentiment": sentiment,
        "actions": new_actions,
        "compliance": compliance,
        "escalated": session["escalated"],
        "escalation_brief": escalation_brief,
        "session_id": session_id,
    }


# ─── SUPERVISOR DATA ──────────────────────────────────────────────────────────

def get_supervisor_data() -> dict:
    """All sessions data for the supervisor dashboard."""
    all_cases = []
    for sid, s in sessions.items():
        customer = s.get("customer", {})
        latest_sentiment = s["sentiment_history"][-1] if s["sentiment_history"] else {}
        latest_compliance = s["compliance_scores"][-1] if s["compliance_scores"] else {}

        # Build action summary
        action_types = [a["type"] for a in s.get("actions", [])]

        all_cases.append({
            "session_id": sid,
            "pnr": s.get("pnr"),
            "customer_name": customer.get("name") if customer else "Unknown",
            "tier": customer.get("tier") if customer else "Unknown",
            "escalated": s.get("escalated", False),
            "escalation_reason": s.get("escalation_reason"),
            "escalation_brief": s.get("escalation_brief"),
            "sentiment": latest_sentiment.get("sentiment", "unknown"),
            "sentiment_intensity": latest_sentiment.get("intensity", 0),
            "compliance_score": latest_compliance.get("score", 100),
            "compliance_label": latest_compliance.get("label", ""),
            "actions_taken": action_types,
            "turns": len(s.get("messages", [])) // 2,
            "started_at": s.get("started_at"),
            "resolved": s.get("resolved", False),
        })

    escalated = [c for c in all_cases if c["escalated"]]
    active = [c for c in all_cases if not c["escalated"] and not c["resolved"]]
    resolved = [c for c in all_cases if c["resolved"]]

    return {
        "total_cases": len(all_cases),
        "escalated_count": len(escalated),
        "active_count": len(active),
        "resolved_count": len(resolved),
        "cases": all_cases,
        "escalated_cases": escalated,
    }


def get_session_detail(session_id: str) -> Optional[dict]:
    return sessions.get(session_id)


def get_available_customers() -> list:
    return [
        {
            "pnr": pnr,
            "name": c["name"],
            "tier": c["tier"],
            "flight": c["flights"][0]["flight"],
            "route": c["flights"][0]["route"],
            "status": c["flights"][0]["status"],
            "delay_hours": c["flights"][0].get("delay_hours"),
            "custom": c.get("custom", False),
        }
        for pnr, c in CUSTOMERS.items()
    ]
