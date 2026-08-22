import { create } from 'zustand';
import ScreenTime, { AppaceSettings, AppGroup, CreateGroupInput, InstalledApp, TelemetryLog } from '../modules/screen-time';
import { BudgetType } from '../constants/defaults';

interface TimerStore {
  balanceSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  budgetType: BudgetType;
  accrualIntervalHours: number;
  trackedApps: string[];
  installedApps: InstalledApp[];
  isWithinWindow: boolean;
  accessibilityEnabled: boolean;
  batteryOptimizationIgnored: boolean;
  usageAccessGranted: boolean;
  onboardingCompleted: boolean;
  telemetryLogs: TelemetryLog[];
  appGroups: AppGroup[];

  checkOnboarding: () => Promise<boolean>;
  setOnboardingCompleted: (completed: boolean) => Promise<void>;
  fetchBalance: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchTrackedApps: () => Promise<void>;
  fetchInstalledApps: () => Promise<void>;
  checkWindow: () => Promise<void>;
  checkAccessibility: () => Promise<void>;
  checkBatteryOptimization: () => Promise<void>;
  checkUsageAccess: () => Promise<void>;
  setWindowHours: (start: number, end: number) => Promise<void>;
  setOpeningBalance: (mins: number) => Promise<void>;
  setHourlyAccrual: (mins: number) => Promise<void>;
  setBudgetType: (type: BudgetType) => Promise<void>;
  setAccrualInterval: (hours: number) => Promise<void>;
  setTrackedApps: (pkgs: string[]) => Promise<void>;
  saveSettings: (start: number, end: number, opening: number, accrual: number, type: BudgetType, interval: number) => Promise<void>;
  openAccessibilitySettings: () => Promise<void>;
  openBatteryOptimizationSettings: () => Promise<void>;
  openUsageAccessSettings: () => Promise<void>;
  startService: () => Promise<void>;
  fetchTelemetryLogs: () => Promise<void>;
  clearTelemetryLogs: () => Promise<void>;
  fetchAppGroups: () => Promise<void>;
  createAppGroup: (input: CreateGroupInput) => Promise<number>;
  updateGroupSettings: (groupId: number, input: CreateGroupInput) => Promise<void>;
  deleteAppGroup: (groupId: number) => Promise<void>;
  addAppToGroup: (packageName: string, groupId: number) => Promise<void>;
  removeAppFromGroup: (packageName: string) => Promise<void>;
  applyEmergencyTopUp: (groupId: number, seconds: number) => Promise<number>;
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
  usageAccessGranted: false,
  onboardingCompleted: false,
  telemetryLogs: [],
  appGroups: [],

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
      budgetType: (s.budgetType as BudgetType) || 'custom',
      accrualIntervalHours: s.accrualIntervalHours || 1,
    });
  },

  fetchTrackedApps: async () => set({ trackedApps: await ScreenTime.getTrackedApps() }),
  fetchInstalledApps: async () => set({ installedApps: await ScreenTime.getInstalledApps() }),
  checkWindow: async () => set({ isWithinWindow: await ScreenTime.isWithinWindow() }),
  checkAccessibility: async () => set({ accessibilityEnabled: await ScreenTime.isAccessibilityEnabled() }),
  checkBatteryOptimization: async () => set({ batteryOptimizationIgnored: await ScreenTime.isBatteryOptimizationIgnored() }),
  checkUsageAccess: async () => set({ usageAccessGranted: await ScreenTime.isUsageAccessGranted() }),

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
  saveSettings: async (start, end, opening, accrual, type, interval) => {
    await ScreenTime.updateSettings(start, end, opening, accrual, type, interval);
    set({
      windowStartHour: start,
      windowEndHour: end,
      openingBalanceMinutes: opening,
      hourlyAccrualMinutes: accrual,
      budgetType: type,
      accrualIntervalHours: interval,
    });
  },
  openAccessibilitySettings: async () => ScreenTime.openAccessibilitySettings(),
  openBatteryOptimizationSettings: async () => ScreenTime.openBatteryOptimizationSettings(),
  openUsageAccessSettings: async () => ScreenTime.openUsageAccessSettings(),
  startService: async () => ScreenTime.startForegroundService(),
  fetchTelemetryLogs: async () => set({ telemetryLogs: await ScreenTime.getTelemetryLogs() }),
  clearTelemetryLogs: async () => {
    await ScreenTime.clearTelemetryLogs();
    set({ telemetryLogs: [] });
  },
  fetchAppGroups: async () => set({ appGroups: await ScreenTime.getAppGroups() }),
  createAppGroup: async (input: CreateGroupInput): Promise<number> => {
    const newId = await ScreenTime.createAppGroup(input);
    await get().fetchAppGroups();
    return newId;
  },
  updateGroupSettings: async (groupId: number, input: CreateGroupInput): Promise<void> => {
    await ScreenTime.updateGroupSettings(groupId, input);
    await get().fetchAppGroups();
  },
  deleteAppGroup: async (groupId: number): Promise<void> => {
    await ScreenTime.deleteAppGroup(groupId);
    await get().fetchAppGroups();
  },
  addAppToGroup: async (packageName: string, groupId: number): Promise<void> => {
    await ScreenTime.addAppToGroup(packageName, groupId);
    await get().fetchAppGroups();
  },
  removeAppFromGroup: async (packageName: string): Promise<void> => {
    await ScreenTime.removeAppFromGroup(packageName);
    await get().fetchAppGroups();
  },
  applyEmergencyTopUp: async (groupId: number, seconds: number): Promise<number> => {
    const granted = await ScreenTime.applyEmergencyTopUp(groupId, seconds);
    await get().fetchAppGroups();
    return granted;
  },
}));
