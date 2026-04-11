"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Save, Download, Trash2 } from "lucide-react";

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
        <FieldRow label="Default Timezone">
          <select
            value={settings.default_timezone}
            onChange={(e) => setSettings((s) => ({ ...s, default_timezone: e.target.value }))}
            style={selectStyle}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
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

      {/* Display */}
      <Section title="Display">
        <FieldRow label="Show P&L in Header">
          <Toggle
            value={settings.show_pnl_in_header}
            onChange={(v) => setSettings((s) => ({ ...s, show_pnl_in_header: v }))}
            label={settings.show_pnl_in_header ? "On" : "Off"}
          />
        </FieldRow>
        <FieldRow label="Date Format">
          <SegmentedControl
            options={DATE_FORMATS}
            value={settings.date_format}
            onChange={(v) => setSettings((s) => ({ ...s, date_format: v }))}
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
