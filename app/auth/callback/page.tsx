"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    const supabase = createClient();

    async function handleCallback() {
      const code = searchParams.get("code");
      setStatus(`Code: ${code ? code.substring(0, 20) + "..." : "NONE"}`);

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus(`Exchange error: ${error.message}`);
          return;
        }
        if (data.session) {
          setStatus("Session OK! Redirecting...");
          window.location.href = "/home";
          return;
        }
        setStatus("Exchange succeeded but no session returned");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus("Existing session found. Redirecting...");
        window.location.href = "/home";
      } else {
        setStatus("No code and no session. Going to login.");
        setTimeout(() => { window.location.href = "/login"; }, 3000);
      }
    }

    handleCallback();
  }, [searchParams]);

  return <p style={{ color: "#aaa", fontSize: 13, marginTop: 12 }}>{status}</p>;
}

export default function AuthCallbackPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #c9a84c", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "#666", fontSize: 14 }}>Signing you in...</p>
        <Suspense>
          <CallbackHandler />
        </Suspense>
      </div>
    </div>
  );
}
