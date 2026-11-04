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
        const sotd = await fetchSotd();

        if (sotd.refreshConfirmed) {
            logger.activity('sotd', 'SOTD Updated', {
                Skill: sotd.skill,
                Bonus: `+${sotd.bonus}%`,
                Updated: `${sotd.dayKey} ${sotd.refreshedAt.slice(11, 19)} UTC`,
                Source: 'Transport Tycoon API',
            });
        }

        return sotd;
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
