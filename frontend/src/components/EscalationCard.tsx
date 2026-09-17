import { AlertTriangle, User, Phone, Mail, Clock, ChevronDown, ChevronRight, CheckCircle } from "lucide-react";
import { useState } from "react";
import type { EscalationBrief } from "../types";

interface Props {
  brief: EscalationBrief;
  sessionId?: string;
  onResolved?: () => void;
}

const TIER_COLORS: Record<string, string> = {
  Platinum: "text-cyan-300 bg-cyan-900/30 border-cyan-700/40",
  Gold:     "text-yellow-300 bg-yellow-900/30 border-yellow-700/40",
  Silver:   "text-gray-300 bg-gray-800/40 border-gray-600/40",
};

const SENTIMENT_LABELS: Record<string, { label: string; color: string }> = {
  calm:       { label: "Calm",       color: "text-green-400" },
  frustrated: { label: "Frustrated", color: "text-amber-400" },
  angry:      { label: "Angry",      color: "text-red-400" },
  very_angry: { label: "Very Angry", color: "text-red-300" },
};

export default function EscalationCard({ brief, sessionId, onResolved }: Props) {
  const [open, setOpen] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [resolving, setResolving] = useState(false);
  const tierClass = TIER_COLORS[brief.loyalty_tier] ?? TIER_COLORS.Silver;
  const sentConfig = SENTIMENT_LABELS[brief.sentiment_at_escalation] ?? { label: brief.sentiment_at_escalation, color: "text-gray-400" };

  const handleAcknowledge = async () => {
    if (!sessionId || resolving || resolved) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/resolve`, { method: "POST" });
      if (res.ok) {
        setResolved(true);
        onResolved?.();
      }
    } catch {
      // silent fail
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="border border-amber-700/50 rounded-xl overflow-hidden bg-amber-950/20">
      {/* Card header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-amber-950/30 hover:bg-amber-950/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" />
          <span className="text-sm font-semibold text-amber-300">Escalation Handoff Brief</span>
        </div>
        {open
          ? <ChevronDown size={14} className="text-amber-500" />
          : <ChevronRight size={14} className="text-amber-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">

          {/* Customer identity */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center">
                <User size={16} className="text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{brief.customer_name}</p>
                <p className="text-xs text-gray-500">PNR: {brief.pnr}</p>
              </div>
            </div>
            <span className={`badge border ${tierClass}`}>{brief.loyalty_tier}</span>
          </div>

          {/* Contact */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Mail size={12} />
              <span>{brief.contact_email}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone size={12} />
              <span>{brief.contact_phone}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800" />

          {/* Escalation reason */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Escalation Reason</p>
            <p className="text-sm text-amber-300 font-medium">{brief.escalation_reason}</p>
          </div>

          {/* What was requested */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Customer Request</p>
            <p className="text-sm text-gray-300">{brief.what_was_requested}</p>
          </div>

          {/* Two column — offered vs denied */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-green-500 uppercase tracking-wider mb-2">✓ Offered</p>
              {brief.what_was_offered.length > 0 ? (
                <ul className="space-y-1">
                  {brief.what_was_offered.map((item, i) => (
                    <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                      <span className="text-green-500 mt-0.5">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-600">Nothing offered yet</p>
              )}
            </div>
            <div>
              <p className="text-xs text-red-500 uppercase tracking-wider mb-2">✗ Declined</p>
              {brief.what_was_denied.length > 0 ? (
                <ul className="space-y-1">
                  {brief.what_was_denied.map((item, i) => (
                    <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                      <span className="text-red-500 mt-0.5">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-600">No denials</p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800" />

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span>Sentiment at escalation:</span>
              <span className={`font-medium ${sentConfig.color}`}>
                {sentConfig.label} ({brief.sentiment_intensity}/10)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={11} />
              <span>{brief.conversation_turns} turns</span>
            </div>
          </div>

          <div className="text-xs text-gray-600">
            Escalated at {new Date(brief.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>

          {/* Action button for human agent */}
          {resolved ? (
            <div className="w-full py-2 rounded-lg bg-green-900/30 border border-green-700/40 text-green-300 text-sm font-medium text-center flex items-center justify-center gap-2">
              <CheckCircle size={14} /> Case Acknowledged &amp; Resolved
            </div>
          ) : (
            <button
              onClick={handleAcknowledge}
              disabled={resolving || !sessionId}
              className="w-full py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 
                         text-amber-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resolving ? "Processing…" : "Acknowledge & Take Over"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
