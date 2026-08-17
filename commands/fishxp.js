// Fish XP Calculator v1

const {
    EmbedBuilder,
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
} = require("discord.js");

const { fetchSotd } = require("../utils/tycoon");


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
        const enteredBaseXp = interaction.options.getNumber("base_xp");
        const usingBonusXp = interaction.options.getBoolean("bonus_xp");
        const bxpAvailable = interaction.options.getInteger("bonus_xp_amount") || 0;

        let baseXp = enteredBaseXp;

        let sotdApplied = false;
        let sotdBonus = 0;

        try {
            const sotd = await fetchSotd();

            console.log("[SOTD]", sotd);

            if (sotd.skill.toLowerCase().includes("fish")) {
                baseXp += sotd.bonus;
                sotdBonus = sotd.bonus;
                sotdApplied = true;
            }

        } catch (error) {
            console.error("Failed to fetch SOTD:", error);
        }

        //Constants
        const xpRemaining = targetXp - currentXp;


        const fishPerSale = 10000;
        const baseXpPerSale = 50;
        const bxpUsedPerSale = 500;

        //Calculations
        const xpPerSaleNoBonus =
            baseXpPerSale * (1 + (baseXp / 100));

        const xpPerSaleWithBonus =
            xpPerSaleNoBonus * 2;

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
                text: "Assumes fish are sold in batches of 10,000.",
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
                    value: `${enteredBaseXp}%`,
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
        if (sotdApplied) {
            fishEmbed.addFields({
                name: "🎣 SOTD Bonus",
                value: `+${sotdBonus}%`,
                inline: true,
            });
        }
        //reply
        await interaction.reply({
            embeds: [fishEmbed]
        });

    },
};