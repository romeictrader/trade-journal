"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trade } from "@/lib/types";
import { Trash2, Eye } from "lucide-react";

export default function TradesPage() {
  const router = useRouter();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<keyof Trade>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState<"All" | "Win" | "Loss" | "Breakeven">("All");

  async function loadTrades() {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("trades").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
      if (data) setTrades(data);
    } catch (err) {
      console.error("Failed to load trades:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTrades(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this trade? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("trades").delete().eq("id", id);
    loadTrades();
  }

  const filtered = filter === "All" ? trades : trades.filter(t => t.outcome === filter);
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortField], bv = b[sortField];
    if (av === undefined || bv === undefined) return 0;
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  function toggleSort(f: keyof Trade) {
    if (sortField === f) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("desc"); }
  }

  const cols: { key: keyof Trade; label: string }[] = [
    { key: "date", label: "Date" },
    { key: "contract", label: "Contract" },
    { key: "direction", label: "Direction" },
    { key: "session", label: "Session" },
    { key: "contracts", label: "Contracts" },
    { key: "pnl", label: "P&L" },
    { key: "rr", label: "R:R" },
    { key: "outcome", label: "Outcome" },
    { key: "setup_tag", label: "Setup" },
    { key: "execution", label: "Execution" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <style>{`@keyframes pulse { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Trade Log</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>All logged trades — add trades from your account dashboard</p>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["All", "Win", "Loss", "Breakeven"] as const).map((f) => {
          const active = filter === f;
          const colors: Record<string, string> = { All: "#c9a84c", Win: "#22c55e", Loss: "#ef4444", Breakeven: "#888" };
          const c = colors[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: `1px solid ${active ? c : "#333"}`,
                background: active ? `${c}22` : "transparent",
                color: active ? c : "#666",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {f}{f !== "All" ? ` (${trades.filter(t => t.outcome === f).length})` : ` (${trades.length})`}
            </button>
          );
        })}
      </div>

      <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #222" }}>
              {cols.map(({ key, label }) => (
                <th key={key} onClick={() => toggleSort(key)} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                  {label} {sortField === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
              ))}
              <th style={{ padding: "12px 16px", fontSize: 11, color: "#555", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  {Array.from({ length: cols.length + 1 }).map((__, ci) => (
                    <td key={ci} style={{ padding: "11px 16px" }}>
                      <div style={{ height: 14, borderRadius: 4, background: "linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%)", backgroundSize: "200% 100%", animation: "pulse 1.5s ease-in-out infinite" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 1} style={{ padding: 40, textAlign: "center", color: "#555", fontSize: 13 }}>
                  No trades yet. Add trades from your account dashboard.
                </td>
              </tr>
            ) : (
              sorted.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: "#aaa" }}>{t.date}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#fff" }}>{t.contract}</td>
                  <td style={{ padding: "11px 16px" }}>
                    {t.direction ? <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: t.direction === "Long" ? "#22c55e22" : "#ef444422", color: t.direction === "Long" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{t.direction}</span> : <span style={{ color: "#444" }}>—</span>}
                  </td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: "#888" }}>{t.session ?? "—"}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: "#ccc" }}>{t.contracts}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 700, color: t.pnl >= 0 ? "#22c55e" : "#ef4444" }}>${t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: "#888" }}>{t.rr != null ? `${t.rr}R` : "—"}</td>
                  <td style={{ padding: "11px 16px" }}>
                    {t.outcome ? <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: t.outcome === "Win" ? "#22c55e22" : t.outcome === "Loss" ? "#ef444422" : "#c9a84c22", color: t.outcome === "Win" ? "#22c55e" : t.outcome === "Loss" ? "#ef4444" : "#c9a84c", fontWeight: 600 }}>{t.outcome}</span> : <span style={{ color: "#444" }}>—</span>}
                  </td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: "#666" }}>{t.setup_tag ?? "—"}</td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: "#666" }}>{t.execution ?? "—"}</td>
                  <td style={{ padding: "11px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => router.push(`/trades/${t.id}`)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 4 }} onMouseEnter={(e) => (e.currentTarget.style.color = "#c9a84c")} onMouseLeave={(e) => (e.currentTarget.style.color = "#555")} title="View">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: 4 }} onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={(e) => (e.currentTarget.style.color = "#444")} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
