const {
    SlashCommandBuilder,
    EmbedBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('Submit a suggestion for the bot')
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        )
        .addStringOption(option =>
            option
                .setName('suggestion')
                .setDescription('Describe your suggestion')
                .setRequired(true)
                .setMaxLength(1000)
        ),

    async execute(interaction) {
        const suggestion = interaction.options.getString(
            'suggestion',
            true
        );

        const suggestionsChannelId =
            process.env.SUGGESTIONS_CHANNEL_ID;

        if (!suggestionsChannelId) {
            throw new Error(
                'SUGGESTIONS_CHANNEL_ID is missing from the environment variables'
            );
        }

        const suggestionsChannel =
            await interaction.client.channels.fetch(
                suggestionsChannelId
            );

        if (!suggestionsChannel?.isTextBased()) {
            throw new Error(
                'The configured suggestions channel is not a text channel'
            );
        }

        const serverName =
            interaction.guild?.name ?? 'Submitted through DM';

        const suggestionEmbed = new EmbedBuilder()
            .setTitle('💡 New Suggestion')
            .setColor('#F1C40F')
            .setDescription(suggestion)
            .addFields(
                {
                    name: 'Submitted by',
                    value:
                        `${interaction.user.tag}\n` +
                        `\`${interaction.user.id}\``,
                    inline: true,
                },
                {
                    name: 'Server',
                    value: serverName,
                    inline: true,
                }
            )
            .setThumbnail(
                interaction.user.displayAvatarURL()
            )
            .setTimestamp()
            .setFooter({
                text: 'TT Tools Suggestions',
            });

        const suggestionMessage =
            await suggestionsChannel.send({
                embeds: [suggestionEmbed],
            });

        try {
            await suggestionMessage.react('👍');
            await suggestionMessage.react('👎');
        } catch (error) {
            console.error(
                '[SUGGEST] Failed to add reactions:',
                error.message
            );
        }

        await interaction.reply({
            content:
                '✅ Thank you! Your suggestion has been submitted.',
            ephemeral: true,
        });
    },
};