const {
    loadUsers,
    saveUsers,
    fetchUserData,
    buildStoredStreaks,
    wantsStreakNotification,
    STREAK_JOBS,
} = require('../utils/tycoon');

const {
    checkApiChargeReminder,
} = require('./apiChargeReminders');

const REMINDER_STAGES = [
    { label: '12h', ms: 12 * 60 * 60 * 1000 },
    { label: '6h', ms: 6 * 60 * 60 * 1000 },
    { label: '3h', ms: 3 * 60 * 60 * 1000 },
    { label: '1h', ms: 1 * 60 * 60 * 1000 },
];

async function refreshUserBeforeOneHourReminder(
    client,
    discordId,
    user,
    users
) {
    console.log(
        `[STREAK REMINDERS] 1h reminder due for ${discordId}. Refreshing live data first...`
    );

    try {
        const { data: result, chargesLeft } = await fetchUserData(
            user.apiKey,
            user.tycoonUserId
        );

        const apiStreaks = result?.data?.streaks;

        if (!apiStreaks) {
            console.log(
                `[STREAK REMINDERS] No live streak data returned for ${discordId}.`
            );

            return false;
        }

        users[discordId].streaks = buildStoredStreaks(
            apiStreaks,
            users[discordId].streaks
        );

        users[discordId].lastRefresh =
            new Date().toISOString();

        users[discordId].chargesLeft = chargesLeft;

        console.log(
            `[STREAK REMINDERS] Live data refreshed for ${discordId}. Charges left: ${chargesLeft}`
        );

        return true;
    } catch (error) {
        console.error(
            `[STREAK REMINDERS] Live refresh failed for ${discordId}:`,
            error
        );

        return false;
    }
}

async function checkStreakReminders(client) {
    const users = loadUsers();

    console.log('[STREAK REMINDERS] Checking reminders...');

    for (const [discordId, user] of Object.entries(users)) {
        if (!user.streaks) continue;

        for (
            const [streakName, storedStreak]
            of Object.entries(user.streaks)
        ) {
            /*
             * Ignore streak jobs the user has disabled.
             */
            if (!wantsStreakNotification(user, streakName)) {
                continue;
            }

            /*
             * Also ignore unknown streak types that aren't in our
             * supported job list.
             */
            if (!(streakName in STREAK_JOBS)) {
                continue;
            }

            let streak = storedStreak;
            let now = Date.now();
            let expiresAt =
                new Date(streak.expiresAt).getTime();

            let timeLeft = expiresAt - now;

            if (timeLeft <= 0) continue;

            if (!Array.isArray(streak.remindersSent)) {
                streak.remindersSent = [];
            }

            for (
                const stage of [...REMINDER_STAGES].reverse()
            ) {
                if (
                    timeLeft <= stage.ms &&
                    !streak.remindersSent.includes(stage.label)
                ) {
                    /*
                     * Only make a live API call before the
                     * 1-hour reminder.
                     */
                    if (stage.label === '1h') {
                        const refreshed =
                            await refreshUserBeforeOneHourReminder(
                                client,
                                discordId,
                                user,
                                users
                            );

                        /*
                         * Do not send a possibly incorrect reminder
                         * if the API refresh failed.
                         */
                        if (!refreshed) {
                            break;
                        }

                        /*
                         * Reload this streak from the newly
                         * refreshed data.
                         */
                        streak =
                            users[discordId].streaks?.[streakName];

                        if (!streak) {
                            console.log(
                                `[STREAK REMINDERS] ${streakName} is no longer present after refresh for ${discordId}.`
                            );

                            break;
                        }

                        now = Date.now();

                        expiresAt =
                            new Date(streak.expiresAt).getTime();

                        timeLeft = expiresAt - now;

                        if (
                            !Array.isArray(streak.remindersSent)
                        ) {
                            streak.remindersSent = [];
                        }

                        /*
                         * After refreshing, the streak may no
                         * longer be near expiry.
                         */
                        if (
                            timeLeft <= 0 ||
                            timeLeft > stage.ms ||
                            streak.remindersSent.includes(
                                stage.label
                            )
                        ) {
                            console.log(
                                `[STREAK REMINDERS] ${streakName} no longer needs a 1h reminder for ${discordId}.`
                            );

                            break;
                        }
                    }

                    try {
                        const userToMessage =
                            await client.users.fetch(discordId);

                        const displayName =
                            STREAK_JOBS[streakName] ??
                            streakName;

                        await userToMessage.send(
                            `⚠️ **Transport Tycoon Streak Reminder**\n\n` +
                            `Your **${displayName}** streak expires in **${stage.label} or less**.\n` +
                            `Current streak: **${streak.current}**\n\n` +
                            `Use \`/streakstatus\` to check your current streaks.\n` +
                            `Use \`/streaksettings\` to change which jobs notify you.`
                        );

                        console.log(
                            `[STREAK REMINDERS] Sent ${stage.label} reminder to ${discordId} for ${streakName}`
                        );

                        for (
                            const completedStage
                            of REMINDER_STAGES
                        ) {
                            if (
                                completedStage.ms >= stage.ms &&
                                !streak.remindersSent.includes(
                                    completedStage.label
                                )
                            ) {
                                streak.remindersSent.push(
                                    completedStage.label
                                );
                            }
                        }
                    } catch (error) {
                        console.error(
                            `[STREAK REMINDERS] Could not DM ${discordId}:`,
                            error
                        );
                    }

                    break;
                }
            }
        }
    }

    saveUsers(users);
}

function startStreakReminderChecker(client) {
    checkStreakReminders(client);

    setInterval(() => {
        checkStreakReminders(client);
    }, 5 * 60 * 1000);
}

module.exports = {
    startStreakReminderChecker,
    checkStreakReminders,
};