import { create } from 'zustand';
import ScreenTime, { AppaceSettings, InstalledApp, TelemetryLog } from '../modules/screen-time';

interface TimerStore {
  balanceSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  budgetType: string;
  accrualIntervalHours: number;
  trackedApps: string[];
  installedApps: InstalledApp[];
  isWithinWindow: boolean;
  accessibilityEnabled: boolean;
  batteryOptimizationIgnored: boolean;
  onboardingCompleted: boolean;
  telemetryLogs: TelemetryLog[];

  checkOnboarding: () => Promise<boolean>;
  setOnboardingCompleted: (completed: boolean) => Promise<void>;
  fetchBalance: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchTrackedApps: () => Promise<void>;
  fetchInstalledApps: () => Promise<void>;
  checkWindow: () => Promise<void>;
  checkAccessibility: () => Promise<void>;
  checkBatteryOptimization: () => Promise<void>;
  setWindowHours: (start: number, end: number) => Promise<void>;
  setOpeningBalance: (mins: number) => Promise<void>;
  setHourlyAccrual: (mins: number) => Promise<void>;
  setBudgetType: (type: string) => Promise<void>;
  setAccrualInterval: (hours: number) => Promise<void>;
  setTrackedApps: (pkgs: string[]) => Promise<void>;
  openAccessibilitySettings: () => Promise<void>;
  openBatteryOptimizationSettings: () => Promise<void>;
  startService: () => Promise<void>;
  fetchTelemetryLogs: () => Promise<void>;
  clearTelemetryLogs: () => Promise<void>;

  maxDailyMinutes: () => number;
  minutesUntilNextDrop: () => number;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  balanceSeconds: 0,
  windowStartHour: 6,
  windowEndHour: 24,
  openingBalanceMinutes: 5,
  hourlyAccrualMinutes: 5,
  budgetType: 'custom',
  accrualIntervalHours: 1,
  trackedApps: [],
  installedApps: [],
  isWithinWindow: false,
  accessibilityEnabled: false,
  batteryOptimizationIgnored: false,
  onboardingCompleted: false,
  telemetryLogs: [],

  checkOnboarding: async () => {
    const completed = await ScreenTime.isOnboardingCompleted();
    set({ onboardingCompleted: completed });
    return completed;
  },
  setOnboardingCompleted: async (completed) => {
    await ScreenTime.setOnboardingCompleted(completed);
    set({ onboardingCompleted: completed });
  },

  fetchBalance: async () => set({ balanceSeconds: await ScreenTime.getBalance() }),

  fetchSettings: async () => {
    const s: AppaceSettings = await ScreenTime.getSettings();
    set({
      windowStartHour: s.windowStartHour,
      windowEndHour: s.windowEndHour,
      openingBalanceMinutes: s.openingBalanceMinutes,
      hourlyAccrualMinutes: s.hourlyAccrualMinutes,
      budgetType: s.budgetType || 'custom',
      accrualIntervalHours: s.accrualIntervalHours || 1,
    });
  },

  fetchTrackedApps: async () => set({ trackedApps: await ScreenTime.getTrackedApps() }),
  fetchInstalledApps: async () => set({ installedApps: await ScreenTime.getInstalledApps() }),
  checkWindow: async () => set({ isWithinWindow: await ScreenTime.isWithinWindow() }),
  checkAccessibility: async () => set({ accessibilityEnabled: await ScreenTime.isAccessibilityEnabled() }),
  checkBatteryOptimization: async () => set({ batteryOptimizationIgnored: await ScreenTime.isBatteryOptimizationIgnored() }),

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
  setBudgetType: async (type) => {
    await ScreenTime.setBudgetType(type);
    set({ budgetType: type });
  },
  setAccrualInterval: async (hours) => {
    await ScreenTime.setAccrualInterval(hours);
    set({ accrualIntervalHours: hours });
  },
  setTrackedApps: async (pkgs) => {
    await ScreenTime.setTrackedApps(pkgs);
    set({ trackedApps: pkgs });
  },
  openAccessibilitySettings: async () => ScreenTime.openAccessibilitySettings(),
  openBatteryOptimizationSettings: async () => ScreenTime.openBatteryOptimizationSettings(),
  startService: async () => ScreenTime.startForegroundService(),
  fetchTelemetryLogs: async () => set({ telemetryLogs: await ScreenTime.getTelemetryLogs() }),
  clearTelemetryLogs: async () => {
    await ScreenTime.clearTelemetryLogs();
    set({ telemetryLogs: [] });
  },

  maxDailyMinutes: () => {
    const { windowStartHour, windowEndHour, openingBalanceMinutes, hourlyAccrualMinutes, accrualIntervalHours } = get();
    let drops = 0;
    for (let hr = windowStartHour + 1; hr < windowEndHour; hr++) {
      if ((hr - windowStartHour) % accrualIntervalHours === 0) {
        drops++;
      }
    }
    return openingBalanceMinutes + (drops * hourlyAccrualMinutes);
  },

  minutesUntilNextDrop: () => {
    const { windowStartHour, accrualIntervalHours } = get();
    const now = new Date();
    const currentHour = now.getHours();
    
    // Find hours since start to figure out when the next interval boundary is
    const hoursSinceStart = currentHour - windowStartHour;
    if (hoursSinceStart < 0) {
      // If we are before windowStartHour, the next drop is at windowStartHour
      // which is opening balance.
      return 0; // Handled by standard screen logic
    }
    
    const remainingHoursInInterval = accrualIntervalHours - (hoursSinceStart % accrualIntervalHours);
    const minsToNextHour = 60 - now.getMinutes();
    return ((remainingHoursInInterval - 1) * 60) + minsToNextHour;
  },
}));
