"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/home");
      router.refresh();
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
      }}
    >
      <div
        style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 12,
          padding: "2.5rem",
          width: "100%",
          maxWidth: 400,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              background: "#c9a84c",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 20,
              color: "#000",
              marginBottom: 12,
            }}
          >
            TJ
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>
            Trade Journal
          </h1>
          <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                background: "#0a0a0a",
                border: "1px solid #222",
                borderRadius: 8,
                padding: "10px 12px",
                color: "#fff",
                fontSize: 14,
                outline: "none",
              }}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                background: "#0a0a0a",
                border: "1px solid #222",
                borderRadius: 8,
                padding: "10px 12px",
                color: "#fff",
                fontSize: 14,
                outline: "none",
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              style={{
                background: "#ef44441a",
                border: "1px solid #ef4444",
                borderRadius: 8,
                padding: "10px 12px",
                color: "#ef4444",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "#666" : "#c9a84c",
              color: "#000",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              borderRadius: 8,
              padding: "12px",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#888" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "#c9a84c", textDecoration: "none" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
