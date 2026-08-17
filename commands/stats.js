const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require("discord.js");

const {
    getTotalCommands,
    getCommandCounts,
    getUniqueUsers,
    getUniqueServers,
} = require("../utils/stats");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Show TT Tools statistics"),

    async execute(interaction) {
        /*
         * Only allow the bot admin to use this command.
         */
        const adminUserId = process.env.ADMIN_USER_ID;

        if (interaction.user.id !== adminUserId) {
            return interaction.reply({
                content: "❌ You do not have permission to use this command.",
                ephemeral: true,
            });
        }

        /*
         * Bot runtime statistics
         */
        const uptimeSeconds = Math.floor(process.uptime());

        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        const uptime =
            `${days}d ${hours}h ${minutes}m ${seconds}s`;

        const ping = interaction.client.ws.ping;

        /*
         * Number of servers the bot is currently in.
         */
        const currentServerCount =
            interaction.client.guilds.cache.size;

        const memoryUsage = process.memoryUsage().rss;
        const memoryMB =
            (memoryUsage / 1024 / 1024).toFixed(1);

        /*
         * Persistent statistics from SQLite
         */
        const totalCommands = getTotalCommands();
        const uniqueUsers = getUniqueUsers();
        const uniqueServers = getUniqueServers();

        const commandCounts = getCommandCounts();

        /*
         * Show the 10 most-used commands.
         */
        const topCommands = commandCounts
            .slice(0, 10)
            .map(
                ({ command, count }, index) =>
                    `${index + 1}. \`/${command}\` — **${count}**`
            )
            .join("\n");

        const commandList =
            topCommands || "No command usage recorded yet.";

        /*
         * Build embed
         */
        const embed = new EmbedBuilder()
            .setTitle("📊 TT Tools Statistics")

            .addFields(
                {
                    name: "🤖 Bot Status",
                    value:
                        `**Uptime:** ${uptime}\n` +
                        `**Ping:** ${ping}ms\n` +
                        `**Memory:** ${memoryMB} MB`,
                    inline: true,
                },
                {
                    name: "🌐 Servers",
                    value:
                        `**Currently in:** ${currentServerCount}\n` +
                        `**Used bot:** ${uniqueServers}`,
                    inline: true,
                },
                {
                    name: "👥 Usage",
                    value:
                        `**Commands:** ${totalCommands}\n` +
                        `**Unique users:** ${uniqueUsers}`,
                    inline: true,
                },
                {
                    name: "🏆 Most Used Commands",
                    value: commandList,
                    inline: false,
                }
            )

            .setFooter({
                text: "Persistent statistics since tracking was enabled",
            })

            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true,
        });
    },
};