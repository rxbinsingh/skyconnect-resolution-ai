import { useState, useCallback, useRef } from "react";
import { Plane, LayoutDashboard, Brain, ChevronDown, Wifi, WifiOff, RefreshCw, Plus, Trash2 } from "lucide-react";
import ChatPanel from "./components/ChatPanel";
import ActionLog from "./components/ActionLog";
import ReasoningTrace from "./components/ReasoningTrace";
import EscalationCard from "./components/EscalationCard";
import SupervisorDashboard from "./components/SupervisorDashboard";
import AddScenarioModal from "./components/AddScenarioModal";
import type {
  Customer, Message, Action, Compliance,
  Sentiment, EscalationBrief, ReasoningTrace as IReasoningTrace,
  ChatResponse,
} from "./types";

const API = "/api";

// ─── Scenario selector card ────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  CANCELLED:  "bg-red-950/50 text-red-300 border-red-700/50",
  DELAYED:    "bg-amber-950/50 text-amber-300 border-amber-700/50",
  UNAFFECTED: "bg-green-950/50 text-green-300 border-green-700/50",
};

const TIER_STYLES: Record<string, string> = {
  Platinum: "text-cyan-300 bg-cyan-900/30 border-cyan-700/40",
  Gold:     "text-yellow-300 bg-yellow-900/30 border-yellow-700/40",
  Silver:   "text-gray-300 bg-gray-800/40 border-gray-600/40",
};

function ScenarioCard({
  customer,
  selected,
  onClick,
  onDelete,
}: {
  customer: Customer;
  selected: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const statusStyle = STATUS_STYLES[customer.status] ?? STATUS_STYLES.UNAFFECTED;
  const tierStyle   = TIER_STYLES[customer.tier]   ?? TIER_STYLES.Silver;

  return (
    <div className={`relative group w-full text-left p-4 rounded-xl border transition-all ${
        selected
          ? "border-brand-500/60 bg-brand-500/10 ring-1 ring-brand-500/30"
          : "border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-800/40"
      }`}>
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-sm font-semibold text-white">{customer.name}</p>
            <p className="text-xs text-gray-500 font-mono">{customer.pnr}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {customer.custom && (
              <span className="badge bg-purple-900/40 text-purple-300 border border-purple-700/40 text-[10px]">Custom</span>
            )}
            <span className={`badge border ${tierStyle}`}>{customer.tier}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {customer.flight} · {customer.route}
          </p>
          <span className={`badge border ${statusStyle}`}>
            {customer.status === "DELAYED" && customer.delay_hours
              ? `Delayed ${customer.delay_hours}h`
              : customer.status}
          </span>
        </div>
      </button>

      {/* Delete button — only for custom scenarios, always visible */}
      {customer.custom && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-2 p-1.5 rounded text-gray-600 
                     hover:text-red-400 hover:bg-red-950/40 transition-all"
          title="Delete scenario"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────

type Tab = "agent" | "supervisor";

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<Tab>("agent");

  // Customers / scenario selector
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedPnr, setSelectedPnr] = useState<string | null>(null);
  const [scenarioOpen, setScenarioOpen] = useState(true);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  // Session state
  const sessionIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [traces, setTraces] = useState<IReasoningTrace[]>([]);
  const [latestCompliance, setLatestCompliance] = useState<Compliance | null>(null);
  const [latestSentiment, setLatestSentiment] = useState<Sentiment | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [escalationBrief, setEscalationBrief] = useState<EscalationBrief | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reasoningVisible, setReasoningVisible] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLogHeight, setActionLogHeight] = useState(240);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  const onDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartH.current = actionLogHeight;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientY - dragStartY.current;
      setActionLogHeight(Math.min(600, Math.max(80, dragStartH.current + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Load customers from backend
  const loadCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/customers`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCustomers(data.customers);
      setBackendOk(true);
      setCustomersLoaded(true);
    } catch {
      setBackendOk(false);
    }
  }, []);

  // Auto-load on mount
  useState(() => { loadCustomers(); });

  // Select a scenario — resets session
  const selectScenario = useCallback(async (pnr: string) => {
    setSelectedPnr(pnr);
    setMessages([]);
    setActions([]);
    setTraces([]);
    setLatestCompliance(null);
    setLatestSentiment(null);
    setEscalated(false);
    setEscalationBrief(null);
    sessionIdRef.current = null;
    setScenarioOpen(false);

    // Create new session
    try {
      const res = await fetch(`${API}/session/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pnr }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionIdRef.current = data.session_id;
      }
    } catch {
      // will be created on first chat turn
    }
  }, []);

  // Send a message
  const handleSend = useCallback(async (userMessage: string) => {
    if (!selectedPnr || isLoading) return;

    const ts = new Date().toISOString();
    setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: ts }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          pnr: selectedPnr,
          message: userMessage,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ Error: ${err.detail ?? "Backend error"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      const data: ChatResponse = await res.json();

      // Persist session id
      if (data.session_id) sessionIdRef.current = data.session_id;

      // Add agent message
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, timestamp: new Date().toISOString() },
      ]);

      // Update action log
      if (data.actions?.length) {
        setActions((prev) => [...prev, ...data.actions]);
      }

      // Update compliance
      if (data.compliance) setLatestCompliance(data.compliance);

      // Update sentiment
      if (data.sentiment) setLatestSentiment(data.sentiment);

      // Update reasoning traces
      if (data.reasoning) {
        setTraces((prev) => [
          ...prev,
          {
            turn: messages.length / 2 + 1,
            timestamp: new Date().toISOString(),
            sentiment: data.sentiment,
            reasoning: data.reasoning!,
            compliance: data.compliance ?? { score: 100, violations: 0, checks: [], label: "✅ Full Compliance" },
          },
        ]);
      }

      // Escalation
      if (data.escalated) {
        setEscalated(true);
        if (data.escalation_brief) setEscalationBrief(data.escalation_brief);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Could not reach the backend. Make sure it's running on port 8000.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPnr, isLoading, messages.length]);

  // Delete a custom scenario
  const deleteScenario = useCallback(async (pnr: string) => {
    try {
      await fetch(`/api/customers/${pnr}`, { method: "DELETE" });
      if (selectedPnr === pnr) {
        setSelectedPnr(null);
        setMessages([]);
        setActions([]);
        setTraces([]);
        setEscalated(false);
        setEscalationBrief(null);
        sessionIdRef.current = null;
      }
      await loadCustomers();
    } catch {
      // silent
    }
  }, [selectedPnr, loadCustomers]);
  const handleScenarioCreated = useCallback(async (pnr: string) => {
    setShowAddModal(false);
    await loadCustomers();      // refresh sidebar list
    selectScenario(pnr);        // auto-select the new scenario
  }, [loadCustomers]);          // eslint-disable-line

  const selectedCustomer = customers.find((c) => c.pnr === selectedPnr) ?? null;

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* ── Top nav ── */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
            <Plane size={15} className="text-brand-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight">
              SkyConnect <span className="text-brand-500">ResolutionAI</span>
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Disruption Resolution Platform</p>
          </div>
        </div>

        {/* Tab switcher */}
        <nav className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1">
          {(["agent", "supervisor"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-gray-700 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab === "agent"
                ? <><Plane size={13} /> Agent</>
                : <><LayoutDashboard size={13} /> Supervisor</>}
            </button>
          ))}
        </nav>

        {/* Backend status */}
        <div className="flex items-center gap-2 text-xs">
          {backendOk === null ? (
            <span className="text-gray-600 flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Connecting…</span>
          ) : backendOk ? (
            <span className="text-green-400 flex items-center gap-1"><Wifi size={12} /> Backend connected</span>
          ) : (
            <button onClick={loadCustomers} className="text-red-400 flex items-center gap-1 hover:text-red-300">
              <WifiOff size={12} /> Reconnect
            </button>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      {activeTab === "supervisor" ? (
        <div className="flex-1 overflow-hidden">
          <SupervisorDashboard />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left sidebar: scenario selector ── */}
          <div className="w-64 shrink-0 border-r border-gray-800 bg-gray-900/30 flex flex-col overflow-hidden">
            <button
              onClick={() => setScenarioOpen(!scenarioOpen)}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scenarios</p>
              <ChevronDown
                size={14}
                className={`text-gray-500 transition-transform ${scenarioOpen ? "" : "-rotate-90"}`}
              />
            </button>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!customersLoaded ? (
                <div className="text-xs text-gray-600 text-center py-6">
                  {backendOk === false ? (
                    <span>Backend offline — run<br /><code className="text-red-400">uvicorn main:app</code></span>
                  ) : (
                    <span className="flex items-center justify-center gap-1">
                      <RefreshCw size={11} className="animate-spin" /> Loading…
                    </span>
                  )}
                </div>
              ) : (
                <>
                  {customers.map((c) => (
                    <ScenarioCard
                      key={c.pnr}
                      customer={c}
                      selected={selectedPnr === c.pnr}
                      onClick={() => selectScenario(c.pnr)}
                      onDelete={c.custom ? () => deleteScenario(c.pnr) : undefined}
                    />
                  ))}
                  {/* Add custom scenario button */}
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed 
                               border-gray-700 hover:border-brand-500/50 hover:bg-brand-500/5 text-gray-500 
                               hover:text-brand-500 text-xs font-medium transition-all"
                  >
                    <Plus size={13} />
                    Add Custom Scenario
                  </button>
                </>
              )}
            </div>

            {/* Reset button */}
            {selectedPnr && (
              <div className="p-3 border-t border-gray-800">
                <button
                  onClick={() => selectScenario(selectedPnr)}
                  className="w-full btn-ghost text-xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={12} /> Reset Conversation
                </button>
              </div>
            )}
          </div>

          {/* ── Center: chat ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedPnr ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                  <Plane size={28} className="text-brand-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white mb-1">Select a Scenario</p>
                  <p className="text-sm text-gray-500 max-w-xs">
                    Choose one of the three customer scenarios from the left panel to begin the resolution conversation.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 max-w-xs text-xs text-gray-600 text-center">
                  <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">Priya<br/>Cancelled flight</div>
                  <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">Arvind<br/>4h delay</div>
                  <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">Meher<br/>6h delay</div>
                </div>
              </div>
            ) : (
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                isEscalated={escalated}
                sentiment={latestSentiment}
                customer={selectedCustomer}
                onSend={handleSend}
              />
            )}
          </div>

          {/* ── Right panel: action log + reasoning ── */}
          <div className="w-80 shrink-0 border-l border-gray-800 flex flex-col overflow-hidden min-h-0">
            {/* Action Log — resizable top section */}
            <div style={{ height: actionLogHeight }} className="shrink-0 overflow-hidden flex flex-col border-b border-gray-800">
              <ActionLog actions={actions} compliance={latestCompliance} />
            </div>

            {/* Escalation card — shows when escalated */}
            {escalated && escalationBrief && (
              <div className="border-b border-gray-800 p-3 overflow-y-auto max-h-80">
                <EscalationCard
                  brief={escalationBrief}
                  sessionId={sessionIdRef.current ?? undefined}
                  onResolved={() => loadCustomers()}
                />
              </div>
            )}

            {/* Drag handle */}
            {reasoningVisible && (
              <div
                onMouseDown={onDragStart}
                className="h-1.5 shrink-0 bg-gray-800 hover:bg-brand-500/40 cursor-row-resize transition-colors flex items-center justify-center"
                title="Drag to resize"
              >
                <div className="w-8 h-0.5 rounded-full bg-gray-600" />
              </div>
            )}

            {/* Reasoning trace — takes all remaining space when visible */}
            <div className={`${reasoningVisible ? "flex-1" : "shrink-0"} overflow-hidden flex flex-col min-h-0`}>
              <ReasoningTrace
                traces={traces}
                visible={reasoningVisible}
                onToggle={() => setReasoningVisible(!reasoningVisible)}
              />
            </div>

            {/* Brain toggle hint */}
            {!reasoningVisible && (
              <div className="px-4 py-2 flex items-center gap-2 text-xs text-gray-600">
                <Brain size={12} />
                <span>{traces.length} reasoning traces hidden</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Scenario Modal */}
      {showAddModal && (
        <AddScenarioModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleScenarioCreated}
        />
      )}
    </div>
  );
}
