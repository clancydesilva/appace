import { InstalledApp } from '../modules/screen-time';

export function filterAndSortApps(
    apps: InstalledApp[], 
    trackedApps: string[], 
    searchQuery: string,
    baselineTracked: string[] = []
): InstalledApp[] {
    const filtered = apps.filter((app) => app.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered.sort((a, b) => {
        const aTracked = baselineTracked.includes(a.package);
        const bTracked = baselineTracked.includes(b.package);
        
        if (aTracked && !bTracked) return -1;
        if (!aTracked && bTracked) return 1;
        return a.name.localeCompare(b.name);
    });
}
