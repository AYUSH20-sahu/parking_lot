const HOUR_MS = 1000 * 60 * 60;

export function calculateDurationHours(entryTime, exitTime) {
    const elapsedMs = new Date(exitTime).getTime() - new Date(entryTime).getTime();
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
        throw new Error('Invalid entry or exit time');
    }

    return Math.max(1, Math.ceil(elapsedMs / HOUR_MS));
}

export function calculateFare(entryTime, exitTime) {
    const hours = calculateDurationHours(entryTime, exitTime);

    if (hours <= 3) return 30;
    if (hours <= 6) return 85;
    return 120;
}