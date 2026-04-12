"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trade, Account } from "@/lib/types";
import Link from "next/link";
import { Plus, ArrowRight, Trash2 } from "lucide-react";
import AddAccountModal from "@/components/AddAccountModal";
import { useIsMobile } from "@/hooks/useIsMobile";

function Skeleton({ width, height }: { width?: string | number; height?: string | number }) {
  return (
    <div
      style={{
        width: width ?? "100%",
        height: height ?? 16,
        background: "linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)",
        backgroundSize: "200% 100%",
        animation: "pulse 1.5s ease-in-out infinite",
        borderRadius: 6,
      }}
    />
  );
}

interface AccountStats {
  account: Account;
  trades: Trade[];
  totalPnl: number;
  winRate: number;
  balance: number;
  todayPnl: number;
  maxDD: number;
}

function calcStats(account: Account, trades: Trade[]): AccountStats {
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const balance = account.starting_balance + totalPnl;
  const today = new Date().toISOString().split("T")[0];
  const todayPnl = trades.filter((t) => t.date === today).reduce((s, t) => s + t.pnl, 0);
  let peak = 0, maxDD = 0, running = 0;
  for (const t of [...trades].sort((a, b) => a.date.localeCompare(b.date))) {
    running += t.pnl;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }
  return { account, trades, totalPnl, winRate, balance, todayPnl, maxDD };
}

function AccountCard({ stats, onDelete, onEdit }: { stats: AccountStats; onDelete: (id: string) => void; onEdit: (account: Account) => void }) {
  const { account, totalPnl, winRate, balance } = stats;

  return (
    <div style={{
      position: "relative",
      background: "#111",
      border: `1px solid #222`,
      borderTop: `3px solid ${account.color}`,
      borderRadius: 12,
    }}>
      {/* Delete — top right */}
      <button
        onClick={() => { if (confirm(`Delete "${account.account_name}"? This cannot be undone.`)) onDelete(account.id); }}
        style={{ position: "absolute", top: 10, right: 10, zIndex: 10, background: "none", border: "none", color: "#555", cursor: "pointer", padding: 4, borderRadius: 5, display: "flex", alignItems: "center" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
      >
        <Trash2 size={13} />
      </button>

      {/* Top content — navigates to dashboard on click */}
      <Link href={`/accounts/${account.id}`} style={{ display: "block", padding: "18px 18px 12px", textDecoration: "none", color: "inherit" }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{account.prop_firm}</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{account.account_name}</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Balance</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: "#555" }}>Total P&L</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>
              ${totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#555" }}>Win Rate</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{winRate.toFixed(1)}%</div>
          </div>
        </div>
      </Link>

      {/* Bottom row — outside Link, both buttons independently clickable */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px 14px" }}>
        <button
          onClick={() => onEdit(account)}
          style={{ background: "#c9a84c", border: "none", color: "#000", cursor: "pointer", padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}
        >
          Edit
        </button>
        <Link href={`/accounts/${account.id}`} style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#c9a84c", gap: 4, textDecoration: "none" }}>
          View Dashboard <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const [accountStats, setAccountStats] = useState<AccountStats[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: accountsData }, { data: tradesData }] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", user.id).order("created_at"),
        supabase.from("trades").select("*").eq("user_id", user.id).order("date", { ascending: true }),
      ]);

      const accounts: Account[] = accountsData ?? [];
      const trades: Trade[] = tradesData ?? [];
      setAllTrades(trades);

      const stats = accounts.map((acc) => {
        const accTrades = trades.filter((t) => t.account_id === acc.id);
        return calcStats(acc, accTrades);
      });
      setAccountStats(stats);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      const supabase = createClient();
      await supabase.from("accounts").delete().eq("id", id);
      load();
    } catch (err) {
      console.error("Failed to delete account:", err);
    }
  }, [load]);

  useEffect(() => {
    load();
    // Real-time subscription — refresh whenever trades change
    const supabase = createClient();
    const channel = supabase
      .channel("trades-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Only count trades belonging to existing accounts
  const activeAccountIds = new Set(accountStats.map((s) => s.account.id));
  const activeTrades = allTrades.filter((t) => t.account_id && activeAccountIds.has(t.account_id));


  // Combined equity curve
  const equityData: { date: string; equity: number }[] = [];
  let cumPnl = 0;
  const sorted = [...activeTrades].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    cumPnl += t.pnl;
    equityData.push({ date: t.date, equity: cumPnl });
  }

  return (
    <div style={{ padding: isMobile ? 16 : 24, maxWidth: 1400 }}>
      <style>{`@keyframes pulse { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", marginBottom: 24, gap: isMobile ? 12 : 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Accounts Overview</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>All prop firm accounts in one place</p>
        </div>
        <button
          onClick={() => setShowAddAccount(true)}
          style={{
            background: "#c9a84c",
            border: "none",
            borderRadius: 8,
            color: "#000",
            fontWeight: 700,
            fontSize: 13,
            padding: "10px 18px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus size={15} />
          Add Account
        </button>
      </div>


      {/* Account cards grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ background: "#111", border: "1px solid #222", borderTop: "3px solid #333", borderRadius: 12, padding: 18, height: 200 }}>
              <Skeleton height={16} width={120} />
              <div style={{ marginTop: 6 }}><Skeleton height={12} width={80} /></div>
              <div style={{ marginTop: 16 }}><Skeleton height={28} width={140} /></div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 24 }}>
          {accountStats.map((stats) => (
            <AccountCard key={stats.account.id} stats={stats} onDelete={deleteAccount} onEdit={(acc) => setEditAccount(acc)} />
          ))}

          {/* Add account card */}
          <button
            onClick={() => setShowAddAccount(true)}
            style={{
              background: "transparent",
              border: "2px dashed #333",
              borderRadius: 12,
              padding: 18,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "#444",
              minHeight: 180,
              transition: "border-color 0.15s, color 0.15s",
            }}
          >
            <Plus size={28} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Add Account</span>
          </button>
        </div>
      )}


      {showAddAccount && (
        <AddAccountModal
          onClose={() => setShowAddAccount(false)}
          onSaved={() => { setShowAddAccount(false); load(); }}
        />
      )}
      {editAccount && (
        <AddAccountModal
          account={editAccount}
          onClose={() => setEditAccount(null)}
          onSaved={() => { setEditAccount(null); load(); }}
        />
      )}
    </div>
  );
}
