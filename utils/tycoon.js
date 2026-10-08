const fs = require('node:fs');
const path = require('node:path');
const { fetch: undiciFetch, Agent } = require('undici');
const logger = require('../services/logger');

const USER_DATA_ENDPOINTS = [
    {
        name: 'Server 1',
        baseUrl: 'http://server.tycoon.community:30120/status/',
    },
    {
        name: 'Server 5',
        baseUrl: 'http://server.tycoon.community:30125/status/',
    },
];

const SOTD_BASE_URLS = [
    'http://server.tycoon.community:30120/status/',
    'http://server.tycoon.community:30125/status/',
];

const TRUSTED_TYCOON_ORIGINS = new Set([
    ...USER_DATA_ENDPOINTS.map(endpoint =>
        new URL(endpoint.baseUrl).origin
    ),
    ...SOTD_BASE_URLS.map(baseUrl => new URL(baseUrl).origin),
]);

const TYCOON_API_KEY = process.env.TYCOON_API_KEY;
const ALLOW_INVALID_TYCOON_CERT =
    process.env.TYCOON_ALLOW_INVALID_CERT === 'true';

const tycoonDispatcher = ALLOW_INVALID_TYCOON_CERT
    ? new Agent({
        connect: {
            rejectUnauthorized: false,
        },
    })
    : undefined;

const USERS_FILE =
    process.env.USERS_FILE ??
    path.join(__dirname, '..', 'data', 'tycoon-users.json');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function tycoonFetch(url, options = {}) {
    const requestUrl = new URL(url);

    if (!TRUSTED_TYCOON_ORIGINS.has(requestUrl.origin)) {
        throw new Error(
            `Refusing to use Tycoon TLS configuration for unexpected origin: ${requestUrl.origin}`
        );
    }

    if (ALLOW_INVALID_TYCOON_CERT) {
        logger.warn(
            '[TYCOON API] TLS certificate verification is disabled for this bot session.',
            {
                service: 'tycoon-api',
                origin: requestUrl.origin,
            }
        );
    }

    return undiciFetch(url, {
        ...options,
        ...(tycoonDispatcher ? { dispatcher: tycoonDispatcher } : {}),
    });
}

/*
 * =========================
 * STREAK JOBS
 * =========================
 *
 * This is the master list of streak jobs used by:
 *
 * - /streakstatus
 * - /streaksettings
 * - streak reminders
 *
 * If another streak job is added in future, add it here.
 */
const STREAK_JOBS = {
    cabbie: '🚕 Cabbie',
    helipilot: '🚁 Heli Pilot',
    hunter: '🦌 Hunter',
    mechanic: '🔧 Mechanic',
    bus: '🚌 Bus',
    conductor: '🚆 Conductor',
    airline: '✈️ Airline',
    ems: '🚑 EMS',
    firefighter: '🚒 Firefighter',
    garbage: '🗑️ Garbage',
    courier: '📦 Courier',
    rts: '🏢 RTS',
    rts_air: '✈️ RTS Air',
    deadliest: '🦀 Deadliest Catch',
};

function wantsStreakNotification(user, streakName) {
    /*
     * Existing users will not have streakNotifications yet.
     *
     * Treat that as every notification being enabled so nobody
     * suddenly stops receiving reminders after this update.
     */
    if (!Array.isArray(user.streakNotifications)) {
        return true;
    }

    return user.streakNotifications.includes(streakName);
}

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
    let fallbackResponse;

    for (const endpoint of USER_DATA_ENDPOINTS) {
        const baseUrl =
            endpoint.baseUrl.endsWith('/')
                ? endpoint.baseUrl
                : `${endpoint.baseUrl}/`;
        const url = new URL(
            `data/${encodeURIComponent(String(tycoonUserId))}`,
            baseUrl
        );

        try {
            logger.info(
                '[TYCOON API] Trying data endpoint.',
                {
                    service: 'tycoon-api',
                    tycoonUserId,
                    baseUrl,
                    endpointName: endpoint.name,
                }
            );

            const response = await tycoonFetch(url.toString(), {
                method: 'GET',
                headers: {
                    'X-Tycoon-Key': apiKey,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10_000),
            });

            const chargesLeft =
                response.headers.get('X-Tycoon-Charges');

            if (response.status >= 400 && response.status < 500) {
                const errorBody = await response.text();

                throw new Error(
                    `API request rejected: ${response.status} ` +
                    `${response.statusText} ${errorBody}`
                );
            }

            if (!response.ok) {
                throw new Error(
                    `API server error: ${response.status} ` +
                    response.statusText
                );
            }

            const data = await response.json();
            const streaks = data?.data?.streaks ?? data?.streaks;

            const normalizedData =
                data?.data?.streaks
                    ? data
                    : streaks
                        ? {
                            ...data,
                            data: {
                                ...(data?.data ?? {}),
                                streaks,
                            },
                        }
                        : data;

            logger.info(
                '[TYCOON API] User data request succeeded.',
                {
                    service: 'tycoon-api',
                    tycoonUserId,
                    baseUrl,
                    endpointName: endpoint.name,
                    chargesLeft,
                }
            );

            if (!normalizedData?.data?.streaks) {
                logger.warn(
                    '[TYCOON API] Endpoint response does not include user streak data.',
                    {
                        service: 'tycoon-api',
                        tycoonUserId,
                        baseUrl,
                        endpointName: endpoint.name,
                    }
                );

                fallbackResponse = {
                    data: normalizedData,
                    chargesLeft,
                };

                continue;
            }

            return {
                data: normalizedData,
                chargesLeft,
            };
        } catch (error) {
            lastError = error;

            logger.error(
                '[TYCOON API] Failed to fetch user data.',
                error,
                {
                    service: 'tycoon-api',
                    tycoonUserId,
                    baseUrl,
                    endpointName: endpoint.name,
                }
            );

            if (error.message.startsWith('API request rejected:')) {
                throw error;
            }
        }
    }

    if (fallbackResponse) {
        logger.warn(
            '[TYCOON API] Returning fallback response without streak data after all endpoint attempts.',
            {
                service: 'tycoon-api',
                tycoonUserId,
            }
        );

        return fallbackResponse;
    }

    throw new Error(
        `All Tycoon data endpoints failed. ` +
        `Last error: ${lastError?.message ?? 'Unknown error'}`
    );
}

/*
 * =========================
 * SOTD
 * =========================
 */

let cachedSotd = null;
let cachedSotdFetchedAt = 0;
let cachedSotdDayKey = null;

const SOTD_CACHE_TIME = 60 * 60 * 1000;
const SOTD_ROLLOVER_DELAY = 15 * 60 * 1000;

/*
 * SOTD does not always update exactly at 00:00 UTC.
 *
 * By subtracting 15 minutes before working out the date,
 * the bot treats:
 *
 * 00:00 - 00:14 UTC = previous SOTD day
 * 00:15 onwards      = new SOTD day
 */
function getSotdDayKey() {
    const now = new Date(
        Date.now() - SOTD_ROLLOVER_DELAY
    );

    return now.toISOString().slice(0, 10);
}

async function fetchSotd(forceRefresh = false) {
    if (!TYCOON_API_KEY) {
        throw new Error(
            'TYCOON_API_KEY is missing from the environment variables'
        );
    }

    const currentDayKey = getSotdDayKey();

    const cacheAge = Date.now() - cachedSotdFetchedAt;

    const cacheIsValid =
        cachedSotd &&
        cachedSotdDayKey === currentDayKey &&
        cacheAge < SOTD_CACHE_TIME;

    if (!forceRefresh && cacheIsValid) {
        return cachedSotd;
    }

    if (
        !forceRefresh &&
        cachedSotd &&
        cachedSotdDayKey === currentDayKey
    ) {
        const now = new Date();

        if (
            now.getUTCHours() === 0 &&
            now.getUTCMinutes() < 15
        ) {
            logger.info(
                '[TYCOON API] SOTD rollover delay active - using previous cached SOTD',
                {
                    service: 'tycoon-sotd',
                    currentDayKey,
                    cachedSotdDayKey,
                }
            );

            return cachedSotd;
        }
    }

    let lastError;

    for (const baseUrl of SOTD_BASE_URLS) {
        const url = `${baseUrl}/sotd.json`;

        try {
            logger.info(
                '[TYCOON API] Trying SOTD endpoint.',
                {
                    service: 'tycoon-sotd',
                    baseUrl,
                }
            );

            const response = await tycoonFetch(url, {
                method: 'GET',
                headers: {
                    'X-Tycoon-Key': TYCOON_API_KEY,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10_000),
            });

            if (response.status >= 400 && response.status < 500) {
                const errorBody = await response.text();

                throw new Error(
                    `SOTD request rejected: ${response.status} ` +
                    `${response.statusText} ${errorBody}`
                );
            }

            if (!response.ok) {
                throw new Error(
                    `SOTD server error: ${response.status} ` +
                    response.statusText
                );
            }

            const data = await response.json();

            const sotd = {
                aptitude: String(data.aptitude ?? '').toLowerCase(),
                short: String(data.short ?? ''),
                skill: String(data.skill ?? ''),
                bonus: Number(data.bonus) || 0,
            };

            cachedSotd = sotd;
            cachedSotdFetchedAt = Date.now();
            cachedSotdDayKey = currentDayKey;

            logger.info(
                '[TYCOON API] Current SOTD fetched successfully.',
                {
                    service: 'tycoon-sotd',
                    skill: sotd.skill,
                    bonus: sotd.bonus,
                    currentDayKey,
                }
            );

            return sotd;
        } catch (error) {
            lastError = error;

            logger.error(
                '[TYCOON API] SOTD fetch failed.',
                error,
                {
                    service: 'tycoon-sotd',
                    baseUrl,
                    currentDayKey,
                }
            );

            if (error.message.startsWith('SOTD request rejected:')) {
                throw error;
            }
        }
    }

    if (cachedSotd) {
        logger.warn(
            '[TYCOON API] Using expired cached SOTD value.',
            {
                service: 'tycoon-sotd',
                currentDayKey,
                cacheAge,
            }
        );

        return cachedSotd;
    }

    throw new Error(
        `All Tycoon SOTD endpoints failed. ` +
        `Last error: ${lastError?.message ?? 'Unknown error'}`
    );
}

module.exports = {
    loadUsers,
    saveUsers,
    getStreakExpiryDate,
    formatTimeRemaining,
    fetchUserData,
    fetchSotd,
    buildStoredStreaks,
    STREAK_JOBS,
    wantsStreakNotification,
    tycoonFetch,
};
