"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";

export interface AutocompleteInputProps {
  fieldName: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  seedOptions?: string[];
  userId: string;
  className?: string;
}

export default function AutocompleteInput({
  fieldName,
  value,
  onChange,
  placeholder,
  seedOptions = [],
  userId,
  className,
}: AutocompleteInputProps) {
  const [userSuggestions, setUserSuggestions] = useState<{ id: string; value: string; use_count: number }[]>([]);
  const [hiddenSeeds, setHiddenSeeds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`hidden_seeds_${fieldName}`) ?? "[]"); } catch { return []; }
  });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from("user_suggestions")
      .select("id, value, use_count")
      .eq("user_id", userId)
      .eq("field_name", fieldName)
      .order("use_count", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setUserSuggestions(data);
      });
  }, [userId, fieldName]);

  const allSuggestions = useCallback((): { value: string; id?: string }[] => {
    const userVals = userSuggestions.map((s) => ({ value: s.value, id: s.id }));
    const merged: { value: string; id?: string }[] = [...userVals];
    for (const s of seedOptions) {
      if (!merged.some((m) => m.value === s) && !hiddenSeeds.includes(s)) merged.push({ value: s });
    }
    const q = value.toLowerCase();
    const filtered = q
      ? merged.filter((s) => s.value.toLowerCase().includes(q))
      : merged;
    return filtered.slice(0, 6);
  }, [userSuggestions, seedOptions, value, hiddenSeeds]);

  const suggestions = allSuggestions();

  async function saveSuggestion(val: string) {
    if (!userId || !val.trim()) return;
    const supabase = createClient();
    await supabase.from("user_suggestions").upsert(
      { user_id: userId, field_name: fieldName, value: val.trim(), use_count: 1 },
      { onConflict: "user_id,field_name,value", ignoreDuplicates: false }
    );
    const { data } = await supabase
      .from("user_suggestions")
      .select("id, value, use_count")
      .eq("user_id", userId)
      .eq("field_name", fieldName)
      .order("use_count", { ascending: false })
      .limit(20);
    if (data) setUserSuggestions(data);
  }

  async function deleteSuggestion(id: string | undefined, seedValue?: string) {
    if (id) {
      const supabase = createClient();
      await supabase.from("user_suggestions").delete().eq("id", id);
      setUserSuggestions((prev) => prev.filter((s) => s.id !== id));
    } else if (seedValue) {
      const next = [...hiddenSeeds, seedValue];
      setHiddenSeeds(next);
      try { localStorage.setItem(`hidden_seeds_${fieldName}`, JSON.stringify(next)); } catch {}
    }
  }

  function handleBlur() {
    setTimeout(() => {
      setOpen(false);
      setActiveIndex(-1);
      if (value.trim()) saveSuggestion(value);
    }, 150);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        onChange(suggestions[activeIndex].value);
        setOpen(false);
        setActiveIndex(-1);
        saveSuggestion(suggestions[activeIndex].value);
      } else {
        setOpen(false);
        if (value.trim()) saveSuggestion(value);
      }
    }
  }

  return (
    <div style={{ position: "relative", width: "100%" }} className={className}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 8,
          padding: "9px 12px",
          color: "#fff",
          fontSize: 13,
          outline: "none",
          boxSizing: "border-box",
        }}
        onMouseDown={() => setOpen(true)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#222",
            border: "1px solid #333",
            borderRadius: 8,
            marginTop: 2,
            zIndex: 200,
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.value}
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 13,
                color: i === activeIndex ? "#c9a84c" : "#ccc",
                background: i === activeIndex ? "#2a2a2a" : "transparent",
                borderBottom: i < suggestions.length - 1 ? "1px solid #2a2a2a" : "none",
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s.value);
                  setOpen(false);
                  setActiveIndex(-1);
                  saveSuggestion(s.value);
                }}
                style={{ flex: 1, padding: "8px 12px", cursor: "pointer" }}
              >
                {s.value}
              </div>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteSuggestion(s.id, s.id ? undefined : s.value);
                }}
                title="Remove suggestion"
                style={{
                  background: "none",
                  border: "none",
                  color: "#555",
                  cursor: "pointer",
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
