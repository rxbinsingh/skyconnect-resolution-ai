"""
main.py — FastAPI Server
AIONOS Assignment 3: Customer-Facing Resolution Agent
"""

import uuid
import asyncio
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from agent import (
    process_turn,
    get_supervisor_data,
    get_session_detail,
    get_available_customers,
    get_or_create_session,
    classify_sentiment,
    run_reasoning,
    generate_response,
    execute_actions,
    compute_compliance_score,
    generate_escalation_brief,
    sessions,
    CUSTOMERS,
)

app = FastAPI(title="AIONOS Disruption Resolution Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── REQUEST / RESPONSE MODELS ────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str | None = None
    pnr: str
    message: str


class NewSessionRequest(BaseModel):
    pnr: str


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "AIONOS Disruption Resolution Agent v1.0"}


@app.get("/customers")
def list_customers():
    """Return all available customer scenarios for the scenario switcher."""
    return {"customers": get_available_customers()}


class CustomScenarioRequest(BaseModel):
    name: str
    pnr: str | None = None
    tier: str = "Silver"
    flight: str
    route: str
    status: str = "DELAYED"
    delay_hours: int | None = None
    email: str | None = None
    phone: str | None = None


@app.post("/customers")
def add_custom_scenario(req: CustomScenarioRequest):
    """Add a custom customer scenario at runtime."""
    import random, string
    from agent import CUSTOMERS

    # Auto-generate PNR if not provided
    pnr = (req.pnr or "CUST-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=4))).upper()

    if pnr in CUSTOMERS:
        raise HTTPException(status_code=409, detail=f"PNR {pnr} already exists")

    # Build flight entry
    flight_entry = {
        "flight": req.flight.upper(),
        "route": req.route,
        "date": "Wed 23 Sep 2026",
        "scheduled_departure": "12:00",
        "status": req.status.upper(),
        "reason": "operational reasons",
        "delay_hours": req.delay_hours if req.status.upper() == "DELAYED" else None,
    }
    if req.status.upper() == "DELAYED" and req.delay_hours:
        from datetime import datetime, timedelta
        base = datetime.strptime("12:00", "%H:%M")
        new_dep = base + timedelta(hours=req.delay_hours)
        flight_entry["new_departure"] = new_dep.strftime("%H:%M")

    CUSTOMERS[pnr] = {
        "name": req.name,
        "tier": req.tier,
        "pnr": pnr,
        "email": req.email or f"{req.name.lower().replace(' ', '.')}@example.com",
        "phone": req.phone or "+91-98xxxxxxx0",
        "history": "New customer — no prior history",
        "flights": [flight_entry],
        "custom": True,
    }

    return {"pnr": pnr, "message": f"Scenario for {req.name} ({pnr}) created successfully"}


@app.post("/session/new")
def new_session(req: NewSessionRequest):
    """Create a new session for a customer PNR."""
    session_id = str(uuid.uuid4())
    customers = {c["pnr"]: c for c in get_available_customers()}
    if req.pnr.upper() not in customers:
        raise HTTPException(status_code=404, detail=f"PNR {req.pnr} not found in data pack")
    return {"session_id": session_id, "pnr": req.pnr.upper()}


@app.post("/chat")
async def chat(req: ChatRequest):
    """
    Main chat endpoint — async parallel pipeline:
      Step 1: Sentiment + Reasoning run CONCURRENTLY (asyncio.gather)
      Step 2: Response generation uses both results
    """
    session_id = req.session_id or str(uuid.uuid4())
    pnr = req.pnr.upper()

    customers = {c["pnr"]: c for c in get_available_customers()}
    if pnr not in customers:
        raise HTTPException(status_code=404, detail=f"PNR {pnr} not found")

    try:
        session = get_or_create_session(session_id, pnr)
        customer = session.get("customer")

        # Already escalated
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

        # Add user message
        session["messages"].append({"role": "user", "content": req.message})
        history = session["messages"][:-1]

        from agent import (
            classify_sentiment_async, run_reasoning_async,
            generate_response_async, execute_actions,
            compute_compliance_score, generate_escalation_brief,
        )

        sentiment_task = classify_sentiment_async(req.message, history)
        reasoning_task = run_reasoning_async(customer, req.message, history, {})

        sentiment, reasoning = await asyncio.gather(sentiment_task, reasoning_task)

        # Legal threat check — override reasoning if needed
        if sentiment.get("legal_threat"):
            reasoning = {
                "customer_request": req.message,
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
                "I completely understand your frustration, and I'm truly sorry for this experience. "
                "I want to make sure this gets the right attention — I'm connecting you with our specialist support team right now. "
                "They'll reach out to you directly and have full authority to resolve this."
            )
        else:
            response_text = await generate_response_async(customer, reasoning, sentiment)

        # Store sentiment
        session["sentiment_history"].append({**sentiment, "timestamp": datetime.now().isoformat()})

        # Execute actions
        new_actions = execute_actions(reasoning, customer, session)
        session["actions"].extend(new_actions)

        # Compliance
        compliance = compute_compliance_score(reasoning, new_actions)
        session["compliance_scores"].append(compliance)

        # Reasoning trace
        session["reasoning_traces"].append({
            "turn": len(session["messages"]),
            "timestamp": datetime.now().isoformat(),
            "sentiment": sentiment,
            "reasoning": reasoning,
            "compliance": compliance,
        })

        # Add agent response
        session["messages"].append({"role": "assistant", "content": response_text})

        # Escalation
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/customers/{pnr}")
def delete_custom_scenario(pnr: str):
    """Delete a custom scenario (built-in scenarios cannot be deleted)."""
    from agent import CUSTOMERS
    pnr = pnr.upper()
    if pnr not in CUSTOMERS:
        raise HTTPException(status_code=404, detail=f"PNR {pnr} not found")
    if not CUSTOMERS[pnr].get("custom"):
        raise HTTPException(status_code=403, detail="Built-in scenarios cannot be deleted")
    del CUSTOMERS[pnr]
    return {"message": f"Scenario {pnr} deleted"}
    """Get full session detail including all messages, actions and traces."""
    session = get_session_detail(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.get("/supervisor")
def supervisor_dashboard():
    """Supervisor dashboard — all cases, escalations, compliance scores."""
    return get_supervisor_data()


@app.post("/session/{session_id}/resolve")
def resolve_session(session_id: str):
    """Mark a session as resolved."""
    from agent import sessions
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    sessions[session_id]["resolved"] = True
    return {"status": "resolved", "session_id": session_id}


@app.get("/health")
def health():
    import os
    return {
        "status": "ok",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
    }
