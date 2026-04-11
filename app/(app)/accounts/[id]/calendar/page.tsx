"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trade, Account } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function AccountCalendarPage() {
  const params = useParams();
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

  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = new Date().toISOString().split("T")[0];

  function dateStr(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const monthPfx = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthTrades = trades.filter((t) => t.date.startsWith(monthPfx));
  const monthPnl = monthTrades.reduce((s, t) => s + t.pnl, 0);

  const selectedTrades = selectedDate ? (byDate[selectedDate] ?? []) : [];

  return (
    <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Link href={`/accounts/${id}`} style={{ color: "#888", display: "flex", alignItems: "center", gap: 4, textDecoration: "none", fontSize: 13 }}>
            <ArrowLeft size={14} /> Back to {account?.account_name ?? "Account"}
          </Link>
          <button onClick={prevMonth} style={{ background: "none", border: "1px solid #333", borderRadius: 8, color: "#888", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={16} />
          </button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{MONTH_NAMES[month]} {year}</h2>
          <button onClick={nextMonth} style={{ background: "none", border: "1px solid #333", borderRadius: 8, color: "#888", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }} style={{ background: "none", border: "1px solid #333", borderRadius: 8, color: "#888", fontSize: 12, padding: "6px 14px", cursor: "pointer" }}>
            Today
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 2 }}>
          {DAYS.map((d) => (
            <div key={d} style={{ padding: "8px", textAlign: "center", fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase" }}>{d}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const ds = dateStr(day);
            const dayTrades = byDate[ds];
            const dayPnl = dayTrades?.reduce((s, t) => s + t.pnl, 0);
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDate;

            return (
              <div
                key={ds}
                onClick={() => setSelectedDate(ds === selectedDate ? null : ds)}
                style={{
                  background: isSelected ? "#1a1a1a" : "#111",
                  border: `1px solid ${isToday ? (account?.color ?? "#c9a84c") : isSelected ? "#333" : "#1a1a1a"}`,
                  borderRadius: 8,
                  padding: "8px",
                  minHeight: 70,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? (account?.color ?? "#c9a84c") : "#888", marginBottom: 6 }}>{day}</div>
                {dayPnl !== undefined && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: dayPnl >= 0 ? "#22c55e22" : "#ef444422", color: dayPnl >= 0 ? "#22c55e" : "#ef4444", display: "inline-block" }}>
                      ${dayPnl >= 0 ? "+" : ""}{dayPnl.toFixed(0)}
                    </div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ width: 280, background: "#111", borderLeft: "1px solid #222", padding: 20, overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#888" }}>{MONTH_NAMES[month]} Summary</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Month P&L", value: `$${monthPnl >= 0 ? "+" : ""}${monthPnl.toFixed(2)}`, color: monthPnl >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Total Trades", value: String(monthTrades.length), color: "#fff" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#666" }}>{item.label}</span>
              <span style={{ fontWeight: 700, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        {selectedDate && (
          <div style={{ borderTop: "1px solid #222", paddingTop: 16 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 13, color: "#888" }}>{selectedDate}</h4>
            {selectedTrades.length === 0 ? (
              <p style={{ color: "#444", fontSize: 12 }}>No trades on this day.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedTrades.map((t) => (
                  <div key={t.id} style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{t.contract}</span>
                      <span style={{ fontWeight: 700, fontSize: 13, color: t.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                        ${t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#555" }}>
                      {t.direction} · {t.entry_price} → {t.exit_price} · {t.contracts}x
                    </div>
                    {t.outcome && (
                      <div style={{ fontSize: 11, marginTop: 4, color: t.outcome === "Win" ? "#22c55e" : t.outcome === "Loss" ? "#ef4444" : "#f59e0b" }}>
                        {t.outcome}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
