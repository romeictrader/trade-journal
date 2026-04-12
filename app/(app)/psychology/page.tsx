"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PsychologyCheckin } from "@/lib/types";
import { CheckCircle, XCircle, Flame, Trash2, Trophy, Zap, Star } from "lucide-react";
import MultiTagInput from "@/components/MultiTagInput";
import { useIsMobile } from "@/hooks/useIsMobile";

const RULES_OPTIONS = [
  "Overtraded", "Overleveraged", "Moved SL", "FOMO Entry", "Chased Entry",
  "Early Exit", "Sized Too Big", "Broke Daily Loss Rule", "Traded Against Trend",
  "No Setup / Boredom Trade", "Revenge Trade",
];

export default function PsychologyPage() {
  const isMobile = useIsMobile();
  const [checkins, setCheckins] = useState<PsychologyCheckin[]>([]);
  const [userId, setUserId] = useState("");

  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const [date] = useState(today);
  const [followedRules, setFollowedRules] = useState<boolean | null>(null);
  const [rulesBroken, setRulesBroken] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        const { data } = await supabase
          .from("psychology_checkins").select("*").eq("user_id", user.id).order("date", { ascending: false });
        if (data) setCheckins(data);
        const todayCheckin = data?.find((c) => c.date === today);
        if (todayCheckin) {
          setFollowedRules(todayCheckin.followed_rules ?? null);
          setNotes(todayCheckin.notes ?? "");
          const rb = (todayCheckin as unknown as Record<string, unknown>).rules_broken as string | null;
          setRulesBroken(rb ?? "");
        }
      } catch (err) { console.error(err); }
    }
    load();
  }, [today]);

  const doSave = useCallback(async (fields: { followedRules?: boolean; rulesBroken?: string; notes?: string }) => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const payload = {
      user_id: user.id, date,
      confidence: 5, focus: 5, stress: 3,
      followed_rules: (fields.followedRules !== undefined ? fields.followedRules : followedRules) ?? null,
      notes: (fields.notes ?? notes) || null,
      rules_broken: (fields.rulesBroken ?? rulesBroken) || null,
    };
    const { data, error } = await supabase
      .from("psychology_checkins").upsert(payload, { onConflict: "user_id,date" }).select().single();
    if (!error && data) {
      setCheckins((prev) => {
        const idx = prev.findIndex((c) => c.id === data.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = data; return next; }
        return [data, ...prev];
      });
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [date, followedRules, rulesBroken, notes]);

  function scheduleAutoSave(fields: { followedRules?: boolean; rulesBroken?: string; notes?: string }) {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => doSave(fields), 1000);
  }

  async function deleteCheckin(id: string) {
    if (!confirm("Delete this check-in?")) return;
    const supabase = createClient();
    await supabase.from("psychology_checkins").delete().eq("id", id);
    setCheckins((prev) => prev.filter((c) => c.id !== id));
    setSelectedDay(null);
  }

  // Stats
  let streak = 0;
  for (const c of [...checkins].sort((a, b) => b.date.localeCompare(a.date))) {
    if (c.followed_rules === true) streak++;
    else if (c.followed_rules === false) break;
    // null (nil) doesn't break streak but doesn't add to it
  }
  const monthPfx = today.slice(0, 7);
  const monthCheckins = checkins.filter((c) => c.date.startsWith(monthPfx));
  const rulesFollowedDays = monthCheckins.filter((c) => c.followed_rules === true).length;
  const rulesBrokenDays = monthCheckins.filter((c) => c.followed_rules === false).length;

  // Calendar
  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function dayCheckin(d: number) {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return checkins.find((ch) => ch.date === ds) ?? null;
  }

  const selectedCheckin = selectedDay ? checkins.find((c) => c.date === selectedDay) ?? null : null;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 700 }}>Psychology</h1>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
        {/* Left: Check-in form */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Daily Check-in — {date}</h3>

          {/* Followed rules */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#ccc", fontWeight: 600, marginBottom: 10 }}>Did you follow your trading rules today?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setFollowedRules(true); setRulesBroken(""); }}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid", borderColor: followedRules === true ? "#22c55e" : "#333", background: followedRules === true ? "#22c55e22" : "transparent", color: followedRules === true ? "#22c55e" : "#888", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <CheckCircle size={14} /> Yes
              </button>
              <button
                onClick={() => { setFollowedRules(null); setRulesBroken(""); }}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid", borderColor: followedRules === null ? "#555" : "#333", background: followedRules === null ? "#55555522" : "transparent", color: followedRules === null ? "#aaa" : "#888", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                — Nil
              </button>
              <button
                onClick={() => { setFollowedRules(false); }}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid", borderColor: followedRules === false ? "#ef4444" : "#333", background: followedRules === false ? "#ef444422" : "transparent", color: followedRules === false ? "#ef4444" : "#888", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <XCircle size={14} /> No
              </button>
            </div>
          </div>

          {/* Rules broken multi-tag */}
          {followedRules === false && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 8, fontWeight: 600 }}>Which rules did you break?</div>
              <MultiTagInput
                fieldName="psych_rules_broken"
                value={rulesBroken}
                onChange={(v) => { setRulesBroken(v); scheduleAutoSave({ rulesBroken: v }); }}
                placeholder="Type or select rules broken..."
                seedOptions={RULES_OPTIONS}
                userId={userId}
              />
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>Notes — What&apos;s affecting your trading mindset?</label>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); scheduleAutoSave({ notes: e.target.value }); }}
              rows={3}
              placeholder="How are you feeling today? Any distractions?"
              style={{ width: "100%", background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <button
            onClick={() => doSave({})}
            disabled={saving}
            style={{ width: "100%", background: saved ? "#22c55e" : saving ? "#666" : "#c9a84c", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 14, padding: "12px", cursor: saving ? "not-allowed" : "pointer" }}
          >
            {saved ? "Saved!" : saving ? "Saving..." : "Save Check-in"}
          </button>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Streak */}
          {(() => {
            const milestone = Math.floor(streak / 30);
            const Icon = milestone >= 3 ? Trophy : milestone >= 2 ? Star : milestone >= 1 ? Zap : Flame;
            const color = milestone >= 3 ? "#22c55e" : milestone >= 2 ? "#a78bfa" : milestone >= 1 ? "#38bdf8" : "#c9a84c";
            const label = milestone >= 3 ? "Legend — 90+ days" : milestone >= 2 ? "Elite — 60+ days" : milestone >= 1 ? "Consistent — 30+ days" : "day following rules streak";
            const badge = milestone > 0 ? `${milestone * 30}+ day milestone 🎉` : null;
            return (
              <div style={{ background: "#111", border: `1px solid ${color}33`, borderRadius: 12, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
                <Icon size={36} style={{ color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color }}>{streak}</div>
                  <div style={{ fontSize: 13, color: "#888" }}>{label}</div>
                  {badge && <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 600 }}>{badge}</div>}
                </div>
              </div>
            );
          })()}

          {/* Month stats */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
            <h4 style={{ margin: "0 0 14px", fontSize: 13, color: "#888" }}>This Month</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "#22c55e0d", border: "1px solid #22c55e33", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#22c55e" }}>{rulesFollowedDays}</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Days followed</div>
              </div>
              <div style={{ background: "#ef44440d", border: "1px solid #ef444433", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#ef4444" }}>{rulesBrokenDays}</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Days broken</div>
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 13, color: "#888" }}>Rule Compliance Calendar</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
              {["M","T","W","T","F","S","S"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 9, color: "#444", padding: "2px 0" }}>{d}</div>
              ))}
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;
                const c = dayCheckin(day);
                const bg = !c ? "#1a1a1a" : c.followed_rules === true ? "#22c55e33" : c.followed_rules === false ? "#ef444433" : "#111";
                const border = !c ? "#222" : c.followed_rules === true ? "#22c55e66" : c.followed_rules === false ? "#ef444466" : "#333";
                const col = !c ? "#444" : c.followed_rules === true ? "#22c55e" : c.followed_rules === false ? "#ef4444" : "#555";
                return (
                  <div
                    key={day}
                    onClick={() => c ? setSelectedDay(`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`) : undefined}
                    style={{ aspectRatio: "1", borderRadius: 4, background: bg, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: col, fontWeight: 600, cursor: c ? "pointer" : "default" }}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "#555" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e33", border: "1px solid #22c55e66", display: "inline-block" }} /> Followed</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#ef444433", border: "1px solid #ef444466", display: "inline-block" }} /> Broken</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#1a1a1a", border: "1px solid #222", display: "inline-block" }} /> No data</span>
            </div>
          </div>
        </div>
      </div>

      {/* Day side peek */}
      {selectedDay && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={() => setSelectedDay(null)} />
          <div style={{ width: 360, height: "100vh", background: "#111", borderLeft: "1px solid #222", overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{selectedDay}</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Psychology Check-in</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {selectedCheckin && (
                  <button onClick={() => deleteCheckin(selectedCheckin.id)} style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#ef4444", cursor: "pointer", padding: "5px 8px", display: "flex", alignItems: "center" }} title="Delete">
                    <Trash2 size={13} />
                  </button>
                )}
                <button onClick={() => setSelectedDay(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
              </div>
            </div>

            {selectedCheckin ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Rules followed */}
                <div style={{ background: selectedCheckin.followed_rules === true ? "#22c55e0d" : selectedCheckin.followed_rules === false ? "#ef44440d" : "#1a1a1a", border: `1px solid ${selectedCheckin.followed_rules === true ? "#22c55e33" : selectedCheckin.followed_rules === false ? "#ef444433" : "#333"}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  {selectedCheckin.followed_rules === true
                    ? <CheckCircle size={18} color="#22c55e" />
                    : selectedCheckin.followed_rules === false
                    ? <XCircle size={18} color="#ef4444" />
                    : <span style={{ fontSize: 18 }}>—</span>}
                  <span style={{ fontSize: 14, fontWeight: 600, color: selectedCheckin.followed_rules === true ? "#22c55e" : selectedCheckin.followed_rules === false ? "#ef4444" : "#888" }}>
                    {selectedCheckin.followed_rules === true ? "Followed trading rules" : selectedCheckin.followed_rules === false ? "Did not follow rules" : "Did not trade (Nil)"}
                  </span>
                </div>

                {/* Rules broken tags */}
                {(() => {
                  const rb = (selectedCheckin as unknown as Record<string, unknown>).rules_broken as string | null;
                  return rb ? (
                    <div>
                      <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Rules Broken</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {rb.split(",").map((r) => r.trim()).filter(Boolean).map((r) => (
                          <span key={r} style={{ background: "#ef444422", border: "1px solid #ef444455", borderRadius: 20, color: "#ef4444", fontSize: 12, fontWeight: 600, padding: "4px 12px" }}>{r}</span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Notes */}
                {selectedCheckin.notes && (
                  <div>
                    <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Notes</div>
                    <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, padding: "10px 12px", color: "#ccc", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selectedCheckin.notes}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: "#444", fontSize: 13, textAlign: "center", marginTop: 20 }}>No check-in for this day.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
