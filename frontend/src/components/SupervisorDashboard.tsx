import { useEffect, useState } from "react";
import { LayoutDashboard, AlertTriangle, CheckCircle, Activity, RefreshCw, User, Clock } from "lucide-react";
import type { SupervisorData, SupervisorCase, EscalationBrief } from "../types";

const API = "/api";

const TIER_COLORS: Record<string, string> = {
  Platinum: "text-cyan-300 bg-cyan-900/30 border-cyan-700/40",
  Gold:     "text-yellow-300 bg-yellow-900/30 border-yellow-700/40",
  Silver:   "text-gray-300 bg-gray-800/40 border-gray-600/40",
};

const SENTIMENT_COLORS: Record<string, string> = {
  calm:       "text-green-400",
  frustrated: "text-amber-400",
  angry:      "text-red-400",
  very_angry: "text-red-300",
  unknown:    "text-gray-400",
};

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function EscalationDetail({ brief, sessionId }: { brief: EscalationBrief; sessionId: string }) {
  const [resolved, setResolved] = useState(false);
  const [resolving, setResolving] = useState(false);

  const handleAcknowledge = async () => {
    if (resolving || resolved) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/resolve`, { method: "POST" });
      if (res.ok) setResolved(true);
    } catch {
      // silent
    } finally {
      setResolving(false);
    }
  };
  return (
    <div className="mt-3 p-3 rounded-lg bg-gray-950/60 border border-gray-800 text-xs space-y-2">
      <div>
        <span className="text-gray-500">Reason: </span>
        <span className="text-amber-300">{brief.escalation_reason}</span>
      </div>
      <div>
        <span className="text-gray-500">Requested: </span>
        <span className="text-gray-300">{brief.what_was_requested}</span>
      </div>
      {brief.what_was_offered.length > 0 && (
        <div>
          <span className="text-gray-500">Offered: </span>
          <span className="text-green-300">{brief.what_was_offered.join(", ")}</span>
        </div>
      )}
      <div className="flex items-center gap-3 text-gray-500">
        <span>📧 {brief.contact_email}</span>
        <span>📞 {brief.contact_phone}</span>
      </div>
      {resolved ? (
        <div className="w-full py-1.5 rounded bg-green-900/30 border border-green-700/40 text-green-300 font-medium text-center">
          ✓ Acknowledged & Resolved
        </div>
      ) : (
        <button
          onClick={handleAcknowledge}
          disabled={resolving}
          className="w-full py-1.5 rounded bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/40 
                     text-amber-300 font-medium transition-colors disabled:opacity-50"
        >
          {resolving ? "Processing…" : "Acknowledge & Take Over"}
        </button>
      )}
    </div>
  );
}

function CaseRow({ c }: { c: SupervisorCase }) {
  const [showDetail, setShowDetail] = useState(false);
  const tierClass = TIER_COLORS[c.tier] ?? TIER_COLORS.Silver;
  const sentColor = SENTIMENT_COLORS[c.sentiment] ?? "text-gray-400";
  const compColor = c.compliance_score === 100 ? "text-green-400" : c.compliance_score >= 75 ? "text-amber-400" : "text-red-400";

  return (
    <div className={`card p-4 ${c.escalated ? "border-amber-800/40" : ""}`}>
      <div className="flex items-center justify-between gap-4">
        {/* Left: customer info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
            <User size={14} className="text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{c.customer_name}</p>
            <p className="text-xs text-gray-500">{c.pnr}</p>
          </div>
        </div>

        {/* Center: badges */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`badge border ${tierClass}`}>{c.tier}</span>
          {c.escalated && (
            <span className="badge bg-amber-950/50 text-amber-300 border border-amber-700/50">
              <AlertTriangle size={10} /> Escalated
            </span>
          )}
          {c.resolved && (
            <span className="badge bg-green-950/50 text-green-300 border border-green-700/50">
              <CheckCircle size={10} /> Resolved
            </span>
          )}
        </div>

        {/* Right: metrics */}
        <div className="flex items-center gap-4 shrink-0 text-xs">
          <div>
            <p className="text-gray-500">Sentiment</p>
            <p className={`font-medium capitalize ${sentColor}`}>{c.sentiment}</p>
          </div>
          <div>
            <p className="text-gray-500">Compliance</p>
            <p className={`font-medium ${compColor}`}>{c.compliance_score}%</p>
          </div>
          <div>
            <p className="text-gray-500">Turns</p>
            <p className="font-medium text-gray-300">{c.turns}</p>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <Clock size={11} />
            <span>{new Date(c.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>

        {/* Toggle detail */}
        {c.escalated && c.escalation_brief && (
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="text-xs text-amber-400 hover:text-amber-300 shrink-0 border border-amber-800/40 px-2 py-1 rounded-lg transition-colors"
          >
            {showDetail ? "Hide" : "View Brief"}
          </button>
        )}
      </div>

      {/* Actions taken */}
      {c.actions_taken.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {c.actions_taken.map((a, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-mono">
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Escalation detail */}
      {showDetail && c.escalation_brief && (
        <EscalationDetail brief={c.escalation_brief} sessionId={c.session_id} />
      )}
    </div>
  );
}

export default function SupervisorDashboard() {
  const [data, setData] = useState<SupervisorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetch_data = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/supervisor`);
      if (res.ok) {
        setData(await res.json());
        setLastRefresh(new Date());
      }
    } catch {
      // silent fail — backend may not be running
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch_data();
    const interval = setInterval(fetch_data, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={20} className="text-brand-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Supervisor Dashboard</h2>
            <p className="text-xs text-gray-500">
              Fleet view — all active cases, escalations, compliance
              {lastRefresh && ` · Refreshed ${lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
            </p>
          </div>
        </div>
        <button
          onClick={fetch_data}
          disabled={loading}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Cases"
            value={data.total_cases}
            icon={<Activity size={18} />}
            color="bg-brand-500/20 text-brand-500"
          />
          <StatCard
            label="Active"
            value={data.active_count}
            icon={<Activity size={18} />}
            color="bg-blue-500/20 text-blue-400"
          />
          <StatCard
            label="Escalated"
            value={data.escalated_count}
            icon={<AlertTriangle size={18} />}
            color="bg-amber-500/20 text-amber-400"
          />
          <StatCard
            label="Resolved"
            value={data.resolved_count}
            icon={<CheckCircle size={18} />}
            color="bg-green-500/20 text-green-400"
          />
        </div>
      )}

      {/* Escalated cases — priority section */}
      {data && data.escalated_cases.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">Requires Attention ({data.escalated_cases.length})</h3>
          </div>
          <div className="space-y-2">
            {data.escalated_cases.map((c) => (
              <CaseRow key={c.session_id} c={c} />
            ))}
          </div>
        </div>
      )}

      {/* All cases */}
      {data && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-3">All Cases</h3>
          {data.cases.length === 0 ? (
            <div className="card p-8 text-center text-gray-600">
              <p className="text-sm">No cases yet — start a conversation in the Agent tab</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.cases.map((c) => (
                <CaseRow key={c.session_id} c={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {!data && !loading && (
        <div className="card p-8 text-center text-gray-600">
          <p className="text-sm">Connect the backend to see live data</p>
        </div>
      )}
    </div>
  );
}
