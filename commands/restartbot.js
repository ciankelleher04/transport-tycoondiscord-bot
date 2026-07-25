const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restartbot')
        .setDescription('Restart TT Tools'),

    async execute(interaction) {
        const adminUserId = process.env.ADMIN_USER_ID;

        if (interaction.user.id !== adminUserId) {
            return interaction.reply({
                content: '❌ Only the bot owner can restart TT Tools.',
                ephemeral: true,
            });
        }

        await interaction.reply({
            content: '🔄 Restarting TT Tools...',
            ephemeral: true,
        });

        console.log(`Bot restart requested by ${interaction.user.tag}`);

        setTimeout(() => {
            process.exit(0);
        }, 1500);
    },
};