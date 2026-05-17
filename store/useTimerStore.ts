import { create } from 'zustand';

interface TimerStore {
  balanceSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  trackedApps: string[];
  isWithinWindow: boolean;
  // Max balance possible today:
  // opening + ((hours - 1) × accrual)
  // Opening balance replaces the first hourly drop — not additive to it.
  maxDailyMinutes: () => number;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  balanceSeconds: 0,
  windowStartHour: 6,
  windowEndHour: 24,
  openingBalanceMinutes: 5,
  hourlyAccrualMinutes: 5,
  trackedApps: [],
  isWithinWindow: false,

  maxDailyMinutes: () => {
    const { windowStartHour, windowEndHour, openingBalanceMinutes, hourlyAccrualMinutes } = get();
    const hours = windowEndHour - windowStartHour; // e.g. 24 - 6 = 18
    return openingBalanceMinutes + ((hours - 1) * hourlyAccrualMinutes); // 5 + (17 × 5) = 90
  },
}));
