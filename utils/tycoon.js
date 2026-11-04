const fs = require('node:fs');
const path = require('node:path');
const { fetch: undiciFetch } = require('undici');
const logger = require('../services/logger');
const {
    recordServerResult,
    recordApiResult,
} = require('./apiMonitor');

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
    'http://server.tycoon.community:30120/status',
    'http://server.tycoon.community:30125/status',
];

const TRUSTED_TYCOON_ORIGINS = new Set([
    ...USER_DATA_ENDPOINTS.map(endpoint =>
        new URL(endpoint.baseUrl).origin
    ),
    ...SOTD_BASE_URLS.map(baseUrl => new URL(baseUrl).origin),
]);

const TYCOON_API_KEY = process.env.TYCOON_API_KEY;

const USERS_FILE =
    process.env.USERS_FILE ??
    path.join(__dirname, '..', 'data', 'tycoon-users.json');
const SOTD_CACHE_FILE =
    process.env.SOTD_CACHE_FILE ??
    path.join('/data', 'sotd.json');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function tycoonFetch(url, options = {}) {
    const requestUrl = new URL(url);

    if (!TRUSTED_TYCOON_ORIGINS.has(requestUrl.origin)) {
        throw new Error(
            `Refusing to use Tycoon TLS configuration for unexpected origin: ${requestUrl.origin}`
        );
    }

    /*
     * The Transport Tycoon status endpoints are intentionally HTTP because
     * the provider's HTTPS certificate previously expired. Do not switch
     * these URLs back to HTTPS without confirming the certificate is valid.
     * No TLS bypass is configured, so future HTTPS requests use normal
     * certificate verification.
     */
    return undiciFetch(url, options);
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

            // Record successful API request
            recordServerResult(endpoint.name, true);
            recordApiResult(true, endpoint.name);

            return {
                data: normalizedData,
                chargesLeft,
            };

        } catch (error) {
            lastError = error;

            // Classify the API failure without changing fallback behaviour.
            let errorType = 'network_or_other_error';

            if (error.message.startsWith('API request rejected:')) {
                errorType = 'http_4xx';
            } else if (error.message.startsWith('API server error:')) {
                errorType = 'http_5xx';
            } else if (
                error.name === 'TimeoutError' ||
                error.name === 'AbortError'
            ) {
                errorType = 'timeout';
            }

            // Record which API server failed.
            recordServerResult(endpoint.name, false, errorType);

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
                recordApiResult(false, null, errorType);
                throw error;
            }
        }
    }

    if (fallbackResponse) {
        recordApiResult(false, null, 'missing_streak_data');

        logger.warn(
            '[TYCOON API] Returning fallback response without streak data after all endpoint attempts.',
            {
                service: 'tycoon-api',
                tycoonUserId,
            }
        );

        return fallbackResponse;
    }

    recordApiResult(false, null, 'all_endpoints_failed');

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

const SOTD_ROLLOVER_DELAY = 15 * 60 * 1000;
const SOTD_RETRY_DELAYS = [0, 1_000, 5_000];
let sotdCache = loadSotdCache();
let sotdRefreshPromise = null;
let sotdApiFetcher = tycoonFetch;

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

function loadSotdCache() {
    try {
        if (!fs.existsSync(SOTD_CACHE_FILE)) return null;

        const parsed = JSON.parse(fs.readFileSync(SOTD_CACHE_FILE, 'utf8'));

        if (!parsed || typeof parsed !== 'object') return null;

        return {
            current: parsed.current ?? null,
            lastKnown: parsed.lastKnown ?? null,
            status: parsed.status ?? 'unavailable',
        };
    } catch (error) {
        logger.error(
            '[TYCOON API] Failed to load persistent SOTD cache.',
            error,
            { service: 'tycoon-sotd', cacheFile: SOTD_CACHE_FILE }
        );
        return null;
    }
}

function saveSotdCache() {
    const directory = path.dirname(SOTD_CACHE_FILE);
    const temporaryFile =
        `${SOTD_CACHE_FILE}.${process.pid}.${Date.now()}.tmp`;

    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
        temporaryFile,
        JSON.stringify(sotdCache, null, 2),
        { encoding: 'utf8', mode: 0o600 }
    );
    fs.renameSync(temporaryFile, SOTD_CACHE_FILE);
}

function getStoredSotd() {
    const currentDayKey = getSotdDayKey();
    const current = sotdCache?.current;

    if (
        current?.dayKey === currentDayKey &&
        current.status === 'confirmed' &&
        current.sotd
    ) {
        return {
            ...current.sotd,
            dayKey: current.dayKey,
            refreshedAt: current.refreshedAt,
            status: current.status,
        };
    }

    return null;
}

async function fetchSotdFromApi(dayKey) {
    let lastError;

    for (const baseUrl of SOTD_BASE_URLS) {
        const url = `${baseUrl}/sotd.json`;

        try {
            const response = await sotdApiFetcher(url, {
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

            if (!sotd.skill || !sotd.short || !Number.isFinite(sotd.bonus)) {
                throw new Error('SOTD response is missing required fields.');
            }

            return sotd;
        } catch (error) {
            lastError = error;

            logger.error(
                '[TYCOON API] SOTD fetch failed.',
                error,
                { service: 'tycoon-sotd', baseUrl, currentDayKey: dayKey }
            );

            if (error.message.startsWith('SOTD request rejected:')) {
                throw error;
            }
        }
    }

    throw new Error(
        `All Tycoon SOTD endpoints failed. ` +
        `Last error: ${lastError?.message ?? 'Unknown error'}`
    );
}

async function refreshSotd() {
    if (!TYCOON_API_KEY) {
        throw new Error(
            'TYCOON_API_KEY is missing from the environment variables'
        );
    }

    const dayKey = getSotdDayKey();
    let lastError;

    for (const delay of SOTD_RETRY_DELAYS) {
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        try {
            const sotd = await fetchSotdFromApi(dayKey);
            const refreshedAt = new Date().toISOString();

            sotdCache = {
                current: {
                    sotd,
                    dayKey,
                    refreshedAt,
                    status: 'confirmed',
                },
                lastKnown: {
                    ...sotd,
                    dayKey,
                    refreshedAt,
                    status: 'confirmed',
                },
                status: 'confirmed',
            };
            saveSotdCache();

            logger.info(
                '[TYCOON API] Current SOTD fetched successfully.',
                {
                    service: 'tycoon-sotd',
                    skill: sotd.skill,
                    bonus: sotd.bonus,
                    currentDayKey: dayKey,
                    refreshedAt,
                }
            );

            return {
                ...sotd,
                dayKey,
                refreshedAt,
                status: 'confirmed',
            };
        } catch (error) {
            lastError = error;
        }
    }

    sotdCache = {
        ...(sotdCache ?? {}),
        current: null,
        status: 'unavailable',
    };
    saveSotdCache();

    throw lastError;
}

async function fetchSotd(forceRefresh = false) {
    const storedSotd = getStoredSotd();

    if (!forceRefresh && storedSotd) {
        return storedSotd;
    }

    if (!sotdRefreshPromise) {
        sotdRefreshPromise = refreshSotd().finally(() => {
            sotdRefreshPromise = null;
        });
    }

    return sotdRefreshPromise;
}

function setSotdApiFetcher(fetcher) {
    sotdApiFetcher = fetcher;
}

function resetSotdCacheForTests() {
    sotdCache = null;
    sotdRefreshPromise = null;
    sotdApiFetcher = tycoonFetch;
}

module.exports = {
    loadUsers,
    saveUsers,
    getStreakExpiryDate,
    formatTimeRemaining,
    fetchUserData,
    fetchSotd,
    getStoredSotd,
    getSotdDayKey,
    setSotdApiFetcher,
    resetSotdCacheForTests,
    buildStoredStreaks,
    STREAK_JOBS,
    wantsStreakNotification,
    tycoonFetch,
};
