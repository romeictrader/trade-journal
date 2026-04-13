"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trade, Account } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AccountCalendarPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: accData }, { data: tradesData }] = await Promise.all([
        supabase.from("accounts").select("*").eq("id", id).eq("user_id", user.id).single(),
        supabase.from("trades").select("*").eq("account_id", id).order("date"),
      ]);
      if (accData) setAccount(accData);
      if (tradesData) setTrades(tradesData);
    }
    load();
  }, [id]);

  const byDate: Record<string, Trade[]> = {};
  for (const t of trades) {
    byDate[t.date] = [...(byDate[t.date] ?? []), t];
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function dateStr(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const todayStr = new Date().toISOString().split("T")[0];

  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthPfx = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthTrades = trades.filter(t => t.date.startsWith(monthPfx));
  const monthPnl = monthTrades.reduce((s, t) => s + t.pnl, 0);
  const selectedTrades = selectedDate ? (byDate[selectedDate] ?? []) : [];

  function getCellBg(pnl: number) {
    if (pnl > 0) return "#0d1f14";
    if (pnl < 0) return "#1f0d0d";
    return "#141414";
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 52px)", background: "#0d0d0d" }}>
      <div style={{ flex: 1, padding: "20px 16px", overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link href={`/accounts/${id}`} style={{ color: "#666", display: "flex", alignItems: "center", gap: 4, textDecoration: "none", fontSize: 13, marginRight: 4 }}>
            <ArrowLeft size={14} /> Back
          </Link>
          <button onClick={prevMonth} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", minWidth: 90 }}>
            {MONTH_SHORT[month]} {year}
          </span>
          <button onClick={nextMonth} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <ChevronRight size={18} />
          </button>
          <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: monthPnl >= 0 ? "#4caf50" : "#ef5350" }}>
            Monthly P&L: {monthPnl >= 0 ? `$${monthPnl.toFixed(2)}` : `-$${Math.abs(monthPnl).toFixed(2)}`}
          </span>
          <button
            onClick={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }}
            style={{ marginLeft: "auto", background: "none", border: "1px solid #333", borderRadius: 6, color: "#aaa", fontSize: 12, padding: "5px 12px", cursor: "pointer" }}
          >
            Today
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr) 90px", marginBottom: 2 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#555", fontWeight: 600, padding: "6px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</div>
          ))}
          <div />
        </div>

        {/* Calendar grid */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {weeks.map((week, wi) => {
            const weekTrades: Trade[] = [];
            for (const day of week) {
              if (!day) continue;
              const ds = dateStr(year, month, day);
              if (byDate[ds]) weekTrades.push(...byDate[ds]);
            }
            const weekPnl = weekTrades.reduce((s, t) => s + t.pnl, 0);

            return (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr) 90px", gap: 2, flex: 1, minHeight: 0 }}>
                {week.map((day, di) => {
                  if (!day) return <div key={`e-${di}`} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4, minHeight: 80 }} />;
                  const ds = dateStr(year, month, day);
                  const dayTrades = byDate[ds];
                  const dayPnl = dayTrades?.reduce((s, t) => s + t.pnl, 0);
                  const isToday = ds === todayStr;
                  const isSelected = ds === selectedDate;
                  const hasTrades = dayPnl !== undefined;

                  return (
                    <div
                      key={ds}
                      onClick={() => setSelectedDate(ds === selectedDate ? null : ds)}
                      style={{
                        background: hasTrades ? getCellBg(dayPnl!) : "#111",
                        border: isSelected || isToday ? "1px solid #4fc3f7" : "1px solid #1e1e1e",
                        borderRadius: 4,
                        padding: "8px 10px",
                        cursor: "pointer",
                        minHeight: 80,
                        display: "flex",
                        flexDirection: "column",
                        transition: "filter 0.1s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.filter = "brightness(1.2)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.filter = "brightness(1)"; }}
                    >
                      <div style={{ fontSize: 12, color: isToday ? "#4fc3f7" : "#888", fontWeight: isToday ? 700 : 400, marginBottom: 6 }}>{day}</div>
                      {hasTrades && (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 700, color: dayPnl! > 0 ? "#4caf50" : dayPnl! < 0 ? "#ef5350" : "#666", marginTop: "auto" }}>
                            {dayPnl! >= 0 ? `$${dayPnl!.toFixed(2)}` : `-$${Math.abs(dayPnl!).toFixed(2)}`}
                          </div>
                          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""}</div>
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Week summary */}
                <div style={{ background: weekTrades.length === 0 ? "#111" : getCellBg(weekPnl), border: "1px solid #1a1a1a", borderRadius: 4, padding: "6px 8px", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Wk {wi + 1}</div>
                  <div style={{ marginTop: "auto" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: weekTrades.length === 0 ? "#444" : weekPnl >= 0 ? "#4caf50" : "#ef5350" }}>
                      {weekTrades.length === 0 ? "$0" : weekPnl >= 0 ? `$${weekPnl.toFixed(2)}` : `-$${Math.abs(weekPnl).toFixed(2)}`}
                    </div>
                    <div style={{ fontSize: 9, color: "#555", marginTop: 1 }}>{weekTrades.length} trade{weekTrades.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side panel */}
      {selectedDate && (
        <div style={{ width: 280, background: "#111", borderLeft: "1px solid #1e1e1e", padding: 20, overflowY: "auto" }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 13, color: "#888" }}>{selectedDate}</h4>
          {selectedTrades.length === 0 ? (
            <p style={{ color: "#444", fontSize: 12 }}>No trades on this day.</p>
          ) : (
            selectedTrades.map(t => (
              <div
                key={t.id}
                onClick={() => router.push(`/trades/${t.id}`)}
                style={{ background: "#0d0d0d", border: "1px solid #222", borderRadius: 8, padding: 10, marginBottom: 6, cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#444")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#222")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{t.contract}</span>
                    {t.direction && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: t.direction === "Long" ? "#4caf5022" : "#ef535022", color: t.direction === "Long" ? "#4caf50" : "#ef5350", fontWeight: 600 }}>{t.direction}</span>}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: t.pnl >= 0 ? "#4caf50" : "#ef5350" }}>
                    {t.pnl >= 0 ? `$${t.pnl.toFixed(2)}` : `-$${Math.abs(t.pnl).toFixed(2)}`}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#555" }}>
                  {t.contracts}x{t.session ? ` · ${t.session}` : ""}{t.rr != null ? ` · ${t.rr}R` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
