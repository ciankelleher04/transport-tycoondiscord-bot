const {
    loadUsers,
    saveUsers,
    fetchUserData,
    buildStoredStreaks,
} = require('../utils/tycoon');

const {
    checkApiChargeReminder,
} = require('./apiChargeReminders');

const cron = require('node-cron');

async function refreshAllStreaks(client) {
    const users = loadUsers();

    console.log('[STREAK REFRESH] Starting refresh...');

    for (const [discordId, user] of Object.entries(users)) {
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
                console.log(
                    `[STREAK REFRESH] No streak data for ${discordId}`
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
            } catch {
                // Use the Discord ID if the username cannot be fetched.
            }

            console.log(
                `[STREAK REFRESH] Refreshed ${username} (${discordId}). Charges left: ${chargesLeft}`
            );
        } catch (error) {
            console.error(
                `[STREAK REFRESH] Failed for ${discordId}:`,
                error
            );
        }
    }

    saveUsers(users);

    console.log('[STREAK REFRESH] Finished.');
}

function startStreakRefresher(client) {
    // Refresh immediately when the bot starts.
    refreshAllStreaks(client);

    // Refresh every 3 hours on the UTC clock.
    cron.schedule(
        '0 */3 * * *',
        () => {
            console.log('[STREAK REFRESH] Scheduled UTC refresh...');
            refreshAllStreaks(client);
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