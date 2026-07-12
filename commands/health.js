const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');

const {
    loadUsers,
} = require('../utils/tycoon');

function formatUptime(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('health')
        .setDescription('Check the health of TT Tools'),

    async execute(interaction) {
        if (interaction.user.id !== process.env.ADMIN_USER_ID) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        const users = loadUsers();
        const registeredUsers = Object.keys(users).length;

        const charges = Object.values(users)
            .map(user => Number(user.chargesLeft))
            .filter(Number.isFinite);

        const lowestCharges =
            charges.length > 0
                ? Math.min(...charges)
                : null;

        const refreshDates = Object.values(users)
            .map(user => user.lastRefresh)
            .filter(Boolean)
            .map(date => new Date(date))
            .filter(date => !Number.isNaN(date.getTime()));

        const latestRefresh =
            refreshDates.length > 0
                ? new Date(
                    Math.max(...refreshDates.map(date => date.getTime()))
                )
                : null;

        const memoryUsedMb = Math.round(
            process.memoryUsage().rss / 1024 / 1024
        );

        const embed = new EmbedBuilder()
            .setTitle('🟢 TT Tools Health')
            .addFields(
                {
                    name: '🤖 Bot',
                    value:
                        `Status: Online\n` +
                        `Uptime: ${formatUptime(process.uptime())}\n` +
                        `Discord ping: ${interaction.client.ws.ping} ms`,
                    inline: false,
                },
                {
                    name: '👥 Users',
                    value: `Registered users: ${registeredUsers}`,
                    inline: false,
                },
                {
                    name: '🔄 Streak Refresh',
                    value:
                        `Last saved refresh: ${latestRefresh
                            ? `<t:${Math.floor(latestRefresh.getTime() / 1000)}:R>`
                            : 'No refresh recorded'
                        }\n` +
                        `Schedule: Every 3 hours UTC`,
                    inline: false,
                },
                {
                    name: '🔑 API',
                    value:
                        `Lowest saved charges: ${lowestCharges ?? 'Unknown'
                        }`,
                    inline: false,
                },
                {
                    name: '💾 Process',
                    value:
                        `Memory usage: ${memoryUsedMb} MB\n` +
                        `Node.js: ${process.version}`,
                    inline: false,
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true,
        });
    },
};