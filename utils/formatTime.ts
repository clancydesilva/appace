export function formatHourLabel(h: number, verbose = false): string {
    if (h === 0 || h === 24) return verbose ? '12:00am (Midnight)' : '12:00am';
    if (h === 12) return verbose ? '12:00pm (Noon)' : '12:00pm';
    return h > 12 ? `${h - 12}:00pm` : `${h}:00am`;
}
