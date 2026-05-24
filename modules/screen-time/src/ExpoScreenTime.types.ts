export interface AppaceSettings {
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
}

export interface InstalledApp {
  name: string;
  package: string;
}
