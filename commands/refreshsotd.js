const {
    SlashCommandBuilder,
    EmbedBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags,
} = require("discord.js");

const { fetchSotd } = require("../utils/tycoon");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("refreshsotd")
        .setDescription("Force-refresh and display the current SOTD")
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
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({
                content: "You do not have permission to use this command.",
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        const sotd = await fetchSotd(true);

        console.log("[SOTD MANUAL REFRESH]", sotd);

        const sotdEmbed = new EmbedBuilder()
            .setTitle("🔄 SOTD Refreshed")
            .setColor("#5865F2")
            .addFields(
                {
                    name: "Skill",
                    value: sotd.skill || "Unknown",
                    inline: true,
                },
                {
                    name: "Short Name",
                    value: sotd.short || "Unknown",
                    inline: true,
                },
                {
                    name: "Bonus",
                    value: `+${sotd.bonus}%`,
                    inline: true,
                },
                {
                    name: "Aptitude",
                    value: `\`${sotd.aptitude || "Unknown"}\``,
                    inline: false,
                }
            )
            .setTimestamp()
            .setFooter({
                text: `Refreshed by ${interaction.user.username}`,
            });

        await interaction.editReply({
            embeds: [sotdEmbed],
        });
    },
};