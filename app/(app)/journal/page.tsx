"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { JournalEntry } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle,
  Loader2,
  ImageIcon,
  X,
  Edit2,
  Trash2,
  Camera,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth,
  isToday,
} from "date-fns";

const MOODS = ["😞", "😐", "😊", "😄", "🔥"];

export default function JournalPage() {
  const [userId, setUserId] = useState("");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; });
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("edit");
  const [mood, setMood] = useState(3);
  const [narrative, setNarrative] = useState("");
  const [explanation, setExplanation] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const [showPhotoPanel, setShowPhotoPanel] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        const { data } = await supabase
          .from("journal_entries")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false });
        if (data) setEntries(data);
      } catch (err) {
        console.error("Failed to load journal:", err);
      }
    }
    init();
  }, []);

  // Load entry for selected date
  useEffect(() => {
    const entry = entries.find((e) => e.date === selectedDate && e.type === "daily") ?? null;
    setCurrentEntry(entry);
    const c = entry?.content as Record<string, unknown> | null;
    setNarrative((c?.narrative as string) ?? "");
    setExplanation((c?.explanation as string) ?? "");
    const paths = (c?.images as string[]) ?? [];
    setImages(paths);
    setMood(entry?.mood ?? 3);
    // Switch to view mode if entry exists, edit if new
    setMode(entry ? "view" : "edit");
    // Generate signed URLs
    if (paths.length > 0) {
      const supabase = createClient();
      Promise.all(
        paths.map((p) => supabase.storage.from("journal-images").createSignedUrl(p, 3600))
      ).then((results) => {
        setImageUrls(results.map((r) => r.data?.signedUrl ?? "").filter(Boolean));
      });
    } else {
      setImageUrls([]);
    }
  }, [selectedDate, entries]);

  const save = useCallback(
    async (fields: { narrative?: string; explanation?: string; images?: string[]; mood?: number }) => {
      if (!userId) return;
      setSaveStatus("saving");
      try {
        const supabase = createClient();
        const content = {
          narrative: fields.narrative ?? narrative,
          explanation: fields.explanation ?? explanation,
          images: fields.images ?? images,
        };
        const payload = {
          user_id: userId,
          date: selectedDate,
          type: "daily" as const,
          content,
          mood: fields.mood ?? mood,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from("journal_entries")
          .upsert(payload, { onConflict: "user_id,date,type" })
          .select()
          .single();
        if (!error && data) {
          setEntries((prev) => {
            const idx = prev.findIndex((e) => e.id === data.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = data; return next; }
            return [data, ...prev];
          });
          setCurrentEntry(data);
        }
        setSaveStatus("saved");
        setMode("view");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Save failed:", err);
        setSaveStatus("idle");
      }
    },
    [userId, selectedDate, narrative, explanation, images, mood]
  );

  async function deleteEntry() {
    if (!currentEntry) return;
    if (!confirm("Delete this journal entry? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("journal_entries").delete().eq("id", currentEntry.id);
    setEntries((prev) => prev.filter((e) => e.id !== currentEntry.id));
    setCurrentEntry(null);
    setNarrative("");
    setExplanation("");
    setImages([]);
    setImageUrls([]);
    setMood(3);
    setMode("edit");
  }

  function scheduleSave(fields: { narrative?: string; explanation?: string; images?: string[]; mood?: number }) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => save(fields), 1500);
  }

  async function uploadImage(file: File) {
    if (!userId) return;
    setUploading(true);
    setUploadError("");
    const supabase = createClient();
    const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("journal-images").upload(path, file);
    if (error) {
      setUploadError("Image upload failed. Make sure the journal-images storage bucket exists in Supabase.");
      setUploading(false);
      return;
    }
    const nextPaths = [...images, path];
    const { data: signed } = await supabase.storage.from("journal-images").createSignedUrl(path, 3600);
    setImages(nextPaths);
    if (signed?.signedUrl) setImageUrls((prev) => [...prev, signed.signedUrl]);
    setUploading(false);
    await save({ images: nextPaths });
  }

  // Paste handler for photo panel (overrides mode restriction)
  useEffect(() => {
    if (!showPhotoPanel) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) uploadImage(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPhotoPanel, userId, images]);

  // Paste handler (only in edit mode)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (mode !== "edit" || showPhotoPanel) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) uploadImage(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, images, mode]);

  // Calendar helpers
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);
  const entryDates = new Set(entries.map((e) => e.date));

  const displayDate = (() => {
    try { return format(new Date(selectedDate + "T12:00:00"), "EEEE, MMMM d, yyyy"); }
    catch { return selectedDate; }
  })();

  return (
    <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
      {/* Left: Calendar */}
      <div style={{ width: 280, background: "#111", borderRight: "1px solid #222", display: "flex", flexDirection: "column", padding: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 4 }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{format(viewMonth, "MMMM yyyy")}</span>
          <button onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 4 }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} style={{ fontSize: 10, color: "#444", textAlign: "center", padding: "2px 0" }}>{d}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {Array.from({ length: startDow }).map((_, i) => <div key={`e-${i}`} />)}
          {days.map((day) => {
            const iso = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`;
            const hasEntry = entryDates.has(iso);
            const isSelected = iso === selectedDate;
            const todayDay = isToday(day);
            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                style={{
                  background: isSelected ? "#c9a84c" : todayDay ? "#1a1a1a" : "none",
                  border: todayDay && !isSelected ? "1px solid #333" : "1px solid transparent",
                  borderRadius: 6,
                  color: isSelected ? "#000" : isSameMonth(day, viewMonth) ? "#ccc" : "#333",
                  fontSize: 12,
                  padding: "5px 2px",
                  cursor: "pointer",
                  fontWeight: isSelected ? 700 : 400,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                {day.getDate()}
                {hasEntry && <div style={{ width: 4, height: 4, borderRadius: "50%", background: isSelected ? "#000" : "#c9a84c", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => { const d = new Date(); setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); setMode("edit"); }}
          style={{ marginTop: 16, width: "100%", background: "#c9a84c", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, padding: "9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <Plus size={14} /> New Entry
        </button>
      </div>

      {/* Right: View or Edit */}
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{displayDate}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {saveStatus === "saving" && <span style={{ fontSize: 12, color: "#555", display: "flex", alignItems: "center", gap: 4 }}><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving...</span>}
              {saveStatus === "saved" && <span style={{ fontSize: 12, color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={13} /> Saved</span>}
              {mode === "view" && currentEntry && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setMode("edit")}
                    style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#c9a84c", fontSize: 12, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    onClick={deleteEntry}
                    style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#ef4444", fontSize: 12, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* VIEW MODE */}
          {mode === "view" && currentEntry ? (
            <div>
              {/* Mood */}
              <div style={{ marginBottom: 24, fontSize: 28 }}>
                {MOODS[(mood ?? 3) - 1]}
              </div>

              {/* Narrative */}
              {narrative && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Narrative</div>
                  <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, padding: "14px 16px", color: "#ccc", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {narrative}
                  </div>
                </div>
              )}

              {/* Explanation */}
              {explanation && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Explanation / Review</div>
                  <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, padding: "14px 16px", color: "#ccc", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {explanation}
                  </div>
                </div>
              )}

              {/* Photos */}
              {imageUrls.filter(Boolean).length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Photos</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                    {imageUrls.filter(Boolean).map((url, i) => (
                      <div
                        key={i}
                        onClick={() => setLightbox(url)}
                        style={{ borderRadius: 10, overflow: "hidden", background: "#1a1a1a", cursor: "zoom-in", border: "1px solid #222" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!narrative && !explanation && imageUrls.filter(Boolean).length === 0 && (
                <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
                  Nothing written yet. Click Edit to add your notes.
                </div>
              )}
            </div>
          ) : (
            /* EDIT MODE */
            <div>
              {/* Date picker */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ background: "#111", border: "1px solid #222", borderRadius: 6, padding: "5px 10px", color: "#666", fontSize: 12, outline: "none", cursor: "pointer", marginBottom: 20 }}
              />

              {/* Mood */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>Mood</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {MOODS.map((emoji, i) => (
                    <button
                      key={i}
                      onClick={() => { setMood(i + 1); }}
                      style={{ fontSize: 24, background: mood === i + 1 ? "#c9a84c22" : "transparent", border: `1px solid ${mood === i + 1 ? "#c9a84c" : "#222"}`, borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Narrative */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>Narrative</div>
                <textarea
                  value={narrative}
                  onChange={(e) => { setNarrative(e.target.value); }}
                  placeholder="Write your trade narrative, market bias, key levels, planned setups..."
                  rows={6}
                  style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
                />
              </div>

              {/* Explanation */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>Explanation / Review</div>
                <textarea
                  value={explanation}
                  onChange={(e) => { setExplanation(e.target.value); }}
                  placeholder="Post-session review — what went well, what went wrong, lessons learned..."
                  rows={6}
                  style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
                />
              </div>

              {/* Photos */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "#555" }}>Photos <span style={{ color: "#333" }}>(paste or click to upload)</span></div>
                  <button
                    type="button"
                    onClick={() => setShowPhotoPanel(true)}
                    style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 7, color: "#c9a84c", fontSize: 12, fontWeight: 600, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <Camera size={12} /> Photos
                  </button>
                </div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    for (const f of Array.from(e.dataTransfer.files)) {
                      if (f.type.startsWith("image/")) await uploadImage(f);
                    }
                  }}
                  style={{ background: "#111", border: "2px dashed #333", borderRadius: 10, padding: "18px 24px", color: "#555", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, width: "100%", justifyContent: "center", marginBottom: 8, boxSizing: "border-box" }}
                >
                  <ImageIcon size={16} />
                  {uploading ? "Uploading..." : "Drop, paste or click to add screenshots"}
                </div>
                {uploadError && (
                  <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>{uploadError}</div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    for (const f of files) await uploadImage(f);
                    e.target.value = "";
                  }}
                />
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <input
                    type="text"
                    value={pasteUrl}
                    onChange={(e) => setPasteUrl(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && pasteUrl.trim()) {
                        const url = pasteUrl.trim();
                        const nextPaths = [...images, url];
                        setImages(nextPaths);
                        setImageUrls((prev) => [...prev, url]);
                        setPasteUrl("");
                      }
                    }}
                    placeholder="Or paste image URL..."
                    style={{ flex: 1, background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = pasteUrl.trim();
                      if (!url) return;
                      const nextPaths = [...images, url];
                      setImages(nextPaths);
                      setImageUrls((prev) => [...prev, url]);
                      setPasteUrl("");
                      scheduleSave({ images: nextPaths });
                    }}
                    style={{ padding: "9px 16px", background: "#222", border: "1px solid #333", borderRadius: 8, color: "#ccc", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Add
                  </button>
                </div>
                {imageUrls.filter(Boolean).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {imageUrls.map((url, i) => url ? (
                      <div key={i} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #222" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          onClick={() => setLightbox(url)}
                          style={{ width: "100%", display: "block", cursor: "zoom-in" }}
                        />
                        <button
                          onClick={() => {
                            const nextPaths = images.filter((_, idx) => idx !== i);
                            const nextUrls = imageUrls.filter((_, idx) => idx !== i);
                            setImages(nextPaths);
                            setImageUrls(nextUrls);
                              }}
                          style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 6, padding: "5px 7px", display: "flex", alignItems: "center", cursor: "pointer", color: "#ef4444" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>

              {/* Save */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #1a1a1a", display: "flex", gap: 10 }}>
                <button
                  onClick={() => save({ narrative, explanation, images, mood })}
                  disabled={saveStatus === "saving" || uploading}
                  style={{ background: "#c9a84c", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 14, padding: "11px 32px", cursor: saveStatus === "saving" ? "not-allowed" : "pointer", opacity: saveStatus === "saving" ? 0.7 : 1 }}
                >
                  {saveStatus === "saving" ? "Saving..." : "Save Entry"}
                </button>
                {currentEntry && (
                  <button
                    onClick={() => setMode("view")}
                    style={{ background: "none", border: "1px solid #333", borderRadius: 8, color: "#888", fontSize: 13, padding: "11px 20px", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}
        >
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 20, background: "#222", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
            <X size={16} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }} />
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Photo paste panel */}
      {showPhotoPanel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={() => setShowPhotoPanel(false)} />
          <div style={{ width: 360, height: "100vh", background: "#111", borderLeft: "1px solid #222", overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Add Screenshots</div>
              <button onClick={() => setShowPhotoPanel(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                for (const f of Array.from(e.dataTransfer.files)) {
                  if (f.type.startsWith("image/")) await uploadImage(f);
                }
              }}
              style={{ border: "2px dashed #333", borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#c9a84c55")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#333")}
            >
              <Camera size={28} color="#555" />
              <div style={{ fontSize: 14, color: "#888", fontWeight: 600 }}>Paste screenshot here</div>
              <div style={{ fontSize: 12, color: "#444" }}>Ctrl+V · drag & drop · or click to browse</div>
            </div>

            {imageUrls.filter(Boolean).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {imageUrls.map((url, i) => url ? (
                  <div key={i} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #222" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" onClick={() => setLightbox(url)} style={{ width: "100%", display: "block", cursor: "zoom-in" }} />
                    <button
                      onClick={() => {
                        const nextPaths = images.filter((_, idx) => idx !== i);
                        const nextUrls = imageUrls.filter((_, idx) => idx !== i);
                        setImages(nextPaths);
                        setImageUrls(nextUrls);
                      }}
                      style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 6, color: "#ef4444", cursor: "pointer", padding: "5px 7px", display: "flex", alignItems: "center" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
