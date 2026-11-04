const cron = require('node-cron');
const logger = require('./logger');
const { fetchSotd } = require('../utils/tycoon');

async function refreshSotdNow(forceRefresh = true) {
    try {
        return await fetchSotd(forceRefresh);
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

    cron.schedule(
        '15 0 * * *',
        () => {
            refreshSotdNow();
        },
        { timezone: 'UTC' }
    );

    cron.schedule(
        '*/15 * * * *',
        () => {
            refreshSotdNow(false);
        },
        { timezone: 'UTC' }
    );
}

module.exports = {
    startSotdRefresher,
    refreshSotdNow,
};
