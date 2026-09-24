const {
    loadUsers,
    saveUsers,
    fetchUserData,
    buildStoredStreaks,
} = require('../utils/tycoon');

const {
    checkApiChargeReminder,
} = require('./apiChargeReminders');

const logger = require('./logger');
const cron = require('node-cron');

async function refreshAllStreaks(client) {
    const users = loadUsers();

    logger.info('[STREAK REFRESH] Starting refresh.', {
        service: 'streak-refresh',
        userCount: Object.keys(users).length,
    });

    for (const [discordId, user] of Object.entries(users)) {
        const context = {
            service: 'streak-refresh',
            discordId,
            tycoonUserId: user.tycoonUserId,
        };

        try {
            const { data: result, chargesLeft } = await fetchUserData(
                user.apiKey,
                user.tycoonUserId
            );

            users[discordId].lastRefresh = new Date().toISOString();
            users[discordId].chargesLeft = chargesLeft;

            await checkApiChargeReminder(
                client,
                discordId,
                users[discordId],
                chargesLeft
            );

            const apiStreaks = result?.data?.streaks;

            if (!apiStreaks) {
                logger.warn(
                    '[STREAK REFRESH] No streak data returned.',
                    context
                );
                continue;
            }

            users[discordId].streaks = buildStoredStreaks(
                apiStreaks,
                users[discordId].streaks
            );

            let username = discordId;

            try {
                const discordUser = await client.users.fetch(discordId);
                username = discordUser.username;
            } catch (error) {
                logger.warn(
                    '[STREAK REFRESH] Could not fetch Discord username; using ID.',
                    { ...context, error: error.message }
                );
            }

            logger.info(
                `[STREAK REFRESH] Refreshed ${username}.`,
                { ...context, username, chargesLeft }
            );
        } catch (error) {
            logger.error(
                '[STREAK REFRESH] Refresh failed for user.',
                error,
                context
            );
        }
    }

    saveUsers(users);

    logger.info('[STREAK REFRESH] Finished.', {
        service: 'streak-refresh',
        userCount: Object.keys(users).length,
    });
}

function startStreakRefresher(client) {
    // Refresh immediately when the bot starts.
    refreshAllStreaks(client).catch(error => {
        logger.error(
            '[STREAK REFRESH] Initial refresh failed unexpectedly.',
            error,
            { service: 'streak-refresh' }
        );
    });

    // Refresh every 3 hours on the UTC clock.
    cron.schedule(
        '0 */3 * * *',
        () => {
            logger.info('[STREAK REFRESH] Scheduled UTC refresh started.', {
                service: 'streak-refresh',
            });

            refreshAllStreaks(client).catch(error => {
                logger.error(
                    '[STREAK REFRESH] Scheduled refresh failed unexpectedly.',
                    error,
                    { service: 'streak-refresh' }
                );
            });
        },
        {
            timezone: 'UTC',
        }
    );
}

module.exports = {
    startStreakRefresher,
    refreshAllStreaks,
};
