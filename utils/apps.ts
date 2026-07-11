import { InstalledApp } from '../modules/screen-time';

export function filterAndSortApps(
    apps: InstalledApp[], 
    trackedApps: string[], 
    searchQuery: string
): InstalledApp[] {
    return apps
        .filter((app) => app.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));
}
