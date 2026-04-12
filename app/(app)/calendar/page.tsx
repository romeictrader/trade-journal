"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trade, Account } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAYS_WEEKDAY = ["Mo", "Tu", "We", "Th", "Fr"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function CalendarPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showWeekends, setShowWeekends] = useState(false);

  // On mobile: hide weekends by default unless toggled
  const hideWeekends = isMobile && !showWeekends;

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [{ data: tradesData }, { data: accountsData }] = await Promise.all([
          supabase.from("trades").select("*").eq("user_id", user.id).order("date"),
          supabase.from("accounts").select("*").eq("user_id", user.id),
        ]);
        if (tradesData) setTrades(tradesData);
        if (accountsData) setAccounts(accountsData);
      } catch (err) {
        console.error("Failed to load calendar data:", err);
      }
    }
    load();
  }, []);

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

  // Build calendar: starts Sunday
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // Month P&L
  const monthPfx = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthTrades = trades.filter(t => t.date.startsWith(monthPfx));
  const monthPnl = monthTrades.reduce((s, t) => s + t.pnl, 0);

  const selectedTrades = selectedDate ? (byDate[selectedDate] ?? []) : [];

  // Group selected trades by account
  const selectedByAccount: Record<string, Trade[]> = {};
  for (const t of selectedTrades) {
    const key = t.account_id ?? "__none__";
    selectedByAccount[key] = [...(selectedByAccount[key] ?? []), t];
  }

  function getCellBg(pnl: number) {
    if (pnl > 0) return "#0d1f14";
    if (pnl < 0) return "#1f0d0d";
    return "#141414";
  }

  function getCellBorder(_pnl: number, isToday: boolean, isSelected: boolean) {
    if (isSelected) return "1px solid #4fc3f7";
    if (isToday) return "1px solid #4fc3f7";
    return "1px solid #1e1e1e";
  }

  const visibleDayLabels = hideWeekends ? DAYS_WEEKDAY : DAYS;
  const gridCols = hideWeekends
    ? "repeat(5, 1fr)"
    : isMobile
    ? "repeat(7, 1fr)"
    : "repeat(7, 1fr) 120px";

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: isMobile ? undefined : "calc(100vh - 52px)", background: "#0d0d0d", overflowY: isMobile ? "auto" : undefined }}>
      <div style={{ flex: 1, padding: isMobile ? "16px 12px" : "20px 16px", overflowY: isMobile ? undefined : "auto", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isMobile ? 10 : 16, position: "relative" }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", minWidth: 90 }}>
            {MONTH_SHORT[month]} {year}
          </span>
          <button onClick={nextMonth} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <ChevronRight size={18} />
          </button>
          {!isMobile && (
            <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
              <span style={{ color: "#fff" }}>Monthly P&L: </span>
              <span style={{ color: monthPnl >= 0 ? "#4caf50" : "#ef5350", fontWeight: 700 }}>{monthPnl >= 0 ? `+$${monthPnl.toFixed(2)}` : `-$${Math.abs(monthPnl).toFixed(2)}`}</span>
            </span>
          )}
          <button
            onClick={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }}
            style={{ marginLeft: "auto", background: "none", border: "1px solid #333", borderRadius: 6, color: "#aaa", fontSize: 12, padding: "5px 12px", cursor: "pointer" }}
          >
            Today
          </button>
        </div>

        {/* Mobile: monthly P&L + Show Weekends toggle */}
        {isMobile && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: "#888" }}>Monthly P&L: </span>
              <span style={{ color: monthPnl >= 0 ? "#4caf50" : "#ef5350", fontWeight: 700 }}>{monthPnl >= 0 ? `+$${monthPnl.toFixed(2)}` : `-$${Math.abs(monthPnl).toFixed(2)}`}</span>
            </span>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#888", userSelect: "none" }}>
              <div
                onClick={() => setShowWeekends(v => !v)}
                style={{
                  width: 16, height: 16, border: `1px solid ${showWeekends ? "#c9a84c" : "#444"}`,
                  borderRadius: 3, background: showWeekends ? "#c9a84c22" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                {showWeekends && <div style={{ width: 8, height: 8, background: "#c9a84c", borderRadius: 1 }} />}
              </div>
              <span onClick={() => setShowWeekends(v => !v)}>Show Weekends</span>
            </label>
          </div>
        )}

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: gridCols, marginBottom: 2 }}>
          {visibleDayLabels.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#555", fontWeight: 600, padding: "6px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</div>
          ))}
          {!isMobile && <div />}
        </div>

        {/* Calendar grid */}
        <div style={{ flex: isMobile ? undefined : 1, height: isMobile ? 360 : undefined, display: "flex", flexDirection: "column", gap: 2 }}>
          {weeks.map((week, wi) => {
            const weekTrades: Trade[] = [];
            for (const day of week) {
              if (!day) continue;
              const ds = dateStr(year, month, day);
              if (byDate[ds]) weekTrades.push(...byDate[ds]);
            }
            const weekPnl = weekTrades.reduce((s, t) => s + t.pnl, 0);
            const weekNum = wi + 1;

            // On mobile with hideWeekends, filter to Mon(di=1)–Fri(di=5)
            const visibleCells = hideWeekends
              ? week.map((day, di) => ({ day, di })).filter(({ di }) => di >= 1 && di <= 5)
              : week.map((day, di) => ({ day, di }));

            return (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: gridCols, gap: 2, flex: 1, minHeight: isMobile ? undefined : 80 }}>
                {visibleCells.map(({ day, di }) => {
                  if (!day) {
                    return <div key={`e-${di}`} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4 }} />;
                  }
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
                        border: getCellBorder(dayPnl ?? 0, isToday, isSelected),
                        borderRadius: 4,
                        padding: isMobile ? "6px 7px" : "8px 10px",
                        cursor: "pointer",
                        minHeight: isMobile ? undefined : 80,
                        display: "flex",
                        flexDirection: "column",
                        transition: "filter 0.1s",
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.filter = "brightness(1.2)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.filter = "brightness(1)"; }}
                    >
                      <div style={{ fontSize: isMobile ? 10 : 12, color: isToday ? "#4fc3f7" : "#888", fontWeight: isToday ? 700 : 400, marginBottom: isMobile ? 2 : 6 }}>{day}</div>
                      {hasTrades && (
                        <>
                          <div style={{ fontSize: isMobile ? 11 : 14, fontWeight: 700, color: dayPnl! > 0 ? "#4caf50" : dayPnl! < 0 ? "#ef5350" : "#666", marginTop: "auto" }}>
                            {dayPnl! >= 0 ? `$${dayPnl!.toFixed(2)}` : `-$${Math.abs(dayPnl!).toFixed(2)}`}
                          </div>
                          <div style={{ fontSize: isMobile ? 10 : 11, color: "#888", marginTop: 2 }}>{dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""}</div>
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Week summary column — desktop only */}
                {!isMobile && (
                  <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 4, padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 80 }}>
                    <div style={{ fontSize: 10, color: "#555", fontWeight: 600, marginBottom: 4 }}>Week {weekNum}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: weekTrades.length === 0 ? "#444" : weekPnl >= 0 ? "#4caf50" : "#ef5350" }}>
                      {weekTrades.length === 0 ? "$0.00" : weekPnl >= 0 ? `$${weekPnl.toFixed(2)}` : `-$${Math.abs(weekPnl).toFixed(2)}`}
                    </div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{weekTrades.length} trade{weekTrades.length !== 1 ? "s" : ""}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Side panel */}
      {selectedDate && (
        <div style={isMobile ? { width: "100%", background: "#111", borderTop: "1px solid #1e1e1e", padding: 16, overflowY: "auto", maxHeight: "55vh" } : { width: 280, background: "#111", borderLeft: "1px solid #1e1e1e", padding: 20, overflowY: "auto" }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 13, color: "#888" }}>{selectedDate}</h4>
          {selectedTrades.length === 0 ? (
            <p style={{ color: "#444", fontSize: 12 }}>No trades on this day.</p>
          ) : (
            Object.entries(selectedByAccount).map(([accId, accTrades]) => {
              const acc = accounts.find(a => a.id === accId);
              const accPnl = accTrades.reduce((s, t) => s + t.pnl, 0);
              return (
                <div key={accId} style={{ marginBottom: 16 }}>
                  {acc && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: acc.color }} />
                      <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{acc.prop_firm} — {acc.account_name}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: accPnl >= 0 ? "#4caf50" : "#ef5350" }}>
                        {accPnl >= 0 ? `$${accPnl.toFixed(2)}` : `-$${Math.abs(accPnl).toFixed(2)}`}
                      </span>
                    </div>
                  )}
                  {accTrades.map(t => (
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
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
