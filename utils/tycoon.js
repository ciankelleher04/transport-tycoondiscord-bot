const fs = require('node:fs');
const path = require('node:path');

const API_BASE_URLS = [
    'https://api.tycoon.community',
    'https://apibeta.tycoon.community',
];

const USERS_FILE =
    process.env.USERS_FILE ??
    path.join(__dirname, '..', 'data', 'tycoon-users.json');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function buildStoredStreaks(apiStreaks, oldStoredStreaks = {}) {
    const storedStreaks = {};

    for (const [key, info] of Object.entries(apiStreaks)) {
        if (info.current <= 0) continue;

        const expiryDate = getStreakExpiryDate(info.last_updated_day);
        const expiresAt = expiryDate.toISOString();

        const oldStreak = oldStoredStreaks[key];

        const remindersSent =
            oldStreak?.expiresAt === expiresAt
                ? oldStreak.remindersSent ?? []
                : [];

        storedStreaks[key] = {
            current: info.current,
            record: info.record,
            lastUpdatedDay: info.last_updated_day,
            expiresAt,
            remindersSent,
        };
    }

    return storedStreaks;
}

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) return {};

    return JSON.parse(
        fs.readFileSync(USERS_FILE, 'utf8')
    );
}

function saveUsers(users) {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(users, null, 2),
        'utf8'
    );
}

function getStreakExpiryDate(lastUpdatedDay) {
    return new Date((lastUpdatedDay + 3) * MS_PER_DAY);
}

function formatTimeRemaining(expiryDate) {
    const now = new Date();
    const diffMs = expiryDate - now;

    if (diffMs <= 0) return 'Expired';

    const totalMinutes = Math.floor(diffMs / (60 * 1000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    }

    return `${hours}h ${minutes}m`;
}

async function fetchUserData(apiKey, tycoonUserId) {
    let lastError;

    for (const baseUrl of API_BASE_URLS) {
        const url = `${baseUrl}/data/${tycoonUserId}`;

        try {
            console.log(
                `[TYCOON API] Trying ${baseUrl} for user ${tycoonUserId}`
            );

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Tycoon-Key': apiKey,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10_000),
            });

            const chargesLeft =
                response.headers.get('X-Tycoon-Charges');

            /*
             * A 4xx response usually means the request, API key,
             * user ID or available charges are the problem.
             * Retrying against beta would probably return the same error.
             */
            if (response.status >= 400 && response.status < 500) {
                const errorBody = await response.text();

                throw new Error(
                    `API request rejected: ${response.status} ` +
                    `${response.statusText} ${errorBody}`
                );
            }

            /*
             * Server-side errors will move on to the beta API.
             */
            if (!response.ok) {
                throw new Error(
                    `API server error: ${response.status} ` +
                    response.statusText
                );
            }

            const data = await response.json();

            console.log(
                `[TYCOON API] Success using ${baseUrl} ` +
                `for user ${tycoonUserId}`
            );

            return {
                data,
                chargesLeft,
            };
        } catch (error) {
            lastError = error;

            console.error(
                `[TYCOON API] Failed using ${baseUrl} ` +
                `for user ${tycoonUserId}:`,
                error.message
            );

            /*
             * Do not retry beta when the API successfully responded
             * with a client-side 4xx error.
             */
            if (error.message.startsWith('API request rejected:')) {
                throw error;
            }

            /*
             * Otherwise, the loop continues and tries the next API.
             */
        }
    }

    throw new Error(
        `Main and beta Tycoon APIs both failed. ` +
        `Last error: ${lastError?.message ?? 'Unknown error'}`
    );
}

module.exports = {
    loadUsers,
    saveUsers,
    getStreakExpiryDate,
    formatTimeRemaining,
    fetchUserData,
    buildStoredStreaks,
};