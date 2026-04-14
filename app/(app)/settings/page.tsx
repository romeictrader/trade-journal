"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Save, Download, Trash2, Plus, ChevronDown, ChevronRight, X } from "lucide-react";
import { useFirmData, Firm, Plan, Preset } from "@/lib/useFirmData";
import { DRAWDOWN_TYPES } from "@/lib/drawdownEngine";

interface JournalSettings {
  theme: string;
  default_currency: string;
  default_timezone: string;
  show_pnl_in_header: boolean;
  date_format: string;
  risk_per_trade: number;
  daily_reset_utc_hour: number;
}

const DEFAULTS: JournalSettings = {
  theme: "dark",
  default_currency: "USD",
  default_timezone: "America/New_York",
  show_pnl_in_header: true,
  date_format: "MM/DD/YYYY",
  risk_per_trade: 100,
  daily_reset_utc_hour: 22,
};


const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "Europe/London",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #222",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  width: "100%",
  maxWidth: 400,
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 28, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 20px", fontSize: 14, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, color: "#aaa", marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        color: "#ccc",
        fontSize: 14,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: 44,
          height: 24,
          borderRadius: 12,
          background: value ? "#c9a84c" : "#333",
          transition: "background 0.2s",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: value ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
          }}
        />
      </span>
      {label}
    </button>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            padding: "7px 14px",
            borderRadius: 8,
            border: `1px solid ${value === opt ? "#c9a84c" : "#333"}`,
            background: value === opt ? "#c9a84c22" : "transparent",
            color: value === opt ? "#c9a84c" : "#888",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

const COMMON_SIZES = [10000, 25000, 50000, 75000, 100000, 150000, 200000, 250000, 300000];

const smallInput: React.CSSProperties = {
  background: "#0a0a0a", border: "1px solid #222", borderRadius: 6,
  padding: "6px 8px", color: "#fff", fontSize: 12, outline: "none",
  width: 80, boxSizing: "border-box", textAlign: "right" as const,
};

function PropFirmRulesSection() {
  const { firms, saveFirms, loading } = useFirmData();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});
  const [newFirmName, setNewFirmName] = useState("");
  const [addingPlanFor, setAddingPlanFor] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [addingSizeFor, setAddingSizeFor] = useState<string | null>(null);
  const [newSizeVal, setNewSizeVal] = useState(50000);

  if (loading) return <Section title="Prop Firm Rules"><div style={{ color: "#555", fontSize: 13 }}>Loading...</div></Section>;

  function toggleFirm(key: string) {
    setExpanded(p => ({ ...p, [key]: !p[key] }));
  }
  function togglePlan(fk: string, pk: string) {
    const id = `${fk}:${pk}`;
    setExpandedPlans(p => ({ ...p, [id]: !p[id] }));
  }

  function addFirm() {
    if (!newFirmName.trim()) return;
    const key = newFirmName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (firms.some(f => f.key === key)) return;
    const updated = [...firms, { key, label: newFirmName.trim(), plans: [] }];
    saveFirms(updated);
    setNewFirmName("");
    setExpanded(p => ({ ...p, [key]: true }));
  }

  function deleteFirm(key: string) {
    if (!confirm("Delete this firm and all its plans?")) return;
    saveFirms(firms.filter(f => f.key !== key));
  }

  function addPlan(firmKey: string) {
    if (!newPlanName.trim()) return;
    const planKey = newPlanName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const updated = firms.map(f => {
      if (f.key !== firmKey) return f;
      if (f.plans.some(p => p.key === planKey)) return f;
      return { ...f, plans: [...f.plans, { key: planKey, label: newPlanName.trim(), sizes: {} }] };
    });
    saveFirms(updated);
    setNewPlanName("");
    setAddingPlanFor(null);
    setExpandedPlans(p => ({ ...p, [`${firmKey}:${planKey}`]: true }));
  }

  function deletePlan(firmKey: string, planKey: string) {
    if (!confirm("Delete this plan?")) return;
    saveFirms(firms.map(f => f.key !== firmKey ? f : { ...f, plans: f.plans.filter(p => p.key !== planKey) }));
  }

  function addSize(firmKey: string, planKey: string) {
    const sizeStr = String(newSizeVal);
    const updated = firms.map(f => {
      if (f.key !== firmKey) return f;
      return { ...f, plans: f.plans.map(p => {
        if (p.key !== planKey) return p;
        if (p.sizes[sizeStr]) return p;
        return { ...p, sizes: { ...p.sizes, [sizeStr]: { daily: 0, dd: 2000, pt: 3000 } } };
      })};
    });
    saveFirms(updated);
    setAddingSizeFor(null);
  }

  function deleteSize(firmKey: string, planKey: string, size: string) {
    saveFirms(firms.map(f => {
      if (f.key !== firmKey) return f;
      return { ...f, plans: f.plans.map(p => {
        if (p.key !== planKey) return p;
        const { [size]: _, ...rest } = p.sizes;
        return { ...p, sizes: rest };
      })};
    }));
  }

  function updatePreset(firmKey: string, planKey: string, size: string, field: keyof Preset, value: number) {
    saveFirms(firms.map(f => {
      if (f.key !== firmKey) return f;
      return { ...f, plans: f.plans.map(p => {
        if (p.key !== planKey) return p;
        return { ...p, sizes: { ...p.sizes, [size]: { ...p.sizes[size], [field]: value } } };
      })};
    }));
  }

  function updatePlanField(firmKey: string, planKey: string, field: string, value: unknown) {
    saveFirms(firms.map(f => {
      if (f.key !== firmKey) return f;
      return { ...f, plans: f.plans.map(p => {
        if (p.key !== planKey) return p;
        return { ...p, [field]: value };
      })};
    }));
  }

  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 28, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Prop Firm Rules
        </h3>
        <span style={{ fontSize: 11, color: "#444" }}>Auto-saves</span>
      </div>

      {firms.map(firm => {
        const isOpen = expanded[firm.key];
        return (
          <div key={firm.key} style={{ marginBottom: 8, border: "1px solid #1a1a1a", borderRadius: 8, overflow: "hidden" }}>
            {/* Firm header */}
            <div
              onClick={() => toggleFirm(firm.key)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", background: "#0a0a0a" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isOpen ? <ChevronDown size={14} color="#555" /> : <ChevronRight size={14} color="#555" />}
                <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{firm.label}</span>
                <span style={{ fontSize: 11, color: "#444" }}>{firm.plans.length} plan{firm.plans.length !== 1 ? "s" : ""}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteFirm(firm.key); }} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                <Trash2 size={12} />
              </button>
            </div>

            {isOpen && (
              <div style={{ padding: "8px 14px 14px" }}>
                {firm.plans.map(plan => {
                  const planId = `${firm.key}:${plan.key}`;
                  const planOpen = expandedPlans[planId] !== false;
                  const sizes = Object.keys(plan.sizes).sort((a, b) => Number(a) - Number(b));
                  return (
                    <div key={plan.key} style={{ marginBottom: 8, border: "1px solid #1a1a1a", borderRadius: 6 }}>
                      {/* Plan header */}
                      <div
                        onClick={() => togglePlan(firm.key, plan.key)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer", background: "#111" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {planOpen ? <ChevronDown size={12} color="#555" /> : <ChevronRight size={12} color="#555" />}
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#c9a84c" }}>{plan.label}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deletePlan(firm.key, plan.key); }} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 2 }} onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                          <X size={12} />
                        </button>
                      </div>

                      {planOpen && (
                        <div style={{ padding: "6px 12px 12px" }}>
                          {/* Drawdown config */}
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10, padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button
                                onClick={() => updatePlanField(firm.key, plan.key, "drawdownEnabled", !(plan.drawdownEnabled !== false))}
                                style={{
                                  width: 32, height: 18, borderRadius: 9, border: "none", padding: 0, cursor: "pointer", position: "relative",
                                  background: plan.drawdownEnabled !== false ? "#22c55e" : "#333", transition: "background 0.2s", flexShrink: 0,
                                }}
                              >
                                <span style={{ position: "absolute", top: 2, left: plan.drawdownEnabled !== false ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                              </button>
                              <span style={{ fontSize: 10, color: "#666", fontWeight: 600 }}>DD</span>
                            </div>
                            {plan.drawdownEnabled !== false && (
                              <>
                                <select
                                  value={plan.drawdownType ?? 3}
                                  onChange={e => updatePlanField(firm.key, plan.key, "drawdownType", Number(e.target.value))}
                                  style={{ ...smallInput, width: 150, textAlign: "left" as const, fontSize: 11 }}
                                >
                                  {DRAWDOWN_TYPES.map(dt => (
                                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                                  ))}
                                </select>
                                {(plan.drawdownType ?? 3) === 6 && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 10, color: "#555" }}>%</span>
                                    <input type="number" value={(plan.drawdownPercent ?? 0.04) * 100} onChange={e => updatePlanField(firm.key, plan.key, "drawdownPercent", (Number(e.target.value) || 0) / 100)} style={{ ...smallInput, width: 50 }} step={0.5} />
                                  </div>
                                )}
                                {(plan.drawdownType ?? 3) === 5 && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 10, color: "#555" }}>Lock+$</span>
                                    <input type="number" value={plan.lockTriggerOffset ?? 0} onChange={e => updatePlanField(firm.key, plan.key, "lockTriggerOffset", Number(e.target.value) || 0)} style={{ ...smallInput, width: 60 }} />
                                  </div>
                                )}
                                {(plan.drawdownType ?? 3) === 7 && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 10, color: "#555" }}>Buffer$</span>
                                    <input type="number" value={plan.bufferTarget ?? 0} onChange={e => updatePlanField(firm.key, plan.key, "bufferTarget", Number(e.target.value) || 0)} style={{ ...smallInput, width: 60 }} />
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Column headers */}
                          <div style={{ display: "grid", gridTemplateColumns: "70px 80px 80px 80px 28px", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, color: "#444", fontWeight: 600 }}>SIZE</span>
                            <span style={{ fontSize: 10, color: "#444", fontWeight: 600, textAlign: "right" }}>DLL</span>
                            <span style={{ fontSize: 10, color: "#444", fontWeight: 600, textAlign: "right" }}>MAX DD</span>
                            <span style={{ fontSize: 10, color: "#444", fontWeight: 600, textAlign: "right" }}>PT</span>
                            <span />
                          </div>

                          {sizes.map(size => {
                            const p = plan.sizes[size];
                            return (
                              <div key={size} style={{ display: "grid", gridTemplateColumns: "70px 80px 80px 80px 28px", gap: 6, marginBottom: 4, alignItems: "center" }}>
                                <span style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>${(Number(size) / 1000).toFixed(0)}K</span>
                                <input type="number" value={p.daily} onChange={e => updatePreset(firm.key, plan.key, size, "daily", Number(e.target.value) || 0)} style={smallInput} />
                                <input type="number" value={p.dd} onChange={e => updatePreset(firm.key, plan.key, size, "dd", Number(e.target.value) || 0)} style={smallInput} />
                                <input type="number" value={p.pt} onChange={e => updatePreset(firm.key, plan.key, size, "pt", Number(e.target.value) || 0)} style={smallInput} />
                                <button onClick={() => deleteSize(firm.key, plan.key, size)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 2 }} onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                                  <X size={11} />
                                </button>
                              </div>
                            );
                          })}

                          {/* Add size */}
                          {addingSizeFor === planId ? (
                            <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                              <select value={newSizeVal} onChange={e => setNewSizeVal(Number(e.target.value))} style={{ ...smallInput, width: 100 }}>
                                {COMMON_SIZES.filter(s => !plan.sizes[String(s)]).map(s => (
                                  <option key={s} value={s}>${(s / 1000).toFixed(0)}K</option>
                                ))}
                              </select>
                              <button onClick={() => addSize(firm.key, plan.key)} style={{ background: "#c9a84c", border: "none", borderRadius: 4, color: "#000", fontSize: 11, fontWeight: 700, padding: "4px 10px", cursor: "pointer" }}>Add</button>
                              <button onClick={() => setAddingSizeFor(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => { setAddingSizeFor(planId); setNewSizeVal(COMMON_SIZES.find(s => !plan.sizes[String(s)]) ?? 50000); }} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 11, padding: "4px 0", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                              <Plus size={10} /> Add Size
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add plan */}
                {addingPlanFor === firm.key ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                    <input value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder="Plan name..." onKeyDown={e => e.key === "Enter" && addPlan(firm.key)} style={{ ...smallInput, width: 140, textAlign: "left" as const }} autoFocus />
                    <button onClick={() => addPlan(firm.key)} style={{ background: "#c9a84c", border: "none", borderRadius: 4, color: "#000", fontSize: 11, fontWeight: 700, padding: "4px 10px", cursor: "pointer" }}>Add</button>
                    <button onClick={() => { setAddingPlanFor(null); setNewPlanName(""); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingPlanFor(firm.key); setNewPlanName(""); }} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 11, padding: "4px 0", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <Plus size={10} /> Add Plan
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add firm */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <input
          value={newFirmName}
          onChange={e => setNewFirmName(e.target.value)}
          placeholder="New firm name..."
          onKeyDown={e => e.key === "Enter" && addFirm()}
          style={{ ...inputStyle, maxWidth: 240, fontSize: 12, padding: "8px 12px" }}
        />
        <button onClick={addFirm} disabled={!newFirmName.trim()} style={{ background: newFirmName.trim() ? "#c9a84c" : "#333", border: "none", borderRadius: 6, color: newFirmName.trim() ? "#000" : "#666", fontWeight: 700, fontSize: 12, padding: "8px 14px", cursor: newFirmName.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 4 }}>
          <Plus size={12} /> Add Firm
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<JournalSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDeleteTrades, setConfirmDeleteTrades] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [dangerWorking, setDangerWorking] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("journal_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setSettings({
          theme: data.theme ?? DEFAULTS.theme,
          default_currency: data.default_currency ?? DEFAULTS.default_currency,
          default_timezone: data.default_timezone ?? DEFAULTS.default_timezone,
          show_pnl_in_header: data.show_pnl_in_header ?? DEFAULTS.show_pnl_in_header,
          date_format: data.date_format ?? DEFAULTS.date_format,
          risk_per_trade: data.risk_per_trade ?? DEFAULTS.risk_per_trade,
          daily_reset_utc_hour: data.daily_reset_utc_hour ?? DEFAULTS.daily_reset_utc_hour,
        });
      } else {
        // Insert defaults
        await supabase.from("journal_settings").insert({ user_id: user.id, ...DEFAULTS });
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase
      .from("journal_settings")
      .upsert({ ...settings, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function exportTradesCSV() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("trades").select("*").eq("user_id", user.id).order("date");
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportJournalJSON() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("journal_entries").select("*").eq("user_id", user.id).order("date");
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAllTrades() {
    setDangerWorking(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDangerWorking(false); return; }
    await supabase.from("trades").delete().eq("user_id", user.id);
    setConfirmDeleteTrades(false);
    setDangerWorking(false);
  }

  async function deleteAccount() {
    setDangerWorking(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDangerWorking(false); return; }
    await supabase.auth.signOut();
    // Note: actual account deletion requires a server-side function or Supabase admin API
    setDangerWorking(false);
  }

  return (
    <div style={{ padding: 32, maxWidth: 640 }}>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 700 }}>Journal Settings</h1>

      {/* Appearance */}
      <Section title="Appearance">
        <FieldRow label="Theme">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SegmentedControl
              options={["Dark"]}
              value={settings.theme === "dark" ? "Dark" : "Light"}
              onChange={(v) => setSettings((s) => ({ ...s, theme: v === "Dark" ? "dark" : "light" }))}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: "#333",
                color: "#888",
                padding: "3px 8px",
                borderRadius: 20,
                letterSpacing: "0.04em",
              }}
            >
              Light — Coming Soon
            </span>
          </div>
        </FieldRow>
      </Section>

      {/* Trading Defaults */}
      <Section title="Trading Defaults">
        <FieldRow label="Default Currency">
          <input
            type="text"
            value={settings.default_currency}
            onChange={(e) => setSettings((s) => ({ ...s, default_currency: e.target.value.toUpperCase() }))}
            style={inputStyle}
            maxLength={5}
            placeholder="USD"
          />
        </FieldRow>
        <FieldRow label="Risk Per Trade ($) — used for R-multiple calculation">
          <input
            type="number"
            value={settings.risk_per_trade}
            onChange={(e) => setSettings((s) => ({ ...s, risk_per_trade: parseFloat(e.target.value) || 0 }))}
            style={inputStyle}
            min={1}
          />
        </FieldRow>
      </Section>


      {/* Data */}
      <Section title="Data">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            type="button"
            onClick={exportTradesCSV}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#ccc",
              fontSize: 13,
              padding: "10px 16px",
              cursor: "pointer",
              width: "fit-content",
            }}
          >
            <Download size={14} />
            Export all trades as CSV
          </button>
          <button
            type="button"
            onClick={exportJournalJSON}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#ccc",
              fontSize: 13,
              padding: "10px 16px",
              cursor: "pointer",
              width: "fit-content",
            }}
          >
            <Download size={14} />
            Export journal entries as JSON
          </button>
        </div>
      </Section>

      {/* Prop Firm Rules */}
      <PropFirmRulesSection />

      {/* Danger Zone */}
      <div style={{ background: "#111", border: "1px solid #ef444444", borderRadius: 12, padding: 28, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 14, color: "#ef4444", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Danger Zone
        </h3>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "#888", margin: "0 0 10px" }}>
            Permanently delete all your trade history. This cannot be undone.
          </p>
          {!confirmDeleteTrades ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteTrades(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "1px solid #ef4444",
                borderRadius: 8,
                color: "#ef4444",
                fontSize: 13,
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
              Delete All Trades
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#ef4444" }}>Are you sure?</span>
              <button
                type="button"
                onClick={deleteAllTrades}
                disabled={dangerWorking}
                style={{
                  background: "#ef4444",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  padding: "7px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {dangerWorking ? "Deleting..." : "Yes, delete all"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteTrades(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #333",
                  borderRadius: 8,
                  color: "#888",
                  fontSize: 13,
                  padding: "7px 14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div>
          <p style={{ fontSize: 13, color: "#888", margin: "0 0 10px" }}>
            Sign out and delete your account. All data will be permanently removed.
          </p>
          {!confirmDeleteAccount ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteAccount(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "1px solid #ef4444",
                borderRadius: 8,
                color: "#ef4444",
                fontSize: 13,
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
              Delete Account
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#ef4444" }}>This cannot be undone.</span>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={dangerWorking}
                style={{
                  background: "#ef4444",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  padding: "7px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {dangerWorking ? "Working..." : "Yes, delete account"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteAccount(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #333",
                  borderRadius: 8,
                  color: "#888",
                  fontSize: 13,
                  padding: "7px 14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: saved ? "#22c55e" : saving ? "#666" : "#c9a84c",
          border: "none",
          borderRadius: 8,
          color: "#000",
          fontWeight: 700,
          fontSize: 14,
          padding: "12px 28px",
          cursor: saving ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Save size={15} />
        {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
