export function calculateMaxDailyMinutes(
    start: number, end: number, opening: number, accrual: number, interval: number
): number {
    let drops = 0;
    for (let hr = start + 1; hr < end; hr++) {
        if ((hr - start) % interval === 0) drops++;
    }
    return opening + (drops * accrual);
}
