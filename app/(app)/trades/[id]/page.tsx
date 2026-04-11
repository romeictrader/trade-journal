"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trade } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, Edit2, X } from "lucide-react";
import TradeForm from "@/components/TradeForm";

interface TradeImage { id: string; storage_path: string | null; url: string | null; }
interface LoadedImage { id: string; signedUrl: string; storage_path: string | null; }

function Badge({ value, color }: { value: string; color?: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    green: { bg: "#22c55e22", text: "#22c55e" },
    red: { bg: "#ef444422", text: "#ef4444" },
    gold: { bg: "#c9a84c22", text: "#c9a84c" },
    gray: { bg: "#88888822", text: "#888" },
  };
  const c = colors[color ?? "gray"];
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 600 }}>
      {value}
    </span>
  );
}

export default function TradeViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [trade, setTrade] = useState<Trade | null>(null);
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("trades").select("*").eq("id", id).single();
    if (!data) { router.push("/trades"); return; }
    setTrade(data);

    const { data: imgs } = await supabase
      .from("trade_images")
      .select("id, storage_path, url")
      .eq("trade_id", id);

    if (imgs && imgs.length > 0) {
      const loaded = await Promise.all(
        (imgs as TradeImage[]).map(async (img) => {
          let signedUrl = img.url ?? "";
          if (img.storage_path) {
            const { data: s } = await supabase.storage
              .from("journal-images")
              .createSignedUrl(img.storage_path, 3600);
            signedUrl = s?.signedUrl ?? img.url ?? "";
          }
          return { id: img.id, signedUrl, storage_path: img.storage_path };
        })
      );
      setImages(loaded.filter((i) => i.signedUrl));
    } else {
      setImages([]);
    }

    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 32, color: "#888" }}>Loading...</div>;
  if (!trade) return null;

  const outcomeColor = trade.outcome === "Win" ? "green" : trade.outcome === "Loss" ? "red" : "gold";
  const dirColor = trade.direction === "Long" ? "green" : "red";

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, padding: "12px 0", borderBottom: "1px solid #1a1a1a", alignItems: "start" }}>
      <span style={{ fontSize: 13, color: "#555" }}>{label}</span>
      <div>{children}</div>
    </div>
  );

  const Val = ({ v }: { v?: string | number | null }) =>
    v != null && v !== "" ? (
      <span style={{ color: "#ccc", fontSize: 14 }}>{v}</span>
    ) : (
      <span style={{ color: "#333", fontSize: 14 }}>—</span>
    );

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <Link href="/trades" style={{ color: "#888", display: "flex", alignItems: "center", gap: 4, textDecoration: "none", fontSize: 13 }}>
          <ArrowLeft size={14} /> Trade Log
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{trade.contract}</h1>
          <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>{trade.date}{trade.day ? ` — ${trade.day}` : ""}</div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          style={{ background: editing ? "#1a1a1a" : "#c9a84c", border: editing ? "1px solid #333" : "none", borderRadius: 8, color: editing ? "#888" : "#000", fontWeight: 700, fontSize: 13, padding: "9px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          {editing ? <><X size={14} /> Cancel</> : <><Edit2 size={14} /> Edit</>}
        </button>
      </div>

      {editing ? (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 24 }}>
          <TradeForm
            accountId={trade.account_id ?? ""}
            initialTrade={trade}
            onSave={() => { setEditing(false); load(); }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          {/* P&L banner */}
          <div style={{
            marginBottom: 28,
            padding: "20px",
            borderRadius: 12,
            background: trade.pnl >= 0 ? "#22c55e0d" : "#ef44440d",
            border: `1px solid ${trade.pnl >= 0 ? "#22c55e33" : "#ef444433"}`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>P&L</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: trade.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
              ${trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}
            </div>
          </div>

          {/* Fields */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "0 24px" }}>
            <Row label="Date"><Val v={trade.date} /></Row>
            <Row label="Day"><Val v={trade.day} /></Row>
            <Row label="Outcome">{trade.outcome ? <Badge value={trade.outcome} color={outcomeColor} /> : <Val />}</Row>
            <Row label="Direction">{trade.direction ? <Badge value={trade.direction} color={dirColor} /> : <Val />}</Row>
            <Row label="Session"><Val v={trade.session} /></Row>
            <Row label="News"><Val v={trade.news} /></Row>
            <Row label="Day Probability"><Val v={trade.day_probability} /></Row>
            <Row label="Emotions"><Val v={trade.emotions} /></Row>
            <Row label="Rules Broken"><Val v={trade.rules_broken} /></Row>
            <Row label="Contract"><Val v={trade.contract} /></Row>
            <Row label="Contracts"><Val v={trade.contracts} /></Row>
            <Row label="R:R">{trade.rr != null ? <span style={{ color: "#ccc", fontSize: 14 }}>{trade.rr}R</span> : <span style={{ color: "#333" }}>—</span>}</Row>
            <Row label="TP Size"><Val v={trade.tp_size} /></Row>
            <Row label="SL Size"><Val v={trade.sl_size} /></Row>
            <Row label="Execution Time"><Val v={trade.execution_time} /></Row>
            <Row label="Execution Grade"><Val v={trade.execution} /></Row>
            <Row label="Checklist Followed">
              <Badge value={trade.checklist ? "Yes" : "No"} color={trade.checklist ? "green" : "gray"} />
            </Row>
            <Row label="PDA"><Val v={trade.pda} /></Row>
            <Row label="Manipulation"><Val v={trade.manipulation} /></Row>
            <Row label="Context"><Val v={trade.context} /></Row>
            {trade.narrative ? (
              <Row label="Narrative">
                <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#0a0a0a", borderRadius: 8, padding: "10px 12px" }}>{trade.narrative}</div>
              </Row>
            ) : <Row label="Narrative"><Val /></Row>}
            {trade.explanation ? (
              <Row label="Explanation">
                <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#0a0a0a", borderRadius: 8, padding: "10px 12px" }}>{trade.explanation}</div>
              </Row>
            ) : <Row label="Explanation"><Val /></Row>}
            {trade.emotions_psych ? (
              <Row label="Emotions / Psych">
                <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#0a0a0a", borderRadius: 8, padding: "10px 12px" }}>{trade.emotions_psych}</div>
              </Row>
            ) : <Row label="Emotions / Psych"><Val /></Row>}
            {trade.notes ? (
              <Row label="Notes">
                <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#0a0a0a", borderRadius: 8, padding: "10px 12px" }}>{trade.notes}</div>
              </Row>
            ) : null}
          </div>

          {/* Screenshots — view only */}
          {images.length > 0 && (
            <div style={{ marginTop: 20, background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                Trade Screenshots
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {images.map((img, i) => (
                  <div key={i} onClick={() => setLightbox(img.signedUrl)} style={{ borderRadius: 10, overflow: "hidden", cursor: "zoom-in", border: "1px solid #222" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.signedUrl} alt="" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 20, background: "#222", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
            <X size={16} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }} />
        </div>
      )}

    </div>
  );
}
