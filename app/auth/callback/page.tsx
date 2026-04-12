"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");

    async function handleCallback() {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.location.href = "/home";
      } else {
        // Listen for auth state change (implicit flow with hash)
        supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session) {
            window.location.href = "/home";
          }
        });
        // Fallback after 5 seconds
        setTimeout(() => { window.location.href = "/login"; }, 5000);
      }
    }

    handleCallback();
  }, [searchParams]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #c9a84c", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "#666", fontSize: 14 }}>Signing you in...</p>
      </div>
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
