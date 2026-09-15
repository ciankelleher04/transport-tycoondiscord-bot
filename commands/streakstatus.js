const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const {
    loadUsers,
    getStreakExpiryDate,
    formatTimeRemaining,
    fetchUserData,
    STREAK_JOBS,
} = require('../utils/tycoon');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('streakstatus')
        .setDescription('Show your current Transport Tycoon job streaks'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const users = loadUsers();
        const savedUser = users[interaction.user.id];

        if (!savedUser) {
            return interaction.editReply(
                'You are not registered yet. Use `/register` first.'
            );
        }

        const { apiKey, tycoonUserId } = savedUser;

        try {
            const { data: result, chargesLeft } = await fetchUserData(
                apiKey,
                tycoonUserId
            );

            const streaks = result?.data?.streaks;

            if (!streaks) {
                return interaction.editReply(
                    'No streak data found in the API response.'
                );
            }

            const now = Date.now();

            const activeStreaks = Object.entries(streaks)
                .filter(([key, info]) => {
                    const expiryDate =
                        getStreakExpiryDate(info.last_updated_day);

                    return (
                        key in STREAK_JOBS &&
                        Number(info.current) > 0 &&
                        expiryDate.getTime() > now
                    );
                })
                .sort(
                    (a, b) =>
                        Number(b[1].current) -
                        Number(a[1].current)
                );

            if (activeStreaks.length === 0) {
                return interaction.editReply(
                    'You do not currently have any active job streaks.'
                );
            }

            const description = activeStreaks
                .map(([key, info]) => {
                    const name = STREAK_JOBS[key] ?? key;

                    const expiryDate =
                        getStreakExpiryDate(info.last_updated_day);

                    const timeRemaining =
                        formatTimeRemaining(expiryDate);

                    return (
                        `**${name}**\n` +
                        `Current: ${info.current}\n` +
                        `Record: ${info.record}\n` +
                        `Expires in: ${timeRemaining}`
                    );
                })
                .join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle('🔥 Current Transport Tycoon Streaks')
                .setDescription(description)
                .setFooter({
                    text: `API charges left: ${chargesLeft ?? 'unknown'}`,
                });

            await interaction.editReply({
                embeds: [embed],
            });
        } catch (error) {
            console.error('Streak status failed:', error);

            await interaction.editReply(
                'Something went wrong while checking your streaks. Check the bot logs.'
            );
        }
    },
};