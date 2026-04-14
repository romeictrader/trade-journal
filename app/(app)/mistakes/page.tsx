"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trade } from "@/lib/types";
import { AlertTriangle, Shield, Check, Camera, X, ChevronDown, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

const CATEGORIES = [
  "FOMO Entry", "Overtraded", "Moved SL", "No Setup / Boredom", "Revenge Trade",
  "Sized Too Big", "Early Entry", "Late Exit", "Against Trend", "Chased Entry",
  "Broke Daily Loss Rule", "Overleveraged", "Didn't Follow Plan", "News Trade",
];

interface Review {
  id?: string;
  trade_id: string;
  notes: string;
  what_to_improve: string;
  categories: string[];
  lesson: string;
  images: string[];
  reviewed: boolean;
}

interface Pattern { title: string; detail: string; severity: "high" | "medium" | "low" }

function detectPatterns(losses: Trade[], all: Trade[]): Pattern[] {
  const p: Pattern[] = [];
  if (losses.length < 2) return p;
  const wins = all.filter(t => t.pnl > 0);

  const sc: Record<string, number> = {};
  for (const t of losses) if (t.session) sc[t.session] = (sc[t.session] ?? 0) + 1;
  const ts = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
  if (ts && ts[1] / losses.length >= 0.6) p.push({ title: "Session Pattern", detail: `${Math.round(ts[1] / losses.length * 100)}% of losses in ${ts[0]}`, severity: ts[1] / losses.length >= 0.8 ? "high" : "medium" });

  const dc: Record<string, number> = {};
  for (const t of losses) if (t.direction) dc[t.direction] = (dc[t.direction] ?? 0) + 1;
  const td = Object.entries(dc).sort((a, b) => b[1] - a[1])[0];
  if (td && td[1] / losses.length >= 0.65) p.push({ title: "Direction Bias", detail: `${Math.round(td[1] / losses.length * 100)}% of losses are ${td[0]}`, severity: td[1] / losses.length >= 0.8 ? "high" : "medium" });

  const dyc: Record<string, number> = {};
  for (const t of losses) if (t.day) dyc[t.day] = (dyc[t.day] ?? 0) + 1;
  const tdy = Object.entries(dyc).sort((a, b) => b[1] - a[1])[0];
  if (tdy && tdy[1] >= 2 && tdy[1] / losses.length >= 0.5) p.push({ title: "Day Pattern", detail: `${tdy[0]} accounts for ${tdy[1]} of ${losses.length} losses`, severity: tdy[1] / losses.length >= 0.7 ? "high" : "medium" });

  const als = losses.reduce((s, t) => s + t.contracts, 0) / losses.length;
  const aws = wins.length > 0 ? wins.reduce((s, t) => s + t.contracts, 0) / wins.length : als;
  if (als > aws * 1.5 && wins.length > 0) p.push({ title: "Oversizing", detail: `Avg ${als.toFixed(0)}ct on losses vs ${aws.toFixed(0)}ct on wins`, severity: "high" });

  const gl = losses.filter(t => t.execution === "C" || t.execution === "D");
  if (gl.length >= 2 && gl.length / losses.length >= 0.5) p.push({ title: "Poor Execution", detail: `${Math.round(gl.length / losses.length * 100)}% of losses graded C/D`, severity: gl.length / losses.length >= 0.75 ? "high" : "medium" });

  const nl = losses.filter(t => t.news && t.news !== "None");
  if (nl.length >= 2 && nl.length / losses.length >= 0.4) p.push({ title: "News Losses", detail: `${Math.round(nl.length / losses.length * 100)}% of losses on news days`, severity: nl.length / losses.length >= 0.6 ? "high" : "medium" });

  let ms = 0, cs = 0;
  for (const t of [...all].sort((a, b) => a.date.localeCompare(b.date))) { if (t.pnl < 0) { cs++; if (cs > ms) ms = cs; } else cs = 0; }
  if (ms >= 3) p.push({ title: "Losing Streak", detail: `Worst streak: ${ms} consecutive losses`, severity: ms >= 5 ? "high" : "medium" });

  const avl = losses.reduce((s, t) => s + Math.abs(t.pnl), 0) / losses.length;
  const avw = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  if (wins.length > 0 && avl > avw * 1.5) p.push({ title: "Losses > Wins", detail: `Avg loss $${avl.toFixed(0)} vs avg win $${avw.toFixed(0)}`, severity: "high" });

  return p;
}

const solutions: Record<string, string> = {
  "Session Pattern": "Reduce size in your worst session or avoid it entirely",
  "Direction Bias": "Review your directional bias — consider counter-trend setups",
  "Day Pattern": "Trade sim or skip your worst day",
  "Oversizing": "Keep position size consistent — never increase after a loss",
  "Poor Execution": "Only take A/B grade setups — skip C trades",
  "News Losses": "Go flat 2 min before high-impact news",
  "Losing Streak": "Set a 2-loss daily stop rule — close platform after 2 losses",
  "Losses > Wins": "Set a hard stop before entry and never move it",
};

export default function MistakesPage() {
  const isMobile = useIsMobile();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | "Unreviewed" | "Reviewed">("All");
  const [userId, setUserId] = useState("");
  const [expandedInsights, setExpandedInsights] = useState(true);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const [{ data: td }, { data: rd }] = await Promise.all([
        supabase.from("trades").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("mistake_entries").select("*").eq("user_id", user.id),
      ]);
      if (td) setTrades(td);
      if (rd) {
        const map: Record<string, Review> = {};
        for (const r of rd) {
          if (r.trade_id) map[r.trade_id] = { ...r, categories: Array.isArray(r.categories) ? r.categories : [], images: Array.isArray(r.images) ? r.images : [] };
        }
        setReviews(map);
      }
      setLoading(false);
    })();
  }, []);

  const saveReview = useCallback(async (tradeId: string, review: Review) => {
    setReviews(prev => ({ ...prev, [tradeId]: review }));
    if (saveTimers.current[tradeId]) clearTimeout(saveTimers.current[tradeId]);
    saveTimers.current[tradeId] = setTimeout(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const trade = trades.find(t => t.id === tradeId);
      await supabase.from("mistake_entries").upsert({
        ...(review.id ? { id: review.id } : {}),
        user_id: user.id,
        trade_id: tradeId,
        date: trade?.date ?? "",
        notes: review.notes || null,
        what_to_improve: review.what_to_improve || null,
        categories: review.categories,
        lesson: review.lesson || null,
        images: review.images,
        reviewed: review.reviewed,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,trade_id" }).select().single().then(({ data }) => {
        if (data) setReviews(prev => ({ ...prev, [tradeId]: { ...prev[tradeId], id: data.id } }));
      });
    }, 800);
  }, [trades]);

  async function uploadFile(file: File, tradeId: string): Promise<string | null> {
    if (!userId) return null;
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "png";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${userId}/mistakes/${tradeId}/${fileName}`;
    const { error } = await supabase.storage.from("journal-images").upload(storagePath, file, { upsert: true });
    if (error) return null;
    const { data } = await supabase.storage.from("journal-images").createSignedUrl(storagePath, 31536000);
    return data?.signedUrl ?? null;
  }

  async function handleFiles(files: FileList | null, tradeId: string) {
    if (!files) return;
    const review = reviews[tradeId] ?? { trade_id: tradeId, notes: "", what_to_improve: "", categories: [], lesson: "", images: [], reviewed: false };
    const newImages = [...review.images];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const url = await uploadFile(file, tradeId);
      if (url) newImages.push(url);
    }
    saveReview(tradeId, { ...review, images: newImages });
  }

  function addImageUrl(tradeId: string, url: string) {
    if (!url.trim()) return;
    const review = reviews[tradeId] ?? { trade_id: tradeId, notes: "", what_to_improve: "", categories: [], lesson: "", images: [], reviewed: false };
    saveReview(tradeId, { ...review, images: [...review.images, url.trim()] });
  }

  const losses = trades.filter(t => t.pnl < 0);
  const filtered = filter === "All" ? losses
    : filter === "Reviewed" ? losses.filter(t => reviews[t.id]?.reviewed)
    : losses.filter(t => !reviews[t.id]?.reviewed);

  const allReviews = Object.values(reviews);
  const allLessons = allReviews.map(r => r.lesson).filter(Boolean);
  const catCounts: Record<string, number> = {};
  for (const r of allReviews) for (const c of r.categories) catCounts[c] = (catCounts[c] ?? 0) + 1;
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const patterns = detectPatterns(losses, trades);

  const sevColor = (s: string) => s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#888";

  if (loading) return <div style={{ padding: 24, color: "#555" }}>Loading...</div>;

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Mistakes & Lessons</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#555" }}>Review every loss. Build your personal rulebook.</p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(["All", "Unreviewed", "Reviewed"] as const).map(f => {
          const count = f === "All" ? losses.length : f === "Reviewed" ? losses.filter(t => reviews[t.id]?.reviewed).length : losses.filter(t => !reviews[t.id]?.reviewed).length;
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${active ? "#c9a84c" : "#333"}`, background: active ? "#c9a84c22" : "transparent", color: active ? "#c9a84c" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {f} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <Shield size={32} color="#22c55e" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, color: "#888", fontWeight: 600 }}>{filter === "Unreviewed" ? "All losses reviewed!" : "No losses recorded"}</div>
          <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>{filter === "Unreviewed" ? "Great job reviewing your trades" : "Losing trades will appear here for review"}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {filtered.map(trade => <ReviewCard key={trade.id} trade={trade} review={reviews[trade.id]} onSave={(r) => saveReview(trade.id, r)} onFiles={(files) => handleFiles(files, trade.id)} onAddUrl={(url) => addImageUrl(trade.id, url)} />)}
        </div>
      )}

      {/* Insights */}
      {losses.length > 0 && (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <div onClick={() => setExpandedInsights(!expandedInsights)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", cursor: "pointer" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#888" }}>Insights & Rulebook</h3>
            {expandedInsights ? <ChevronDown size={16} color="#555" /> : <ChevronRight size={16} color="#555" />}
          </div>
          {expandedInsights && (
            <div style={{ padding: "0 20px 20px" }}>
              {/* My Rulebook */}
              {allLessons.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Shield size={14} color="#22c55e" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.05em" }}>My Rulebook ({allLessons.length} rules)</span>
                  </div>
                  {allLessons.map((l, i) => (
                    <div key={i} style={{ padding: "8px 12px", marginBottom: 4, background: "#0a0a0a", borderRadius: 6, borderLeft: "3px solid #22c55e", fontSize: 12, color: "#ccc" }}>
                      {l}
                    </div>
                  ))}
                </div>
              )}

              {/* Top Mistakes */}
              {topCats.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Top Mistakes</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {topCats.map(([cat, count]) => (
                      <span key={cat} style={{ padding: "4px 10px", borderRadius: 6, background: "#ef444422", border: "1px solid #ef444444", color: "#ef4444", fontSize: 11, fontWeight: 600 }}>
                        {cat} ({count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pattern Detection */}
              {patterns.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <AlertTriangle size={14} color="#f59e0b" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Patterns</span>
                  </div>
                  {patterns.map((p, i) => (
                    <div key={i} style={{ padding: "8px 12px", marginBottom: 4, background: "#0a0a0a", borderRadius: 6, borderLeft: `3px solid ${sevColor(p.severity)}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: sevColor(p.severity) }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{p.detail}</div>
                      {solutions[p.title] && <div style={{ fontSize: 11, color: "#22c55e", marginTop: 2 }}>{solutions[p.title]}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ trade, review, onSave, onFiles, onAddUrl }: {
  trade: Trade;
  review?: Review;
  onSave: (r: Review) => void;
  onFiles: (files: FileList | null) => void;
  onAddUrl: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(!review?.reviewed);
  const [imgUrl, setImgUrl] = useState("");

  const r: Review = review ?? { trade_id: trade.id, notes: "", what_to_improve: "", categories: [], lesson: "", images: [], reviewed: false };

  function update(fields: Partial<Review>) {
    onSave({ ...r, ...fields });
  }

  function toggleCat(cat: string) {
    const cats = r.categories.includes(cat) ? r.categories.filter(c => c !== cat) : [...r.categories, cat];
    update({ categories: cats });
  }

  function removeImage(idx: number) {
    update({ images: r.images.filter((_, i) => i !== idx) });
  }

  return (
    <div style={{ background: "#111", border: `1px solid ${r.reviewed ? "#22c55e33" : "#222"}`, borderRadius: 12, overflow: "hidden" }}>
      {/* Trade header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", background: "#0a0a0a" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#555" }}>{trade.date}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{trade.contract}</span>
          {trade.direction && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: trade.direction === "Long" ? "#22c55e22" : "#ef444422", color: trade.direction === "Long" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{trade.direction}</span>}
          <span style={{ fontSize: 12, color: "#888" }}>{trade.contracts}ct</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>${trade.pnl.toFixed(2)}</span>
          {trade.session && <span style={{ fontSize: 11, color: "#444" }}>{trade.session}</span>}
          {trade.execution && <span style={{ fontSize: 11, color: "#444" }}>Grade: {trade.execution}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {r.reviewed && <Check size={14} color="#22c55e" />}
          {expanded ? <ChevronDown size={14} color="#555" /> : <ChevronRight size={14} color="#555" />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "12px 16px 16px" }}>
          {/* Categories */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Mistake Category</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {CATEGORIES.map(cat => {
                const active = r.categories.includes(cat);
                return (
                  <button key={cat} onClick={() => toggleCat(cat)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${active ? "#ef4444" : "#222"}`, background: active ? "#ef444422" : "transparent", color: active ? "#ef4444" : "#555", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* What went wrong */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>What went wrong?</div>
            <textarea
              value={r.notes}
              onChange={e => update({ notes: e.target.value })}
              placeholder="Describe what happened..."
              rows={2}
              style={{ width: "100%", background: "#0a0a0a", border: "1px solid #222", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
            />
          </div>

          {/* What should I have done */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>What should I have done?</div>
            <textarea
              value={r.what_to_improve}
              onChange={e => update({ what_to_improve: e.target.value })}
              placeholder="How would I handle this differently..."
              rows={2}
              style={{ width: "100%", background: "#0a0a0a", border: "1px solid #222", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
            />
          </div>

          {/* Lesson */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Lesson / Rule to Remember</div>
            <input
              value={r.lesson}
              onChange={e => update({ lesson: e.target.value })}
              placeholder="One rule to prevent this..."
              style={{ width: "100%", background: "#0a0a0a", border: "1px solid #222", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Screenshots */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Camera size={12} color="#555" />
              <span style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Screenshots</span>
            </div>
            {r.images.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {r.images.map((url, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={url} alt="" style={{ width: 100, height: 70, objectFit: "cover", borderRadius: 6, border: "1px solid #222" }} />
                    <button onClick={() => removeImage(i)} style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Drop zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
              onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.multiple = true; input.onchange = () => onFiles(input.files); input.click(); }}
              style={{ border: "1px dashed #333", borderRadius: 6, padding: "12px", textAlign: "center", cursor: "pointer", fontSize: 11, color: "#444", marginBottom: 6 }}
            >
              Drop screenshots or click to upload
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <input value={imgUrl} onChange={e => setImgUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { onAddUrl(imgUrl); setImgUrl(""); } }} placeholder="Or paste image URL..." style={{ flex: 1, background: "#0a0a0a", border: "1px solid #222", borderRadius: 4, padding: "5px 8px", color: "#fff", fontSize: 11, outline: "none" }} />
              <button onClick={() => { onAddUrl(imgUrl); setImgUrl(""); }} disabled={!imgUrl.trim()} style={{ background: imgUrl.trim() ? "#c9a84c" : "#333", border: "none", borderRadius: 4, color: imgUrl.trim() ? "#000" : "#666", fontWeight: 700, fontSize: 10, padding: "5px 10px", cursor: imgUrl.trim() ? "pointer" : "not-allowed" }}>Add</button>
            </div>
          </div>

          {/* Reviewed toggle */}
          <button
            onClick={() => update({ reviewed: !r.reviewed })}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, color: r.reviewed ? "#22c55e" : "#555", fontSize: 12, fontWeight: 600 }}
          >
            <span style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${r.reviewed ? "#22c55e" : "#333"}`, background: r.reviewed ? "#22c55e22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {r.reviewed && <Check size={12} />}
            </span>
            Reviewed
          </button>
        </div>
      )}
    </div>
  );
}
