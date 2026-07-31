const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Show TT Tools statistics"),

    async execute(interaction) {
        const uptimeSeconds = Math.floor(process.uptime());

        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        const uptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        const ping = interaction.client.ws.ping;
        const serverCount = interaction.client.guilds.cache.size;

        const memoryUsage = process.memoryUsage().rss;
        const memoryMB = (memoryUsage / 1024 / 1024).toFixed(1);

        const embed = new EmbedBuilder()
            .setTitle("📊 TT Tools Statistics")
            .addFields(
                {
                    name: "⏱️ Uptime",
                    value: uptime,
                    inline: true,
                },
                {
                    name: "🏓 Discord Ping",
                    value: `${ping}ms`,
                    inline: true,
                },
                {
                    name: "🧠 Memory Usage",
                    value: `${memoryMB} MB`,
                    inline: true,
                },
                {
                    name: "🏠 Servers",
                    value: `${serverCount}`,
                    inline: true,
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
        });
    },
};