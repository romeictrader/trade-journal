"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
        skipBrowserRedirect: true,
      },
    });
    if (error) { setError(error.message); setGoogleLoading(false); return; }
    if (data.url) window.location.href = data.url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else { router.push("/home"); router.refresh(); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 50% 30%, #161616 0%, #0a0a0a 70%)", padding: "0 24px" }}>

      {/* Heading */}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#fff", margin: "0 0 8px", textAlign: "center" }}>Welcome To One To One Journal</h1>
      <p style={{ fontSize: 15, color: "#666", margin: "0 0 36px", textAlign: "center" }}>Sign-up or sign-in to your account now</p>

      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Google Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          style={{
            width: "100%",
            background: "#111",
            color: "#fff",
            fontWeight: 600,
            fontSize: 15,
            border: "1px solid #2a2a2a",
            borderRadius: 10,
            padding: "14px",
            cursor: googleLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: 12,
            opacity: googleLoading ? 0.7 : 1,
            transition: "border-color 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#444")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
        >
          <GoogleIcon />
          {googleLoading ? "Redirecting..." : "Continue with Google"}
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
          <span style={{ fontSize: 13, color: "#444" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 7 }}>Email ID</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 10, padding: "13px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
              onFocus={e => (e.currentTarget.style.borderColor = "#c9a84c55")}
              onBlur={e => (e.currentTarget.style.borderColor = "#222")}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 7 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 10, padding: "13px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
              onFocus={e => (e.currentTarget.style.borderColor = "#c9a84c55")}
              onBlur={e => (e.currentTarget.style.borderColor = "#222")}
            />
          </div>

          <div style={{ textAlign: "right", marginBottom: 20 }}>
            <a href="/forgot-password" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#c9a84c")}
              onMouseLeave={e => (e.currentTarget.style.color = "#555")}
            >Forgot password?</a>
          </div>

          {error && (
            <div style={{ background: "#ef44441a", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 12px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", background: loading ? "#555" : "#c9a84c", color: "#000", fontWeight: 700, fontSize: 15, border: "none", borderRadius: 10, padding: "14px", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.2s, filter 0.2s" }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.filter = "brightness(0.9)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)"; }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#555" }}>
          Don&apos;t have an account?{" "}
          <a href="/signup" style={{ color: "#c9a84c", textDecoration: "none" }}>Sign up</a>
        </p>
      </div>
    </div>
  );
}
