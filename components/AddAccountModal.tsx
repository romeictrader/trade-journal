"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Account } from "@/lib/types";
import AutocompleteInput from "./AutocompleteInput";

interface AddAccountModalProps {
  onClose: () => void;
  onSaved: () => void;
  account?: Account; // if provided, edit mode
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

const PROP_FIRM_SEEDS = [
  "APEX", "TopstepX", "Bulenox", "E8", "FTMO", "TradeDay",
  "FastTrackTrading", "Earn2Trade", "MyFundedFutures", "Topstep",
];
const PRESET_SIZES = [25000, 50000, 100000, 150000, 200000];
const PRESET_COLORS = [
  "#c9a84c", "#3b82f6", "#22c55e", "#a855f7",
  "#ef4444", "#f97316", "#ec4899", "#06b6d4",
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        background: enabled ? "#22c55e" : "#333",
        cursor: "pointer",
        padding: 0,
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute",
        top: 3,
        left: enabled ? 19 : 3,
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: "#fff",
        transition: "left 0.2s",
        display: "block",
      }} />
    </button>
  );
}

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
  const isEdit = !!account;
  const [propFirm, setPropFirm] = useState(account?.prop_firm ?? "");
  const [accountName, setAccountName] = useState(account?.account_name ?? "");
  const [accountSize, setAccountSize] = useState(account?.account_size ?? 50000);
  const [dailyLoss, setDailyLoss] = useState(account?.daily_loss_limit ?? 1000);
  const [maxDrawdown, setMaxDrawdown] = useState(account?.max_drawdown ?? 2500);
  const [profitTarget, setProfitTarget] = useState(account?.profit_target ?? 3000);
  const [dailyLossEnabled, setDailyLossEnabled] = useState(account?.daily_loss_enabled ?? true);
  const [maxDrawdownEnabled, setMaxDrawdownEnabled] = useState(account?.max_drawdown_enabled ?? true);
  const [profitTargetEnabled, setProfitTargetEnabled] = useState(account?.profit_target_enabled ?? true);
  const [color, setColor] = useState(account?.color ?? "#c9a84c");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSave() {
    if (!propFirm || !accountName) { setError("Prop firm and account name are required"); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setSaving(false); return; }

    const payload = {
      prop_firm: propFirm,
      account_name: accountName,
      account_size: accountSize,
      daily_loss_limit: dailyLoss,
      max_drawdown: maxDrawdown,
      profit_target: profitTarget,
      daily_loss_enabled: dailyLossEnabled,
      max_drawdown_enabled: maxDrawdownEnabled,
      profit_target_enabled: profitTargetEnabled,
      color,
    };

    const { error: err } = account
      ? await supabase.from("accounts").update(payload).eq("id", account.id)
      : await supabase.from("accounts").insert({ ...payload, user_id: user.id, starting_balance: accountSize });

    if (err) {
      setError(err.message);
      setSaving(false);
    } else {
      onSaved();
    }
  }

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

        <FieldRow label="Prop Firm">
          <AutocompleteInput
            fieldName="prop_firm"
            value={propFirm}
            onChange={setPropFirm}
            placeholder="Type prop firm name..."
            seedOptions={PROP_FIRM_SEEDS}
            userId={userId}
          />
        </FieldRow>

        <FieldRow label="Account Name">
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            style={inputStyle}
            placeholder="100K Account #1"
          />
        </FieldRow>

        <FieldRow label="Account Size">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {PRESET_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAccountSize(s)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: `1px solid ${accountSize === s ? "#c9a84c" : "#333"}`,
                  background: accountSize === s ? "#c9a84c22" : "transparent",
                  color: accountSize === s ? "#c9a84c" : "#888",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ${(s / 1000).toFixed(0)}K
              </button>
            ))}
          </div>
          <input
            type="number"
            value={accountSize}
            onChange={(e) => setAccountSize(parseFloat(e.target.value) || 0)}
            style={inputStyle}
          />
        </FieldRow>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <label style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Daily Loss Limit ($)</label>
            <Toggle enabled={dailyLossEnabled} onChange={setDailyLossEnabled} />
          </div>
          <input
            type="number"
            value={dailyLoss}
            onChange={(e) => setDailyLoss(parseFloat(e.target.value) || 0)}
            style={{ ...inputStyle, opacity: dailyLossEnabled ? 1 : 0.4, pointerEvents: dailyLossEnabled ? "auto" : "none" }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <label style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Max Drawdown ($)</label>
            <Toggle enabled={maxDrawdownEnabled} onChange={setMaxDrawdownEnabled} />
          </div>
          <input
            type="number"
            value={maxDrawdown}
            onChange={(e) => setMaxDrawdown(parseFloat(e.target.value) || 0)}
            style={{ ...inputStyle, opacity: maxDrawdownEnabled ? 1 : 0.4, pointerEvents: maxDrawdownEnabled ? "auto" : "none" }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <label style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Profit Target ($)</label>
            <Toggle enabled={profitTargetEnabled} onChange={setProfitTargetEnabled} />
          </div>
          <input
            type="number"
            value={profitTarget}
            onChange={(e) => setProfitTarget(parseFloat(e.target.value) || 0)}
            style={{ ...inputStyle, opacity: profitTargetEnabled ? 1 : 0.4, pointerEvents: profitTargetEnabled ? "auto" : "none" }}
          />
        </div>

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
            disabled={saving}
            style={{
              flex: 1,
              background: saving ? "#555" : "#c9a84c",
              border: "none",
              borderRadius: 8,
              color: "#000",
              fontWeight: 700,
              fontSize: 14,
              padding: "13px",
              cursor: saving ? "not-allowed" : "pointer",
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
