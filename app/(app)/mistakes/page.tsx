"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trade } from "@/lib/types";
import { Shield, Check, Camera, X, ChevronDown, ChevronRight, Plus, Trash2, ExternalLink, Bell } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

const DEFAULT_CATEGORIES = [
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
  date?: string;
}

export default function MistakesPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | "Unreviewed" | "Reviewed">("All");
  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState<"rules" | "review" | "calendar" | "repeats">("rules");
  const [tradeImages, setTradeImages] = useState<Record<string, string[]>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCat, setNewCat] = useState("");
  const [editingCats, setEditingCats] = useState(false);

  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState("");
  const [checklist, setChecklist] = useState<{ text: string; checked: boolean }[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");

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
      if (td) {
        setTrades(td);
        // Load trade screenshots for losing trades
        const lossIds = td.filter((t: Trade) => t.pnl < 0).map((t: Trade) => t.id);
        if (lossIds.length > 0) {
          const { data: imgs } = await supabase.from("trade_images").select("trade_id, storage_path, url").in("trade_id", lossIds);
          if (imgs && imgs.length > 0) {
            const imgMap: Record<string, string[]> = {};
            for (const img of imgs) {
              let url = img.url ?? "";
              if (img.storage_path) {
                const { data: s } = await supabase.storage.from("journal-images").createSignedUrl(img.storage_path, 3600);
                url = s?.signedUrl ?? url;
              }
              if (url) {
                if (!imgMap[img.trade_id]) imgMap[img.trade_id] = [];
                imgMap[img.trade_id].push(url);
              }
            }
            setTradeImages(imgMap);
          }
        }
      }
      if (rd) {
        const map: Record<string, Review> = {};
        for (const r of rd) {
          if (r.trade_id) map[r.trade_id] = { ...r, categories: Array.isArray(r.categories) ? r.categories : [], images: Array.isArray(r.images) ? r.images : [] };
        }
        setReviews(map);
      }
      try {
        const sc = localStorage.getItem("mistake_categories");
        if (sc) setCategories(JSON.parse(sc));
        const sr = localStorage.getItem("mistake_rules");
        if (sr) setRules(JSON.parse(sr));
        const scl = localStorage.getItem("mistake_checklist");
        if (scl) setChecklist(JSON.parse(scl));
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  function saveCats(u: string[]) { setCategories(u); localStorage.setItem("mistake_categories", JSON.stringify(u)); }
  function saveRulesList(u: string[]) { setRules(u); localStorage.setItem("mistake_rules", JSON.stringify(u)); }
  function saveChecklist(u: { text: string; checked: boolean }[]) { setChecklist(u); localStorage.setItem("mistake_checklist", JSON.stringify(u)); }

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
        user_id: user.id, trade_id: tradeId, date: trade?.date ?? "",
        notes: review.notes || null, what_to_improve: review.what_to_improve || null,
        categories: review.categories, lesson: review.lesson || null,
        images: review.images, reviewed: review.reviewed,
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
  const filtered = filter === "All" ? losses : filter === "Reviewed" ? losses.filter(t => reviews[t.id]?.reviewed) : losses.filter(t => !reviews[t.id]?.reviewed);

  const catCounts: Record<string, { count: number; trades: Trade[] }> = {};
  for (const [tid, r] of Object.entries(reviews)) {
    const trade = trades.find(t => t.id === tid);
    if (!trade) continue;
    for (const c of r.categories) {
      if (!catCounts[c]) catCounts[c] = { count: 0, trades: [] };
      catCounts[c].count++;
      catCounts[c].trades.push(trade);
    }
  }
  const repeats = Object.entries(catCounts).filter(([, v]) => v.count >= 1).sort((a, b) => b[1].count - a[1].count);

  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const calCells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (calCells.length % 7 !== 0) calCells.push(null);
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);

  function dayHasLoss(d: number) { const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; return losses.some(t => t.date === ds); }
  function dayHasReview(d: number) { const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; return Object.values(reviews).some(r => r.date === ds && r.reviewed); }

  const uncheckedCount = checklist.filter(c => !c.checked).length;
  const allLessons = Object.entries(reviews).map(([tid, r]) => {
    if (!r.lesson) return null;
    const trade = trades.find(t => t.id === tid);
    return { lesson: r.lesson, date: trade?.date ?? r.date ?? "" };
  }).filter(Boolean) as { lesson: string; date: string }[];

  if (loading) return <div style={{ padding: 24, color: "#555" }}>Loading...</div>;

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Mistakes & Lessons</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#555" }}>Review every loss. Build your rulebook.</p>
      </div>

      {/* Reminder banner */}
      {(uncheckedCount > 0 || rules.length > 0) && (
        <div style={{ background: "#c9a84c11", border: "1px solid #c9a84c33", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <Bell size={16} color="#c9a84c" />
          <div style={{ flex: 1 }}>
            {uncheckedCount > 0 && <div style={{ fontSize: 12, color: "#c9a84c", fontWeight: 600 }}>{uncheckedCount} checklist item{uncheckedCount !== 1 ? "s" : ""} unchecked — review before trading</div>}
            {rules.length > 0 && <div style={{ fontSize: 11, color: "#888", marginTop: uncheckedCount > 0 ? 2 : 0 }}>{rules.length} rule{rules.length !== 1 ? "s" : ""} to follow today</div>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {([["rules", "My Rules"], ["review", "Review Losses"], ["calendar", "Calendar"], ["repeats", "Repeat Mistakes"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${tab === key ? "#c9a84c" : "#333"}`, background: tab === key ? "#c9a84c22" : "transparent", color: tab === key ? "#c9a84c" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer", position: "relative" }}>
            {label}
            {key === "rules" && uncheckedCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{uncheckedCount}</span>}
            {key === "review" && losses.filter(t => !reviews[t.id]?.reviewed).length > 0 && <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#f59e0b", color: "#000", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{losses.filter(t => !reviews[t.id]?.reviewed).length}</span>}
          </button>
        ))}
      </div>

      {/* TAB: My Rules (includes checklist as reminders) */}
      {tab === "rules" && (
        <div>
          {/* Pre-trade checklist / reminders */}
          <div style={{ background: "#111", border: "1px solid #c9a84c33", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Bell size={16} color="#c9a84c" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#c9a84c" }}>Pre-Trade Reminders</h3>
              <span style={{ fontSize: 11, color: "#555" }}>Check before every session</span>
            </div>
            {checklist.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, padding: "8px 10px", background: "#0a0a0a", borderRadius: 6 }}>
                <button onClick={() => { const u = [...checklist]; u[i] = { ...u[i], checked: !u[i].checked }; saveChecklist(u); }} style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${item.checked ? "#22c55e" : "#333"}`, background: item.checked ? "#22c55e22" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}>
                  {item.checked && <Check size={14} color="#22c55e" />}
                </button>
                <span style={{ flex: 1, fontSize: 13, color: item.checked ? "#555" : "#ccc", textDecoration: item.checked ? "line-through" : "none" }}>{item.text}</span>
                <button onClick={() => saveChecklist(checklist.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 2 }} onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newCheckItem.trim()) { saveChecklist([...checklist, { text: newCheckItem.trim(), checked: false }]); setNewCheckItem(""); } }} placeholder="Add reminder..." style={{ flex: 1, background: "#0a0a0a", border: "1px solid #222", borderRadius: 6, padding: "8px 12px", color: "#fff", fontSize: 12, outline: "none" }} />
              <button onClick={() => { if (newCheckItem.trim()) { saveChecklist([...checklist, { text: newCheckItem.trim(), checked: false }]); setNewCheckItem(""); } }} disabled={!newCheckItem.trim()} style={{ background: newCheckItem.trim() ? "#c9a84c" : "#333", border: "none", borderRadius: 6, color: newCheckItem.trim() ? "#000" : "#666", fontWeight: 700, fontSize: 12, padding: "8px 14px", cursor: newCheckItem.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 4 }}>
                <Plus size={12} /> Add
              </button>
            </div>
            {checklist.length > 0 && (
              <button onClick={() => saveChecklist(checklist.map(c => ({ ...c, checked: false })))} style={{ marginTop: 12, background: "none", border: "1px solid #222", borderRadius: 6, color: "#555", fontSize: 11, padding: "6px 12px", cursor: "pointer" }}>
                Reset All
              </button>
            )}
          </div>

          {/* Rules */}
          <div style={{ background: "#111", border: "1px solid #22c55e33", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Shield size={16} color="#22c55e" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#22c55e" }}>Rules to Follow</h3>
            </div>
            {rules.map((rule, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", marginBottom: 4, background: "#0a0a0a", borderRadius: 6, borderLeft: "3px solid #22c55e" }}>
                <span style={{ fontSize: 13, color: "#ccc", flex: 1 }}>{i + 1}. {rule}</span>
                <button onClick={() => saveRulesList(rules.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 2, flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input value={newRule} onChange={e => setNewRule(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newRule.trim()) { saveRulesList([...rules, newRule.trim()]); setNewRule(""); } }} placeholder="Add a new rule..." style={{ flex: 1, background: "#0a0a0a", border: "1px solid #222", borderRadius: 6, padding: "8px 12px", color: "#fff", fontSize: 12, outline: "none" }} />
              <button onClick={() => { if (newRule.trim()) { saveRulesList([...rules, newRule.trim()]); setNewRule(""); } }} disabled={!newRule.trim()} style={{ background: newRule.trim() ? "#22c55e" : "#333", border: "none", borderRadius: 6, color: newRule.trim() ? "#000" : "#666", fontWeight: 700, fontSize: 12, padding: "8px 14px", cursor: newRule.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 4 }}>
                <Plus size={12} /> Add Rule
              </button>
            </div>
          </div>

          {/* Reflections from reviews */}
          {allLessons.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Reflections from Reviews ({allLessons.length})</div>
              {allLessons.map((l, i) => (
                <div key={i} style={{ padding: "8px 12px", marginBottom: 4, background: "#0a0a0a", borderRadius: 6, borderLeft: "3px solid #c9a84c" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#888" }}>{l.lesson}</span>
                    <span style={{ fontSize: 10, color: "#444", flexShrink: 0, marginLeft: 12 }}>{l.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Review Losses */}
      {tab === "review" && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {(["All", "Unreviewed", "Reviewed"] as const).map(f => {
              const count = f === "All" ? losses.length : f === "Reviewed" ? losses.filter(t => reviews[t.id]?.reviewed).length : losses.filter(t => !reviews[t.id]?.reviewed).length;
              return (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${filter === f ? "#c9a84c" : "#222"}`, background: filter === f ? "#c9a84c22" : "transparent", color: filter === f ? "#c9a84c" : "#555", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {f} ({count})
                </button>
              );
            })}
          </div>
          {filtered.length === 0 ? (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 40, textAlign: "center" }}>
              <Shield size={32} color="#22c55e" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, color: "#888", fontWeight: 600 }}>{filter === "Unreviewed" ? "All losses reviewed!" : "No losses recorded"}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map(trade => (
                <ReviewCard key={trade.id} trade={trade} review={reviews[trade.id]} categories={categories} editingCats={editingCats} setEditingCats={setEditingCats} newCat={newCat} setNewCat={setNewCat} onAddCat={(cat) => { if (cat.trim() && !categories.includes(cat.trim())) saveCats([...categories, cat.trim()]); setNewCat(""); }} onDeleteCat={(cat) => saveCats(categories.filter(c => c !== cat))} onSave={(r) => saveReview(trade.id, r)} onFiles={(files) => handleFiles(files, trade.id)} onAddUrl={(url) => addImageUrl(trade.id, url)} onViewTrade={() => router.push(`/trades/${trade.id}`)} tradeScreenshots={tradeImages[trade.id] ?? []} />
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB: Calendar */}
      {tab === "calendar" && (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16 }}>&lt;</button>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#ccc" }}>{new Date(calYear, calMonth).toLocaleString("en", { month: "long", year: "numeric" })}</span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16 }}>&gt;</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#444", fontWeight: 600, padding: 4 }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {calCells.map((d, i) => {
              if (!d) return <div key={i} />;
              const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const hasLoss = dayHasLoss(d);
              const hasRev = dayHasReview(d);
              const isSelected = selectedCalDay === ds;
              return (
                <button key={i} onClick={() => hasLoss ? setSelectedCalDay(isSelected ? null : ds) : undefined} style={{ aspectRatio: "1", borderRadius: 6, border: isSelected ? "1px solid #c9a84c" : "1px solid transparent", background: hasLoss ? (hasRev ? "#22c55e22" : "#ef444433") : "transparent", color: hasLoss ? "#fff" : "#444", fontSize: 12, fontWeight: hasLoss ? 700 : 400, cursor: hasLoss ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 10, color: "#555" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#ef444433", marginRight: 4 }} />Unreviewed</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#22c55e22", marginRight: 4 }} />Reviewed</span>
          </div>
          {selectedCalDay && (
            <div style={{ marginTop: 16, borderTop: "1px solid #222", paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ccc", marginBottom: 10 }}>{selectedCalDay}</div>
              {losses.filter(t => t.date === selectedCalDay).map(t => {
                const r = reviews[t.id];
                return (
                  <div key={t.id} onClick={() => router.push(`/trades/${t.id}`)} style={{ padding: "10px 12px", marginBottom: 6, background: "#0a0a0a", borderRadius: 8, borderLeft: `3px solid ${r?.reviewed ? "#22c55e" : "#ef4444"}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#111"} onMouseLeave={e => e.currentTarget.style.background = "#0a0a0a"}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{t.contract}</span>
                      {t.direction && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: t.direction === "Long" ? "#22c55e22" : "#ef444422", color: t.direction === "Long" ? "#22c55e" : "#ef4444" }}>{t.direction}</span>}
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>${t.pnl.toFixed(2)}</span>
                      <ExternalLink size={10} color="#444" />
                      {r?.reviewed && <Check size={12} color="#22c55e" />}
                    </div>
                    {r?.categories && r.categories.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                        {r.categories.map(c => <span key={c} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#ef444422", color: "#ef4444" }}>{c}</span>)}
                      </div>
                    )}
                    {r?.lesson && <div style={{ fontSize: 11, color: "#22c55e", marginTop: 4 }}>{r.lesson}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Repeat Mistakes */}
      {tab === "repeats" && (
        <div>
          {repeats.length === 0 ? (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 15, color: "#888", fontWeight: 600 }}>No categorized mistakes yet</div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>Tag losses in the Review tab</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {repeats.map(([cat, { count, trades: catTrades }]) => (
                <RepeatCard key={cat} category={cat} count={count} trades={catTrades} reviews={reviews} router={router} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RepeatCard({ category, count, trades, reviews, router }: { category: string; count: number; trades: Trade[]; reviews: Record<string, Review>; router: ReturnType<typeof import("next/navigation").useRouter> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {expanded ? <ChevronDown size={14} color="#555" /> : <ChevronRight size={14} color="#555" />}
          <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>{category}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: count >= 3 ? "#ef4444" : count >= 2 ? "#f59e0b" : "#888", background: count >= 3 ? "#ef444422" : count >= 2 ? "#f59e0b22" : "#222", padding: "3px 10px", borderRadius: 20 }}>{count}x</span>
      </div>
      {expanded && (
        <div style={{ padding: "0 16px 16px" }}>
          {trades.sort((a, b) => b.date.localeCompare(a.date)).map(t => {
            const r = reviews[t.id];
            return (
              <div key={t.id} onClick={() => router.push(`/trades/${t.id}`)} style={{ padding: "8px 10px", marginBottom: 4, background: "#0a0a0a", borderRadius: 6, borderLeft: "3px solid #ef4444", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#111"} onMouseLeave={e => e.currentTarget.style.background = "#0a0a0a"}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#555" }}>{t.date}</span>
                  <span style={{ fontWeight: 700, color: "#fff", fontSize: 12 }}>{t.contract}</span>
                  {t.direction && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: t.direction === "Long" ? "#22c55e22" : "#ef444422", color: t.direction === "Long" ? "#22c55e" : "#ef4444" }}>{t.direction}</span>}
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>${t.pnl.toFixed(2)}</span>
                  <ExternalLink size={10} color="#444" />
                </div>
                {r?.notes && <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{r.notes}</div>}
                {r?.lesson && <div style={{ fontSize: 11, color: "#22c55e", marginTop: 2 }}>{r.lesson}</div>}
              </div>
            );
          })}
          <div style={{ marginTop: 8, fontSize: 11, color: "#555" }}>
            Total lost: <span style={{ color: "#ef4444", fontWeight: 700 }}>${trades.reduce((s, t) => s + t.pnl, 0).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
      <img src={url} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }} />
    </div>
  );
}

function ReviewCard({ trade, review, categories, editingCats, setEditingCats, newCat, setNewCat, onAddCat, onDeleteCat, onSave, onFiles, onAddUrl, onViewTrade, tradeScreenshots }: {
  trade: Trade; review?: Review; categories: string[]; editingCats: boolean; setEditingCats: (v: boolean) => void; newCat: string; setNewCat: (v: string) => void; onAddCat: (cat: string) => void; onDeleteCat: (cat: string) => void; onSave: (r: Review) => void; onFiles: (files: FileList | null) => void; onAddUrl: (url: string) => void; onViewTrade: () => void; tradeScreenshots: string[];
}) {
  const [expanded, setExpanded] = useState(!review?.reviewed);
  const [imgUrl, setImgUrl] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const r: Review = review ?? { trade_id: trade.id, notes: "", what_to_improve: "", categories: [], lesson: "", images: [], reviewed: false };

  function update(fields: Partial<Review>) { onSave({ ...r, ...fields }); }
  function toggleCat(cat: string) { update({ categories: r.categories.includes(cat) ? r.categories.filter(c => c !== cat) : [...r.categories, cat] }); }
  function removeImage(idx: number) { update({ images: r.images.filter((_, i) => i !== idx) }); }

  return (
    <>
    {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    <div style={{ background: "#111", border: `1px solid ${r.reviewed ? "#22c55e33" : "#222"}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#0a0a0a" }}>
        <div onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: "pointer", flex: 1 }}>
          <span style={{ fontSize: 12, color: "#555" }}>{trade.date}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{trade.contract}</span>
          {trade.direction && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: trade.direction === "Long" ? "#22c55e22" : "#ef444422", color: trade.direction === "Long" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{trade.direction}</span>}
          <span style={{ fontSize: 12, color: "#888" }}>{trade.contracts}ct</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>${trade.pnl.toFixed(2)}</span>
          {trade.session && <span style={{ fontSize: 11, color: "#444" }}>{trade.session}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={onViewTrade} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = "#c9a84c"} onMouseLeave={e => e.currentTarget.style.color = "#444"} title="View Trade">
            <ExternalLink size={13} />
          </button>
          {r.reviewed && <Check size={14} color="#22c55e" />}
          <div onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer", padding: 4 }}>
            {expanded ? <ChevronDown size={14} color="#555" /> : <ChevronRight size={14} color="#555" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "12px 16px 16px" }}>
          {/* Trade screenshots from original trade */}
          {tradeScreenshots.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Trade Screenshots</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tradeScreenshots.map((url, i) => (
                  <img key={i} src={url} alt="" onClick={() => setLightboxUrl(url)} style={{ width: 140, height: 90, objectFit: "cover", borderRadius: 6, border: "1px solid #222", cursor: "zoom-in" }} />
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Mistake Category</span>
              <button onClick={() => setEditingCats(!editingCats)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 10 }}>{editingCats ? "Done" : "Edit"}</button>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {categories.map(cat => (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <button onClick={() => toggleCat(cat)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${r.categories.includes(cat) ? "#ef4444" : "#222"}`, background: r.categories.includes(cat) ? "#ef444422" : "transparent", color: r.categories.includes(cat) ? "#ef4444" : "#555", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{cat}</button>
                  {editingCats && <button onClick={() => onDeleteCat(cat)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#333"}><X size={10} /></button>}
                </div>
              ))}
              {editingCats && (
                <div style={{ display: "flex", gap: 2 }}>
                  <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && onAddCat(newCat)} placeholder="New..." style={{ width: 80, background: "#0a0a0a", border: "1px solid #222", borderRadius: 4, padding: "3px 6px", color: "#fff", fontSize: 10, outline: "none" }} />
                  <button onClick={() => onAddCat(newCat)} style={{ background: "#c9a84c", border: "none", borderRadius: 4, color: "#000", fontSize: 9, fontWeight: 700, padding: "3px 6px", cursor: "pointer" }}>+</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>What went wrong?</div>
            <textarea value={r.notes} onChange={e => update({ notes: e.target.value })} placeholder="Describe what happened..." rows={2} style={{ width: "100%", background: "#0a0a0a", border: "1px solid #222", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>What should I have done?</div>
            <textarea value={r.what_to_improve} onChange={e => update({ what_to_improve: e.target.value })} placeholder="How would I handle this differently..." rows={2} style={{ width: "100%", background: "#0a0a0a", border: "1px solid #222", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Reflection</div>
            <input value={r.lesson} onChange={e => update({ lesson: e.target.value })} placeholder="What did I learn from this trade..." style={{ width: "100%", background: "#0a0a0a", border: "1px solid #222", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Camera size={12} color="#555" />
              <span style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase" }}>Screenshots</span>
            </div>
            {r.images.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {r.images.map((url, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={url} alt="" style={{ width: 100, height: 70, objectFit: "cover", borderRadius: 6, border: "1px solid #222" }} />
                    <button onClick={() => removeImage(i)} style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><X size={8} /></button>
                  </div>
                ))}
              </div>
            )}
            <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files); }} onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.multiple = true; input.onchange = () => onFiles(input.files); input.click(); }} style={{ border: "1px dashed #333", borderRadius: 6, padding: "10px", textAlign: "center", cursor: "pointer", fontSize: 11, color: "#444", marginBottom: 6 }}>
              Drop screenshots or click to upload
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <input value={imgUrl} onChange={e => setImgUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { onAddUrl(imgUrl); setImgUrl(""); } }} placeholder="Or paste image URL..." style={{ flex: 1, background: "#0a0a0a", border: "1px solid #222", borderRadius: 4, padding: "5px 8px", color: "#fff", fontSize: 11, outline: "none" }} />
              <button onClick={() => { onAddUrl(imgUrl); setImgUrl(""); }} disabled={!imgUrl.trim()} style={{ background: imgUrl.trim() ? "#c9a84c" : "#333", border: "none", borderRadius: 4, color: imgUrl.trim() ? "#000" : "#666", fontWeight: 700, fontSize: 10, padding: "5px 10px", cursor: imgUrl.trim() ? "pointer" : "not-allowed" }}>Add</button>
            </div>
          </div>

          <button onClick={() => update({ reviewed: !r.reviewed })} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, color: r.reviewed ? "#22c55e" : "#555", fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${r.reviewed ? "#22c55e" : "#333"}`, background: r.reviewed ? "#22c55e22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{r.reviewed && <Check size={12} />}</span>
            Reviewed
          </button>
        </div>
      )}
    </div>
    </>
  );
}
