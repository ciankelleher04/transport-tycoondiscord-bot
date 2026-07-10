// Fish XP Calculator v1

const {
    EmbedBuilder,
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("fishxp")
        .setDescription("Calculate the remaining Fish XP needed.")
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
                .setDescription("Your current Fish XP")
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
                .setDescription("Are you using BXP?")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("bonus_xp_amount")
                .setDescription("How much BXP you currently have")
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

    name: "fishxp",

    async execute(interaction) {

        //Get command options
        const targetXp = Number(interaction.options.getString("target"))
        const currentXp = interaction.options.getInteger("current_xp");
        const baseXp = interaction.options.getNumber("base_xp");
        const usingBonusXp = interaction.options.getBoolean("bonus_xp");
        const bxpAvailable = interaction.options.getInteger("bonus_xp_amount") || 0;

        //Constants
        const xpRemaining = targetXp - currentXp;


        // Fish are sold in batches of 10.
        const fishPerSale = 10;
        const baseXpPerSale = 0.05;
        const bxpUsedPerSale = 0.5;

        //Calculations
        const xpPerSaleNoBonus = baseXpPerSale * (1 + (baseXp / 100));
        const xpPerSaleWithBonus = xpPerSaleNoBonus + baseXpPerSale;

        const salesWithBonus = Math.floor(bxpAvailable / bxpUsedPerSale);
        const xpCoveredByBonusSales = salesWithBonus * xpPerSaleWithBonus;

        let salesRemaining;

        if (usingBonusXp && xpCoveredByBonusSales >= xpRemaining) {
            salesRemaining = Math.ceil(xpRemaining / xpPerSaleWithBonus);
        } else if (usingBonusXp) {
            const xpLeftAfterBonus = xpRemaining - xpCoveredByBonusSales;
            salesRemaining = salesWithBonus + Math.ceil(xpLeftAfterBonus / xpPerSaleNoBonus);
        } else {
            salesRemaining = Math.ceil(xpRemaining / xpPerSaleNoBonus);
        }

        const fishRemaining = salesRemaining * fishPerSale;

        const salesIfAllBonus = Math.ceil(xpRemaining / xpPerSaleWithBonus);
        const totalBxpNeeded = Math.ceil(salesIfAllBonus * bxpUsedPerSale);
        const bxpNeeded = Math.max(totalBxpNeeded - bxpAvailable, 0);


        //Embed
        const fishEmbed = new EmbedBuilder()
            .setTitle("🐟 Fish XP Calculator")
            .setTimestamp()
            .setColor("#5865F2")
            .setFooter({
                text: `Requested by ${interaction.user.username} • ⚠️ Does not include SOTD bonus`,
            })
            .setAuthor({
                name: interaction.client.user.username,
                iconURL: interaction.client.user.displayAvatarURL()
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
                    name: "🐟 Fish Remaining",
                    value: fishRemaining.toLocaleString(),
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

        //reply
        await interaction.reply({
            embeds: [fishEmbed]
        });

    },
};