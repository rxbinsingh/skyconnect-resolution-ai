import { useState } from "react";
import { X, Plus, Loader } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreated: (pnr: string) => void;
}

const TIERS = ["Gold", "Silver", "Platinum"];
const STATUSES = ["CANCELLED", "DELAYED", "UNAFFECTED"];

const DEFAULT_FORM = {
  name: "",
  pnr: "",
  tier: "Silver",
  flight: "",
  route: "",
  status: "DELAYED",
  delay_hours: "",
  email: "",
  phone: "",
};

export default function AddScenarioModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError("Customer name is required");
    if (!form.flight.trim()) return setError("Flight number is required");
    if (!form.route.trim()) return setError("Route is required");
    if (form.status === "DELAYED" && !form.delay_hours)
      return setError("Delay hours required for delayed flights");

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        tier: form.tier,
        flight: form.flight.trim(),
        route: form.route.trim(),
        status: form.status,
      };
      if (form.pnr.trim()) body.pnr = form.pnr.trim();
      if (form.status === "DELAYED" && form.delay_hours)
        body.delay_hours = parseInt(form.delay_hours);
      if (form.email.trim()) body.email = form.email.trim();
      if (form.phone.trim()) body.phone = form.phone.trim();

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Failed to create scenario");
      }

      const data = await res.json();
      onCreated(data.pnr);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md card overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <p className="text-sm font-semibold text-white">Add Custom Scenario</p>
            <p className="text-xs text-gray-500 mt-0.5">Create a new customer disruption scenario</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Row: name + tier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Customer Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white 
                           placeholder:text-gray-600 focus:outline-none focus:border-brand-500/60"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Loyalty Tier</label>
              <select
                value={form.tier}
                onChange={(e) => set("tier", e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white 
                           focus:outline-none focus:border-brand-500/60"
              >
                {TIERS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Row: flight + pnr */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Flight Number *</label>
              <input
                type="text"
                value={form.flight}
                onChange={(e) => set("flight", e.target.value)}
                placeholder="SK-401"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white 
                           placeholder:text-gray-600 focus:outline-none focus:border-brand-500/60"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">PNR <span className="text-gray-600">(auto if blank)</span></label>
              <input
                type="text"
                value={form.pnr}
                onChange={(e) => set("pnr", e.target.value.toUpperCase())}
                placeholder="CUST-XXXX"
                maxLength={10}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white 
                           placeholder:text-gray-600 focus:outline-none focus:border-brand-500/60 font-mono"
              />
            </div>
          </div>

          {/* Route */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Route *</label>
            <input
              type="text"
              value={form.route}
              onChange={(e) => set("route", e.target.value)}
              placeholder="Chennai → Mumbai"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white 
                         placeholder:text-gray-600 focus:outline-none focus:border-brand-500/60"
            />
          </div>

          {/* Row: status + delay */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Flight Status</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white 
                           focus:outline-none focus:border-brand-500/60"
              >
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            {form.status === "DELAYED" && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Delay (hours) *</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={form.delay_hours}
                  onChange={(e) => set("delay_hours", e.target.value)}
                  placeholder="e.g. 3"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white 
                             placeholder:text-gray-600 focus:outline-none focus:border-brand-500/60"
                />
              </div>
            )}
          </div>

          {/* Optional contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email <span className="text-gray-600">(optional)</span></label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="customer@example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white 
                           placeholder:text-gray-600 focus:outline-none focus:border-brand-500/60"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Phone <span className="text-gray-600">(optional)</span></label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91-98xxxxxxxx"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white 
                           placeholder:text-gray-600 focus:outline-none focus:border-brand-500/60"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Policy hint */}
          {form.status === "DELAYED" && form.delay_hours && (
            <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
              {parseInt(form.delay_hours) < 3 && "Policy: ₹500 meal voucher only"}
              {parseInt(form.delay_hours) >= 3 && parseInt(form.delay_hours) <= 5 && "Policy: Meal voucher + lounge access"}
              {parseInt(form.delay_hours) > 5 && "Policy: Meal voucher + lounge access + hotel (delayed hours only)"}
            </div>
          )}
          {form.status === "CANCELLED" && (
            <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
              Policy: Free rebooking within 24h or full refund — customer's choice
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
              {loading ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
              {loading ? "Creating…" : "Create Scenario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
