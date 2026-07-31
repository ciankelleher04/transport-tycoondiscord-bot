const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("servers")
        .setDescription("Show the servers TT Tools is connected to"),

    async execute(interaction) {
        if (interaction.user.id !== process.env.BOT_OWNER_ID) {
            return interaction.reply({
                content: "You do not have permission to use this command.",
                ephemeral: true,
            });
        }

        const serverList = interaction.client.guilds.cache
            .map(guild => {
                return [
                    `**${guild.name}**`,
                    `Members: ${guild.memberCount}`,
                    `Server ID: \`${guild.id}\``,
                ].join("\n");
            })
            .join("\n\n");

        const embed = new EmbedBuilder()
            .setTitle(`🖥️ TT Tools Servers (${interaction.client.guilds.cache.size})`)
            .setDescription(serverList || "The bot is not connected to any servers.")
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true,
        });
    },
};