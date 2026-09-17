export interface Customer {
  pnr: string;
  name: string;
  tier: "Gold" | "Silver" | "Platinum";
  flight: string;
  route: string;
  status: "CANCELLED" | "DELAYED" | "UNAFFECTED";
  delay_hours: number | null;
  custom?: boolean;
}

export interface Sentiment {
  sentiment: "calm" | "frustrated" | "angry" | "very_angry";
  intensity: number;
  trigger: string;
  legal_threat: boolean;
  recommended_tone: string;
  timestamp?: string;
}

export interface Entitlement {
  item: string;
  policy_rule: string;
  granted: boolean;
  reason: string;
}

export interface BeyondPolicy {
  item: string;
  reason_denied: string;
  must_escalate: boolean;
}

export interface Reasoning {
  customer_identified: boolean;
  flight_status: string;
  customer_request: string;
  entitlements: Entitlement[];
  requests_beyond_policy: BeyondPolicy[];
  ambiguity_detected: boolean;
  clarifying_question: string | null;
  actions_to_take: string[];
  escalate: boolean;
  escalation_reason: string | null;
  policy_compliance: "full" | "partial" | "violation";
  reasoning_summary: string;
}

export interface ComplianceCheck {
  item: string;
  granted: boolean;
  policy_rule: string;
  correct: boolean;
  note: string;
}

export interface Compliance {
  score: number;
  violations: number;
  checks: ComplianceCheck[];
  label: string;
}

export interface Action {
  type: string;
  icon: string;
  label: string;
  detail: string;
  policy_basis: string;
  timestamp: string;
  status: "completed" | "denied" | "escalated";
}

export interface EscalationBrief {
  customer_name: string;
  pnr: string;
  loyalty_tier: string;
  escalation_reason: string;
  what_was_requested: string;
  what_was_offered: string[];
  what_was_denied: string[];
  sentiment_at_escalation: string;
  sentiment_intensity: number;
  conversation_turns: number;
  timestamp: string;
  contact_email: string;
  contact_phone: string;
}

export interface ChatResponse {
  response: string;
  reasoning: Reasoning | null;
  sentiment: Sentiment;
  actions: Action[];
  compliance: Compliance | null;
  escalated: boolean;
  escalation_brief: EscalationBrief | null;
  session_id: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ReasoningTrace {
  turn: number;
  timestamp: string;
  sentiment: Sentiment;
  reasoning: Reasoning;
  compliance: Compliance;
}

export interface SupervisorCase {
  session_id: string;
  pnr: string;
  customer_name: string;
  tier: string;
  escalated: boolean;
  escalation_reason: string | null;
  escalation_brief: EscalationBrief | null;
  sentiment: string;
  sentiment_intensity: number;
  compliance_score: number;
  compliance_label: string;
  actions_taken: string[];
  turns: number;
  started_at: string;
  resolved: boolean;
}

export interface SupervisorData {
  total_cases: number;
  escalated_count: number;
  active_count: number;
  resolved_count: number;
  cases: SupervisorCase[];
  escalated_cases: SupervisorCase[];
}
