"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FUTURES, SETUP_TAGS } from "@/lib/types";

interface AddTradeModalProps {
  onClose: () => void;
  onSaved?: () => void;
}

export default function AddTradeModal({ onClose, onSaved }: AddTradeModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [contract, setContract] = useState("ES");
  const [direction, setDirection] = useState<"Long" | "Short">("Long");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [contracts, setContracts] = useState("1");
  const [setupTag, setSetupTag] = useState("");
  const [emotionBefore, setEmotionBefore] = useState(5);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const pointValue = FUTURES[contract] ?? 50;
  const pnlPreview =
    entryPrice && exitPrice
      ? (
          (parseFloat(exitPrice) - parseFloat(entryPrice)) *
          (direction === "Long" ? 1 : -1) *
          pointValue *
          parseInt(contracts || "1")
        ).toFixed(2)
      : null;

  async function handleSave() {
    if (!entryPrice || !exitPrice) {
      setError("Entry and exit price are required");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setSaving(false); return; }

    const pnl = parseFloat(pnlPreview ?? "0");
    const { error } = await supabase.from("trades").insert({
      user_id: user.id,
      date,
      contract,
      direction,
      entry_price: parseFloat(entryPrice),
      exit_price: parseFloat(exitPrice),
      contracts: parseInt(contracts),
      pnl,
      setup_tag: setupTag || null,
      emotion_before: emotionBefore,
      notes: notes || null,
    });

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      onSaved?.();
      onClose();
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{ flex: 1, background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      <div
        style={{
          width: 420,
          height: "100vh",
          background: "#111",
          borderLeft: "1px solid #222",
          overflowY: "auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Add Trade</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <FieldRow label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </FieldRow>

        <FieldRow label="Contract">
          <input
            list="contracts-list"
            value={contract}
            onChange={(e) => setContract(e.target.value.toUpperCase())}
            style={inputStyle}
            placeholder="ES, NQ, MES..."
          />
          <datalist id="contracts-list">
            {Object.keys(FUTURES).map((k) => <option key={k} value={k} />)}
          </datalist>
        </FieldRow>

        <FieldRow label="Direction">
          <div style={{ display: "flex", gap: 8 }}>
            {(["Long", "Short"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: direction === d ? (d === "Long" ? "#22c55e" : "#ef4444") : "#333",
                  background: direction === d ? (d === "Long" ? "#22c55e22" : "#ef444422") : "transparent",
                  color: direction === d ? (d === "Long" ? "#22c55e" : "#ef4444") : "#888",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Entry Price">
          <input
            type="number"
            step="0.01"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            style={inputStyle}
            placeholder="5000.00"
          />
        </FieldRow>

        <FieldRow label="Exit Price">
          <input
            type="number"
            step="0.01"
            value={exitPrice}
            onChange={(e) => setExitPrice(e.target.value)}
            style={inputStyle}
            placeholder="5010.00"
          />
        </FieldRow>

        <FieldRow label="Contracts">
          <input
            type="number"
            min="1"
            value={contracts}
            onChange={(e) => setContracts(e.target.value)}
            style={inputStyle}
          />
        </FieldRow>

        {pnlPreview !== null && (
          <div
            style={{
              background: parseFloat(pnlPreview) >= 0 ? "#22c55e1a" : "#ef44441a",
              border: `1px solid ${parseFloat(pnlPreview) >= 0 ? "#22c55e" : "#ef4444"}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: parseFloat(pnlPreview) >= 0 ? "#22c55e" : "#ef4444",
              fontWeight: 700,
              fontSize: 16,
              textAlign: "center",
            }}
          >
            P&L Preview: ${parseFloat(pnlPreview) >= 0 ? "+" : ""}{pnlPreview}
          </div>
        )}

        <FieldRow label="Setup">
          <select
            value={setupTag}
            onChange={(e) => setSetupTag(e.target.value)}
            style={{ ...inputStyle, background: "#0a0a0a" }}
          >
            <option value="">Select setup...</option>
            {SETUP_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FieldRow>

        <FieldRow label={`Emotion Before: ${emotionBefore}/10`}>
          <input
            type="range"
            min="1"
            max="10"
            value={emotionBefore}
            onChange={(e) => setEmotionBefore(parseInt(e.target.value))}
            style={{ width: "100%", accentColor: "#c9a84c" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, marginTop: 4 }}>
            <span>😰</span><span>😤</span><span>😊</span>
          </div>
        </FieldRow>

        <FieldRow label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder="Trade notes..."
          />
        </FieldRow>

        {error && (
          <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saving ? "#666" : "#c9a84c",
            border: "none",
            borderRadius: 8,
            color: "#000",
            fontWeight: 700,
            fontSize: 14,
            padding: "12px",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Trade"}
        </button>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
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
};
