import { InstalledApp } from '../modules/screen-time';

export function filterAndSortApps(
    apps: InstalledApp[], 
    trackedApps: string[], 
    searchQuery: string
): InstalledApp[] {
    return apps
        .filter((app) => app.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            const aTracked = trackedApps.includes(a.package);
            const bTracked = trackedApps.includes(b.package);
            if (aTracked && !bTracked) return -1;
            if (!aTracked && bTracked) return 1;
            return a.name.localeCompare(b.name);
        });
}
