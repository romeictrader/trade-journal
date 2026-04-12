"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trade, SETUP_TAGS } from "@/lib/types";
import StatCard from "@/components/StatCard";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { TrendingUp, Target, BarChart2, DollarSign, ArrowUpDown, TrendingDown } from "lucide-react";

type Tab = "overview" | "contract" | "time" | "setup";

export default function AnalysisPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Only load trades that belong to existing accounts
        const { data: accounts } = await supabase.from("accounts").select("id").eq("user_id", user.id);
        const accountIds = (accounts ?? []).map((a) => a.id);

        if (accountIds.length === 0) { setTrades([]); setLoading(false); return; }

        const { data } = await supabase
          .from("trades")
          .select("*")
          .in("account_id", accountIds)
          .order("date", { ascending: true });
        if (data) setTrades(data);
      } catch (err) {
        console.error("Failed to load analysis data:", err);
      } finally {
        setLoading(false);
      }
    }

    load();

    // Real-time updates
    const supabase = createClient();
    const channel = supabase
      .channel("analysis-trades")
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div style={{ padding: 32, color: "#888" }}>Loading analysis...</div>;

  // Stats
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;
  const expectancy = trades.length > 0 ? totalPnl / trades.length : 0;

  // Equity curve
  let cum = 0;
  const equityData = trades.map((t) => { cum += t.pnl; return { date: t.date, equity: cum }; });

  // By day of week
  const dowMap: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const t of trades) {
    const dow = new Date(t.date + "T12:00:00").getDay();
    if (dowMap[dow]) dowMap[dow].push(t.pnl);
  }
  const DOW_LABELS: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };
  const dowData = [1, 2, 3, 4, 5].map((d) => ({
    day: DOW_LABELS[d],
    pnl: dowMap[d].reduce((s, v) => s + v, 0),
  }));

  // Monthly P&L
  const monthMap: Record<string, number> = {};
  for (const t of trades) {
    const m = t.date.slice(0, 7);
    monthMap[m] = (monthMap[m] ?? 0) + t.pnl;
  }
  const monthData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, pnl]) => ({ month: m, pnl }));

  // By contract
  const contractMap: Record<string, { trades: Trade[] }> = {};
  for (const t of trades) {
    if (!contractMap[t.contract]) contractMap[t.contract] = { trades: [] };
    contractMap[t.contract].trades.push(t);
  }
  const contractData = Object.entries(contractMap).map(([c, { trades: ts }]) => ({
    contract: c,
    count: ts.length,
    winPct: (ts.filter((t) => t.pnl > 0).length / ts.length) * 100,
    avgPnl: ts.reduce((s, t) => s + t.pnl, 0) / ts.length,
    totalPnl: ts.reduce((s, t) => s + t.pnl, 0),
  }));

  // By setup
  const setupMap: Record<string, Trade[]> = {};
  for (const t of trades) {
    const s = t.setup_tag ?? "None";
    if (!setupMap[s]) setupMap[s] = [];
    setupMap[s].push(t);
  }
  const setupData = Object.entries(setupMap).map(([s, ts]) => ({
    setup: s,
    count: ts.length,
    winRate: (ts.filter((t) => t.pnl > 0).length / ts.length) * 100,
    totalPnl: ts.reduce((s, t) => s + t.pnl, 0),
  }));

  const tabStyle = (t: Tab): React.CSSProperties => ({
    background: tab === t ? "#c9a84c22" : "none",
    border: `1px solid ${tab === t ? "#c9a84c" : "#333"}`,
    borderRadius: 8,
    color: tab === t ? "#c9a84c" : "#666",
    fontSize: 13,
    padding: "8px 18px",
    cursor: "pointer",
  });

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700 }}>Analysis</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["overview", "contract", "time", "setup"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 20 }}>
            <StatCard label="Total P&L" value={`$${totalPnl.toFixed(2)}`} valueColor={totalPnl >= 0 ? "#22c55e" : "#ef4444"} icon={<DollarSign size={15} />} />
            <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`} icon={<Target size={15} />} />
            <StatCard label="Profit Factor" value={profitFactor.toFixed(2)} icon={<TrendingUp size={15} />} />
            <StatCard label="Avg Win" value={`$${avgWin.toFixed(2)}`} valueColor="#22c55e" icon={<ArrowUpDown size={15} />} />
            <StatCard label="Avg Loss" value={`$${avgLoss.toFixed(2)}`} valueColor="#ef4444" icon={<TrendingDown size={15} />} />
            <StatCard label="Expectancy" value={`$${expectancy.toFixed(2)}`} valueColor={expectancy >= 0 ? "#22c55e" : "#ef4444"} icon={<BarChart2 size={15} />} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 13, color: "#888" }}>Equity Curve</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={equityData}>
                  <defs>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c9a84c" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#c9a84c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis tick={{ fill: "#555", fontSize: 10 }} width={55} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => [`$${(v as number).toFixed(2)}`, "Equity"]} />
                  <ReferenceLine y={0} stroke="#333" />
                  <Area type="monotone" dataKey="equity" stroke="#c9a84c" strokeWidth={2} fill="url(#g2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 13, color: "#888" }}>P&L by Day of Week</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dowData}>
                  <XAxis dataKey="day" tick={{ fill: "#aaa", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#888", fontSize: 10 }} width={55} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => [`$${(v as number).toFixed(2)}`, "P&L"]} />
                  <ReferenceLine y={0} stroke="#333" />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {dowData.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly table */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #222" }}>
              <h3 style={{ margin: 0, fontSize: 13, color: "#888" }}>Monthly P&L</h3>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222" }}>
                  {["Month", "P&L"].map((h) => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, color: "#555", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthData.map((r) => (
                  <tr key={r.month} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={{ padding: "10px 20px", fontSize: 13, color: "#aaa" }}>{r.month}</td>
                    <td style={{ padding: "10px 20px", fontSize: 13, fontWeight: 700, color: r.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                      ${r.pnl >= 0 ? "+" : ""}{r.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "contract" && (
        <>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 13, color: "#888" }}>P&L by Contract</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contractData}>
                <XAxis dataKey="contract" tick={{ fill: "#aaa", fontSize: 11 }} />
                <YAxis tick={{ fill: "#888", fontSize: 10 }} width={55} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => [`$${(v as number).toFixed(2)}`, "P&L"]} />
                <ReferenceLine y={0} stroke="#333" />
                <Bar dataKey="totalPnl" radius={[4, 4, 0, 0]}>
                  {contractData.map((entry, i) => (
                    <Cell key={i} fill={entry.totalPnl >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222" }}>
                  {["Contract", "Trades", "Win %", "Avg P&L", "Total P&L"].map((h) => (
                    <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: "#555", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contractData.map((r) => (
                  <tr key={r.contract} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={{ padding: "10px 20px", fontWeight: 600 }}>{r.contract}</td>
                    <td style={{ padding: "10px 20px", color: "#888", fontSize: 13 }}>{r.count}</td>
                    <td style={{ padding: "10px 20px", fontSize: 13 }}>{r.winPct.toFixed(1)}%</td>
                    <td style={{ padding: "10px 20px", fontSize: 13, color: r.avgPnl >= 0 ? "#22c55e" : "#ef4444" }}>${r.avgPnl.toFixed(2)}</td>
                    <td style={{ padding: "10px 20px", fontSize: 13, fontWeight: 700, color: r.totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>${r.totalPnl >= 0 ? "+" : ""}{r.totalPnl.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "time" && (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <BarChart2 size={48} style={{ color: "#333", marginBottom: 16 }} />
          <h3 style={{ color: "#555", fontWeight: 500 }}>Time-of-Day Analysis</h3>
          <p style={{ color: "#444", fontSize: 13 }}>
            Add trade time in future update. Currently trades only record date, not time.
          </p>
          <div style={{ marginTop: 24 }}>
            <h4 style={{ color: "#888", marginBottom: 16, fontSize: 13 }}>P&L by Day of Week</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dowData}>
                <XAxis dataKey="day" tick={{ fill: "#aaa", fontSize: 12 }} />
                <YAxis tick={{ fill: "#888", fontSize: 10 }} width={55} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => [`$${(v as number).toFixed(2)}`, "P&L"]} />
                <ReferenceLine y={0} stroke="#333" />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {dowData.map((entry, i) => (
                    <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === "setup" && (
        <>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 13, color: "#888" }}>Win Rate by Setup</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={setupData}>
                <XAxis dataKey="setup" tick={{ fill: "#aaa", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#888", fontSize: 10 }} width={40} unit="%" />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => [`${(v as number).toFixed(1)}%`, "Win Rate"]} />
                <Bar dataKey="winRate" fill="#c9a84c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222" }}>
                  {["Setup", "Trades", "Win Rate", "Total P&L"].map((h) => (
                    <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: "#555", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {setupData.map((r) => (
                  <tr key={r.setup} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={{ padding: "10px 20px", fontWeight: 600, color: "#c9a84c" }}>{r.setup}</td>
                    <td style={{ padding: "10px 20px", color: "#888", fontSize: 13 }}>{r.count}</td>
                    <td style={{ padding: "10px 20px", fontSize: 13 }}>{r.winRate.toFixed(1)}%</td>
                    <td style={{ padding: "10px 20px", fontSize: 13, fontWeight: 700, color: r.totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>${r.totalPnl >= 0 ? "+" : ""}{r.totalPnl.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
