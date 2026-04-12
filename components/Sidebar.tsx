"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  FileText,
  BarChart2,
  Brain,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  userEmail: string;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { label: "Accounts", icon: Briefcase, href: "/home" },
  { label: "Trade Log", icon: BookOpen, href: "/trades" },
  { label: "Combined Calendar", icon: Calendar, href: "/calendar" },
  { label: "Journal", icon: FileText, href: "/journal" },
  { label: "Analysis", icon: BarChart2, href: "/analysis" },
  { label: "Psychology", icon: Brain, href: "/psychology" },
];

export default function Sidebar({ userEmail, isMobile, mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const width = isMobile ? 240 : (collapsed ? 60 : 200);
  const showLabels = isMobile ? true : !collapsed;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width,
        background: "#111111",
        borderRight: "1px solid #222",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.25s, width 0.2s",
        zIndex: 50,
        overflow: "hidden",
        transform: isMobile ? (mobileOpen ? "translateX(0)" : "translateX(-100%)") : "none",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: !showLabels ? "16px 0" : "16px",
          borderBottom: "1px solid #222",
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: !showLabels ? "center" : "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: "#c9a84c",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
              color: "#000",
              flexShrink: 0,
            }}
          >
            1:1
          </div>
          {showLabels && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>
                One To One Journal
              </div>
              <div style={{ fontSize: 10, color: "#888" }}>Pro Edition</div>
            </div>
          )}
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav sections */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        {showLabels && (
          <div
            style={{
              fontSize: 10,
              color: "#444",
              fontWeight: 600,
              letterSpacing: "0.1em",
              padding: "8px 16px 4px",
              textTransform: "uppercase",
            }}
          >
            Journal
          </div>
        )}
        {navItems.map(({ label, icon: Icon, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={isMobile ? onClose : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: !showLabels ? "10px 0" : "10px 16px",
                justifyContent: !showLabels ? "center" : "flex-start",
                background: active ? "#1a1a1a" : "transparent",
                borderLeft: active ? "2px solid #c9a84c" : "2px solid transparent",
                color: active ? "#c9a84c" : "#888",
                textDecoration: "none",
                fontSize: 13,
                transition: "all 0.15s",
                marginBottom: 2,
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {showLabels && <span>{label}</span>}
            </Link>
          );
        })}

        <div style={{ height: 16 }} />
        {showLabels && (
          <div
            style={{
              fontSize: 10,
              color: "#444",
              fontWeight: 600,
              letterSpacing: "0.1em",
              padding: "8px 16px 4px",
              textTransform: "uppercase",
            }}
          >
            Account
          </div>
        )}
        <Link
          href="/settings"
          onClick={isMobile ? onClose : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: !showLabels ? "10px 0" : "10px 16px",
            justifyContent: !showLabels ? "center" : "flex-start",
            background: pathname === "/settings" ? "#1a1a1a" : "transparent",
            borderLeft: pathname === "/settings" ? "2px solid #c9a84c" : "2px solid transparent",
            color: pathname === "/settings" ? "#c9a84c" : "#888",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          <Settings size={16} style={{ flexShrink: 0 }} />
          {showLabels && <span>Settings</span>}
        </Link>
      </div>

      {/* Bottom: user + sign out */}
      <div style={{ borderTop: "1px solid #222", padding: !showLabels ? "12px 0" : "12px 16px" }}>
        {showLabels && (
          <div
            style={{
              fontSize: 11,
              color: "#555",
              marginBottom: 8,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {userEmail}
          </div>
        )}
        <button
          onClick={handleSignOut}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer",
            fontSize: 13,
            padding: 0,
            justifyContent: !showLabels ? "center" : "flex-start",
            width: "100%",
          }}
        >
          <LogOut size={15} />
          {showLabels && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: "absolute",
            top: "50%",
            right: -12,
            width: 24,
            height: 24,
            background: "#222",
            border: "1px solid #333",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#888",
            padding: 0,
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      )}
    </div>
  );
}
