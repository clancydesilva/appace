import { AppGroup } from '../modules/screen-time';

/**
 * Calculates the maximum theoretical daily screen time in minutes for standard budgets.
 */
export function calculateMaxDailyMinutes(
    start: number,
    end: number,
    opening: number,
    accrual: number,
    interval: number
): number {
    let drops = 0;
    for (let hr = start; hr < end; hr++) {
        if ((hr - start) % interval === 0) drops++;
    }
    return opening + (drops * accrual);
}

/**
 * Calculates the maximum theoretical daily screen time in minutes for an AppGroup
 * (supporting Standard, Compounding, and Custom presets).
 */
export function calculateGroupMaxDaily(group: AppGroup): number {
    const start = group.windowStartHour;
    const end = group.windowEndHour;
    const opening = group.openingBalanceMinutes;
    const interval = Math.max(1, group.accrualIntervalHours);

    if (group.budgetType === 'compounding') {
        const baseMins = group.compoundingBase / 60.0;
        const d = group.compoundingCoefficient;
        let total = opening;
        for (let hr = start; hr < end; hr++) {
            const hourIndex = hr - start;
            if (hourIndex % interval === 0) {
                const dropMins = baseMins + (hourIndex * d);
                total += Math.ceil(dropMins);
            }
        }
        return total;
    }

    // Standard / Custom linear calculation
    return calculateMaxDailyMinutes(start, end, opening, group.hourlyAccrualMinutes, interval);
}

/**
 * Computes status and info for the upcoming accrual drop for an AppGroup.
 */
export function calculateGroupNextDrop(
    group: AppGroup,
    now: Date = new Date()
): {
    isWithinWindow: boolean;
    minutesUntilNextDrop: number;
    hourProgress: number;
    nextDropMinutes: number;
} {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    const isWithinWindow = currentHour >= group.windowStartHour && currentHour < group.windowEndHour;
    const minutesUntilNextDrop = 60 - currentMinute;
    const hourProgress = (currentMinute * 60 + currentSecond) / 3600;

    let nextDropMinutes = group.hourlyAccrualMinutes;

    if (group.budgetType === 'compounding') {
        const nextHour = currentHour + 1;
        const hourIndex = Math.max(0, nextHour - group.windowStartHour);
        const baseMins = group.compoundingBase / 60.0;
        const d = group.compoundingCoefficient;
        nextDropMinutes = Math.ceil(baseMins + (hourIndex * d));
    }

    return {
        isWithinWindow,
        minutesUntilNextDrop,
        hourProgress,
        nextDropMinutes,
    };
}
