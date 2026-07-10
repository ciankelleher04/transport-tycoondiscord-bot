const {
    EmbedBuilder,
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bearxp")
        .setDescription("Calculate Bear XP needed.")
        .addStringOption(option =>
            option
                .setName("target")
                .setDescription("Target XP/Level")
                .setRequired(true)
                .addChoices(
                    { name: "1M XP (Level 632)", value: "1000000" },
                    { name: "10M XP (Level 2000)", value: "10000000" },
                    { name: "Level 100", value: "25250" },
                )
        )
        .addIntegerOption(option =>
            option
                .setName("current_xp")
                .setDescription("Your current XP")
                .setRequired(true)
        )
        .addNumberOption(option =>
            option
                .setName("base_xp")
                .setDescription("Your base XP bonus (%)")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName("bonus_xp")
                .setDescription("Are you using bonus XP?")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("bonus_xp_amount")
                .setDescription("How much bonus XP you currently have")
                .setRequired(false)
        )
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

    name: "bearxp",

    async execute(interaction) {

        //Get command options
        const targetXp = parseInt(interaction.options.getString("target"));
        const currentXp = interaction.options.getInteger("current_xp");
        const baseXp = interaction.options.getNumber("base_xp");
        const usingBonusXp = interaction.options.getBoolean("bonus_xp");
        const bxpAvailable = interaction.options.getInteger("bonus_xp_amount") || 0;

        //Constants
        const xpRemaining = targetXp - currentXp;

        const baseBearXp = 6;
        const bxpUsedPerBear = 60;

        //XP calculations
        const xpPerBearNoBonus = baseBearXp * (1 + (baseXp / 100));
        const xpPerBearWithBonus = xpPerBearNoBonus + baseBearXp;

        const bearsWithBonus = Math.floor(bxpAvailable / bxpUsedPerBear);
        const xpCoveredByBonusBears = bearsWithBonus * xpPerBearWithBonus;

        let bearsRemaining;

        if (usingBonusXp && xpCoveredByBonusBears >= xpRemaining) {
            bearsRemaining = Math.ceil(xpRemaining / xpPerBearWithBonus);
        } else if (usingBonusXp) {
            const xpLeftAfterBonus = xpRemaining - xpCoveredByBonusBears;
            bearsRemaining = bearsWithBonus + Math.ceil(xpLeftAfterBonus / xpPerBearNoBonus);
        } else {
            bearsRemaining = Math.ceil(xpRemaining / xpPerBearNoBonus);
        }

        const bearsIfAllBonus = Math.ceil(xpRemaining / xpPerBearWithBonus);
        const totalBxpNeeded = bearsIfAllBonus * bxpUsedPerBear;
        const bxpNeeded = Math.max(totalBxpNeeded - bxpAvailable, 0);


        //embed
        const bearEmbed = new EmbedBuilder()
            .setTitle("🐻 Bear XP Calculator")
            .setTimestamp()
            .setColor("#C47F2B")
            .setFooter({
                text: `Requested by ${interaction.user.username} • ⚠️ Does not include SOTD bonus`,
            })
            .setAuthor({
                name: interaction.client.user.username,
                iconURL: interaction.client.user.displayAvatarURL(),
            })
            .addFields(
                {
                    name: "🎯 Target XP",
                    value: targetXp.toLocaleString(),
                    inline: true,
                },
                {
                    name: "📈 Current XP",
                    value: currentXp.toLocaleString(),
                    inline: true,
                },
                {
                    name: "⭐ Base XP Bonus",
                    value: `${baseXp}%`,
                    inline: true,
                },
                {
                    name: "📊 XP Remaining",
                    value: xpRemaining.toLocaleString(),
                    inline: true,
                },
                {
                    name: "🐻 Bears Remaining",
                    value: bearsRemaining.toLocaleString(),
                    inline: true,
                },
                {
                    name: "⚡ BXP Available",
                    value: bxpAvailable.toLocaleString(),
                    inline: true,
                },
                {
                    name: "⚡ Total BXP Needed",
                    value: totalBxpNeeded.toLocaleString(),
                    inline: true,
                },
                {
                    name: "🛒  BXP Still Needed",
                    value: bxpNeeded.toLocaleString(),
                    inline: true,
                },
            );

        //Reply
        await interaction.reply({
            embeds: [bearEmbed]
        });
    },
};