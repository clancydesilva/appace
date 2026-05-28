import { create } from 'zustand';
import ScreenTime, { AppaceSettings, InstalledApp } from '../modules/screen-time';

interface TimerStore {
  balanceSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  trackedApps: string[];
  installedApps: InstalledApp[];
  isWithinWindow: boolean;
  accessibilityEnabled: boolean;

  fetchBalance: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchTrackedApps: () => Promise<void>;
  fetchInstalledApps: () => Promise<void>;
  checkWindow: () => Promise<void>;
  checkAccessibility: () => Promise<void>;
  setWindowHours: (start: number, end: number) => Promise<void>;
  setOpeningBalance: (mins: number) => Promise<void>;
  setHourlyAccrual: (mins: number) => Promise<void>;
  setTrackedApps: (pkgs: string[]) => Promise<void>;
  openAccessibilitySettings: () => Promise<void>;
  startService: () => Promise<void>;

  maxDailyMinutes: () => number;  // opening + ((hours-1) x accrual)
  minutesUntilNextDrop: () => number;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  balanceSeconds: 0,
  windowStartHour: 6,
  windowEndHour: 24,
  openingBalanceMinutes: 5,
  hourlyAccrualMinutes: 5,
  trackedApps: [],
  installedApps: [],
  isWithinWindow: false,
  accessibilityEnabled: false,

  fetchBalance: async () => set({ balanceSeconds: await ScreenTime.getBalance() }),

  fetchSettings: async () => {
    const s: AppaceSettings = await ScreenTime.getSettings();
    set({
      windowStartHour: s.windowStartHour,
      windowEndHour: s.windowEndHour,
      openingBalanceMinutes: s.openingBalanceMinutes,
      hourlyAccrualMinutes: s.hourlyAccrualMinutes,
    });
  },

  fetchTrackedApps: async () => set({ trackedApps: await ScreenTime.getTrackedApps() }),
  fetchInstalledApps: async () => set({ installedApps: await ScreenTime.getInstalledApps() }),
  checkWindow: async () => set({ isWithinWindow: await ScreenTime.isWithinWindow() }),
  checkAccessibility: async () => set({ accessibilityEnabled: await ScreenTime.isAccessibilityEnabled() }),

  setWindowHours: async (start, end) => {
    await ScreenTime.setWindowHours(start, end);
    set({ windowStartHour: start, windowEndHour: end });
  },
  setOpeningBalance: async (mins) => {
    await ScreenTime.setOpeningBalance(mins);
    set({ openingBalanceMinutes: mins });
  },
  setHourlyAccrual: async (mins) => {
    await ScreenTime.setHourlyAccrual(mins);
    set({ hourlyAccrualMinutes: mins });
  },
  setTrackedApps: async (pkgs) => {
    await ScreenTime.setTrackedApps(pkgs);
    set({ trackedApps: pkgs });
  },
  openAccessibilitySettings: async () => ScreenTime.openAccessibilitySettings(),
  startService: async () => ScreenTime.startForegroundService(),

  maxDailyMinutes: () => {
    const { windowStartHour, windowEndHour, openingBalanceMinutes, hourlyAccrualMinutes } = get();
    const hours = windowEndHour - windowStartHour;
    return openingBalanceMinutes + ((hours - 1) * hourlyAccrualMinutes); // 5 + (17x5) = 90
  },

  minutesUntilNextDrop: () => 60 - new Date().getMinutes(),
}));
