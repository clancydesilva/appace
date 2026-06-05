export interface AppaceSettings {
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  budgetType: string;
  accrualIntervalHours: number;
}

export interface InstalledApp {
  name: string;
  package: string;
}

export interface TelemetryLog {
  id: number;
  timestamp: number;
  event: string;
  batteryPercent: number;
  isCharging: boolean;
  details: string;
}
