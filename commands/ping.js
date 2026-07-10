const {
    REST,
    Routes,
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    EmbedBuilder,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong!")
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

    async execute(interaction) {
        const ping = interaction.client.ws.ping;

        //Embed Builder
        const pingEmbed = new EmbedBuilder()
            .setTitle("🏓 Pong!")
            .setTimestamp()
            .setColor("#5865F2")
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({
                text: "requested by " + interaction.user.username,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .addFields(
                {
                    name: "⚡ WebSocket Ping",
                    value: `\`${ping} ms\``,
                    inline: false,
                },
                {
                    name: "🟢 Status",
                    value: "Online",
                    inline: false
                },

            )

        await interaction.reply({
            embeds: [pingEmbed]
        });
    },
};