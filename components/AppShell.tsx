"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function AppShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 45,
          }}
        />
      )}

      <Sidebar
        userEmail={userEmail}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <Header
        isMobile={isMobile}
        onMenuClick={() => setMobileOpen(true)}
      />

      <main
        style={{
          marginLeft: isMobile ? 0 : 200,
          paddingTop: 52,
          minHeight: "100vh",
        }}
      >
        {children}
      </main>
    </div>
  );
}
