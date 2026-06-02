import { NativeModule, requireNativeModule } from 'expo';
import { AppaceSettings, InstalledApp } from './ExpoScreenTime.types';

declare class ExpoScreenTimeModule extends NativeModule {
  getBalance(): Promise<number>;
  getSettings(): Promise<AppaceSettings>;
  isWithinWindow(): Promise<boolean>;
  setWindowHours(start: number, end: number): Promise<void>;
  setOpeningBalance(minutes: number): Promise<void>;
  setHourlyAccrual(minutes: number): Promise<void>;
  setTrackedApps(packages: string[]): Promise<void>;
  getTrackedApps(): Promise<string[]>;
  getInstalledApps(): Promise<InstalledApp[]>;
  isAccessibilityEnabled(): Promise<boolean>;
  openAccessibilitySettings(): Promise<void>;
  isBatteryOptimizationIgnored(): Promise<boolean>;
  openBatteryOptimizationSettings(): Promise<void>;
  startForegroundService(): Promise<void>;
}

export default requireNativeModule<ExpoScreenTimeModule>('ExpoScreenTime');
