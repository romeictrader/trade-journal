"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type Preset = { daily: number; dd: number; pt: number };
export type Plan = { key: string; label: string; sizes: Record<string, Preset> };
export type Firm = { key: string; label: string; plans: Plan[] };

// Default data — used to seed on first load
const DEFAULT_FIRMS: Firm[] = [
  {
    key: "apex", label: "Apex Trader Funding", plans: [
      { key: "eod", label: "EOD", sizes: { "25000": { daily: 0, dd: 1500, pt: 1500 }, "50000": { daily: 0, dd: 2500, pt: 3000 }, "75000": { daily: 0, dd: 2750, pt: 4250 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 5000, pt: 9000 }, "250000": { daily: 0, dd: 6500, pt: 12500 }, "300000": { daily: 0, dd: 7500, pt: 20000 } } },
      { key: "intraday", label: "Intraday", sizes: { "25000": { daily: 0, dd: 1500, pt: 1500 }, "50000": { daily: 0, dd: 2500, pt: 3000 }, "75000": { daily: 0, dd: 2750, pt: 4250 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 5000, pt: 9000 }, "250000": { daily: 0, dd: 6500, pt: 12500 }, "300000": { daily: 0, dd: 7500, pt: 20000 } } },
    ],
  },
  {
    key: "topstep", label: "Topstep", plans: [
      { key: "standard", label: "Standard", sizes: { "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 4500, pt: 9000 } } },
    ],
  },
  {
    key: "tradeify", label: "Tradeify", plans: [
      { key: "select", label: "Select", sizes: { "25000": { daily: 0, dd: 1000, pt: 1500 }, "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 4500, pt: 9000 } } },
      { key: "growth", label: "Growth", sizes: { "25000": { daily: 600, dd: 1000, pt: 1500 }, "50000": { daily: 1250, dd: 2000, pt: 3000 }, "100000": { daily: 2500, dd: 3500, pt: 6000 }, "150000": { daily: 3750, dd: 5000, pt: 9000 } } },
    ],
  },
  {
    key: "myfundedfutures", label: "My Funded Futures", plans: [
      { key: "core", label: "Core", sizes: { "50000": { daily: 0, dd: 2000, pt: 3000 } } },
      { key: "rapid", label: "Rapid", sizes: { "25000": { daily: 0, dd: 1000, pt: 1500 }, "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 4500, pt: 9000 } } },
      { key: "pro", label: "Pro", sizes: { "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 4500, pt: 9000 } } },
    ],
  },
  {
    key: "phidias", label: "Phidias", plans: [
      { key: "static25k", label: "Static 25K", sizes: { "25000": { daily: 0, dd: 500, pt: 1500 } } },
      { key: "fundamental", label: "Fundamental", sizes: { "50000": { daily: 0, dd: 2500, pt: 4000 }, "100000": { daily: 0, dd: 5000, pt: 4500 }, "150000": { daily: 0, dd: 7500, pt: 9000 } } },
      { key: "swing", label: "Swing", sizes: { "50000": { daily: 0, dd: 2500, pt: 4000 }, "100000": { daily: 0, dd: 5000, pt: 4500 }, "150000": { daily: 0, dd: 7500, pt: 9000 } } },
    ],
  },
  {
    key: "bulenox", label: "Bulenox", plans: [
      { key: "default", label: "Standard", sizes: { "25000": { daily: 500, dd: 1500, pt: 1500 }, "50000": { daily: 1100, dd: 2500, pt: 2000 }, "100000": { daily: 2200, dd: 3000, pt: 6000 }, "150000": { daily: 3300, dd: 4500, pt: 9000 } } },
    ],
  },
  {
    key: "tradeday", label: "TradeDay", plans: [
      { key: "intraday", label: "Intraday", sizes: { "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 4000, pt: 9000 } } },
      { key: "eod", label: "EOD", sizes: { "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 4000, pt: 9000 } } },
      { key: "static", label: "Static", sizes: { "50000": { daily: 0, dd: 500, pt: 1500 }, "100000": { daily: 0, dd: 750, pt: 2500 }, "150000": { daily: 0, dd: 1000, pt: 3750 } } },
    ],
  },
  {
    key: "takeprofittrader", label: "Take Profit Trader", plans: [
      { key: "default", label: "Standard", sizes: { "25000": { daily: 0, dd: 1500, pt: 1500 }, "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 4500, pt: 9000 } } },
    ],
  },
  {
    key: "tickticktrader", label: "TickTick Trader", plans: [
      { key: "default", label: "Standard", sizes: { "25000": { daily: 0, dd: 1000, pt: 1500 }, "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 4500, pt: 9000 } } },
    ],
  },
  {
    key: "fundednext", label: "FundedNext", plans: [
      { key: "default", label: "Standard", sizes: { "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 4500, pt: 9000 }, "200000": { daily: 0, dd: 5000, pt: 12000 } } },
    ],
  },
  {
    key: "lucidtrading", label: "Lucid Trading", plans: [
      { key: "flex", label: "LucidFlex", sizes: { "25000": { daily: 0, dd: 1000, pt: 1250 }, "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 0, dd: 4500, pt: 9000 } } },
      { key: "pro", label: "LucidPro", sizes: { "25000": { daily: 0, dd: 1000, pt: 1250 }, "50000": { daily: 1200, dd: 2000, pt: 3000 }, "100000": { daily: 1800, dd: 3000, pt: 6000 }, "150000": { daily: 2700, dd: 4500, pt: 9000 } } },
      { key: "direct", label: "LucidDirect", sizes: { "25000": { daily: 0, dd: 1000, pt: 1250 }, "50000": { daily: 1200, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 3000, pt: 6000 }, "150000": { daily: 3000, dd: 5000, pt: 9000 } } },
    ],
  },
  {
    key: "alphafutures", label: "Alpha Futures", plans: [
      { key: "standard", label: "Standard", sizes: { "50000": { daily: 0, dd: 2000, pt: 3000 }, "100000": { daily: 0, dd: 4000, pt: 6000 }, "150000": { daily: 0, dd: 6000, pt: 9000 } } },
      { key: "advanced", label: "Advanced", sizes: { "50000": { daily: 0, dd: 1750, pt: 4000 }, "100000": { daily: 0, dd: 3500, pt: 8000 }, "150000": { daily: 0, dd: 5250, pt: 12000 } } },
      { key: "zero", label: "Zero", sizes: { "50000": { daily: 1000, dd: 2000, pt: 3000 }, "100000": { daily: 2000, dd: 4000, pt: 6000 } } },
    ],
  },
];

export function useFirmData() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFirms(DEFAULT_FIRMS); setLoading(false); return; }

      const { data } = await supabase
        .from("prop_firm_config")
        .select("firms")
        .eq("user_id", user.id)
        .single();

      if (data?.firms && Array.isArray(data.firms) && data.firms.length > 0) {
        setFirms(data.firms);
      } else {
        // Seed defaults on first load
        await supabase.from("prop_firm_config").upsert(
          { user_id: user.id, firms: DEFAULT_FIRMS },
          { onConflict: "user_id" }
        );
        setFirms(DEFAULT_FIRMS);
      }
      setLoading(false);
    })();
  }, []);

  const saveFirms = useCallback(async (updated: Firm[]) => {
    setFirms(updated);
    // Debounced save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("prop_firm_config").upsert(
        { user_id: user.id, firms: updated, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }, 800);
  }, []);

  // Derived: firmList for dropdowns, firmData for lookups
  const firmList = firms.map(f => ({ key: f.key, label: f.label }));
  const firmData: Record<string, { plans: Plan[] }> = {};
  for (const f of firms) firmData[f.key] = { plans: f.plans };

  return { firms, firmList, firmData, loading, saveFirms };
}
