"use client";

import { Menu } from "lucide-react";

interface HeaderProps {
  isMobile?: boolean;
  onMenuClick?: () => void;
}

export default function Header({ isMobile, onMenuClick }: HeaderProps) {
  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: isMobile ? 0 : 200,
        right: 0,
        height: 52,
        background: "#111111",
        borderBottom: "1px solid #222",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        paddingLeft: isMobile ? 16 : 0,
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
    </header>
  );
}
