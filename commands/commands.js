const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('Show the available bot commands'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Available Commands')
            .setDescription(
                [
                    '`/ping` — Check whether the bot is online',
                    '`/register` — Register your Transport Tycoon API key',
                    '`/unregister` — Unregister API key for streak reminder',
                    '`/streakstatus` — Show your active job streaks',
                    '`/fishxp` — Calculate Fish XP requirements',
                    '`/bearxp` — Calculate hunting XP requirements',
                    '`/suggest` — Suggest new bot ideas/bot commands',
                ].join('\n')
            );

        await interaction.reply({
            embeds: [embed],
        });
    },
};