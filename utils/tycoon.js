const fs = require('node:fs');

const BASE_API_URL = 'https://api.tycoon.community';
const path = require("path");

const USERS_FILE = path.join(__dirname, "..", "data", "tycoon-users.json");

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
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(users, null, 2),
        "utf8"
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

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m`;
}

async function fetchUserData(apiKey, tycoonUserId) {
    const response = await fetch(`${BASE_API_URL}/data/${tycoonUserId}`, {
        method: 'GET',
        headers: {
            'X-Tycoon-Key': apiKey,
            'Content-Type': 'application/json',
        },
    });

    function buildStoredStreaks(apiStreaks) {
        const storedStreaks = {};

        for (const [key, info] of Object.entries(apiStreaks)) {
            if (info.current <= 0) continue;

            const expiryDate = getStreakExpiryDate(info.last_updated_day);

            storedStreaks[key] = {
                current: info.current,
                record: info.record,
                lastUpdatedDay: info.last_updated_day,
                expiresAt: expiryDate.toISOString(),
                remindersSent: [],
            };
        }

        return storedStreaks;
    }

    const chargesLeft = response.headers.get('X-Tycoon-Charges');

    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
        data,
        chargesLeft,
    };
}

module.exports = {
    loadUsers,
    saveUsers,
    getStreakExpiryDate,
    formatTimeRemaining,
    fetchUserData,
    buildStoredStreaks,
};