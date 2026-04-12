"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trade, Account } from "@/lib/types";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, Eye, Trash2 } from "lucide-react";
import TradeForm from "@/components/TradeForm";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday,
} from "date-fns";

function Skeleton({ width, height }: { width?: string | number; height?: string | number }) {
  return (
    <div style={{ width: width ?? "100%", height: height ?? 16, background: "linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%)", backgroundSize: "200% 100%", animation: "pulse 1.5s ease-in-out infinite", borderRadius: 6 }} />
  );
}

function MiniCalendar({ trades, color, selectedDate, onSelectDate }: { trades: Trade[]; color: string; selectedDate: string | null; onSelectDate: (d: string | null) => void }) {
  const [viewMonth, setViewMonth] = useState(new Date());

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const monthStart = startOfMonth(viewMonth);
  const startDow = getDay(monthStart);
  const daysInMonth = endOfMonth(viewMonth).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  const dailyMap: Record<string, { pnl: number; count: number }> = {};
  for (const t of trades) {
    if (!dailyMap[t.date]) dailyMap[t.date] = { pnl: 0, count: 0 };
    dailyMap[t.date].pnl += t.pnl;
    dailyMap[t.date].count += 1;
  }

  function ds(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthPfx = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthPnl = trades.filter(t => t.date.startsWith(monthPfx)).reduce((s, t) => s + t.pnl, 0);

  function getCellBg(pnl: number) {
    if (pnl > 0) return "#0d1f14";
    if (pnl < 0) return "#1f0d0d";
    return "#141414";
  }

  // Compute all week stats upfront
  const weekStats = weeks.map((week, wi) => {
    const weekPnl = week.reduce((s: number, day) => {
      if (!day) return s;
      return s + (dailyMap[ds(day)]?.pnl ?? 0);
    }, 0 as number);
    const weekCount = week.reduce((s: number, day) => {
      if (!day) return s;
      return s + (dailyMap[ds(day)]?.count ?? 0);
    }, 0 as number);
    return { wi, weekPnl, weekCount };
  });

  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, display: "flex", gap: 16 }}>
      {/* Calendar side */}
      <div style={{ flex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12, position: "relative" }}>
          <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 13, color: "#ccc", fontWeight: 600, marginRight: 4 }}>{format(viewMonth, "MMM yyyy")}</span>
          <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
            <ChevronRight size={14} />
          </button>
          <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
            <span style={{ color: "#fff" }}>Monthly P&L: </span>
            <span style={{ color: monthPnl >= 0 ? "#4caf50" : "#ef5350", fontWeight: 700 }}>{monthPnl >= 0 ? `+$${monthPnl.toFixed(2)}` : `-$${Math.abs(monthPnl).toFixed(2)}`}</span>
          </span>
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 2 }}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
            <div key={d} style={{ fontSize: 10, color: "#444", textAlign: "center", padding: "3px 0", fontWeight: 600 }}>{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {week.map((day, di) => {
                if (!day) return <div key={`e-${di}`} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 3, minHeight: 80 }} />;
                const iso = ds(day);
                const stat = dailyMap[iso];
                const hasTrades = !!stat;
                const isSelected = selectedDate === iso;
                const isToday2 = iso === todayStr;

                return (
                  <div
                    key={iso}
                    onClick={() => hasTrades ? onSelectDate(isSelected ? null : iso) : undefined}
                    style={{
                      background: hasTrades ? getCellBg(stat.pnl) : "#0d0d0d",
                      border: isSelected || isToday2 ? `1px solid ${color}` : "1px solid #1e1e1e",
                      borderRadius: 3,
                      padding: "6px 8px",
                      minHeight: 80,
                      cursor: hasTrades ? "pointer" : "default",
                      display: "flex",
                      flexDirection: "column",
                    }}
                    onMouseEnter={e => { if (hasTrades) (e.currentTarget as HTMLDivElement).style.filter = "brightness(1.2)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.filter = "brightness(1)"; }}
                  >
                    <div style={{ fontSize: 12, color: isToday2 ? color : "#555", fontWeight: isToday2 ? 700 : 400 }}>{day}</div>
                    {hasTrades && (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: stat.pnl > 0 ? "#4caf50" : stat.pnl < 0 ? "#ef5350" : "#666", marginTop: "auto" }}>
                          {stat.pnl >= 0 ? `$${stat.pnl.toFixed(2)}` : `-$${Math.abs(stat.pnl).toFixed(2)}`}
                        </div>
                        <div style={{ fontSize: 10, color: "#666" }}>{stat.count} trade{stat.count !== 1 ? "s" : ""}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Week summaries panel */}
      <div style={{ width: 140, display: "flex", flexDirection: "column", gap: 2, paddingTop: 36 }}>
        {weekStats.map(({ wi, weekPnl, weekCount }) => (
          <div
            key={wi}
            style={{
              flex: 1,
              background: "#0d0d0d",
              border: "1px solid #1a1a1a",
              borderRadius: 6,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minHeight: 80,
            }}
          >
            <div style={{ fontSize: 10, color: "#444", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Week {wi + 1}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: weekCount === 0 ? "#333" : weekPnl >= 0 ? "#4caf50" : "#ef5350" }}>
              {weekCount === 0 ? "$0.00" : weekPnl >= 0 ? `$${weekPnl.toFixed(2)}` : `-$${Math.abs(weekPnl).toFixed(2)}`}
            </div>
            <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{weekCount} trade{weekCount !== 1 ? "s" : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccountDashboard() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  async function deleteTrade(tradeId: string) {
    if (!confirm("Delete this trade?")) return;
    const supabase = createClient();
    await supabase.from("trades").delete().eq("id", tradeId);
    load();
  }

  const [account, setAccount] = useState<Account | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [resetUtcHour, setResetUtcHour] = useState(22);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [{ data: accData }, { data: tradesData }, { data: settingsData }] = await Promise.all([
      supabase.from("accounts").select("*").eq("id", id).eq("user_id", user.id).single(),
      supabase.from("trades").select("*").eq("account_id", id).order("date", { ascending: true }),
      supabase.from("journal_settings").select("daily_reset_utc_hour").eq("user_id", user.id).single(),
    ]);

    if (!accData) { router.push("/"); return; }
    setAccount(accData);
    setTrades(tradesData ?? []);
    if (settingsData?.daily_reset_utc_hour != null) setResetUtcHour(settingsData.daily_reset_utc_hour);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  // Real-time reset: check every minute if we've crossed the reset hour, reload trades if so
  useEffect(() => {
    let lastTradingDate: string | null = null;

    function getTradingDate() {
      const now = new Date();
      const nyStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
      const nyDate = new Date(nyStr);
      const nyDateStr = `${nyDate.getFullYear()}-${String(nyDate.getMonth()+1).padStart(2,"0")}-${String(nyDate.getDate()).padStart(2,"0")}`;
      if (nyDate.getHours() < 17) return nyDateStr;
      const tomorrow = new Date(nyDate.getTime() + 24 * 60 * 60 * 1000);
      return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,"0")}-${String(tomorrow.getDate()).padStart(2,"0")}`;
    }

    lastTradingDate = getTradingDate();

    const interval = setInterval(() => {
      const current = getTradingDate();
      if (lastTradingDate && current !== lastTradingDate) {
        lastTradingDate = current;
        load(); // reload trades so daily loss resets to $0
      }
    }, 60 * 1000); // check every minute

    return () => clearInterval(interval);
  }, [resetUtcHour, load]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <style>{`@keyframes pulse { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }`}</style>
        <Skeleton height={28} width={200} />
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ background: "#111", borderRadius: 12, height: 100 }}><Skeleton /></div>)}
        </div>
      </div>
    );
  }

  if (!account) return null;

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  // Daily loss resets at 5:00 PM New York time (handles DST automatically).
  function getNYTradingDate() {
    const now = new Date();
    // Get current time in New York
    const nyStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyStr);
    // If before 5pm NY, trading day is today NY date; if after 5pm NY, it's tomorrow's session (still today's date for daily loss)
    const nyHour = nyDate.getHours();
    // Trading day = NY calendar date if before 5pm, else still the same NY date (next session starts after 5pm)
    // Daily loss counts trades on the current NY calendar date up until 5pm reset
    const nyDateStr = `${nyDate.getFullYear()}-${String(nyDate.getMonth()+1).padStart(2,"0")}-${String(nyDate.getDate()).padStart(2,"0")}`;
    if (nyHour < 17) {
      return nyDateStr;
    } else {
      // After 5pm NY — new session started, daily loss resets, count next NY date
      const tomorrow = new Date(nyDate.getTime() + 24 * 60 * 60 * 1000);
      return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,"0")}-${String(tomorrow.getDate()).padStart(2,"0")}`;
    }
  }
  const tradingDate = getNYTradingDate();
  const todayPnl = trades.filter((t) => t.date === tradingDate).reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const balance = account.starting_balance + totalPnl;

  let peak = 0, running = 0;
  for (const t of trades) {
    running += t.pnl;
    if (running > peak) peak = running;
  }
  const maxDD = Math.max(0, peak - running); // current drawdown from peak (decreases when you profit)

  const rrTrades = trades.filter((t) => t.rr != null);
  const avgRR = rrTrades.length > 0 ? rrTrades.reduce((s, t) => s + (t.rr ?? 0), 0) / rrTrades.length : 0;
  const grossWin = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  const avgWin = wins > 0 ? grossWin / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const expectancy = wins + losses > 0 ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss : 0;

  const equityData: { date: string; equity: number }[] = [];
  let cum = 0;
  for (const t of trades) { cum += t.pnl; equityData.push({ date: t.date, equity: cum }); }

  const dailyMap: Record<string, number> = {};
  for (const t of trades) dailyMap[t.date] = (dailyMap[t.date] ?? 0) + t.pnl;
  const sortedDates = Object.keys(dailyMap).sort().slice(-30);
  const dailyData = sortedDates.map((d) => ({ date: d.slice(5), pnl: dailyMap[d] }));

  const ruleItems = [
    { label: "Daily Loss", current: Math.abs(Math.min(todayPnl, 0)), limit: account.daily_loss_limit, inverted: true },
    { label: "Max Drawdown", current: maxDD, limit: account.max_drawdown, inverted: true },
    { label: "Profit Target", current: maxDD > 0 ? 0 : Math.max(totalPnl, 0), limit: account.profit_target, inverted: false },
  ];

  const recentTrades = [...trades].reverse().slice(0, 10);

  return (
    <div style={{ padding: 24 }}>
      <style>{`@keyframes pulse { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link href="/" style={{ color: "#888", display: "flex", alignItems: "center", gap: 4, textDecoration: "none", fontSize: 13 }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{account.prop_firm}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#555" }}>{account.account_name}</p>
        </div>
        <button
          onClick={() => setShowAddTrade(true)}
          style={{ background: "#c9a84c", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, padding: "10px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={15} /> Add Trade
        </button>
      </div>

      {/* Balance bar */}
      <div style={{ background: "#111", border: `1px solid #222`, borderTop: `3px solid ${account.color}`, borderRadius: 12, padding: "20px", marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {[
          { label: "Balance", value: `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: totalPnl > 0 ? "#22c55e" : totalPnl < 0 ? "#ef4444" : "#fff" },
          { label: "Total P&L", value: `$${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" },
          { label: "Max Drawdown", value: `$${maxDD.toFixed(2)}`, color: maxDD > account.max_drawdown * 0.8 ? "#ef4444" : "#fff" },
        ].map((item) => (
          <div key={item.label}>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Prop Firm Rules */}
      <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "20px", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#888", fontWeight: 600 }}>Prop Firm Rules</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {ruleItems.map((rule) => {
            const pct = Math.min(Math.max((rule.current / rule.limit) * 100, 0), 100);
            const passing = rule.inverted ? rule.current < rule.limit : rule.current >= rule.limit;
            return (
              <div key={rule.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: "#888" }}>{rule.label}</span>
                  <span style={{ fontWeight: 600 }}>
                    <span style={{ color: rule.inverted ? (rule.current >= rule.limit ? "#ef4444" : "#fff") : (rule.current >= rule.limit ? "#22c55e" : "#fff") }}>${rule.current.toFixed(0)}</span>
                    <span style={{ color: "#555" }}> / </span>
                    <span style={{ color: rule.inverted ? "#ef4444" : "#22c55e" }}>${rule.limit.toFixed(0)}</span>
                  </span>
                </div>
                <div style={{ background: "#222", borderRadius: 4, height: 6 }}>
                  <div style={{ height: 6, borderRadius: 4, width: `${pct}%`, background: rule.inverted ? "#ef4444" : pct >= 100 ? "#22c55e" : "#c9a84c", transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, color: "#555", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Performance</div>
          {[
            { label: "Net P&L", value: `$${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Expectancy", value: `$${expectancy.toFixed(2)}`, color: expectancy >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Profit Factor", value: profitFactor.toFixed(2), color: profitFactor >= 1.5 ? "#22c55e" : profitFactor >= 1 ? "#c9a84c" : "#ef4444" },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "#666" }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, color: "#555", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Consistency</div>
          {[
            { label: "Win Rate", value: `${winRate.toFixed(1)}%` },
            { label: "Avg RR", value: avgRR.toFixed(2) },
            { label: "W / L", value: `${wins} / ${losses}` },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "#666" }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: "#fff" }}>{s.value}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, color: "#555", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Risk</div>
          {[
            { label: "Max Drawdown", value: `$${maxDD.toFixed(2)}`, color: maxDD > account.max_drawdown * 0.8 ? "#ef4444" : "#fff" },
            { label: "Avg Loss", value: losses > 0 ? `$${(grossLoss / losses).toFixed(2)}` : "—", color: "#ef4444" },
            { label: "Total Trades", value: String(trades.length) },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "#666" }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: (s as { color?: string }).color ?? "#fff" }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#888", fontWeight: 600 }}>Equity Curve</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={account.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={account.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#555", fontSize: 11 }} width={60} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => [`$${(v as number).toFixed(2)}`, "P&L"]} />
              <ReferenceLine y={0} stroke="#333" />
              <Area type="monotone" dataKey="equity" stroke={account.color} strokeWidth={2} fill={`url(#gold-${id})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#888", fontWeight: 600 }}>Daily P&L (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 10 }} />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} width={55} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => [`$${(v as number).toFixed(2)}`, "P&L"]} />
              <ReferenceLine y={0} stroke="#333" />
              <Bar dataKey="pnl" fill={account.color} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ marginBottom: 20 }}>
        <MiniCalendar trades={trades} color={account.color} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      </div>

      {/* Recent trades */}
      <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#888", fontWeight: 600 }}>Recent Trades</h3>
        {recentTrades.length === 0 ? (
          <p style={{ color: "#444", fontSize: 13 }}>No trades yet. Add your first trade!</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentTrades.map((t) => (
              <div key={t.id} onClick={() => router.push(`/trades/${t.id}`)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0a0a0a", borderRadius: 8, fontSize: 13, cursor: "pointer" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#111")} onMouseLeave={(e) => (e.currentTarget.style.background = "#0a0a0a")}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{t.contract}</span>
                  {t.direction && <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: t.direction === "Long" ? "#22c55e22" : "#ef444422", color: t.direction === "Long" ? "#22c55e" : "#ef4444" }}>{t.direction}</span>}
                  {t.outcome && <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: t.outcome === "Win" ? "#22c55e22" : t.outcome === "Loss" ? "#ef444422" : "#f59e0b22", color: t.outcome === "Win" ? "#22c55e" : t.outcome === "Loss" ? "#ef4444" : "#f59e0b" }}>{t.outcome}</span>}
                  <span style={{ color: "#555", fontSize: 11 }}>{t.date}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 700, color: t.pnl >= 0 ? "#22c55e" : "#ef4444" }}>${t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}</span>
                  <button onClick={(e) => { e.stopPropagation(); router.push(`/trades/${t.id}`); }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 4, display: "flex" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#c9a84c")} onMouseLeave={(e) => (e.currentTarget.style.color = "#555")} title="View">
                    <Eye size={13} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteTrade(t.id); }} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: 4, display: "flex" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={(e) => (e.currentTarget.style.color = "#444")} title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Day peek side panel */}
      {selectedDate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={() => setSelectedDate(null)} />
          <div style={{ width: 400, height: "100vh", background: "#111", borderLeft: "1px solid #222", overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{selectedDate}</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                  {trades.filter((t) => t.date === selectedDate).length} trade{trades.filter((t) => t.date === selectedDate).length !== 1 ? "s" : ""}
                  {" · "}
                  <span style={{ color: trades.filter((t) => t.date === selectedDate).reduce((s, t) => s + t.pnl, 0) >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                    ${trades.filter((t) => t.date === selectedDate).reduce((s, t) => s + t.pnl, 0) >= 0 ? "+" : ""}
                    {trades.filter((t) => t.date === selectedDate).reduce((s, t) => s + t.pnl, 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedDate(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {trades.filter((t) => t.date === selectedDate).map((t) => (
                <div
                  key={t.id}
                  onClick={() => router.push(`/trades/${t.id}`)}
                  style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#444")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#222")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{t.contract}</span>
                      {t.direction && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: t.direction === "Long" ? "#22c55e22" : "#ef444422", color: t.direction === "Long" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{t.direction}</span>}
                      {t.outcome && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: t.outcome === "Win" ? "#22c55e22" : t.outcome === "Loss" ? "#ef444422" : "#f59e0b22", color: t.outcome === "Win" ? "#22c55e" : t.outcome === "Loss" ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>{t.outcome}</span>}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: t.pnl >= 0 ? "#22c55e" : "#ef4444" }}>${t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#555" }}>
                    {t.session && <span>{t.session}</span>}
                    {t.rr != null && <span>{t.rr}R</span>}
                    {t.execution_time && <span>{t.execution_time}</span>}
                    {t.execution && <span>Grade: {t.execution}</span>}
                  </div>
                  {t.notes && <div style={{ marginTop: 8, fontSize: 12, color: "#666", lineHeight: 1.5, borderTop: "1px solid #1a1a1a", paddingTop: 8 }}>{t.notes}</div>}
                  <div style={{ marginTop: 10, fontSize: 11, color: "#c9a84c", textAlign: "right" }}>Tap to view full journal →</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Trade */}
      {showAddTrade && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={() => setShowAddTrade(false)} />
          <div style={{ width: 480, height: "100vh", background: "#111", borderLeft: "1px solid #222", overflowY: "auto", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Add Trade</h2>
              <button onClick={() => setShowAddTrade(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <TradeForm accountId={id} onSave={() => { setShowAddTrade(false); load(); }} onCancel={() => setShowAddTrade(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
