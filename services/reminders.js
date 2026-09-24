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

const logger = require('./logger');

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
    logger.info(
        `[STREAK REMINDERS] 1h reminder due for ${discordId}. Refreshing live data first...`,
        { discordId, service: 'streak-reminders' }
    );

    try {
        const { data: result, chargesLeft } = await fetchUserData(
            user.apiKey,
            user.tycoonUserId
        );

        const apiStreaks = result?.data?.streaks;

        if (!apiStreaks) {
            logger.warn(
                '[STREAK REMINDERS] No live streak data returned.',
                { discordId, service: 'streak-reminders' }
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

        logger.info(
            `[STREAK REMINDERS] Live data refreshed for ${discordId}. Charges left: ${chargesLeft}`,
            { discordId, service: 'streak-reminders' }
        );

        return true;
    } catch (error) {
        logger.error(
            '[STREAK REMINDERS] Live refresh failed.',
            error,
            { discordId, service: 'streak-reminders' }
        );

        return false;
    }
}

async function checkStreakReminders(client) {
    const users = loadUsers();

    logger.info('[STREAK REMINDERS] Checking reminders...', {
        service: 'streak-reminders',
        userCount: Object.keys(users).length,
    });

    for (const [discordId, user] of Object.entries(users)) {
        if (!user.streaks) continue;

        for (
            const [streakName, storedStreak]
            of Object.entries(user.streaks)
        ) {
            if (!wantsStreakNotification(user, streakName)) {
                continue;
            }

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
                    if (stage.label === '1h') {
                        const refreshed =
                            await refreshUserBeforeOneHourReminder(
                                client,
                                discordId,
                                user,
                                users
                            );

                        if (!refreshed) {
                            break;
                        }

                        streak =
                            users[discordId].streaks?.[streakName];

                        if (!streak) {
                            logger.info(
                                `[STREAK REMINDERS] ${streakName} is no longer present after refresh for ${discordId}.`,
                                { discordId, streakName, service: 'streak-reminders' }
                            );

                            break;
                        }

                        now = Date.now();
                        expiresAt =
                            new Date(streak.expiresAt).getTime();
                        timeLeft = expiresAt - now;

                        if (!Array.isArray(streak.remindersSent)) {
                            streak.remindersSent = [];
                        }

                        if (
                            timeLeft <= 0 ||
                            timeLeft > stage.ms ||
                            streak.remindersSent.includes(stage.label)
                        ) {
                            logger.info(
                                `[STREAK REMINDERS] ${streakName} no longer needs a 1h reminder for ${discordId}.`,
                                { discordId, streakName, service: 'streak-reminders' }
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

                        logger.info(
                            `[STREAK REMINDERS] Sent ${stage.label} reminder to ${discordId} for ${streakName}`,
                            { discordId, streakName, stage: stage.label, service: 'streak-reminders' }
                        );

                        for (const completedStage of REMINDER_STAGES) {
                            if (
                                completedStage.ms >= stage.ms &&
                                !streak.remindersSent.includes(completedStage.label)
                            ) {
                                streak.remindersSent.push(completedStage.label);
                            }
                        }
                    } catch (error) {
                        logger.error(
                            '[STREAK REMINDERS] Could not send reminder DM.',
                            error,
                            { discordId, streakName, stage: stage.label, service: 'streak-reminders' }
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
