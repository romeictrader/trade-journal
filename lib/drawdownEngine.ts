/**
 * Drawdown Tracking Engine
 *
 * Supports 8 drawdown types:
 * 1 = Intraday Trailing Unrealized  (floor trails peak equity including open P&L)
 * 2 = Intraday Trailing Realized    (floor trails peak closed balance)
 * 3 = EOD Trailing                  (floor only updates at end of day)
 * 4 = Static                        (floor fixed from day one, never moves)
 * 5 = EOD Trailing → Locks to Static (EOD trailing until lock trigger hit)
 * 6 = Relative                      (percentage of current balance)
 * 7 = Buffer Zone                   (no floor until buffer earned)
 * 8 = Daily Loss Limit overlay      (overlay on top of any other type)
 */

export interface DrawdownConfig {
  drawdownType: number;       // 1-8
  startingBalance: number;
  drawdownAmount: number;     // max_drawdown field
  drawdownPercent?: number;   // type 6 only
  lockTriggerBalance?: number; // type 5 only
  bufferTarget?: number;      // type 7 only
  dailyLossLimit?: number;    // type 8 overlay, or account DLL
}

export interface DrawdownResult {
  floor: number;
  breached: boolean;
  dllBreached: boolean;
  isLocked: boolean;          // type 5: whether floor has locked
  bufferMet: boolean;         // type 7: whether buffer has been earned
  bufferRemaining: number;    // type 7: how much buffer left to earn
  currentDD: number;          // how much drawdown consumed
  remaining: number;          // distance from balance to floor
  peakBalance: number;        // highest balance reached (relevant type)
  dailyLoss: number;          // today's loss amount
  typeName: string;           // human-readable type name
}

export const DRAWDOWN_TYPES: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Intraday Trailing Drawdown", short: "Intraday Trailing" },
  { value: 2, label: "EOD Trailing", short: "EOD Trailing" },
  { value: 3, label: "Static", short: "Static" },
  { value: 4, label: "EOD Trailing → Locks", short: "EOD → Lock" },
  { value: 5, label: "Relative (% of Balance)", short: "Relative %" },
  { value: 6, label: "Buffer Zone", short: "Buffer Zone" },
  { value: 7, label: "Daily Loss Limit Only", short: "DLL Only" },
];

interface Trade {
  date: string;
  pnl: number;
}

/**
 * Calculate drawdown state from account config and trade history.
 * Trades should be sorted by date ascending.
 */
export function calculateDrawdown(
  config: DrawdownConfig,
  trades: Trade[],
  today: string, // YYYY-MM-DD
): DrawdownResult {
  const { drawdownType, startingBalance, drawdownAmount } = config;

  let floor = startingBalance - drawdownAmount;
  let peakBalance = startingBalance;
  let isLocked = false;
  let bufferMet = false;
  let balance = startingBalance;

  // Build daily P&L
  const dailyPnl: Record<string, number> = {};
  for (const t of trades) {
    dailyPnl[t.date] = (dailyPnl[t.date] ?? 0) + t.pnl;
  }
  const sortedDates = Object.keys(dailyPnl).sort();

  // Today's P&L
  const todayPnl = dailyPnl[today] ?? 0;
  const todayLoss = Math.abs(Math.min(todayPnl, 0));

  // Running balance through each trade for intraday types
  let runningBal = startingBalance;

  switch (drawdownType) {
    case 1: // Intraday Trailing Drawdown — trail peak balance trade by trade
      for (const t of trades) {
        runningBal += t.pnl;
        if (runningBal > peakBalance) peakBalance = runningBal;
      }
      floor = peakBalance - drawdownAmount;
      balance = runningBal;
      break;

    case 2: // EOD Trailing — trail highest end-of-day balance
      for (const date of sortedDates) {
        runningBal += dailyPnl[date];
        if (runningBal > peakBalance) peakBalance = runningBal;
      }
      floor = peakBalance - drawdownAmount;
      balance = runningBal;
      break;

    case 3: // Static — floor is fixed forever
      floor = startingBalance - drawdownAmount;
      for (const date of sortedDates) runningBal += dailyPnl[date];
      balance = runningBal;
      peakBalance = balance;
      break;

    case 4: // EOD Trailing → Locks to Static
    {
      const lockTrigger = config.lockTriggerBalance ?? (startingBalance + drawdownAmount);
      for (const date of sortedDates) {
        runningBal += dailyPnl[date];
        if (!isLocked) {
          if (runningBal > peakBalance) peakBalance = runningBal;
          floor = peakBalance - drawdownAmount;
          if (runningBal >= lockTrigger) {
            isLocked = true;
            floor = Math.min(peakBalance - drawdownAmount, startingBalance);
          }
        }
      }
      balance = runningBal;
      break;
    }

    case 5: // Relative — percentage of current balance
    {
      const pct = config.drawdownPercent ?? 0.04;
      for (const date of sortedDates) runningBal += dailyPnl[date];
      balance = runningBal;
      floor = balance * (1 - pct);
      peakBalance = balance;
      break;
    }

    case 6: // Buffer Zone — no floor until buffer earned
    {
      const bufferTarget = config.bufferTarget ?? drawdownAmount;
      for (const date of sortedDates) runningBal += dailyPnl[date];
      balance = runningBal;
      const totalProfit = balance - startingBalance;
      bufferMet = totalProfit >= bufferTarget;
      if (bufferMet) {
        floor = startingBalance; // static floor at starting balance after buffer met
      } else {
        floor = -Infinity; // no breach possible
      }
      peakBalance = balance;
      break;
    }

    case 7: // Daily Loss Limit Only — no trailing floor, just DLL
      for (const date of sortedDates) runningBal += dailyPnl[date];
      balance = runningBal;
      floor = -Infinity; // no max drawdown floor
      peakBalance = balance;
      break;

    default: // fallback to EOD trailing (type 2)
      for (const date of sortedDates) {
        runningBal += dailyPnl[date];
        if (runningBal > peakBalance) peakBalance = runningBal;
      }
      floor = peakBalance - drawdownAmount;
      balance = runningBal;
  }

  // Cap floor: for trailing types (1,2,4), floor should not exceed startingBalance
  if ([1, 2, 4].includes(drawdownType) && !isLocked) {
    floor = Math.min(floor, startingBalance);
  }

  const breached = floor !== -Infinity && balance <= floor;
  const remaining = floor === -Infinity ? Infinity : Math.max(0, balance - floor);

  // Effective peak for DD consumed calculation
  const effectivePeak = [1, 2, 4].includes(drawdownType)
    ? Math.min(peakBalance, (isLocked ? floor : startingBalance) + drawdownAmount)
    : balance;
  const currentDD = drawdownType === 3
    ? Math.max(0, startingBalance - balance)
    : drawdownType === 5
      ? 0
      : Math.max(0, effectivePeak - balance);

  // DLL check
  const dll = config.dailyLossLimit ?? 0;
  const dllBreached = dll > 0 && todayLoss >= dll;

  // Buffer remaining
  const bufferRemaining = drawdownType === 6
    ? Math.max(0, (config.bufferTarget ?? drawdownAmount) - Math.max(0, balance - startingBalance))
    : 0;

  const typeName = DRAWDOWN_TYPES.find(t => t.value === drawdownType)?.label ?? "Unknown";

  return {
    floor: floor === -Infinity ? 0 : floor,
    breached,
    dllBreached,
    isLocked,
    bufferMet,
    bufferRemaining,
    currentDD,
    remaining: remaining === Infinity ? 0 : remaining,
    peakBalance,
    dailyLoss: todayLoss,
    typeName,
  };
}
