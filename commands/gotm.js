const {
    EmbedBuilder,
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
} = require("discord.js");

const PRIORITY_NORMAL = "normal";
const PRIORITY_HIGH = "high";
const PRIORITY_OVERLIMIT = "overlimit";

function formatResult(value) {
    return value.toLocaleString("en-IE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("gotm")
        .setDescription("Calculate GOTM points for an order")
        .addStringOption(option =>
            option
                .setName("priority")
                .setDescription("Order priority type")
                .setRequired(true)
                .addChoices(
                    { name: "Normal order (+3)", value: PRIORITY_NORMAL },
                    { name: "High priority order (+5)", value: PRIORITY_HIGH },
                    { name: "Overlimit/custom order", value: PRIORITY_OVERLIMIT }
                )
        )
        .addNumberOption(option =>
            option
                .setName("item_gotm_points")
                .setDescription("Base GOTM points for the item")
                .setRequired(true)
        )
        .addNumberOption(option =>
            option
                .setName("amount_ordered")
                .setDescription("Amount ordered")
                .setRequired(true)
        )
        .addNumberOption(option =>
            option
                .setName("normal_max_order_amount")
                .setDescription("Normal maximum order amount")
                .setRequired(true)
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

    name: "gotm",

    async execute(interaction) {
        const priority = interaction.options.getString("priority");
        const itemGotmPoints = interaction.options.getNumber("item_gotm_points");
        const amountOrdered = interaction.options.getNumber("amount_ordered");
        const normalMaxOrderAmount = interaction.options.getNumber("normal_max_order_amount");

        const invalidInput =
            !Number.isFinite(itemGotmPoints) ||
            itemGotmPoints < 0 ||
            !Number.isFinite(amountOrdered) ||
            amountOrdered < 0 ||
            !Number.isFinite(normalMaxOrderAmount) ||
            normalMaxOrderAmount <= 0;

        if (invalidInput) {
            await interaction.reply({
                content: "Invalid input. `item_gotm_points` and `amount_ordered` must be finite numbers greater than or equal to 0, and `normal_max_order_amount` must be a finite number greater than 0.",
                ephemeral: true,
            });
            return;
        }

        let result;
        let formula;

        if (priority === PRIORITY_HIGH) {
            result = itemGotmPoints + 5;
            formula = "itemGotmPoints + 5";
        } else if (priority === PRIORITY_OVERLIMIT) {
            result = (itemGotmPoints + 4) * (amountOrdered / normalMaxOrderAmount);
            formula = "(itemGotmPoints + 4) × (amountOrdered / normalMaxOrderAmount)";
        } else {
            result = itemGotmPoints + 3;
            formula = "itemGotmPoints + 3";
        }

        const priorityLabel =
            priority === PRIORITY_HIGH
                ? "High priority"
                : priority === PRIORITY_OVERLIMIT
                    ? "Overlimit/custom"
                    : "Normal";

        const embed = new EmbedBuilder()
            .setTitle("📋 GOTM Points Calculator")
            .setColor("#2ECC71")
            .addFields(
                { name: "Priority", value: priorityLabel, inline: true },
                { name: "GOTM Item Points", value: formatResult(itemGotmPoints), inline: true },
                { name: "Amount Ordered", value: formatResult(amountOrdered), inline: true },
                { name: "Normal Max Order Amount", value: formatResult(normalMaxOrderAmount), inline: true },
                { name: "Formula", value: `\`${formula}\`` },
                { name: "Calculated GOTM Points", value: `**${formatResult(result)}**` }
            )
            .setFooter({
                text: `Requested by ${interaction.user.username}`,
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
        });
    },
};
