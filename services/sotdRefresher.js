const cron = require('node-cron');
const logger = require('./logger');
const { fetchSotd } = require('../utils/tycoon');

async function refreshSotdNow() {
    try {
        return await fetchSotd(true);
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
}

module.exports = {
    startSotdRefresher,
    refreshSotdNow,
};
