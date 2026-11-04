const {
    SlashCommandBuilder,
    EmbedBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags,
} = require("discord.js");

const { fetchSotd } = require("../utils/tycoon");
const logger = require("../services/logger");

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
        if (interaction.user.id !== process.env.ADMIN_USER_ID) {
            return interaction.reply({
                content: "You do not have permission to use this command.",
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        let sotd;

        try {
            sotd = await fetchSotd(true);
        } catch (error) {
            logger.warn("[SOTD MANUAL REFRESH] Refresh failed.", {
                service: "tycoon-sotd",
                error: error.message,
            });

            return interaction.editReply({
                content:
                    "The SOTD refresh failed. Any confirmed current-day SOTD remains preserved; no unverified bonus was applied.",
            });
        }

        console.log("[SOTD MANUAL REFRESH]", sotd);

        if (sotd.refreshConfirmed && sotd.changed) {
            logger.activity("sotd", "SOTD Updated", {
                Skill: sotd.skill,
                Bonus: `+${sotd.bonus}%`,
                Updated: `${sotd.dayKey} ${sotd.refreshedAt.slice(11, 19)} UTC`,
                Source: "Manual Transport Tycoon API refresh",
            });
        }

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