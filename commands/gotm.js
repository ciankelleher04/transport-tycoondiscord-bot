const {
    EmbedBuilder,
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
} = require("discord.js");

const PRIORITY_NORMAL = "normal";
const PRIORITY_HIGH = "high";
const PRIORITY_OVERLIMIT = "overlimit";
const PRODUCT_OPTION_NAME = "product";
const MAX_AUTOCOMPLETE_RESULTS = 25;

const PRODUCT_GOTM_POINTS = Object.freeze({
    acid: { label: "Acid", points: 5 },
    airline: { label: "Airline", points: 3 },
    airlinemeals: { label: "Airlinemeals", points: 6 },
    batteries: { label: "Batteries", points: 7 },
    bears: { label: "Bears", points: 10 },
    biz: { label: "Biz", points: 8 },
    bronzealloy: { label: "Bronzealloy", points: 7 },
    bus: { label: "Bus", points: 3 },
    cargo: { label: "Cargo", points: 3 },
    cementmix: { label: "Cementmix", points: 5 },
    ceramictiles: { label: "Ceramictiles", points: 7 },
    circuitboards: { label: "Circuitboards", points: 8 },
    computers: { label: "Computers", points: 8 },
    concrete: { label: "Concrete", points: 10 },
    conductor: { label: "Conductor", points: 2 },
    coppervoucher: { label: "Coppervoucher", points: 4 },
    defibkit: { label: "Defibkit", points: 4 },
    ems: { label: "Ems", points: 3 },
    explosives: { label: "Explosives", points: 8 },
    farming: { label: "Farming", points: 4 },
    firefighter: { label: "Firefighter", points: 4 },
    fish: { label: "Fish", points: 5 },
    fishing: { label: "Fishing", points: 2 },
    flint: { label: "Flint", points: 2 },
    garbage: { label: "Garbage", points: 3 },
    heli: { label: "Heli", points: 4 },
    hunting: { label: "Hunting", points: 3 },
    ironvoucher: { label: "Ironvoucher", points: 6 },
    kerosene: { label: "Kerosene", points: 6 },
    lctoken: { label: "Lctoken", points: 3 },
    mechanic: { label: "Mechanic", points: 2 },
    mining: { label: "Mining", points: 3 },
    pills: { label: "Pills", points: 5 },
    planks: { label: "Planks", points: 5 },
    player: { label: "Player", points: 1 },
    postop: { label: "Postop", points: 3 },
    racing: { label: "Racing", points: 2 },
    rawore: { label: "Rawore", points: 3 },
    rebar: { label: "Rebar", points: 10 },
    refinedamalgam: { label: "Refinedamalgam", points: 6 },
    refinedcopper: { label: "Refinedcopper", points: 4 },
    refinedsolder: { label: "Refinedsolder", points: 7 },
    refinedtin: { label: "Refinedtin", points: 7 },
    refinedzinc: { label: "Refinedzinc", points: 4 },
    rubber: { label: "Rubber", points: 8 },
    sand: { label: "Sand", points: 4 },
    sawdust: { label: "Sawdust", points: 3 },
    scrapaluminum: { label: "Scrapaluminum", points: 3 },
    scrapcopper: { label: "Scrapcopper", points: 2 },
    scrapgold: { label: "Scrapgold", points: 5 },
    scraplead: { label: "Scraplead", points: 3 },
    scrapmercury: { label: "Scrapmercury", points: 6 },
    scrapplastic: { label: "Scrapplastic", points: 2 },
    scraptin: { label: "Scraptin", points: 6 },
    spools: { label: "Spools", points: 7 },
    strength: { label: "Strength", points: 1 },
    sulfur: { label: "Sulfur", points: 5 },
    treatedwater: { label: "Treatedwater", points: 6 },
    trucking: { label: "Trucking", points: 1 },
    water: { label: "Water", points: 6 },
});

const PRODUCT_ENTRIES = Object.entries(PRODUCT_GOTM_POINTS)
    .map(([value, details]) => ({ value, ...details }))
    .sort((left, right) => left.label.localeCompare(right.label));

function formatResult(value) {
    return value.toLocaleString("en-IE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    });
}

function normalizeProductKey(productInput) {
    return productInput
        ?.trim()
        .replace(/\s*\(\s*\d+\s+points?\s*\)\s*$/i, "")
        .toLowerCase();
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
        .addStringOption(option =>
            option
                .setName(PRODUCT_OPTION_NAME)
                .setDescription("Product being ordered")
                .setRequired(true)
                .setAutocomplete(true)
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

    async autocomplete(interaction) {
        const focusedValue = interaction.options
            .getFocused()
            .trim()
            .toLowerCase();

        const matchingProducts = PRODUCT_ENTRIES
            .filter(({ label, value }) =>
                label.toLowerCase().includes(focusedValue) ||
                value.includes(focusedValue)
            )
            .slice(0, MAX_AUTOCOMPLETE_RESULTS)
            .map(({ label, points, value }) => ({
                name: `${label} (${points} points)`,
                value,
            }));

        await interaction.respond(matchingProducts);
    },

    async execute(interaction) {
        const priority = interaction.options.getString("priority");
        const selectedProduct = interaction.options.getString(PRODUCT_OPTION_NAME);
        const productKey = normalizeProductKey(selectedProduct);
        const selectedProductData = productKey ? PRODUCT_GOTM_POINTS[productKey] : null;
        const itemGotmPoints = selectedProductData?.points;
        const amountOrdered = interaction.options.getNumber("amount_ordered");
        const normalMaxOrderAmount = interaction.options.getNumber("normal_max_order_amount");

        const invalidInput =
            !selectedProductData ||
            !Number.isFinite(itemGotmPoints) ||
            !Number.isFinite(amountOrdered) ||
            amountOrdered < 0 ||
            !Number.isFinite(normalMaxOrderAmount) ||
            normalMaxOrderAmount <= 0;

        if (invalidInput) {
            await interaction.reply({
                content: "Invalid input. Select a valid product, provide `amount_ordered` as a finite number greater than or equal to 0, and `normal_max_order_amount` as a finite number greater than 0.",
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
                { name: "Product", value: selectedProductData.label, inline: true },
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
