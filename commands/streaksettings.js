const {
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    EmbedBuilder,
} = require('discord.js');

const {
    loadUsers,
    STREAK_JOBS,
} = require('../utils/tycoon');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('streaksettings')
        .setDescription(
            'Choose which job streaks you receive reminders for'
        ),

    async execute(interaction) {
        const users = loadUsers();
        const user = users[interaction.user.id];

        if (!user) {
            return interaction.reply({
                content:
                    'You are not registered yet. Use `/register` first.',
                ephemeral: true,
            });
        }

        /*
         * Existing users without settings have every job enabled.
         */
        const selectedJobs =
            Array.isArray(user.streakNotifications)
                ? user.streakNotifications
                : Object.keys(STREAK_JOBS);

        const menu = new StringSelectMenuBuilder()
            .setCustomId('streak_notification_settings')
            .setPlaceholder('Choose streak notifications...')
            .setMinValues(0)
            .setMaxValues(Object.keys(STREAK_JOBS).length);

        for (const [key, displayName] of Object.entries(STREAK_JOBS)) {
            /*
             * STREAK_JOBS contains values such as:
             *
             * 🚕 Cabbie
             *
             * Split that into the emoji and the Discord menu label.
             */
            const firstSpace = displayName.indexOf(' ');

            const emoji =
                firstSpace === -1
                    ? null
                    : displayName.slice(0, firstSpace);

            const label =
                firstSpace === -1
                    ? displayName
                    : displayName.slice(firstSpace + 1);

            const option =
                new StringSelectMenuOptionBuilder()
                    .setLabel(label)
                    .setValue(key)
                    .setDefault(selectedJobs.includes(key));

            if (emoji) {
                option.setEmoji(emoji);
            }

            menu.addOptions(option);
        }

        const row =
            new ActionRowBuilder().addComponents(menu);

        const enabledNames = selectedJobs
            .map(key => STREAK_JOBS[key])
            .filter(Boolean);

        const currentSettings =
            enabledNames.length > 0
                ? enabledNames.join('\n')
                : '🔕 No streak notifications enabled';

        const embed = new EmbedBuilder()
            .setTitle('🔥 Streak Notification Settings')
            .setDescription(
                'Choose which jobs you want to receive ' +
                '**12h, 6h, 3h and 1h** streak expiry reminders for.\n\n' +
                '**Currently enabled:**\n' +
                currentSettings
            )
            .setFooter({
                text: 'You can change these settings at any time.',
            });

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true,
        });
    },
};