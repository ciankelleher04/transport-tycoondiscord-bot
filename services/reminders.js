const { loadUsers, saveUsers } = require('../utils/tycoon');

const REMINDER_STAGES = [
    { label: '12h', ms: 12 * 60 * 60 * 1000 },
    { label: '6h', ms: 6 * 60 * 60 * 1000 },
    { label: '3h', ms: 3 * 60 * 60 * 1000 },
    { label: '1h', ms: 1 * 60 * 60 * 1000 },
];

async function checkStreakReminders(client) {
    const users = loadUsers();
    const now = Date.now();

    console.log('[STREAK REMINDERS] Checking reminders...');

    for (const [discordId, user] of Object.entries(users)) {
        if (!user.streaks) continue;

        for (const [streakName, streak] of Object.entries(user.streaks)) {
            const expiresAt = new Date(streak.expiresAt).getTime();
            const timeLeft = expiresAt - now;

            if (timeLeft <= 0) continue;

            if (!Array.isArray(streak.remindersSent)) {
                streak.remindersSent = [];
            }

            for (const stage of REMINDER_STAGES) {
                if (timeLeft <= stage.ms && !streak.remindersSent.includes(stage.label)) {
                    try {
                        const userToMessage = await client.users.fetch(discordId);

                        await userToMessage.send(
                            `⚠️ **Transport Tycoon Streak Reminder**\n\n` +
                            `Your **${streakName}** streak expires in **${stage.label} or less**.\n` +
                            `Current streak: **${streak.current}**\n\n` +
                            `Use \`/streakstatus\` to check your current streaks.`
                        );

                        console.log(
                            `[STREAK REMINDERS] Sent ${stage.label} reminder to ${discordId} for ${streakName}`
                        );

                        streak.remindersSent.push(stage.label);
                    } catch (error) {
                        console.error(
                            `[STREAK REMINDERS] Could not DM ${discordId}:`,
                            error
                        );
                    }
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