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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  userEmail: string;
}

const navItems = [
  { label: "Accounts", icon: Briefcase, href: "/home" },
  { label: "Trade Log", icon: BookOpen, href: "/trades" },
  { label: "Combined Calendar", icon: Calendar, href: "/calendar" },
  { label: "Journal", icon: FileText, href: "/journal" },
  { label: "Analysis", icon: BarChart2, href: "/analysis" },
  { label: "Psychology", icon: Brain, href: "/psychology" },
];

export default function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const width = collapsed ? 60 : 200;

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
        transition: "width 0.2s",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? "16px 0" : "16px",
          borderBottom: "1px solid #222",
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
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
          TJ
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>
              Trade Journal
            </div>
            <div style={{ fontSize: 10, color: "#888" }}>Pro Edition</div>
          </div>
        )}
      </div>

      {/* Nav sections */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        {!collapsed && (
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: collapsed ? "10px 0" : "10px 16px",
                justifyContent: collapsed ? "center" : "flex-start",
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
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        <div style={{ height: 16 }} />
        {!collapsed && (
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
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: collapsed ? "10px 0" : "10px 16px",
            justifyContent: collapsed ? "center" : "flex-start",
            background: pathname === "/settings" ? "#1a1a1a" : "transparent",
            borderLeft:
              pathname === "/settings"
                ? "2px solid #c9a84c"
                : "2px solid transparent",
            color: pathname === "/settings" ? "#c9a84c" : "#888",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          <Settings size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>

      {/* Bottom: user + sign out */}
      <div style={{ borderTop: "1px solid #222", padding: collapsed ? "12px 0" : "12px 16px" }}>
        {!collapsed && (
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
            justifyContent: collapsed ? "center" : "flex-start",
            width: "100%",
          }}
        >
          <LogOut size={15} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
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
    </div>
  );
}
