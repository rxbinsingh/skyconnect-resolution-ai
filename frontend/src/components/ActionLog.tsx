import { CheckCircle, XCircle, AlertTriangle, Info, Clock } from "lucide-react";
import type { Action, Compliance } from "../types";

interface Props {
  actions: Action[];
  compliance: Compliance | null;
}

const STATUS_STYLES: Record<string, string> = {
  completed: "action-receipt action-completed",
  denied:    "action-receipt action-denied",
  escalated: "action-receipt action-escalated",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle size={15} className="text-green-400 shrink-0 mt-0.5" />,
  denied:    <XCircle    size={15} className="text-red-400 shrink-0 mt-0.5" />,
  escalated: <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />,
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function CompliancePanel({ compliance }: { compliance: Compliance }) {
  const color =
    compliance.score === 100 ? "text-green-400 border-green-800/50 bg-green-950/30"
    : compliance.score >= 75  ? "text-amber-400 border-amber-800/50 bg-amber-950/30"
    : "text-red-400 border-red-800/50 bg-red-950/30";

  return (
    <div className={`rounded-xl border p-3 mb-3 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Policy Compliance</p>
        <span className="text-lg font-bold">{compliance.score}%</span>
      </div>
      <p className="text-sm font-medium mb-2">{compliance.label}</p>
      <div className="space-y-1">
        {compliance.checks.map((c, i) => (
          <div key={i} className="flex items-start gap-2 text-xs opacity-80">
            {c.correct
              ? <CheckCircle size={12} className="mt-0.5 shrink-0 text-green-400" />
              : <XCircle    size={12} className="mt-0.5 shrink-0 text-red-400" />}
            <div>
              <span className="font-medium">{c.item}</span>
              {c.note && <span className="text-gray-400"> — {c.note}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ActionLog({ actions, compliance }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Agent Action Log</p>
          <span className="badge bg-gray-800 text-gray-400 border border-gray-700">
            {actions.length} actions
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Real-time audit trail with policy citations</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {/* Compliance panel — show latest */}
        {compliance && <CompliancePanel compliance={compliance} />}

        {actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-600">
            <Info size={20} />
            <p className="text-xs">Actions will appear here as the agent works</p>
          </div>
        ) : (
          // Show newest first
          [...actions].reverse().map((action, i) => (
            <div key={i} className={STATUS_STYLES[action.status] ?? "action-receipt action-info"}>
              <div className="mt-0.5">{STATUS_ICONS[action.status] ?? <Info size={15} className="text-blue-400" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-xs font-semibold text-gray-200 truncate">
                    {action.icon} {action.label}
                  </p>
                  <div className="flex items-center gap-1 text-gray-500 shrink-0">
                    <Clock size={10} />
                    <span className="text-xs">{formatTime(action.timestamp)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">{action.detail}</p>
                <p className="text-xs text-gray-600 mt-1 italic">📋 {action.policy_basis}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
