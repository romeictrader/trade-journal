"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/home": "Accounts",
  "/trades": "Trade Log",
  "/calendar": "Calendar",
  "/journal": "Narrative / Bias",
  "/mistakes": "Mistakes",
  "/analysis": "Analysis",
  "/psychology": "Psychology",
  "/settings": "Settings",
};

interface HeaderProps {
  isMobile?: boolean;
  onMenuClick?: () => void;
}

export default function Header({ isMobile, onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES[pathname] ?? "";

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: isMobile ? 0 : 200,
        right: 0,
        height: 52,
        background: "#111111",
        borderBottom: "1px solid #1a1a1a",
        boxShadow: "0 1px 0 #c9a84c18",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        paddingLeft: isMobile ? 16 : 20,
        gap: 12,
      }}
    >
      {isMobile && (
        <button
          onClick={onMenuClick}
          style={{
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Menu size={22} />
        </button>
      )}
      {isMobile ? (
        <span style={{ fontSize: 14, fontWeight: 700, color: "#c9a84c", letterSpacing: "0.02em" }}>OTO Journal</span>
      ) : (
        pageTitle && (
          <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{pageTitle}</span>
        )
      )}
    </header>
  );
}
