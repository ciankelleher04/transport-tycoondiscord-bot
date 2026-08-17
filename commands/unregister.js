const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    loadUsers,
    saveUsers,
} = require('../utils/tycoon');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unregister')
        .setDescription(
            'Remove your Transport Tycoon API details and stop streak tracking'
        ),

    async execute(interaction) {
        const users = loadUsers();
        const discordId = interaction.user.id;

        if (!users[discordId]) {
            return interaction.reply({
                content:
                    'You are not currently registered. There is no stored API data to remove.',
                ephemeral: true,
            });
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(`unregister_confirm_${discordId}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`unregister_cancel_${discordId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(
            confirmButton,
            cancelButton
        );

        const response = await interaction.reply({
            content:
                '⚠️ **Are you sure you want to unregister?**\n\n' +
                'This will permanently remove your stored Transport Tycoon API key, ' +
                'Tycoon user ID, streak data and reminder tracking.\n\n' +
                'You can register again later using `/register`.',
            components: [row],
            ephemeral: true,
        });

        try {
            const buttonInteraction =
                await response.awaitMessageComponent({
                    filter: (i) =>
                        i.user.id === discordId &&
                        (
                            i.customId === `unregister_confirm_${discordId}` ||
                            i.customId === `unregister_cancel_${discordId}`
                        ),
                    time: 60_000,
                });

            if (
                buttonInteraction.customId ===
                `unregister_cancel_${discordId}`
            ) {
                return buttonInteraction.update({
                    content: '❌ Unregister cancelled. Your data has not been changed.',
                    components: [],
                });
            }

            /*
             * Load the file again here instead of using the copy from
             * when /unregister was first executed.
             *
             * That avoids overwriting any changes made to tycoon-users.json
             * during the time the confirmation message was waiting.
             */
            const latestUsers = loadUsers();

            if (!latestUsers[discordId]) {
                return buttonInteraction.update({
                    content:
                        'Your registration has already been removed.',
                    components: [],
                });
            }

            delete latestUsers[discordId];

            saveUsers(latestUsers);

            console.log(
                `[UNREGISTER] Removed stored Tycoon data for Discord user ${discordId}`
            );

            await buttonInteraction.update({
                content:
                    '✅ Your Transport Tycoon API details and stored streak data have been removed.\n\n' +
                    'Streak tracking and reminders have now stopped. ' +
                    'You can use `/register` again at any time.',
                components: [],
            });
        } catch (error) {
            /*
             * awaitMessageComponent throws when the 60 second timeout expires.
             */
            await interaction.editReply({
                content:
                    '⌛ Unregister timed out. Your data has not been changed.\n\n' +
                    'Run `/unregister` again if you still want to remove it.',
                components: [],
            });
        }
    },
};