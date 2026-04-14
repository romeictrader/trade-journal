"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trade } from "@/lib/types";
import { AlertTriangle, ChevronDown, ChevronRight, TrendingDown, Shield } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

interface Pattern {
  icon: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

interface Solution {
  rule: string;
  reason: string;
}

function detectPatterns(losses: Trade[], allTrades: Trade[]): Pattern[] {
  const patterns: Pattern[] = [];
  if (losses.length < 2) return patterns;

  const wins = allTrades.filter(t => t.pnl > 0);

  // 1. Session pattern
  const sessionCounts: Record<string, number> = {};
  for (const t of losses) if (t.session) sessionCounts[t.session] = (sessionCounts[t.session] ?? 0) + 1;
  const topSession = Object.entries(sessionCounts).sort((a, b) => b[1] - a[1])[0];
  if (topSession && topSession[1] / losses.length >= 0.6) {
    const pct = Math.round((topSession[1] / losses.length) * 100);
    patterns.push({ icon: "clock", title: "Session Pattern", detail: `${pct}% of your losses happen in the ${topSession[0]} session`, severity: pct >= 80 ? "high" : "medium" });
  }

  // 2. Direction bias
  const dirCounts: Record<string, number> = {};
  for (const t of losses) if (t.direction) dirCounts[t.direction] = (dirCounts[t.direction] ?? 0) + 1;
  const topDir = Object.entries(dirCounts).sort((a, b) => b[1] - a[1])[0];
  if (topDir && topDir[1] / losses.length >= 0.65) {
    const pct = Math.round((topDir[1] / losses.length) * 100);
    patterns.push({ icon: "arrow", title: "Direction Bias", detail: `${pct}% of your losses are ${topDir[0]} trades`, severity: pct >= 80 ? "high" : "medium" });
  }

  // 3. Day of week
  const dayCounts: Record<string, number> = {};
  for (const t of losses) if (t.day) dayCounts[t.day] = (dayCounts[t.day] ?? 0) + 1;
  const topDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  if (topDay && topDay[1] >= 2 && topDay[1] / losses.length >= 0.5) {
    patterns.push({ icon: "calendar", title: "Day Pattern", detail: `${topDay[0]} accounts for ${topDay[1]} of your ${losses.length} losses`, severity: topDay[1] / losses.length >= 0.7 ? "high" : "medium" });
  }

  // 4. Contract size comparison
  const avgLossSize = losses.reduce((s, t) => s + t.contracts, 0) / losses.length;
  const avgWinSize = wins.length > 0 ? wins.reduce((s, t) => s + t.contracts, 0) / wins.length : avgLossSize;
  if (avgLossSize > avgWinSize * 1.5 && wins.length > 0) {
    patterns.push({ icon: "size", title: "Oversizing on Losers", detail: `Avg ${avgLossSize.toFixed(0)} contracts on losses vs ${avgWinSize.toFixed(0)} on wins — you size up when losing`, severity: "high" });
  }

  // 5. Time pattern
  const timeLosses = losses.filter(t => t.execution_time);
  if (timeLosses.length >= 2) {
    const earlyLosses = timeLosses.filter(t => {
      const h = parseInt(t.execution_time!.split(":")[0]);
      return h < 10;
    });
    if (earlyLosses.length / timeLosses.length >= 0.5) {
      const pct = Math.round((earlyLosses.length / timeLosses.length) * 100);
      patterns.push({ icon: "time", title: "Early Trading Losses", detail: `${pct}% of your losses happen before 10:00 AM — the open is hurting you`, severity: pct >= 70 ? "high" : "medium" });
    }
  }

  // 6. Execution grade
  const gradedLosses = losses.filter(t => t.execution);
  if (gradedLosses.length >= 2) {
    const badGrades = gradedLosses.filter(t => t.execution === "C" || t.execution === "D");
    if (badGrades.length / gradedLosses.length >= 0.5) {
      const pct = Math.round((badGrades.length / gradedLosses.length) * 100);
      patterns.push({ icon: "grade", title: "Poor Execution", detail: `${pct}% of your losses have C/D execution grade — low quality entries`, severity: pct >= 75 ? "high" : "medium" });
    }
  }

  // 7. News correlation
  const newsLosses = losses.filter(t => t.news && t.news !== "None" && t.news !== "");
  if (newsLosses.length >= 2 && newsLosses.length / losses.length >= 0.4) {
    const pct = Math.round((newsLosses.length / losses.length) * 100);
    patterns.push({ icon: "news", title: "News Day Losses", detail: `${pct}% of your losses happen on news event days (${newsLosses.map(t => t.news).filter((v, i, a) => a.indexOf(v) === i).join(", ")})`, severity: pct >= 60 ? "high" : "medium" });
  }

  // 8. Losing streak
  let maxStreak = 0, streak = 0;
  for (const t of [...allTrades].sort((a, b) => a.date.localeCompare(b.date) || (a.created_at ?? "").localeCompare(b.created_at ?? ""))) {
    if (t.pnl < 0) { streak++; if (streak > maxStreak) maxStreak = streak; }
    else streak = 0;
  }
  if (maxStreak >= 3) {
    patterns.push({ icon: "streak", title: "Losing Streak", detail: `Your worst losing streak is ${maxStreak} consecutive trades — consider stopping after 2 losses in a row`, severity: maxStreak >= 5 ? "high" : "medium" });
  }

  // 9. Avg loss vs avg win
  const avgLoss = losses.reduce((s, t) => s + Math.abs(t.pnl), 0) / losses.length;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  if (wins.length > 0 && avgLoss > avgWin * 1.5) {
    patterns.push({ icon: "ratio", title: "Losses Bigger Than Wins", detail: `Avg loss $${avgLoss.toFixed(0)} vs avg win $${avgWin.toFixed(0)} — you let losers run too long`, severity: "high" });
  }

  return patterns;
}

function generateSolutions(patterns: Pattern[], losses: Trade[]): Solution[] {
  const solutions: Solution[] = [];

  for (const p of patterns) {
    switch (p.icon) {
      case "clock":
        solutions.push({ rule: `Reduce position size in your worst session or avoid it entirely`, reason: p.detail });
        break;
      case "arrow":
        solutions.push({ rule: `Review your directional bias — consider taking more counter-trend setups or waiting for stronger confirmation`, reason: p.detail });
        break;
      case "calendar":
        solutions.push({ rule: `Trade sim or reduce size on your worst day — or skip it entirely`, reason: p.detail });
        break;
      case "size":
        solutions.push({ rule: `Keep position size consistent — never increase size after a loss. Set a max contract limit and stick to it`, reason: p.detail });
        break;
      case "time":
        solutions.push({ rule: `Wait 30 minutes after market open before entering trades. Let the opening volatility settle`, reason: p.detail });
        break;
      case "grade":
        solutions.push({ rule: `Only take A and B grade setups. If you wouldn't grade the setup at least B before entry, skip it`, reason: p.detail });
        break;
      case "news":
        solutions.push({ rule: `Go flat 2 minutes before high-impact news events. Do not trade during the initial reaction`, reason: p.detail });
        break;
      case "streak":
        solutions.push({ rule: `Set a 2-loss daily stop rule. After 2 consecutive losses, close the platform and review your trades`, reason: p.detail });
        break;
      case "ratio":
        solutions.push({ rule: `Set a hard stop loss before entry and never move it. Your avg loss should be smaller than your avg win`, reason: p.detail });
        break;
    }
  }

  if (solutions.length === 0 && losses.length > 0) {
    solutions.push({ rule: "Add more trade details (session, execution time, grade) to unlock deeper pattern detection", reason: "Not enough data to detect specific patterns yet" });
  }

  return solutions;
}

export default function MistakesPage() {
  const isMobile = useIsMobile();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("trades").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
      if (data) setTrades(data);
      setLoading(false);
    })();
  }, []);

  const losses = trades.filter(t => t.pnl < 0);
  const wins = trades.filter(t => t.pnl > 0);
  const patterns = detectPatterns(losses, trades);
  const solutions = generateSolutions(patterns, losses);

  // Group losses by date
  const lossesByDate: Record<string, Trade[]> = {};
  for (const t of losses) {
    if (!lossesByDate[t.date]) lossesByDate[t.date] = [];
    lossesByDate[t.date].push(t);
  }
  const sortedDates = Object.keys(lossesByDate).sort((a, b) => b.localeCompare(a));

  // Stats
  const totalLost = losses.reduce((s, t) => s + t.pnl, 0);
  const avgLoss = losses.length > 0 ? totalLost / losses.length : 0;
  const worstDay = sortedDates.reduce((worst, date) => {
    const dayTotal = lossesByDate[date].reduce((s, t) => s + t.pnl, 0);
    if (!worst || dayTotal < worst.pnl) return { date, pnl: dayTotal };
    return worst;
  }, null as { date: string; pnl: number } | null);

  const sevColor = (s: string) => s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#888";

  if (loading) return <div style={{ padding: 24, color: "#555" }}>Loading...</div>;

  return (
    <div style={{ padding: isMobile ? 16 : 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Mistakes & Lessons</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#555" }}>Learn from your losses to become a better trader</p>
      </div>

      {losses.length === 0 ? (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>
            <Shield size={32} color="#22c55e" />
          </div>
          <div style={{ fontSize: 15, color: "#888", fontWeight: 600 }}>No losses recorded yet</div>
          <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>When you log losing trades, patterns and solutions will appear here</div>
        </div>
      ) : (
        <>
          {/* Loss Summary */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 16, display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total Losses</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444" }}>{losses.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total Lost</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444" }}>${totalLost.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Avg Loss</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444" }}>${avgLoss.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Worst Day</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>{worstDay ? `${worstDay.date}` : "—"}</div>
              {worstDay && <div style={{ fontSize: 11, color: "#ef4444" }}>${worstDay.pnl.toFixed(2)}</div>}
            </div>
          </div>

          {/* Pattern Detection */}
          {patterns.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <AlertTriangle size={16} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>Pattern Detection</h3>
                <span style={{ fontSize: 11, color: "#555" }}>{patterns.length} pattern{patterns.length !== 1 ? "s" : ""} found</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {patterns.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: "#0a0a0a", borderRadius: 8, borderLeft: `3px solid ${sevColor(p.severity)}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: sevColor(p.severity), marginBottom: 2 }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{p.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Solutions */}
          {solutions.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #22c55e33", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Shield size={16} color="#22c55e" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#22c55e" }}>Rules to Follow</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {solutions.map((s, i) => (
                  <div key={i} style={{ padding: "12px 14px", background: "#0a0a0a", borderRadius: 8, borderLeft: "3px solid #22c55e" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc", marginBottom: 4 }}>{i + 1}. {s.rule}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>Because: {s.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Losses by Date */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <TrendingDown size={16} color="#ef4444" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#888" }}>Losses by Date</h3>
            </div>
            {sortedDates.map(date => {
              const dayTrades = lossesByDate[date];
              const dayTotal = dayTrades.reduce((s, t) => s + t.pnl, 0);
              const isOpen = expanded[date];
              const dayName = dayTrades[0]?.day ?? "";
              return (
                <div key={date} style={{ marginBottom: 6, border: "1px solid #1a1a1a", borderRadius: 8, overflow: "hidden" }}>
                  <div
                    onClick={() => setExpanded(p => ({ ...p, [date]: !p[date] }))}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", background: "#0a0a0a" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isOpen ? <ChevronDown size={14} color="#555" /> : <ChevronRight size={14} color="#555" />}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{date}</span>
                      {dayName && <span style={{ fontSize: 11, color: "#444" }}>{dayName}</span>}
                      <span style={{ fontSize: 11, color: "#555" }}>{dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>${dayTotal.toFixed(2)}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: "8px 14px 14px" }}>
                      {dayTrades.map(t => (
                        <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid #1a1a1a", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", minWidth: 40 }}>{t.contract}</span>
                          {t.direction && <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: t.direction === "Long" ? "#22c55e22" : "#ef444422", color: t.direction === "Long" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{t.direction}</span>}
                          <span style={{ fontSize: 12, color: "#888" }}>{t.contracts} contracts</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>${t.pnl.toFixed(2)}</span>
                          {t.session && <span style={{ fontSize: 11, color: "#555" }}>{t.session}</span>}
                          {t.execution && <span style={{ fontSize: 11, color: "#555" }}>Grade: {t.execution}</span>}
                          {t.execution_time && <span style={{ fontSize: 11, color: "#555" }}>{t.execution_time}</span>}
                          {(t.context || t.explanation) && (
                            <div style={{ width: "100%", marginTop: 4, padding: "8px 10px", background: "#111", borderRadius: 6, fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                              {t.context && <div>{t.context}</div>}
                              {t.explanation && <div style={{ marginTop: t.context ? 4 : 0, fontStyle: "italic" }}>{t.explanation}</div>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
