const cron = require('node-cron');
const logger = require('./logger');
const { fetchSotd } = require('../utils/tycoon');

const SOTD_SCHEDULES = [
    { name: 'main', expression: '15 0 * * *' },
    { name: 'backup', expression: '45 0 * * *' },
    { name: 'final', expression: '15 1 * * *' },
];

async function refreshSotdNow() {
    try {
        return await fetchSotd();
    } catch (error) {
        logger.error(
            '[SOTD REFRESH] Daily refresh failed after retries.',
            error,
            { service: 'sotd-refresh' }
        );
        return null;
    }
}

function startSotdRefresher() {
    fetchSotd().catch(error => {
        logger.warn(
            '[SOTD REFRESH] No confirmed current SOTD is available at startup.',
            { service: 'sotd-refresh', error: error.message }
        );
    });

    for (const schedule of SOTD_SCHEDULES) {
        cron.schedule(
            schedule.expression,
            () => {
                refreshSotdNow();
            },
            { timezone: 'UTC' }
        );
    }
}

module.exports = {
    startSotdRefresher,
    refreshSotdNow,
    SOTD_SCHEDULES,
};
