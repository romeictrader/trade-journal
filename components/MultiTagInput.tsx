"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { X as XIcon } from "lucide-react";

interface MultiTagInputProps {
  fieldName: string;
  value: string; // comma-separated stored value
  onChange: (v: string) => void;
  placeholder?: string;
  seedOptions?: string[];
  userId?: string;
}

export default function MultiTagInput({
  fieldName,
  value,
  onChange,
  placeholder,
  seedOptions = [],
  userId,
}: MultiTagInputProps) {
  const tags = value ? value.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<{ label: string; isSeed: boolean; dbId?: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dbOptions, setDbOptions] = useState<{ id: string; value: string }[]>([]);
  const [hiddenSeeds, setHiddenSeeds] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hiddenKey = `hiddenSeeds_${fieldName}`;
    setHiddenSeeds(JSON.parse(localStorage.getItem(hiddenKey) ?? "[]"));
  }, [fieldName]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from("user_suggestions")
      .select("id, value")
      .eq("user_id", userId)
      .eq("field_name", fieldName)
      .then(({ data }) => {
        if (data) setDbOptions(data);
      });
  }, [userId, fieldName]);

  useEffect(() => {
    const q = input.toLowerCase();
    const seedList = seedOptions
      .filter((s) => !hiddenSeeds.includes(s) && !tags.includes(s))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .map((s) => ({ label: s, isSeed: true }));

    const dbList = dbOptions
      .filter((o) => !tags.includes(o.value))
      .filter((o) => !q || o.value.toLowerCase().includes(q))
      .filter((o) => !seedList.find((s) => s.label === o.value))
      .map((o) => ({ label: o.value, isSeed: false, dbId: o.id }));

    setSuggestions([...seedList, ...dbList].slice(0, 10));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, dbOptions, value, hiddenSeeds]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addTag(tag: string) {
    const t = tag.trim();
    if (!t || tags.includes(t)) { setInput(""); return; }
    const newTags = [...tags, t];
    onChange(newTags.join(", "));
    setInput("");
    setShowDropdown(false);

    // Auto-save to DB if not already saved and not a seed
    if (userId && !seedOptions.includes(t) && !dbOptions.find((o) => o.value === t)) {
      const supabase = createClient();
      supabase
        .from("user_suggestions")
        .insert({ user_id: userId, field_name: fieldName, value: t })
        .select("id, value")
        .single()
        .then(({ data }) => {
          if (data) setDbOptions((prev) => [...prev, data as { id: string; value: string }]);
        });
    }
  }

  function removeTag(tag: string) {
    const newTags = tags.filter((t) => t !== tag);
    onChange(newTags.join(", "));
  }

  function deleteSuggestion(e: React.MouseEvent, item: { label: string; isSeed: boolean; dbId?: string }) {
    e.preventDefault();
    e.stopPropagation();
    if (item.isSeed) {
      const hiddenKey = `hiddenSeeds_${fieldName}`;
      const updated = [...hiddenSeeds, item.label];
      setHiddenSeeds(updated);
      localStorage.setItem(hiddenKey, JSON.stringify(updated));
    } else if (item.dbId && userId) {
      const supabase = createClient();
      supabase.from("user_suggestions").delete().eq("id", item.dbId).then(() => {
        setDbOptions((prev) => prev.filter((o) => o.id !== item.dbId));
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          background: "#0a0a0a",
          border: "1px solid #222",
          borderRadius: 8,
          padding: "7px 10px",
          minHeight: 40,
          cursor: "text",
          alignItems: "center",
        }}
        onClick={() => setShowDropdown(true)}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "#c9a84c22",
              border: "1px solid #c9a84c55",
              borderRadius: 6,
              color: "#c9a84c",
              fontSize: 12,
              fontWeight: 600,
              padding: "2px 8px",
              whiteSpace: "nowrap",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#c9a84c88", padding: 0, lineHeight: 1, display: "flex" }}
            >
              <XIcon size={10} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          style={{
            background: "none",
            border: "none",
            outline: "none",
            color: "#fff",
            fontSize: 13,
            flex: 1,
            minWidth: 80,
            padding: 0,
          }}
        />
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#161616",
            border: "1px solid #333",
            borderRadius: 8,
            zIndex: 100,
            overflow: "hidden",
            marginTop: 4,
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
        >
          {suggestions.map((s) => (
            <div
              key={s.label}
              onMouseDown={(e) => { e.preventDefault(); addTag(s.label); }}
              style={{
                padding: "9px 14px",
                fontSize: 13,
                color: "#ccc",
                cursor: "pointer",
                borderBottom: "1px solid #222",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#222")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span>{s.label}</span>
              <button
                type="button"
                onMouseDown={(e) => deleteSuggestion(e, s)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#444",
                  padding: "0 2px",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
                title="Remove suggestion"
              >
                <XIcon size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
