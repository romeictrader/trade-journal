"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trade } from "@/lib/types";
import { AlertTriangle, ChevronDown, ChevronRight, TrendingDown, Shield, Plus, X, Check, Camera } from "lucide-react";
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

interface MistakeEntry {
  id?: string;
  user_id?: string;
  date: string;
  notes: string;
  what_to_improve: string;
  checklist: { text: string; checked: boolean }[];
  images: string[];
}

function detectPatterns(losses: Trade[], allTrades: Trade[]): Pattern[] {
  const patterns: Pattern[] = [];
  if (losses.length < 2) return patterns;
  const wins = allTrades.filter(t => t.pnl > 0);

  const sessionCounts: Record<string, number> = {};
  for (const t of losses) if (t.session) sessionCounts[t.session] = (sessionCounts[t.session] ?? 0) + 1;
  const topSession = Object.entries(sessionCounts).sort((a, b) => b[1] - a[1])[0];
  if (topSession && topSession[1] / losses.length >= 0.6) {
    const pct = Math.round((topSession[1] / losses.length) * 100);
    patterns.push({ icon: "clock", title: "Session Pattern", detail: `${pct}% of your losses happen in the ${topSession[0]} session`, severity: pct >= 80 ? "high" : "medium" });
  }

  const dirCounts: Record<string, number> = {};
  for (const t of losses) if (t.direction) dirCounts[t.direction] = (dirCounts[t.direction] ?? 0) + 1;
  const topDir = Object.entries(dirCounts).sort((a, b) => b[1] - a[1])[0];
  if (topDir && topDir[1] / losses.length >= 0.65) {
    const pct = Math.round((topDir[1] / losses.length) * 100);
    patterns.push({ icon: "arrow", title: "Direction Bias", detail: `${pct}% of your losses are ${topDir[0]} trades`, severity: pct >= 80 ? "high" : "medium" });
  }

  const dayCounts: Record<string, number> = {};
  for (const t of losses) if (t.day) dayCounts[t.day] = (dayCounts[t.day] ?? 0) + 1;
  const topDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  if (topDay && topDay[1] >= 2 && topDay[1] / losses.length >= 0.5) {
    patterns.push({ icon: "calendar", title: "Day Pattern", detail: `${topDay[0]} accounts for ${topDay[1]} of your ${losses.length} losses`, severity: topDay[1] / losses.length >= 0.7 ? "high" : "medium" });
  }

  const avgLossSize = losses.reduce((s, t) => s + t.contracts, 0) / losses.length;
  const avgWinSize = wins.length > 0 ? wins.reduce((s, t) => s + t.contracts, 0) / wins.length : avgLossSize;
  if (avgLossSize > avgWinSize * 1.5 && wins.length > 0) {
    patterns.push({ icon: "size", title: "Oversizing on Losers", detail: `Avg ${avgLossSize.toFixed(0)} contracts on losses vs ${avgWinSize.toFixed(0)} on wins`, severity: "high" });
  }

  const timeLosses = losses.filter(t => t.execution_time);
  if (timeLosses.length >= 2) {
    const earlyLosses = timeLosses.filter(t => { const h = parseInt(t.execution_time!.split(":")[0]); return h < 10; });
    if (earlyLosses.length / timeLosses.length >= 0.5) {
      const pct = Math.round((earlyLosses.length / timeLosses.length) * 100);
      patterns.push({ icon: "time", title: "Early Trading Losses", detail: `${pct}% of your losses happen before 10:00 AM`, severity: pct >= 70 ? "high" : "medium" });
    }
  }

  const gradedLosses = losses.filter(t => t.execution);
  if (gradedLosses.length >= 2) {
    const badGrades = gradedLosses.filter(t => t.execution === "C" || t.execution === "D");
    if (badGrades.length / gradedLosses.length >= 0.5) {
      const pct = Math.round((badGrades.length / gradedLosses.length) * 100);
      patterns.push({ icon: "grade", title: "Poor Execution", detail: `${pct}% of your losses have C/D execution grade`, severity: pct >= 75 ? "high" : "medium" });
    }
  }

  const newsLosses = losses.filter(t => t.news && t.news !== "None" && t.news !== "");
  if (newsLosses.length >= 2 && newsLosses.length / losses.length >= 0.4) {
    const pct = Math.round((newsLosses.length / losses.length) * 100);
    patterns.push({ icon: "news", title: "News Day Losses", detail: `${pct}% of your losses on news days`, severity: pct >= 60 ? "high" : "medium" });
  }

  let maxStreak = 0, streak = 0;
  for (const t of [...allTrades].sort((a, b) => a.date.localeCompare(b.date))) {
    if (t.pnl < 0) { streak++; if (streak > maxStreak) maxStreak = streak; } else streak = 0;
  }
  if (maxStreak >= 3) {
    patterns.push({ icon: "streak", title: "Losing Streak", detail: `Worst streak: ${maxStreak} consecutive losses`, severity: maxStreak >= 5 ? "high" : "medium" });
  }

  const avgLoss = losses.reduce((s, t) => s + Math.abs(t.pnl), 0) / losses.length;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  if (wins.length > 0 && avgLoss > avgWin * 1.5) {
    patterns.push({ icon: "ratio", title: "Losses Bigger Than Wins", detail: `Avg loss $${avgLoss.toFixed(0)} vs avg win $${avgWin.toFixed(0)}`, severity: "high" });
  }

  return patterns;
}

function generateSolutions(patterns: Pattern[]): Solution[] {
  const solutions: Solution[] = [];
  const map: Record<string, { rule: string; reason: string }> = {
    clock: { rule: "Reduce position size in your worst session or avoid it entirely", reason: "" },
    arrow: { rule: "Review your directional bias — consider counter-trend setups or stronger confirmation", reason: "" },
    calendar: { rule: "Trade sim or reduce size on your worst day — or skip it", reason: "" },
    size: { rule: "Keep position size consistent — never increase after a loss. Set a max contract limit", reason: "" },
    time: { rule: "Wait 30 minutes after market open before entering. Let opening volatility settle", reason: "" },
    grade: { rule: "Only take A and B grade setups. If it's not at least B before entry, skip it", reason: "" },
    news: { rule: "Go flat 2 minutes before high-impact news. Do not trade during the initial reaction", reason: "" },
    streak: { rule: "Set a 2-loss daily stop rule. After 2 consecutive losses, close the platform and review", reason: "" },
    ratio: { rule: "Set a hard stop loss before entry and never move it. Avg loss must be smaller than avg win", reason: "" },
  };
  for (const p of patterns) {
    const s = map[p.icon];
    if (s) solutions.push({ rule: s.rule, reason: p.detail });
  }
  return solutions;
}

export default function MistakesPage() {
  const isMobile = useIsMobile();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Date navigation
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const [selectedDate, setSelectedDate] = useState(today);

  // Mistake entry for selected date
  const [entry, setEntry] = useState<MistakeEntry>({ date: today, notes: "", what_to_improve: "", checklist: [], images: [] });
  const [allEntries, setAllEntries] = useState<MistakeEntry[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load trades + entries
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: tradeData }, { data: entryData }] = await Promise.all([
        supabase.from("trades").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("mistake_entries").select("*").order("date", { ascending: false }),
      ]);
      if (tradeData) setTrades(tradeData);
      if (entryData) setAllEntries(entryData.map((e: Record<string, unknown>) => ({
        ...e,
        checklist: Array.isArray(e.checklist) ? e.checklist : [],
        images: Array.isArray(e.images) ? e.images : [],
      })) as MistakeEntry[]);
      setLoading(false);
    })();
  }, []);

  // Load entry for selected date
  useEffect(() => {
    const existing = allEntries.find(e => e.date === selectedDate);
    if (existing) {
      setEntry(existing);
    } else {
      setEntry({ date: selectedDate, notes: "", what_to_improve: "", checklist: [], images: [] });
    }
  }, [selectedDate, allEntries]);

  // Auto-save
  const doSave = useCallback(async (data: MistakeEntry) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      user_id: user.id,
      date: data.date,
      notes: data.notes || null,
      what_to_improve: data.what_to_improve || null,
      checklist: data.checklist,
      images: data.images,
      updated_at: new Date().toISOString(),
    };
    const { data: saved } = await supabase
      .from("mistake_entries")
      .upsert(payload, { onConflict: "user_id,date" })
      .select()
      .single();
    if (saved) {
      setAllEntries(prev => {
        const idx = prev.findIndex(e => e.date === data.date);
        const updated = { ...saved, checklist: Array.isArray(saved.checklist) ? saved.checklist : [], images: Array.isArray(saved.images) ? saved.images : [] } as MistakeEntry;
        if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
        return [updated, ...prev];
      });
    }
  }, []);

  function scheduleAutoSave(updated: MistakeEntry) {
    setEntry(updated);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(updated), 800);
  }

  function addCheckItem() {
    if (!newCheckItem.trim()) return;
    const updated = { ...entry, checklist: [...entry.checklist, { text: newCheckItem.trim(), checked: false }] };
    setNewCheckItem("");
    scheduleAutoSave(updated);
  }

  function toggleCheckItem(idx: number) {
    const updated = { ...entry, checklist: entry.checklist.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c) };
    scheduleAutoSave(updated);
  }

  function removeCheckItem(idx: number) {
    const updated = { ...entry, checklist: entry.checklist.filter((_, i) => i !== idx) };
    scheduleAutoSave(updated);
  }

  function addImage() {
    if (!imageUrl.trim()) return;
    const updated = { ...entry, images: [...entry.images, imageUrl.trim()] };
    setImageUrl("");
    scheduleAutoSave(updated);
  }

  function removeImage(idx: number) {
    const updated = { ...entry, images: entry.images.filter((_, i) => i !== idx) };
    scheduleAutoSave(updated);
  }

  // Data
  const losses = trades.filter(t => t.pnl < 0);
  const patterns = detectPatterns(losses, trades);
  const solutions = generateSolutions(patterns);
  const dayLosses = losses.filter(t => t.date === selectedDate);
  const dayTotal = dayLosses.reduce((s, t) => s + t.pnl, 0);

  // All dates that have losses OR entries
  const allDatesSet = new Set<string>();
  for (const t of losses) allDatesSet.add(t.date);
  for (const e of allEntries) allDatesSet.add(e.date);
  const allDates = [...allDatesSet].sort((a, b) => b.localeCompare(a));

  // Loss summary
  const lossesByDate: Record<string, Trade[]> = {};
  for (const t of losses) { if (!lossesByDate[t.date]) lossesByDate[t.date] = []; lossesByDate[t.date].push(t); }
  const totalLost = losses.reduce((s, t) => s + t.pnl, 0);
  const avgLoss = losses.length > 0 ? totalLost / losses.length : 0;

  const sevColor = (s: string) => s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#888";

  if (loading) return <div style={{ padding: 24, color: "#555" }}>Loading...</div>;

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Mistakes & Lessons</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#555" }}>Learn from your losses to become a better trader</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        {/* LEFT: Daily review */}
        <div>
          {/* Date picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, padding: "8px 12px", color: selectedDate === today ? "#c9a84c" : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", outline: "none", colorScheme: "dark" }}
            />
            {dayLosses.length > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>{dayLosses.length} loss{dayLosses.length !== 1 ? "es" : ""}: ${dayTotal.toFixed(2)}</span>
            )}
          </div>

          {/* Day's losing trades */}
          {dayLosses.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Losses This Day</div>
              {dayLosses.map(t => (
                <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid #1a1a1a", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{t.contract}</span>
                  {t.direction && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: t.direction === "Long" ? "#22c55e22" : "#ef444422", color: t.direction === "Long" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{t.direction}</span>}
                  <span style={{ fontSize: 12, color: "#888" }}>{t.contracts}ct</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>${t.pnl.toFixed(2)}</span>
                  {t.session && <span style={{ fontSize: 10, color: "#555" }}>{t.session}</span>}
                  {t.execution && <span style={{ fontSize: 10, color: "#555" }}>Grade: {t.execution}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Notes — what happened */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>What went wrong?</div>
            <textarea
              value={entry.notes}
              onChange={e => scheduleAutoSave({ ...entry, notes: e.target.value })}
              placeholder="Describe your mistakes today..."
              rows={4}
              style={{ width: "100%", background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
            />
          </div>

          {/* What to improve */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>What can I do better?</div>
            <textarea
              value={entry.what_to_improve}
              onChange={e => scheduleAutoSave({ ...entry, what_to_improve: e.target.value })}
              placeholder="How will I prevent this next time..."
              rows={3}
              style={{ width: "100%", background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
            />
          </div>

          {/* Checklist / Reminders */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#c9a84c", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Pre-Trade Checklist / Reminders</div>
            {entry.checklist.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <button
                  onClick={() => toggleCheckItem(i)}
                  style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${item.checked ? "#22c55e" : "#333"}`, background: item.checked ? "#22c55e22" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}
                >
                  {item.checked && <Check size={12} color="#22c55e" />}
                </button>
                <span style={{ flex: 1, fontSize: 13, color: item.checked ? "#555" : "#ccc", textDecoration: item.checked ? "line-through" : "none" }}>{item.text}</span>
                <button onClick={() => removeCheckItem(i)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 2 }} onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                  <X size={12} />
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input
                value={newCheckItem}
                onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCheckItem()}
                placeholder="Add reminder..."
                style={{ flex: 1, background: "#0a0a0a", border: "1px solid #222", borderRadius: 6, padding: "7px 10px", color: "#fff", fontSize: 12, outline: "none" }}
              />
              <button onClick={addCheckItem} disabled={!newCheckItem.trim()} style={{ background: newCheckItem.trim() ? "#c9a84c" : "#333", border: "none", borderRadius: 6, color: newCheckItem.trim() ? "#000" : "#666", fontWeight: 700, fontSize: 11, padding: "7px 12px", cursor: newCheckItem.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 4 }}>
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          {/* Screenshots */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Camera size={14} color="#555" />
              <span style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Screenshots</span>
            </div>
            {entry.images.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {entry.images.map((url, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={url} alt="" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #222" }} />
                    <button onClick={() => removeImage(i)} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addImage()}
                placeholder="Paste image URL..."
                style={{ flex: 1, background: "#0a0a0a", border: "1px solid #222", borderRadius: 6, padding: "7px 10px", color: "#fff", fontSize: 12, outline: "none" }}
              />
              <button onClick={addImage} disabled={!imageUrl.trim()} style={{ background: imageUrl.trim() ? "#c9a84c" : "#333", border: "none", borderRadius: 6, color: imageUrl.trim() ? "#000" : "#666", fontWeight: 700, fontSize: 11, padding: "7px 12px", cursor: imageUrl.trim() ? "pointer" : "not-allowed" }}>
                Add
              </button>
            </div>
          </div>

          {/* Past entries quick nav */}
          {allDates.length > 1 && (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Review Past Dates</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {allDates.slice(0, 20).map(date => {
                  const hasLoss = losses.some(t => t.date === date);
                  const hasEntry = allEntries.some(e => e.date === date && (e.notes || e.what_to_improve || e.checklist.length > 0));
                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      style={{
                        padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${selectedDate === date ? "#c9a84c" : "#222"}`,
                        background: selectedDate === date ? "#c9a84c22" : "transparent",
                        color: selectedDate === date ? "#c9a84c" : hasEntry ? "#888" : hasLoss ? "#ef4444" : "#444",
                      }}
                    >
                      {date.slice(5)}{hasEntry ? " *" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Patterns + Solutions + Summary */}
        <div>
          {/* Loss Summary */}
          {losses.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
                <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>${avgLoss.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Loss Days</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{Object.keys(lossesByDate).length}</div>
              </div>
            </div>
          )}

          {/* Pattern Detection */}
          {patterns.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <AlertTriangle size={16} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>Pattern Detection</h3>
              </div>
              {patterns.map((p, i) => (
                <div key={i} style={{ padding: "10px 12px", marginBottom: 6, background: "#0a0a0a", borderRadius: 8, borderLeft: `3px solid ${sevColor(p.severity)}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sevColor(p.severity), marginBottom: 2 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{p.detail}</div>
                </div>
              ))}
            </div>
          )}

          {/* Solutions */}
          {solutions.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #22c55e33", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Shield size={16} color="#22c55e" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#22c55e" }}>Rules to Follow</h3>
              </div>
              {solutions.map((s, i) => (
                <div key={i} style={{ padding: "12px 14px", marginBottom: 6, background: "#0a0a0a", borderRadius: 8, borderLeft: "3px solid #22c55e" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc", marginBottom: 4 }}>{i + 1}. {s.rule}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>Because: {s.reason}</div>
                </div>
              ))}
            </div>
          )}

          {/* All losses list */}
          {Object.keys(lossesByDate).length > 0 && (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <TrendingDown size={16} color="#ef4444" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#888" }}>All Losses</h3>
              </div>
              {Object.keys(lossesByDate).sort((a, b) => b.localeCompare(a)).map(date => {
                const dayTrades = lossesByDate[date];
                const dt = dayTrades.reduce((s, t) => s + t.pnl, 0);
                const isOpen = expanded[date];
                return (
                  <div key={date} style={{ marginBottom: 4, border: "1px solid #1a1a1a", borderRadius: 6, overflow: "hidden" }}>
                    <div onClick={() => setExpanded(p => ({ ...p, [date]: !p[date] }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer", background: "#0a0a0a" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isOpen ? <ChevronDown size={12} color="#555" /> : <ChevronRight size={12} color="#555" />}
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#ccc" }}>{date}</span>
                        <span style={{ fontSize: 10, color: "#444" }}>{dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>${dt.toFixed(2)}</span>
                    </div>
                    {isOpen && dayTrades.map(t => (
                      <div key={t.id} style={{ padding: "6px 12px", borderTop: "1px solid #1a1a1a", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "#fff" }}>{t.contract}</span>
                        {t.direction && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: t.direction === "Long" ? "#22c55e22" : "#ef444422", color: t.direction === "Long" ? "#22c55e" : "#ef4444" }}>{t.direction}</span>}
                        <span style={{ color: "#888" }}>{t.contracts}ct</span>
                        <span style={{ fontWeight: 700, color: "#ef4444" }}>${t.pnl.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {losses.length === 0 && (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 40, textAlign: "center" }}>
              <Shield size={32} color="#22c55e" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, color: "#888", fontWeight: 600 }}>No losses recorded yet</div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>Patterns and solutions appear as you log trades</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
