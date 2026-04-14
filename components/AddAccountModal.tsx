"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Account } from "@/lib/types";
import { useFirmData } from "@/lib/useFirmData";

interface AddAccountModalProps {
  onClose: () => void;
  onSaved: () => void;
  account?: Account;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid #222",
  borderRadius: 8,
  padding: "9px 12px",
  color: "#fff",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};



const PRESET_COLORS = [
  "#c9a84c", "#3b82f6", "#22c55e", "#a855f7",
  "#ef4444", "#f97316", "#ec4899", "#06b6d4",
];


function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function AddAccountModal({ onClose, onSaved, account }: AddAccountModalProps) {
  const { firmList, firmData, loading: firmsLoading } = useFirmData();

  const initialFirmLabel = account ? (firmList.find(f => f.label === account.prop_firm || f.key === account.prop_firm.toLowerCase().replace(/[^a-z0-9]/g, ""))?.label ?? "") : "";

  const [propFirm, setPropFirm] = useState(initialFirmLabel);
  const [planType, setPlanType] = useState("");
  const [accountName, setAccountName] = useState(account?.account_name ?? "");
  const [accountSize, setAccountSize] = useState(account?.account_size ?? 0);
  const [color, setColor] = useState(account?.color ?? "#c9a84c");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Derived values
  const firmKey = firmList.find(f => f.label === propFirm)?.key ?? "";
  const firmConfig = firmKey ? firmData[firmKey] : null;
  const plans = firmConfig?.plans ?? [];
  const selectedPlan = plans.find(p => p.key === planType) ?? null;
  const availableSizes = selectedPlan ? Object.keys(selectedPlan.sizes).map(Number).sort((a, b) => a - b) : [];
  const preset = selectedPlan?.sizes[String(accountSize)] ?? null;

  // Auto-select plan when firm changes
  useEffect(() => {
    if (plans.length === 1) {
      setPlanType(plans[0].key);
    } else if (plans.length > 1) {
      setPlanType(plans[0].key);
    } else {
      setPlanType("");
    }
    setAccountSize(0);
  }, [firmKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first size when plan changes
  useEffect(() => {
    if (selectedPlan) {
      const sizes = Object.keys(selectedPlan.sizes).map(Number).sort((a, b) => a - b);
      if (sizes.length > 0 && !sizes.includes(accountSize)) {
        setAccountSize(sizes[0]);
      }
    }
  }, [planType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSave() {
    if (!propFirm || !accountName || !preset) {
      setError("Please select a prop firm, plan, size, and enter account name");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setSaving(false); return; }

    const ddType = selectedPlan?.drawdownType ?? 2;
    const payload: Record<string, unknown> = {
      prop_firm: propFirm,
      account_name: accountName,
      account_size: accountSize,
      daily_loss_limit: preset.daily,
      max_drawdown: preset.dd,
      profit_target: preset.pt,
      daily_loss_enabled: preset.daily > 0,
      max_drawdown_enabled: selectedPlan?.drawdownEnabled !== false,
      profit_target_enabled: true,
      color,
      drawdown_type: ddType,
      drawdown_percent: ddType === 5 ? (selectedPlan?.drawdownPercent ?? 0.04) : null,
      lock_trigger_balance: ddType === 4 ? (selectedPlan?.lockTriggerOffset ? accountSize + selectedPlan.lockTriggerOffset : accountSize + preset.dd) : null,
      buffer_target: ddType === 6 ? (selectedPlan?.bufferTarget ?? preset.dd) : null,
    };

    const { error: err } = account
      ? await supabase.from("accounts").update(payload).eq("id", account.id)
      : await supabase.from("accounts").insert({ ...payload, user_id: user.id, starting_balance: accountSize });

    if (err) { setError(err.message); setSaving(false); }
    else { onSaved(); }
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 6,
    border: `1px solid ${active ? "#c9a84c" : "#333"}`,
    background: active ? "#c9a84c22" : "transparent",
    color: active ? "#c9a84c" : "#888",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.15s",
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div
        style={{
          width: 440,
          height: "100vh",
          background: "#111",
          borderLeft: "1px solid #222",
          overflowY: "auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{account ? "Edit Account" : "Add Account"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Prop Firm — select dropdown */}
        <FieldRow label="Prop Firm">
          <select
            value={propFirm}
            onChange={(e) => setPropFirm(e.target.value)}
            style={{
              ...inputStyle,
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              paddingRight: 32,
            }}
          >
            <option value="" style={{ background: "#111", color: "#888" }}>Select prop firm...</option>
            {firmList.map((f) => (
              <option key={f.key} value={f.label} style={{ background: "#111", color: "#fff" }}>
                {f.label}
              </option>
            ))}
          </select>
        </FieldRow>

        {/* Plan Type — only show if firm has multiple plans */}
        {plans.length > 1 && (
          <FieldRow label="Plan Type">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {plans.map((p) => (
                <button key={p.key} type="button" onClick={() => setPlanType(p.key)} style={btnStyle(planType === p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
          </FieldRow>
        )}

        {/* Account Name */}
        <FieldRow label="Account Name">
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            style={inputStyle}
            placeholder="My 50K Account"
          />
        </FieldRow>

        {/* Account Size — only show sizes available for selected plan */}
        {selectedPlan && (
          <FieldRow label="Account Size">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {availableSizes.map((s) => (
                <button key={s} type="button" onClick={() => setAccountSize(s)} style={btnStyle(accountSize === s)}>
                  ${(s / 1000).toFixed(0)}K
                </button>
              ))}
            </div>
          </FieldRow>
        )}

        {/* Account Rules — read-only, auto-generated */}
        {preset && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Account Rules
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 4, fontWeight: 600 }}>Daily Loss</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: preset.daily > 0 ? "#fff" : "#444" }}>
                  {preset.daily > 0 ? `$${preset.daily.toLocaleString()}` : "None"}
                </div>
              </div>
              <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 4, fontWeight: 600 }}>Max DD</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>
                  ${preset.dd.toLocaleString()}
                </div>
              </div>
              <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 4, fontWeight: 600 }}>Profit Target</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>
                  ${preset.pt.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Color */}
        <FieldRow label="Color">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: c,
                  border: color === c ? "3px solid #fff" : "3px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            ))}
          </div>
        </FieldRow>

        {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ marginTop: "auto", display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !preset}
            style={{
              flex: 1,
              background: saving ? "#555" : !preset ? "#333" : "#c9a84c",
              border: "none",
              borderRadius: 8,
              color: !preset ? "#666" : "#000",
              fontWeight: 700,
              fontSize: 14,
              padding: "13px",
              cursor: saving || !preset ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : account ? "Save Changes" : "Save Account"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#888",
              fontSize: 13,
              padding: "13px 20px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
