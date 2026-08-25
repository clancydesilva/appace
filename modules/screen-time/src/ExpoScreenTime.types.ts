/**
 * User-configurable budget settings, mirroring the `BalanceEntity` fields in Room.
 * All hour values are 24-hour (0–23). All minute values are whole minutes.
 */
export interface AppaceSettings {
  /** Hour at which the earning window opens each day (inclusive, 0–23). Default: 6. */
  windowStartHour: number;
  /** Hour at which the earning window closes each day (exclusive, 0–23). Default: 24. */
  windowEndHour: number;
  /** Balance granted once at window-open each day, in minutes. Default: 5. */
  openingBalanceMinutes: number;
  /** Time added to the balance every `accrualIntervalHours` hours within the window, in minutes. Default: 5. */
  hourlyAccrualMinutes: number;
  /**
   * Accrual formula type. Currently only `"standard"` and `"custom"` are behaviourally active.
   * `"compounding"` is reserved for future implementation — see `adr/003-accrual-formula-choice.md`.
   */
  budgetType: string;
  /** How many hours must pass between each accrual drop. Default: 1 (every hour). */
  accrualIntervalHours: number;
}

/** A launchable app returned by `getInstalledApps()`, filtered to user-facing launcher entries. */
export interface InstalledApp {
  /** Human-readable app label (e.g. "Instagram"). */
  name: string;
  /** Android package name (e.g. "com.instagram.android"). Used as the stable identifier. */
  package: string;
}

/**
 * A single row from the on-device telemetry log (`TelemetryEntity` in Room).
 * All events are local-only — no data is uploaded off-device.
 * See `TelemetryLogger.log()` for the full list of event types.
 */
export interface TelemetryLog {
  /** Auto-incremented Room primary key. */
  id: number;
  /** Unix timestamp of the event in milliseconds. */
  timestamp: number;
  /** Short event category string (e.g. "TICK", "DEDUCT", "BLOCK", "RAW_EVENT"). */
  event: string;
  /** Battery percentage at the time of the event, or -1 if unavailable. */
  batteryPercent: number;
  /** Whether the device was charging at the time of the event. */
  isCharging: boolean;
  /** Human-readable detail string for the event. */
  details: string;
}

/** A fully-hydrated app group as returned by getAppGroups(). */
export interface AppGroup {
  id: number;
  name: string;
  ordinal: number;
  balanceSeconds: number;
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  accrualIntervalHours: number;
  budgetType: 'standard' | 'compounding' | 'custom';
  compoundingBase: number;        // seconds
  compoundingCoefficient: number; // float
  compoundingStreak: number;      // active non-use streak (hours)
  emergencyBudgetSeconds: number;
  emergencyUsedSeconds: number;
  emergencyRemainingSeconds: number;
  packages: string[];             // packageNames of all member apps
}

/** Input shape for createAppGroup() and updateGroupSettings(). */
export interface CreateGroupInput {
  name: string;
  packages: string[];
  windowStartHour: number;
  windowEndHour: number;
  openingBalanceMinutes: number;
  hourlyAccrualMinutes: number;
  accrualIntervalHours: number;
  budgetType: 'standard' | 'compounding' | 'custom';
  compoundingBase: number;        // seconds
  compoundingCoefficient: number;
  emergencyBudgetMinutes: number;
}
