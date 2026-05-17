export const DEFAULT_WINDOW_START_HOUR = 6;
export const DEFAULT_WINDOW_END_HOUR = 24;
export const DEFAULT_OPENING_BALANCE_MINUTES = 5;
export const DEFAULT_HOURLY_ACCRUAL_MINUTES = 5;
export const DEFAULT_TRACKED_APPS: string[] = [];

// Daily accrual breakdown (defaults):
// 6:00am  → +5 mins (opening balance — replaces the first hourly drop)
// 7:00am  → +5 mins (silent)
// 8:00am  → +5 mins (silent)
// ...
// 11:00pm → +5 mins (silent, last drop of the day)
// 12:00am → balance wipes, window closes
//
// Max = opening + ((windowEnd - windowStart - 1) × accrual)
// Max = 5    + (17                              × 5)       = 90 mins
