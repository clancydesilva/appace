import { NativeModule, requireNativeModule } from 'expo';
import { AppaceSettings, InstalledApp, TelemetryLog } from './ExpoScreenTime.types';

declare class ExpoScreenTimeModule extends NativeModule {
  getBalance(): Promise<number>;
  getSettings(): Promise<AppaceSettings>;
  isWithinWindow(): Promise<boolean>;
  setWindowHours(start: number, end: number): Promise<void>;
  setOpeningBalance(minutes: number): Promise<void>;
  setHourlyAccrual(minutes: number): Promise<void>;
  setBudgetType(type: string): Promise<void>;
  setAccrualInterval(hours: number): Promise<void>;
  updateSettings(start: number, end: number, opening: number, accrual: number, type: string, interval: number): Promise<void>;
  isOnboardingCompleted(): Promise<boolean>;
  setOnboardingCompleted(completed: boolean): Promise<void>;
  setTrackedApps(packages: string[]): Promise<void>;
  getTrackedApps(): Promise<string[]>;
  getInstalledApps(): Promise<InstalledApp[]>;
  isAccessibilityEnabled(): Promise<boolean>;
  openAccessibilitySettings(): Promise<void>;
  isBatteryOptimizationIgnored(): Promise<boolean>;
  openBatteryOptimizationSettings(): Promise<void>;
  startForegroundService(): Promise<void>;
  getTelemetryLogs(): Promise<TelemetryLog[]>;
  clearTelemetryLogs(): Promise<void>;
  isDebug: boolean;
}

export default requireNativeModule<ExpoScreenTimeModule>('ExpoScreenTime');
