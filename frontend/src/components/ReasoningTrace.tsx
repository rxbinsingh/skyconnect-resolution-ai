import { useState } from "react";
import { ChevronDown, ChevronRight, Brain, CheckCircle, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
import type { ReasoningTrace as IReasoningTrace } from "../types";

interface Props {
  traces: IReasoningTrace[];
  visible: boolean;
  onToggle: () => void;
}

const COMPLIANCE_COLORS: Record<string, string> = {
  full:      "text-green-400 bg-green-950/40 border-green-800/40",
  partial:   "text-amber-400 bg-amber-950/40 border-amber-800/40",
  violation: "text-red-400 bg-red-950/40 border-red-800/40",
};

const SENTIMENT_COLORS: Record<string, string> = {
  calm:       "text-green-400",
  frustrated: "text-amber-400",
  angry:      "text-red-400",
  very_angry: "text-red-300",
};

function TraceEntry({ trace, index }: { trace: IReasoningTrace; index: number }) {
  const [open, setOpen] = useState(index === 0); // latest open by default
  const r = trace.reasoning;
  const s = trace.sentiment;
  const complianceClass = COMPLIANCE_COLORS[r.policy_compliance] ?? COMPLIANCE_COLORS.full;

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      {/* Trace header — clickable */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800/80 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Brain size={14} className="text-brand-500 shrink-0" />
          <span className="text-xs font-mono text-gray-300">Turn {trace.turn}</span>
          <span className={`text-xs font-medium ${SENTIMENT_COLORS[s.sentiment] ?? "text-gray-400"}`}>
            · {s.sentiment} ({s.intensity}/10)
          </span>
          <span className={`badge border ${complianceClass} ml-1`}>
            {r.policy_compliance}
          </span>
        </div>
        {open
          ? <ChevronDown size={14} className="text-gray-500" />
          : <ChevronRight size={14} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 bg-gray-950/50 space-y-3 font-mono text-xs">

          {/* Step 1 — Customer & flight identification */}
          <div className="trace-step">
            <span className="text-brand-500 shrink-0">→</span>
            <span className="text-gray-400">
              Customer identified: <span className="text-white">{r.customer_identified ? "YES" : "NO"}</span>
              {" | "}Flight: <span className="text-white">{r.flight_status}</span>
            </span>
          </div>

          {/* Step 2 — Request */}
          <div className="trace-step">
            <span className="text-brand-500 shrink-0">→</span>
            <span className="text-gray-400">
              Request: <span className="text-yellow-300">{r.customer_request}</span>
            </span>
          </div>

          {/* Step 3 — Sentiment signal */}
          <div className="trace-step">
            <span className="text-brand-500 shrink-0">→</span>
            <span className={`${SENTIMENT_COLORS[s.sentiment] ?? "text-gray-400"}`}>
              Sentiment: {s.sentiment} | Intensity: {s.intensity}/10
              {s.trigger !== "none" && ` | Trigger: ${s.trigger}`}
            </span>
          </div>

          {/* Step 4 — Entitlements */}
          {r.entitlements.length > 0 && (
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wider text-[10px]">Entitlement Check</p>
              {r.entitlements.map((e, i) => (
                <div key={i} className="trace-step">
                  <span className="shrink-0">
                    {e.granted
                      ? <CheckCircle size={12} className="text-green-400" />
                      : <XCircle size={12} className="text-red-400" />}
                  </span>
                  <span className={e.granted ? "text-green-300" : "text-red-300"}>
                    {e.item}
                    <span className="text-gray-500"> ({e.policy_rule})</span>
                    {" — "}{e.reason}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Step 5 — Beyond policy */}
          {r.requests_beyond_policy.length > 0 && (
            <div className="space-y-1">
              <p className="text-gray-600 uppercase tracking-wider text-[10px]">Beyond-Policy Requests</p>
              {r.requests_beyond_policy.map((req, i) => (
                <div key={i} className="trace-step">
                  <XCircle size={12} className="text-red-400 shrink-0" />
                  <span className="text-red-300">
                    {req.item}
                    <span className="text-gray-500"> — {req.reason_denied}</span>
                    {req.must_escalate && (
                      <span className="text-amber-400"> [MUST ESCALATE]</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Step 6 — Ambiguity */}
          {r.ambiguity_detected && (
            <div className="trace-step">
              <HelpCircle size={12} className="text-yellow-400 shrink-0" />
              <span className="text-yellow-300">
                Ambiguity detected — asking: <em>{r.clarifying_question}</em>
              </span>
            </div>
          )}

          {/* Step 7 — Actions decided */}
          <div className="trace-step">
            <span className="text-brand-500 shrink-0">→</span>
            <span className="text-gray-400">
              Actions: <span className="text-cyan-300">{r.actions_to_take.join(", ")}</span>
            </span>
          </div>

          {/* Step 8 — Escalation */}
          {r.escalate && (
            <div className="trace-step">
              <AlertTriangle size={12} className="text-amber-400 shrink-0" />
              <span className="text-amber-300">
                ESCALATING: {r.escalation_reason}
              </span>
            </div>
          )}

          {/* Step 9 — Summary */}
          <div className="mt-2 pt-2 border-t border-gray-800">
            <p className="text-gray-500 leading-relaxed">{r.reasoning_summary}</p>
          </div>

          {/* Tone used */}
          <div className="trace-step">
            <span className="text-brand-500 shrink-0">→</span>
            <span className="text-gray-500">
              Response tone: <span className="text-purple-300">{s.recommended_tone}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReasoningTrace({ traces, visible, onToggle }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header with toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-3 border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain size={15} className="text-brand-500" />
          <p className="text-sm font-semibold text-white">Agent Reasoning</p>
          <span className="badge bg-brand-500/20 text-brand-500 border border-brand-500/30">
            {traces.length} turns
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{visible ? "Hide" : "Show"}</span>
          {visible ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        </div>
      </button>

      {visible && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {traces.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-2 text-gray-600">
              <Brain size={18} />
              <p className="text-xs">Reasoning traces will appear after the first turn</p>
            </div>
          ) : (
            // Show newest first
            [...traces].reverse().map((trace, i) => (
              <TraceEntry key={i} trace={trace} index={i} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
