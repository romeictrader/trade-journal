"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trade, Account, FUTURES } from "@/lib/types";
import { ChevronDown, ChevronUp, Camera, X as XIcon } from "lucide-react";
import MultiTagInput from "./MultiTagInput";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid #222",
  borderRadius: 8,
  padding: "9px 12px",
  color: "#fff",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#0a0a0a",
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#161616",
          border: "1px solid #222",
          borderRadius: 8,
          padding: "10px 14px",
          color: "#ccc",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: open ? 12 : 0,
        }}
      >
        {title}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  colorMap,
}: {
  options: T[];
  value: T | undefined;
  onChange: (v: T) => void;
  colorMap?: Record<string, string>;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const color = colorMap?.[opt] ?? "#c9a84c";
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              flex: 1,
              minWidth: 60,
              padding: "7px 10px",
              borderRadius: 8,
              border: `1px solid ${active ? color : "#333"}`,
              background: active ? color + "22" : "transparent",
              color: active ? color : "#888",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

interface TradeFormProps {
  accountId?: string;
  onSave: () => void;
  onCancel: () => void;
  initialTrade?: Partial<Trade>;
}

const CONTRACTS_LIST = ["ES", "MES", "NQ", "MNQ", "YM", "MYM", "CL", "GC", "SI", "NG", "RTY", "M2K", "6E", "6J"];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function calcDay(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T12:00:00");
    return DAY_NAMES[d.getDay()];
  } catch {
    return "";
  }
}

interface UploadedImage {
  url: string;
  storagePath?: string;
  file?: File;
}

export default function TradeForm({ accountId, onSave, onCancel, initialTrade }: TradeFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");

  // Trade Details
  const [contract, setContract] = useState(initialTrade?.contract ?? "ES");
  const [selectedAccount, setSelectedAccount] = useState(initialTrade?.account_id ?? accountId ?? "");
  const [date, setDate] = useState(initialTrade?.date ?? new Date().toISOString().split("T")[0]);
  const [executionTime, setExecutionTime] = useState(initialTrade?.execution_time ?? "");
  const [direction, setDirection] = useState<"Long" | "Short">(initialTrade?.direction ?? "Long");
  const [outcome, setOutcome] = useState<string>(initialTrade?.outcome ?? "");
  const [manualPnl, setManualPnl] = useState(initialTrade?.pnl ? String(initialTrade.pnl) : "");
  const [contractsQty, setContractsQty] = useState(initialTrade?.contracts ? String(initialTrade.contracts) : "1");
  const [rr, setRr] = useState(initialTrade?.rr ? String(initialTrade.rr) : "");
  const [tpSize, setTpSize] = useState(initialTrade?.tp_size ? String(initialTrade.tp_size) : "");
  const [slSize, setSlSize] = useState(initialTrade?.sl_size ? String(initialTrade.sl_size) : "");

  // Session & Context
  const [session, setSession] = useState(initialTrade?.session ?? "");
  const [dayProb, setDayProb] = useState(initialTrade?.day_probability ?? "");
  const [news, setNews] = useState(initialTrade?.news ?? "");

  // Psychology
  const [emotions, setEmotions] = useState(initialTrade?.emotions ?? "");
  const [rulesBroken, setRulesBroken] = useState(initialTrade?.rules_broken ?? "");
  const [checklist, setChecklist] = useState(initialTrade?.checklist ?? false);
  const [emotionsPsych, setEmotionsPsych] = useState(initialTrade?.emotions_psych ?? "");

  // Analysis
  const [pda, setPda] = useState(initialTrade?.pda ?? "");
  const [manipulation, setManipulation] = useState(initialTrade?.manipulation ?? "");
  const [execution, setExecution] = useState(initialTrade?.execution ?? "");
  const [context, setContext] = useState(initialTrade?.context ?? "");
  const [narrative, setNarrative] = useState(initialTrade?.narrative ?? "");
  const [explanation, setExplanation] = useState(initialTrade?.explanation ?? "");

  // Images
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [existingImages, setExistingImages] = useState<{ id: string; url: string; storage_path: string | null }[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showPhotoPanel, setShowPhotoPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("accounts").select("*").eq("user_id", user.id).order("created_at");
      if (data) setAccounts(data);

      // Load existing images when editing
      if (initialTrade?.id) {
        const { data: imgs } = await supabase
          .from("trade_images")
          .select("id, storage_path, url")
          .eq("trade_id", initialTrade.id);
        if (imgs && imgs.length > 0) {
          const loaded = await Promise.all(
            imgs.map(async (img: { id: string; storage_path: string | null; url: string | null }) => {
              let url = img.url ?? "";
              if (img.storage_path) {
                const { data: s } = await supabase.storage.from("journal-images").createSignedUrl(img.storage_path, 3600);
                url = s?.signedUrl ?? img.url ?? "";
              }
              return { id: img.id, url, storage_path: img.storage_path };
            })
          );
          setExistingImages(loaded.filter((i) => i.url));
        }
      }
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pnlValue = manualPnl ? parseFloat(manualPnl) : null;
  const day = calcDay(date);

  async function uploadFile(file: File, tradeId?: string): Promise<UploadedImage | null> {
    if (!userId) return null;
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "png";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${userId}/trades/${tradeId ?? "new"}/${fileName}`;
    const { error: uploadErr } = await supabase.storage
      .from("journal-images")
      .upload(storagePath, file, { upsert: true });
    if (uploadErr) return null;
    const { data: urlData } = await supabase.storage.from("journal-images").createSignedUrl(storagePath, 3600);
    if (!urlData?.signedUrl) return null;
    return { url: urlData.signedUrl, storagePath, file };
  }

  async function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const result = await uploadFile(file);
      if (result) setImages((prev) => [...prev, result]);
    }
    setUploading(false);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) handleFileSelect([file] as unknown as FileList);
      }
    }
  }

  function addImageUrl() {
    const url = imageUrl.trim();
    if (!url) return;
    setImages((prev) => [...prev, { url }]);
    setImageUrl("");
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  // Global paste listener when photo panel is open
  useEffect(() => {
    if (!showPhotoPanel) return;
    function onPaste(e: ClipboardEvent) {
      for (let i = 0; i < (e.clipboardData?.items.length ?? 0); i++) {
        if (e.clipboardData!.items[i].type.startsWith("image/")) {
          const file = e.clipboardData!.items[i].getAsFile();
          if (file) handleFileSelect([file] as unknown as FileList);
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPhotoPanel]);

  async function saveTradeImages(tradeId: string) {
    if (images.length === 0) return;
    const supabase = createClient();
    for (const img of images) {
      await supabase.from("trade_images").insert({
        user_id: userId,
        trade_id: tradeId,
        storage_path: img.storagePath ?? null,
        url: img.url,
      });
    }
    // Also update image_urls array on the trade
    const urls = images.map((i) => i.url);
    await supabase.from("trades").update({ image_urls: urls }).eq("id", tradeId);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setSaving(false); return; }

    const pnl = pnlValue ?? 0;
    const payload: Record<string, unknown> = {
      user_id: user.id,
      date,
      day,
      contract,
      direction,
      entry_price: 0,
      exit_price: 0,
      contracts: parseInt(contractsQty || "1"),
      pnl,
      account_id: selectedAccount || null,
      execution_time: executionTime || null,
      outcome: outcome || null,
      session: session || null,
      news: news || null,
      day_probability: dayProb || null,
      emotions: emotions || null,
      rules_broken: rulesBroken || null,
      rr: rr ? parseFloat(rr) : null,
      tp_size: tpSize ? parseFloat(tpSize) : null,
      sl_size: slSize ? parseFloat(slSize) : null,
      narrative: narrative || null,
      context: context || null,
      execution: execution || null,
      checklist,
      pda: pda || null,
      manipulation: manipulation || null,
      explanation: explanation || null,
      emotions_psych: emotionsPsych || null,
    };

    let err;
    if (initialTrade?.id) {
      ({ error: err } = await supabase.from("trades").update(payload).eq("id", initialTrade.id));
      if (!err && images.length > 0) await saveTradeImages(initialTrade.id);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("trades")
        .insert(payload)
        .select("id")
        .single();
      err = insertErr;
      if (!err && inserted?.id && images.length > 0) {
        await saveTradeImages(inserted.id);
      }
    }

    if (err) {
      setError(err.message);
      setSaving(false);
    } else {
      onSave();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Section 1 — Trade Details */}
      <div>
        <div
          style={{
            background: "#161616",
            border: "1px solid #222",
            borderRadius: 8,
            padding: "10px 14px",
            color: "#ccc",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          Trade Details
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldRow label="Pair / Contract">
            <input
              list="contracts-datalist"
              value={contract}
              onChange={(e) => setContract(e.target.value.toUpperCase())}
              style={inputStyle}
              placeholder="ES, NQ, MES..."
            />
            <datalist id="contracts-datalist">
              {CONTRACTS_LIST.map((c) => <option key={c} value={c} />)}
            </datalist>
          </FieldRow>

          <FieldRow label="Account">
            <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} style={selectStyle}>
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.prop_firm} — {a.account_name}</option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </FieldRow>

          <FieldRow label="Execution Time">
            <input
              type="time"
              value={executionTime}
              onChange={(e) => setExecutionTime(e.target.value)}
              style={{
                ...inputStyle,
                colorScheme: "dark",
                color: "#fff",
                backgroundColor: "#1a1a1a",
                border: "1px solid #333",
              }}
            />
          </FieldRow>

          <div style={{ gridColumn: "1 / -1" }}>
            <FieldRow label="Direction">
              <ToggleGroup
                options={["Long", "Short"]}
                value={direction}
                onChange={(v) => setDirection(v as "Long" | "Short")}
                colorMap={{ Long: "#22c55e", Short: "#ef4444" }}
              />
            </FieldRow>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <FieldRow label="Outcome">
              <ToggleGroup
                options={["Win", "Loss", "Breakeven"]}
                value={outcome}
                onChange={setOutcome}
                colorMap={{ Win: "#22c55e", Loss: "#ef4444", Breakeven: "#f59e0b" }}
              />
            </FieldRow>
          </div>

          <FieldRow label="P&L ($)">
            <input
              type="number"
              step="0.01"
              value={manualPnl}
              onChange={(e) => setManualPnl(e.target.value)}
              style={{
                ...inputStyle,
                fontWeight: 700,
                color: pnlValue === null ? "#fff" : pnlValue >= 0 ? "#22c55e" : "#ef4444",
                background: pnlValue === null ? "#0a0a0a" : pnlValue >= 0 ? "#22c55e11" : "#ef444411",
                border: `1px solid ${pnlValue === null ? "#222" : pnlValue >= 0 ? "#22c55e44" : "#ef444444"}`,
              }}
              placeholder="e.g. 250 or -125"
            />
          </FieldRow>

          <FieldRow label="Contracts (Qty)">
            <input type="number" min="1" value={contractsQty} onChange={(e) => setContractsQty(e.target.value)} style={inputStyle} />
          </FieldRow>

          <FieldRow label="RR Achieved">
            <input type="number" step="0.01" value={rr} onChange={(e) => setRr(e.target.value)} style={inputStyle} placeholder="2.5" />
          </FieldRow>

          <FieldRow label="TP Size (ticks)">
            <input type="number" step="1" value={tpSize} onChange={(e) => setTpSize(e.target.value)} style={inputStyle} placeholder="8" />
          </FieldRow>

          <FieldRow label="SL Size (ticks)">
            <input type="number" step="1" value={slSize} onChange={(e) => setSlSize(e.target.value)} style={inputStyle} placeholder="4" />
          </FieldRow>
        </div>
      </div>

      {/* Section 2 — Session & Context */}
      <Section title="Session & Context" defaultOpen>
        <FieldRow label="Day (auto)">
          <div style={{ ...inputStyle, color: "#888" }}>{day || "—"}</div>
        </FieldRow>
        <FieldRow label="Session">
          <MultiTagInput
            fieldName="session"
            value={session}
            onChange={setSession}
            placeholder="London, New York..."
            seedOptions={["London", "New York", "Asian", "London-NY Overlap", "Pre-Market"]}
            userId={userId}
          />
        </FieldRow>
        <FieldRow label="Day Probability">
          <MultiTagInput
            fieldName="day_probability"
            value={dayProb}
            onChange={setDayProb}
            placeholder="High, Medium, Low"
            seedOptions={["High", "Medium", "Low"]}
            userId={userId}
          />
        </FieldRow>
        <FieldRow label="News Event">
          <MultiTagInput
            fieldName="news"
            value={news}
            onChange={setNews}
            placeholder="CPI, FOMC, None..."
            seedOptions={["None", "CPI", "FOMC", "NFP", "PMI", "GDP", "PPI", "Earnings"]}
            userId={userId}
          />
        </FieldRow>
      </Section>

      {/* Section 3 — Psychology */}
      <Section title="Psychology" defaultOpen={false}>
        <FieldRow label="Emotions (Pre-trade)">
          <MultiTagInput
            fieldName="emotions"
            value={emotions}
            onChange={setEmotions}
            placeholder="Calm, Confident..."
            seedOptions={["Calm", "Confident", "Neutral", "Anxious", "FOMO", "Revenge", "Bored", "Tired", "Excited"]}
            userId={userId}
          />
        </FieldRow>
        <FieldRow label="Rules Broken">
          <MultiTagInput
            fieldName="rules_broken"
            value={rulesBroken}
            onChange={setRulesBroken}
            placeholder="None, Overtraded..."
            seedOptions={["None", "Overtraded", "Moved SL", "FOMO Entry", "Sized Too Big", "Early Exit", "Chased Entry", "Broke Daily Loss Rule"]}
            userId={userId}
          />
        </FieldRow>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#ccc", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={checklist}
              onChange={(e) => setChecklist(e.target.checked)}
              style={{ accentColor: "#c9a84c", width: 16, height: 16 }}
            />
            Followed pre-trade checklist
          </label>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldRow label="Emotions / Psych (Post-trade)">
            <MultiTagInput
              fieldName="emotions_psych"
              value={emotionsPsych}
              onChange={setEmotionsPsych}
              placeholder="Disciplined, Regret..."
              seedOptions={["Disciplined", "Regret", "Confident", "Frustrated", "Calm", "Greedy", "Patient"]}
              userId={userId}
            />
          </FieldRow>
        </div>
      </Section>

      {/* Section 4 — Analysis */}
      <Section title="Analysis" defaultOpen={false}>
        <FieldRow label="PDA (ICT)">
          <MultiTagInput
            fieldName="pda"
            value={pda}
            onChange={setPda}
            placeholder="Order Block, FVG..."
            seedOptions={["None", "Order Block", "FVG", "CISD", "Breaker", "Mitigation", "Optimal Trade Entry", "Liquidity Sweep", "Displacement", "IFVG"]}
            userId={userId}
          />
        </FieldRow>
        <FieldRow label="Manipulation">
          <MultiTagInput
            fieldName="manipulation"
            value={manipulation}
            onChange={setManipulation}
            placeholder="None, Buy Side..."
            seedOptions={["None", "Buy Side", "Sell Side", "Both", "Unclear"]}
            userId={userId}
          />
        </FieldRow>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldRow label="Execution Grade">
            <ToggleGroup
              options={["A", "B", "C", "D"]}
              value={execution}
              onChange={setExecution}
              colorMap={{ A: "#22c55e", B: "#c9a84c", C: "#f59e0b", D: "#ef4444" }}
            />
          </FieldRow>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldRow label="Market Context">
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Describe the market context..."
            />
          </FieldRow>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldRow label="Post-trade Explanation">
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="What happened? What did you learn?"
            />
          </FieldRow>
        </div>

        {/* Image Upload */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Trade Screenshots
            </label>
            <button
              type="button"
              onClick={() => setShowPhotoPanel(true)}
              style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 7, color: "#c9a84c", fontSize: 12, fontWeight: 600, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            >
              <Camera size={12} /> Photos
            </button>
          </div>

          {/* Drop zone */}
          <div
            ref={dropZoneRef}
            onPaste={handlePaste}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileSelect(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            tabIndex={0}
            style={{
              border: "2px dashed #333",
              borderRadius: 8,
              background: "#111",
              padding: "20px",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 10,
              color: "#555",
              fontSize: 13,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Camera size={22} color="#555" />
            <span>Drop screenshots here or click to upload</span>
            {uploading && <span style={{ color: "#c9a84c", fontSize: 12 }}>Uploading...</span>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFileSelect(e.target.files)}
          />

          {/* URL input */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addImageUrl()}
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Or paste image URL..."
            />
            <button
              type="button"
              onClick={addImageUrl}
              style={{
                padding: "9px 14px",
                background: "#222",
                border: "1px solid #333",
                borderRadius: 8,
                color: "#ccc",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Add
            </button>
          </div>

          {/* Existing + new thumbnails */}
          {(existingImages.length > 0 || images.length > 0) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {existingImages.map((img) => (
                <div key={img.id} style={{ position: "relative", width: 80, height: 80 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #333" }} />
                  <button
                    type="button"
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.from("trade_images").delete().eq("id", img.id);
                      if (img.storage_path) await supabase.storage.from("journal-images").remove([img.storage_path]);
                      setExistingImages((prev) => prev.filter((i) => i.id !== img.id));
                    }}
                    style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  >
                    <XIcon size={10} />
                  </button>
                </div>
              ))}
              {images.map((img, i) => (
                <div key={`new-${i}`} style={{ position: "relative", width: 80, height: 80 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={`new ${i + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #c9a84c44" }} />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  >
                    <XIcon size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            background: saving ? "#555" : "#c9a84c",
            border: "none",
            borderRadius: 8,
            color: "#000",
            fontWeight: 700,
            fontSize: 14,
            padding: "13px",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Trade"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "none",
            border: "1px solid #333",
            borderRadius: 8,
            color: "#888",
            fontSize: 13,
            padding: "13px 20px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>

      {/* Photo paste panel */}
      {showPhotoPanel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={() => setShowPhotoPanel(false)} />
          <div style={{ width: 360, height: "100vh", background: "#111", borderLeft: "1px solid #222", overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Add Screenshots</div>
              <button onClick={() => setShowPhotoPanel(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {/* Paste / drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); }}
              style={{ border: "2px dashed #333", borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#c9a84c55")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#333")}
            >
              <Camera size={28} color="#555" />
              <div style={{ fontSize: 14, color: "#888", fontWeight: 600 }}>Paste screenshot here</div>
              <div style={{ fontSize: 12, color: "#444" }}>Ctrl+V · drag & drop · or click to browse</div>
              {uploading && <div style={{ fontSize: 12, color: "#c9a84c" }}>Uploading...</div>}
            </div>

            {/* All images (existing + newly added) */}
            {(existingImages.length > 0 || images.length > 0) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {existingImages.map((img) => (
                  <div key={img.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #222" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" style={{ width: "100%", display: "block" }} />
                    <button
                      type="button"
                      onClick={async () => {
                        const supabase = createClient();
                        await supabase.from("trade_images").delete().eq("id", img.id);
                        if (img.storage_path) await supabase.storage.from("journal-images").remove([img.storage_path]);
                        setExistingImages((prev) => prev.filter((i) => i.id !== img.id));
                      }}
                      style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 6, color: "#ef4444", cursor: "pointer", padding: "5px 7px", display: "flex", alignItems: "center" }}
                    >
                      <XIcon size={13} />
                    </button>
                  </div>
                ))}
                {images.map((img, i) => (
                  <div key={`new-${i}`} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #c9a84c44" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" style={{ width: "100%", display: "block" }} />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 6, color: "#ef4444", cursor: "pointer", padding: "5px 7px", display: "flex", alignItems: "center" }}
                    >
                      <XIcon size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
