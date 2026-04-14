export type Direction = "Long" | "Short";

export interface Trade {
  id: string;
  user_id: string;
  account_id?: string;
  date: string;           // YYYY-MM-DD
  day?: string;           // Mon/Tue/Wed/Thu/Fri
  outcome?: string;       // Win / Loss / Breakeven
  session?: string;       // London / New York / Asian / London-NY Overlap
  news?: string;          // news event or None
  day_probability?: string; // High / Medium / Low
  emotions?: string;      // Calm / Confident / Anxious / FOMO / Revenge / Neutral
  rules_broken?: string;  // None / list
  contract: string;       // instrument e.g. ES, NQ
  contracts: number;      // contract size / qty
  direction?: Direction;
  entry_price: number;
  exit_price: number;
  pnl: number;
  rr?: number;            // Risk:Reward achieved
  tp_size?: number;       // Take profit in ticks/points
  sl_size?: number;       // Stop loss in ticks/points
  execution_time?: string; // HH:MM
  narrative?: string;     // trade narrative / thesis
  context?: string;       // market context
  execution?: string;     // execution quality: A / B / C
  checklist?: boolean;    // followed checklist?
  pda?: string;           // Price Delivery Algorithm (ICT): CISD/OB/FVG/etc
  manipulation?: string;  // manipulation observed: Yes/No/description
  explanation?: string;   // post-trade explanation
  emotions_psych?: string; // post-trade emotion notes
  setup_tag?: string;
  emotion_before?: number;
  emotion_after?: number;
  notes?: string;
  created_at?: string;
}

export interface Account {
  id: string;
  user_id: string;
  prop_firm: string;
  account_name: string;
  account_size: number;
  starting_balance: number;
  daily_loss_limit: number;
  max_drawdown: number;
  profit_target: number;
  daily_loss_enabled: boolean;
  max_drawdown_enabled: boolean;
  profit_target_enabled: boolean;
  color: string;
  plan_key?: string;                 // e.g. "flex", "pro", "standard"
  drawdown_type?: number;          // 1-7, default 2 (EOD Trailing)
  drawdown_percent?: number;       // type 5 only
  lock_trigger_balance?: number;   // type 4 only
  buffer_target?: number;          // type 6 only
  created_at?: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  type: "daily" | "weekly" | "reflection";
  content: object;
  mood?: number;
  linked_trade_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface PsychologyCheckin {
  id: string;
  user_id: string;
  date: string;
  confidence?: number;
  focus?: number;
  stress?: number;
  followed_rules?: boolean;
  notes?: string;
}

export interface AccountSettings {
  starting_balance: number;
  daily_loss_limit: number;
  max_drawdown: number;
  profit_target: number;
  account_name: string;
}

export const FUTURES: Record<string, number> = {
  ES: 50,
  MES: 5,
  NQ: 20,
  MNQ: 2,
  YM: 5,
  MYM: 0.5,
  RTY: 50,
  M2K: 5,
  CL: 1000,
  NG: 10000,
  GC: 100,
  SI: 5000,
  "6E": 125000,
  "6J": 12500000,
};

export const SETUP_TAGS = [
  "Breakout",
  "Pullback",
  "Reversal",
  "VWAP Reclaim",
  "ICT Concept",
  "Supply/Demand",
  "Momentum",
  "Range",
  "Gap Fill",
  "Other",
];
