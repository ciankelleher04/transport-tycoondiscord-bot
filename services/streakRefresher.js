const {
    loadUsers,
    saveUsers,
    fetchUserData,
    buildStoredStreaks,
} = require('../utils/tycoon');

async function refreshAllStreaks() {
    const users = loadUsers();

    console.log('[STREAK REFRESH] Starting refresh...');

    for (const [discordId, user] of Object.entries(users)) {
        try {
            const { data: result, chargesLeft } = await fetchUserData(
                user.apiKey,
                user.tycoonUserId
            );

            const apiStreaks = result?.data?.streaks;

            if (!apiStreaks) {
                console.log(`[STREAK REFRESH] No streak data for ${discordId}`);
                continue;
            }

            users[discordId].streaks = buildStoredStreaks(
                apiStreaks,
                users[discordId].streaks
            );
            users[discordId].lastRefresh = new Date().toISOString();
            users[discordId].chargesLeft = chargesLeft;

            console.log(`[STREAK REFRESH] Refreshed ${discordId}. Charges left: ${chargesLeft}`);
        } catch (error) {
            console.error(`[STREAK REFRESH] Failed for ${discordId}:`, error);
        }
    }

    saveUsers(users);

    console.log('[STREAK REFRESH] Finished.');
}

function startStreakRefresher() {
    refreshAllStreaks();

    setInterval(refreshAllStreaks, 3 * 60 * 60 * 1000);
}

module.exports = {
    startStreakRefresher,
    refreshAllStreaks,
};